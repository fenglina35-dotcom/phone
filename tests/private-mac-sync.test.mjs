import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import {read} from './_helpers.mjs';

test('Mac account: native login, renewal and account races keep credentials isolated', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionMac/MacPhoneBridge.swift');
 const actor=source.slice(source.indexOf('private final class MacAccountRedirectPolicy:'))
  .replaceAll('SecItemCopyMatching(','fixtureCopy(').replaceAll('SecItemUpdate(','fixtureUpdate(')
  .replaceAll('SecItemAdd(','fixtureAdd(').replaceAll('SecItemDelete(','fixtureDelete(')
  .replace('let config = URLSessionConfiguration.ephemeral','let config = URLSessionConfiguration.ephemeral\nconfig.protocolClasses = [FixtureProtocol.self]');
 const fixture=String.raw`
import Foundation
import Security
enum Fixture {
 static let lock=NSLock()
 static var stored:Data?
 static var refreshes=0
 static var calls=0
 static var logoutLocal=false
 static var expired=false
}
func fixtureCopy(_ query:CFDictionary,_ result:UnsafeMutablePointer<CFTypeRef?>?) -> OSStatus {
 Fixture.lock.lock();defer{Fixture.lock.unlock()}
 guard let data=Fixture.stored else{return errSecItemNotFound}
 result?.pointee=data as CFData;return errSecSuccess
}
func fixtureUpdate(_ query:CFDictionary,_ change:CFDictionary) -> OSStatus {
 Fixture.lock.lock();defer{Fixture.lock.unlock()}
 guard Fixture.stored != nil else{return errSecItemNotFound}
 Fixture.stored=(change as NSDictionary)[kSecValueData] as? Data;return errSecSuccess
}
func fixtureAdd(_ query:CFDictionary,_ ignored:UnsafeMutablePointer<CFTypeRef?>?) -> OSStatus {
 Fixture.lock.lock();defer{Fixture.lock.unlock()}
 Fixture.stored=(query as NSDictionary)[kSecValueData] as? Data;return errSecSuccess
}
func fixtureDelete(_ query:CFDictionary) -> OSStatus {
 Fixture.lock.lock();defer{Fixture.lock.unlock()};Fixture.stored=nil;return errSecSuccess
}
final class FixtureProtocol:URLProtocol,@unchecked Sendable {
 override class func canInit(with request:URLRequest)->Bool{return true}
 override class func canonicalRequest(for request:URLRequest)->URLRequest{return request}
 override func stopLoading(){}
 override func startLoading(){
  precondition(request.url?.host=="qvuahlqimcfgeoetosnl.supabase.co")
  var raw=request.httpBody
  if raw==nil,let stream=request.httpBodyStream {
   stream.open();defer{stream.close()};var bytes=Data(),buffer=[UInt8](repeating:0,count:4096)
   while true {let n=stream.read(&buffer,maxLength:buffer.count);if n<=0{break};bytes.append(contentsOf:buffer.prefix(n))}
   raw=bytes
  }
  let url=request.url!,body=(raw.flatMap{try? JSONSerialization.jsonObject(with:$0)} as? [String:Any]) ?? [:]
  var result:Any=[],status=200,delay:Double=0
  Fixture.lock.lock();Fixture.calls+=1
  if url.path.hasPrefix("/auth/") {
   if url.path.hasSuffix("logout") {Fixture.logoutLocal=url.query=="scope=local";result=[:]}
   else if url.query=="grant_type=refresh_token" {
    Fixture.refreshes+=1;delay=0.05
    result=["access_token":"fixture-refreshed-access","refresh_token":"fixture-rotated-refresh","expires_in":3600,"user":["id":"owner-refresh"]]
   } else if body["password"] as? String == "wrong-password" {status=400;result=["error":"invalid"]}
   else {
    let email=body["email"] as? String ?? ""
    precondition(email.hasPrefix("smallphone.86") && email.hasSuffix("@example.com"))
    if email.contains("13900000001") {delay=0.15}
    result=["access_token":"fixture-access","refresh_token":"fixture-refresh","expires_in":Fixture.expired ? -5:3600,"user":["id":email]]
   }
  }
  Fixture.lock.unlock()
  let bytes=try! JSONSerialization.data(withJSONObject:result)
  let response=HTTPURLResponse(url:url,statusCode:status,httpVersion:"HTTP/1.1",headerFields:["Content-Type":"application/json"])!
  DispatchQueue.global().asyncAfter(deadline:.now()+delay){[self] in
   client?.urlProtocol(self,didReceive:response,cacheStoragePolicy:.notAllowed)
   client?.urlProtocol(self,didLoad:bytes);client?.urlProtocolDidFinishLoading(self)
  }
 }
}
`;
 const run=String.raw`
Task {
 do {
  let account=MacPhoneAccount()
  let login=try await account.handle("account.password.signin",["phone":"+86 13900000000","password":"fixture-password"])
  precondition(JSONSerialization.isValidJSONObject(login), "WebKit-safe public status")
  precondition(login["maskedPhone"] as? String == "139****0000", "public phone mask")
  precondition(!String(describing:login).contains("fixture-access"), "no token in public status")
  let previous=Fixture.stored
  do{_ = try await account.handle("account.password.signin",["phone":"13900000000","password":"wrong-password"]);fatalError("accepted wrong password")}catch{}
  precondition(Fixture.stored==previous, "failed login preserves previous session")
  let before=Fixture.calls
  do{_ = try await account.handle("account.backup.file.begin",[:]);fatalError("overwrote phone backup")}catch{}
  precondition(Fixture.calls==before && Fixture.stored==previous, "unsupported backup does not submit")
  _ = try await account.handle("account.signout",[:])
  precondition(Fixture.logoutLocal && Fixture.stored==nil, "logout stays local")
  let older=Task{try? await account.handle("account.password.signin",["phone":"13900000001","password":"fixture-password"])}
  try await Task.sleep(nanoseconds:20_000_000)
  _ = try await account.handle("account.password.signin",["phone":"13900000002","password":"fixture-password"])
  _ = await older.value
  let latest=try await account.handle("account.status",[:])
  precondition((latest["userId"] as? String)?.contains("13900000002")==true, "newer login wins")
  Fixture.expired=true
  _ = try await account.handle("account.password.signin",["phone":"13900000003","password":"fixture-password"])
  async let first=account.handle("account.backup.info",[:])
  async let second=account.handle("account.backup.info",[:])
  _ = try await (first,second)
  precondition(Fixture.refreshes==1, "single concurrent refresh")
  let stored=try JSONSerialization.jsonObject(with:Fixture.stored!) as! [String:Any]
  precondition(stored["refresh"] as? String == "fixture-rotated-refresh", "rotated refresh persisted")
  print("native-account-isolation-ok");exit(0)
 } catch {print("native-account-test-failed");exit(1)}
}
dispatchMain()
`;
 const output=cp.execFileSync('swift',['-'],{input:fixture+actor+run,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
 assert(output.includes('native-account-isolation-ok'));
});
