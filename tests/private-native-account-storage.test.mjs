import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {read,ROOT} from './_helpers.mjs';

test('rollback followed by upgrade never silently picks a stale parallel owner directory', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
 const namespace=source.slice(source.indexOf('struct PrivateNativeStorageScope:'),source.indexOf('\nenum SmallPhoneDiagnosticsStore'));
 const program=`import Foundation\nimport CryptoKit\n${namespace}\n`+String.raw`
let f=FileManager.default,support=f.temporaryDirectory.appendingPathComponent("smallphone-source-collision-"+UUID().uuidString)
defer{try? f.removeItem(at:support)}
let owner="10000000-0000-0000-0000-000000000001",scope=PrivateNativeStorageScope(owner:owner,epoch:0)!
let legacy=support.appendingPathComponent("SmallPhonePrivateStore"),accounts=support.appendingPathComponent("SmallPhonePrivateAccounts"),parallel=accounts.appendingPathComponent(owner)
try f.createDirectory(at:legacy,withIntermediateDirectories:true);try f.createDirectory(at:parallel,withIntermediateDirectories:true)
try Data(owner.utf8).write(to:accounts.appendingPathComponent("legacy-owner.v1"))
let fresh=Data("restored-new-state".utf8),stale=Data("stale-candidate-state".utf8)
try fresh.write(to:legacy.appendingPathComponent("__core_state.json"));try stale.write(to:parallel.appendingPathComponent("__core_state.json"))
var blocked=false
do{_ = try PrivateNativeStorageNamespace.directory(support:support,scope:scope,legacyOwner:owner)}catch{blocked=true}
precondition(try! Data(contentsOf:legacy.appendingPathComponent("__core_state.json"))==fresh)
precondition(try! Data(contentsOf:parallel.appendingPathComponent("__core_state.json"))==stale)
print(blocked ? "ambiguous-boot-blocked":"silently-picked-parallel-state")
let approval:[String:Any] = ["version":2,"owner":owner,"source":"legacy","approvedCoreSHA256":String(repeating:"a",count:64)]
try JSONSerialization.data(withJSONObject:approval).write(to:accounts.appendingPathComponent("sync-source.v2.json"))
let selected=try PrivateNativeStorageNamespace.directory(support:support,scope:scope,legacyOwner:owner)
precondition(selected.path==legacy.path,"a reviewed pin selects the current 577 directory without moving either source")
precondition(try! Data(contentsOf:parallel.appendingPathComponent("__core_state.json"))==stale)
precondition(PrivateNativeStorageNamespace.approvedCoreDigest(support:support,scope:scope)==String(repeating:"a",count:64))
`;
 const output=cp.execFileSync('swift',['-'],{input:program,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
 assert(output.includes('ambiguous-boot-blocked'),'two surviving core directories must require explicit source resolution before boot or writes');
});

test('native account stores isolate files, atomically preserve legacy data and reject stale transfers', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
 if(!source.includes('struct PrivateNativeStorageScope:')){
  // The old implementation has no scope type. Exercise its actual directory/URL selector with
  // only Application Support redirected to a fixture, rather than failing on a missing symbol.
  const old=source.slice(source.indexOf('    nonisolated private func nativeStorageDirectory('),source.indexOf('    private func performLicenseRequest('))
   .replace(/FileManager\.default\.urls\([\s\S]*?\)\.first/,'[support].first');
  const program=String.raw`
import Foundation
import CryptoKit
let support=FileManager.default.temporaryDirectory.appendingPathComponent("smallphone-native-old-"+UUID().uuidString,isDirectory:true)
defer{try? FileManager.default.removeItem(at:support)}
final class LegacyStore {
 var currentOwner="A"
 func path()->URL?{nativeStorageURL(for:"__core_state")}
`+old+String.raw`
}
let store=LegacyStore(),first=store.path();store.currentOwner="B";let second=store.path()
print(first==second ? "cross-account-paths-collide":"account-storage-isolated")
`;
  const output=cp.execFileSync('swift',['-'],{input:program,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
  assert(output.includes('account-storage-isolated'),'old native directory selects the same core/recovery path after account changes');
  return;
 }
 const namespace=source.slice(source.indexOf('struct PrivateNativeStorageScope:'),source.indexOf('\nenum SmallPhoneDiagnosticsStore'));
 const action=source.slice(source.indexOf('    private func performStorageAction('),source.indexOf('    nonisolated private func replyScopedStorage(')).replace('private func performStorageAction(','func performStorageAction(');
 const helpers=source.slice(source.indexOf('    nonisolated private func nativeStorageDataWithRecovery('),source.indexOf('    nonisolated private func applyNativeStorageProtection('));
 const url=source.slice(source.indexOf('    private func nativeStorageURL('),source.indexOf('    private func performLicenseRequest('));
 const allowed=source.slice(source.indexOf('    private func nativeStorageReplyAllowed('),source.indexOf('    private var pendingSpeechEvents:'));
 const fixture=String.raw`
import Foundation
import CryptoKit
`+namespace+String.raw`
final class StorageFixture:@unchecked Sendable {
 struct Answer {let result:[String:Any]?;let error:String?}
 private struct NativeStorageReadSession {let data:Data;let expiresAt:TimeInterval;let scope:PrivateNativeStorageScope}
 let support:URL
 let legacyStorageOwner:String?
 let storageQueue=DispatchQueue(label:"fixture.storage")
 private var storageReadSessions:[String:NativeStorageReadSession]=[:]
 private let stateLock=NSLock(),replyLock=NSLock()
 private var active:PrivateNativeStorageScope
 private var answers:[String:Answer]=[:]
 private let arrived=DispatchSemaphore(value:0)
 init(support:URL,scope:PrivateNativeStorageScope,legacyOwner:String?){self.support=support;active=scope;self.legacyStorageOwner=legacyOwner}
 func switchScope(_ value:PrivateNativeStorageScope){stateLock.lock();active=value;stateLock.unlock()}
 private func currentNativeStorageScope()->PrivateNativeStorageScope?{stateLock.lock();defer{stateLock.unlock()};return active}
 private func nativeStorageDirectory(scope:PrivateNativeStorageScope)->URL?{try? PrivateNativeStorageNamespace.directory(support:support,scope:scope,legacyOwner:legacyStorageOwner)}
 private func applyNativeStorageProtection(to url:URL)throws{}
 private func reply(requestID:String,result:[String:Any]?=nil,error:String?=nil){replyLock.lock();answers[requestID]=Answer(result:result,error:error);replyLock.unlock();arrived.signal()}
 private func replyScopedStorage(_ scope:PrivateNativeStorageScope,requestID:String,result:[String:Any]?=nil,error:String?=nil){
  if !nativeStorageReplyAllowed(scope){reply(requestID:requestID,error:"storage_account_changed");return}
  reply(requestID:requestID,result:result,error:error)
 }
 func receive(_ id:String)->Answer{
  for _ in 0..<30{
   replyLock.lock();let value=answers.removeValue(forKey:id);replyLock.unlock();if let value{return value}
   _ = arrived.wait(timeout:.now()+0.1)
  }
  fatalError("fixture storage callback timed out")
 }
 func call(_ action:String,_ arguments:[String:Any])->Answer{let id=UUID().uuidString;var body=arguments;if body["owner"]==nil{body["owner"]=currentNativeStorageScope()?.owner ?? "guest"};performStorageAction(requestID:id,action:action,arguments:body);return receive(id)}
`+allowed+helpers+url+action+String.raw`
}
let files=FileManager.default
let root=files.temporaryDirectory.appendingPathComponent("smallphone-native-account-"+UUID().uuidString,isDirectory:true)
try files.createDirectory(at:root,withIntermediateDirectories:true)
defer{try? files.removeItem(at:root)}
let a="10000000-0000-0000-0000-000000000001",b="10000000-0000-0000-0000-000000000002"
let a0=PrivateNativeStorageScope(owner:a,epoch:0)!,a2=PrivateNativeStorageScope(owner:a,epoch:2)!,b1=PrivateNativeStorageScope(owner:b,epoch:1)!,b3=PrivateNativeStorageScope(owner:b,epoch:3)!
precondition(PrivateNativeStorageScope(owner:"../../escape",epoch:0)==nil)
func record(_ text:String)->Data{try! JSONSerialization.data(withJSONObject:["ver":1,"savedAt":10,"json":String(data:try! JSONSerialization.data(withJSONObject:["settings":[:],"text":text]),encoding:.utf8)!])}
let support=root.appendingPathComponent("first",isDirectory:true),old=support.appendingPathComponent("SmallPhonePrivateStore",isDirectory:true)
try files.createDirectory(at:old,withIntermediateDirectories:true)
let original=record(String(repeating:"private-A-only",count:16000)),legacyFile=old.appendingPathComponent("__core_state.json")
try original.write(to:legacyFile)
try Data("original-backup".utf8).write(to:old.appendingPathComponent("__recovery_history_state.backup.json"))
let inode=(try files.attributesOfItem(atPath:legacyFile.path))[.systemFileNumber] as! NSNumber
let fixture=StorageFixture(support:support,scope:a0,legacyOwner:a)
let readA=fixture.call("storage.get",["key":"__core_state"])
precondition(readA.error==nil && readA.result?["found"] as? Bool==true && readA.result?["chunked"] as? Bool==true)
let token=readA.result!["transferToken"] as! String
let aDirectory=support.appendingPathComponent("SmallPhonePrivateAccounts/"+a,isDirectory:true),aFile=aDirectory.appendingPathComponent("__core_state.json")
precondition(!files.fileExists(atPath:old.path),"legacy directory was renamed, not duplicated")
precondition(try! Data(contentsOf:aFile)==original)
precondition((try! files.attributesOfItem(atPath:aFile.path))[.systemFileNumber] as! NSNumber==inode,"same inode proves atomic same-volume move")
precondition(try! String(contentsOf:aDirectory.appendingPathComponent("__recovery_history_state.backup.json"),encoding:.utf8)=="original-backup")
fixture.switchScope(b1)
let readB=fixture.call("storage.get",["key":"__core_state"])
precondition(readB.result?["found"] as? Bool==false,"B cannot recover A files")
let cross=fixture.call("storage.get.chunk",["key":"__core_state","transferToken":token,"offset":0])
precondition(cross.error=="invalid_storage_transfer" && cross.result==nil)
fixture.switchScope(a2)
precondition(fixture.call("storage.get.chunk",["key":"__core_state","transferToken":token,"offset":0]).error=="invalid_storage_transfer","old same-user session cannot continue after reauthentication")
let fresh=fixture.call("storage.get",["key":"__core_state"]),freshToken=fresh.result!["transferToken"] as! String
fixture.storageQueue.suspend()
fixture.performStorageAction(requestID:"late-A",action:"storage.get.chunk",arguments:["key":"__core_state","owner":a,"transferToken":freshToken,"offset":0])
fixture.switchScope(b3);fixture.storageQueue.resume()
let late=fixture.receive("late-A")
precondition(late.error=="storage_account_changed" && late.result==nil,"late A payload never reaches B")
fixture.performStorageAction(requestID:"missing-owner",action:"storage.get",arguments:["key":"__core_state"])
precondition(fixture.receive("missing-owner").error=="storage_account_changed","logged-in requests require explicit owner")
let oldAState=String(data:try JSONSerialization.data(withJSONObject:["settings":[:],"_deviceSyncOwner":a,"text":"late-A"]),encoding:.utf8)!
precondition(fixture.call("storage.put",["key":"__core_state","owner":a,"ver":1,"savedAt":30,"stateJSON":oldAState]).error=="storage_account_changed","old JS A payload cannot be redirected to B")
precondition(fixture.call("storage.put",["key":"__core_state","owner":b,"ver":1,"savedAt":30,"stateJSON":oldAState]).error=="storage_account_changed","body owner mismatch is rejected even if envelope claims B")
let unmarked=String(data:try JSONSerialization.data(withJSONObject:["settings":[:],"text":"unbound-old-data"]),encoding:.utf8)!
precondition(fixture.call("storage.put",["key":"__core_state","owner":b,"ver":1,"savedAt":30,"stateJSON":unmarked]).error=="storage_account_changed","B cannot write an unmarked legacy snapshot")
precondition(!files.fileExists(atPath:support.appendingPathComponent("SmallPhonePrivateAccounts/"+b+"/__core_state.json").path),"rejected old payloads never create B core contents")
let bState=String(data:try JSONSerialization.data(withJSONObject:["settings":[:],"text":"B-only","_deviceSyncOwner":b]),encoding:.utf8)!
precondition(fixture.call("storage.put",["key":"__core_state","ver":1,"savedAt":20,"stateJSON":bState]).result?["saved"] as? Bool==true)
precondition(try! Data(contentsOf:aFile)==original,"B writes do not change A")
let bHead=fixture.call("storage.get",["key":"__core_state","primaryOnly":true]).result!["contentSHA256"] as! String
let committed=fixture.call("storage.put",["key":"__core_state","ver":1,"savedAt":21,"stateJSON":bState,"expectedSHA256":bHead])
precondition(committed.result?["saved"] as? Bool==true && committed.result?["parentSHA256"] as? String==bHead)
precondition(fixture.call("storage.put",["key":"__core_state","ver":1,"savedAt":40,"stateJSON":bState,"expectedSHA256":bHead]).error=="storage_revision_changed","a later timestamp cannot replace a committed different parent")
precondition(fixture.call("storage.delete",["key":"__core_state"]).result?["deleted"] as? Bool==true)
precondition(try! Data(contentsOf:aFile)==original,"B deletion does not remove A recovery data")
precondition(fixture.call("storage.get",["key":"../outside"]).error=="invalid_storage_key")

let guestSupport=root.appendingPathComponent("guest",isDirectory:true),guestOld=guestSupport.appendingPathComponent("SmallPhonePrivateStore",isDirectory:true)
try files.createDirectory(at:guestOld,withIntermediateDirectories:true);try original.write(to:guestOld.appendingPathComponent("__core_state.json"))
let guest=PrivateNativeStorageScope(owner:nil,epoch:0)!
let guestDirectory=try PrivateNativeStorageNamespace.directory(support:guestSupport,scope:guest,legacyOwner:nil)
precondition(guestDirectory.lastPathComponent=="Guest")
let laterB=try PrivateNativeStorageNamespace.directory(support:guestSupport,scope:b1,legacyOwner:b)
precondition(!files.fileExists(atPath:laterB.appendingPathComponent("__core_state.json").path),"later login cannot claim unowned legacy data")
precondition(try! Data(contentsOf:guestDirectory.appendingPathComponent("__core_state.json"))==original)
precondition(PrivateNativeStorageNamespace.recordedLegacyOwner(support:guestSupport)=="Guest")

let existingSupport=root.appendingPathComponent("existing",isDirectory:true),existingRoot=existingSupport.appendingPathComponent("SmallPhonePrivateAccounts",isDirectory:true)
let existingA=existingRoot.appendingPathComponent(a,isDirectory:true),existingOld=existingSupport.appendingPathComponent("SmallPhonePrivateStore",isDirectory:true)
try files.createDirectory(at:existingA,withIntermediateDirectories:true);try files.createDirectory(at:existingOld,withIntermediateDirectories:true)
try Data(a.utf8).write(to:existingRoot.appendingPathComponent("legacy-owner.v1"))
try Data("newer-owner-file".utf8).write(to:existingA.appendingPathComponent("__core_state.json"));try original.write(to:existingOld.appendingPathComponent("__core_state.json"))
_ = try PrivateNativeStorageNamespace.directory(support:existingSupport,scope:b1,legacyOwner:b)
precondition(try! String(contentsOf:existingA.appendingPathComponent("__core_state.json"),encoding:.utf8)=="newer-owner-file")
precondition(try! Data(contentsOf:existingOld.appendingPathComponent("__core_state.json"))==original,"existing target never overwrites unique legacy evidence")
precondition(PrivateNativeStorageNamespace.recordedLegacyOwner(support:existingSupport)==a)
// Pin only the actual restored file; this cannot silently approve future contents.
try files.createDirectory(at:old,withIntermediateDirectories:true)
let restoredCore=record("verified-restored-current"),restoredDigest=SHA256.hash(data:restoredCore).map{String(format:"%02x",$0)}.joined()
try restoredCore.write(to:old.appendingPathComponent("__core_state.json"))
let sourcePin:[String:Any]=["version":2,"owner":a,"source":"legacy","approvedCoreSHA256":restoredDigest]
try JSONSerialization.data(withJSONObject:sourcePin).write(to:support.appendingPathComponent("SmallPhonePrivateAccounts/sync-source.v2.json"))
fixture.switchScope(a2)
let pinned=fixture.call("storage.get",["key":"__core_state","primaryOnly":true])
precondition(pinned.result?["sourceApproval"] as? String==restoredDigest)
let aState=String(data:try JSONSerialization.data(withJSONObject:["settings":[:],"_deviceSyncOwner":a,"text":"next-committed-state"]),encoding:.utf8)!
precondition(fixture.call("storage.put",["key":"__core_state","ver":1,"savedAt":50,"stateJSON":aState,"expectedSHA256":restoredDigest]).result?["saved"] as? Bool==true)
precondition(fixture.call("storage.get",["key":"__core_state","primaryOnly":true]).result?["sourceApproval"]==nil,"approval applies to one immutable content, not arbitrary later snapshots")
precondition(try! Data(contentsOf:aFile)==original,"pin and approved write preserve the other source directory")
print("native-owner-storage-isolation-ok")
`;
 const output=cp.execFileSync('swift',['-'],{input:fixture,encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024});
 assert(output.includes('native-owner-storage-isolation-ok'));
 const replies=source.slice(source.indexOf('    nonisolated private func replyStorage('),source.indexOf('    private func performStorageStatus('));
 assert.equal((replies.match(/nativeStorageReplyAllowed\(scope\)/g)||[]).length,3,'all native return payload branches check the live account');
 assert(!action.includes('self.replyStorage('),'queued storage responses carry their captured owner');
 const bootstrap=source.slice(source.indexOf('    func publicAccountBootstrapScript()'),source.indexOf('    private func currentNativeStorageScope()'));
 assert(!/accessToken|refreshToken|password/.test(bootstrap));
 assert(bootstrap.includes('__SMALL_PHONE_NATIVE_ACCOUNT__')&&bootstrap.includes('__SMALL_PHONE_LEGACY_OWNER__'));
});

test('legacy owner capture retries failed storage without rebinding data to a later login', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
 const namespace=source.slice(source.indexOf('struct PrivateNativeStorageScope:'),source.indexOf('\nenum SmallPhoneDiagnosticsStore'));
 const method=source.slice(source.indexOf('    private func captureLegacyStorageOwnerIfNeeded()'),source.indexOf('    func accountWebsiteDataStore()'))
  .replaceAll('FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first','[support].first');
 const fixture=String.raw`
import Foundation
import CryptoKit
`+namespace+String.raw`
final class CaptureFixture {
 let support:URL
 private var legacyStorageOwnerCaptured=false
 private var legacyStorageOwner:String?
 private var legacyStorageNamespaceReady=false
 var owner="10000000-0000-0000-0000-000000000001"
 struct Session {let userID:String}
 init(_ support:URL){self.support=support}
 private func loadPrivateAccountSession()->Session?{Session(userID:owner)}
 func capture()->Bool{captureLegacyStorageOwnerIfNeeded();return legacyStorageNamespaceReady}
`+method+String.raw`
}
let files=FileManager.default, support=files.temporaryDirectory.appendingPathComponent("smallphone-owner-capture-"+UUID().uuidString)
defer{try? files.removeItem(at:support)}
try Data("blocked-directory".utf8).write(to:support)
let fixture=CaptureFixture(support)
precondition(!fixture.capture(),"an unwritable namespace cannot become ready")
fixture.owner="10000000-0000-0000-0000-000000000002"
precondition(!fixture.capture())
try files.removeItem(at:support)
precondition(fixture.capture(),"retry can recover after storage is writable")
precondition(PrivateNativeStorageNamespace.recordedLegacyOwner(support:support)=="10000000-0000-0000-0000-000000000001","original owner survives a failed persistence retry")
print("legacy-capture-retry-ok")
`;
 const out=cp.execFileSync('swift',['-'],{input:fixture,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});assert(out.includes('legacy-capture-retry-ok'));
 assert(source.includes('guard self.legacyStorageNamespaceReady else'),'a login cannot replace the current identity before legacy ownership persists');
});

test('native installation identity is stable, device-only and never reads the real Keychain in fixtures', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
 const helper=source.slice(source.indexOf('enum PrivateAccountInstallationID {'),source.indexOf('\nprivate final class PrivateDeviceSyncRedirectPolicy:'))
  .replaceAll('SecItemCopyMatching(','fixtureCopy(').replaceAll('SecItemAdd(','fixtureAdd(');
 const fixture=String.raw`
import Foundation
import CryptoKit
import Security
enum Fixture {
 static let lock=NSLock();static var stored:Data?;static var adds=0;static var deny=false
}
func fixtureCopy(_ query:CFDictionary,_ result:UnsafeMutablePointer<CFTypeRef?>?) -> OSStatus {
 Fixture.lock.lock();defer{Fixture.lock.unlock()}
 precondition((query as NSDictionary)[kSecAttrService] as? String == "com.qianyi.smallphone.account.installation.v1")
 if Fixture.deny{return errSecInteractionNotAllowed}
 guard let data=Fixture.stored else{return errSecItemNotFound}
 result?.pointee=data as CFData;return errSecSuccess
}
func fixtureAdd(_ query:CFDictionary,_ result:UnsafeMutablePointer<CFTypeRef?>?) -> OSStatus {
 Fixture.lock.lock();defer{Fixture.lock.unlock()}
 precondition((query as NSDictionary)[kSecAttrAccessible] as? String == kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
 if Fixture.stored != nil{return errSecDuplicateItem}
 Fixture.adds+=1;Fixture.stored=(query as NSDictionary)[kSecValueData] as? Data;return errSecSuccess
}
`+helper+String.raw`
let group=DispatchGroup(),lock=NSLock();var ids=[String]()
for _ in 0..<20 {group.enter();DispatchQueue.global().async{let id=try! PrivateAccountInstallationID.value();lock.lock();ids.append(id);lock.unlock();group.leave()}}
group.wait();precondition(Set(ids).count==1 && Fixture.adds==1 && UUID(uuidString:ids[0]) != nil)
precondition(try! PrivateAccountInstallationID.value()==ids[0])
Fixture.stored=Data("corrupt-preserve-me".utf8)
do{_ = try PrivateAccountInstallationID.value();fatalError("invalid existing ID overwritten")}catch{}
precondition(Fixture.stored==Data("corrupt-preserve-me".utf8) && Fixture.adds==1)
Fixture.stored=nil;Fixture.deny=true
do{_ = try PrivateAccountInstallationID.value();fatalError("locked Keychain treated as missing")}catch{}
precondition(Fixture.stored==nil && Fixture.adds==1)
print("installation-fixture-ok")
`;
 const out=cp.execFileSync('swift',['-'],{input:fixture,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
 assert(out.includes('installation-fixture-ok'));
});

test('native WebKit identities preserve the legacy store and isolate accounts and guest sessions', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
 const selector=source.slice(source.indexOf('enum PrivateNativeWebsiteStoreIdentity {'),source.indexOf('\nextension Notification.Name {'));
 const fixture='import Foundation\n'+selector+String.raw`
let a="10000000-0000-0000-0000-000000000001",b="10000000-0000-0000-0000-000000000002"
precondition(PrivateNativeWebsiteStoreIdentity.identifier(owner:a,legacyOwner:a)==nil,"legacy A keeps existing default WebKit store")
precondition(PrivateNativeWebsiteStoreIdentity.identifier(owner:b,legacyOwner:a)==UUID(uuidString:b),"B receives its own persistent WebKit store")
let guest=PrivateNativeWebsiteStoreIdentity.identifier(owner:nil,legacyOwner:a)
precondition(guest != nil && guest != UUID(uuidString:a) && guest != UUID(uuidString:b))
precondition(PrivateNativeWebsiteStoreIdentity.identifier(owner:nil,legacyOwner:nil)==nil,"original guest remains default")
precondition(PrivateNativeWebsiteStoreIdentity.identifier(owner:a,legacyOwner:nil)==UUID(uuidString:a),"later login cannot claim guest store")
precondition(PrivateNativeWebsiteStoreIdentity.identifier(owner:b,legacyOwner:a)==PrivateNativeWebsiteStoreIdentity.identifier(owner:b,legacyOwner:a),"persistent across document recreation")
print("account-webstore-identity-ok")
`;
 const out=cp.execFileSync('swift',['-'],{input:fixture,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});assert(out.includes('account-webstore-identity-ok'));
 const view=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift'),root=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/SmallPhonePrivateRootView.swift');
 assert(view.includes('configuration.websiteDataStore = context.coordinator.bridge.accountWebsiteDataStore()'));
 assert(source.includes('WKWebsiteDataStore(forIdentifier: identifier)'));
 assert(root.includes('.id("\\(webViewGeneration):\\(accountDocumentEpoch)")'));
 assert(!root.includes('SmallPhoneUsageReportMountView().id'),'account changes must not remount the companion report');
});

test('two native bridge instances cannot both commit against one predecessor', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
 const shared=source.match(/enum PrivateNativeStorageWork \{[\s\S]*?\n\}/)?.[0]||'';
 const declaration=source.match(/private let storageQueue = PrivateNativeStorageWork\.shared/)?.[0]||source.match(/private let storageQueue = DispatchQueue\([\s\S]*?\n    \)/)?.[0];assert(declaration);
 const program=`import Foundation\n${shared}\nfinal class FixtureBridge {\n${declaration}\n`+String.raw`
 func attempt(_ value:String){storageQueue.async{let previous=cell.read();ready.signal();_ = release.wait(timeout:.now()+3);if previous=="parent"{cell.commit(value)};finished.leave()}}
}
final class Cell: @unchecked Sendable {
 let lock=NSLock();var value="parent",writes=0
 func read()->String{lock.lock();defer{lock.unlock()};return value}
 func commit(_ next:String){lock.lock();defer{lock.unlock()};value=next;writes+=1}
}
let cell=Cell(),ready=DispatchSemaphore(value:0),release=DispatchSemaphore(value:0),finished=DispatchGroup()
let first=FixtureBridge(),second=FixtureBridge();finished.enter();finished.enter();first.attempt("first");second.attempt("second")
_ = ready.wait(timeout:.now()+1);_ = ready.wait(timeout:.now()+0.1);release.signal();release.signal()
precondition(finished.wait(timeout:.now()+5) == .success)
print("native-predecessor-commits=\(cell.writes)")
`;
 const out=cp.execFileSync('swift',['-'],{input:program,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});assert(out.includes('native-predecessor-commits=1'),'both bridges accepted the same old parent: '+out.trim());
});


test('read-only native snapshot pins WAL state, rejects changing cores and never replaces evidence', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
 const start=source.indexOf('enum PrivateReadOnlySnapshot {');
 const engine=start<0?'':source.slice(start,source.indexOf('// One foreground-only job',start));
 const program=`import Foundation\nimport CryptoKit\nimport SQLite3\n${engine}\n`+String.raw`
let f=FileManager.default,root=f.temporaryDirectory.appendingPathComponent("smallphone-snapshot-test-"+UUID().uuidString)
defer{try? f.removeItem(at:root)}
let library=root.appendingPathComponent("Library"),store=library.appendingPathComponent("Application Support/SmallPhonePrivateStore"),web=library.appendingPathComponent("WebKit/WebsiteData/Default/IndexedDB/test")
try f.createDirectory(at:store,withIntermediateDirectories:true);try f.createDirectory(at:web,withIntermediateDirectories:true)
let owner="10000000-0000-0000-0000-000000000001",core=store.appendingPathComponent("__core_state.json"),dbURL=web.appendingPathComponent("IndexedDB.sqlite3")
let state=String(data:try JSONSerialization.data(withJSONObject:["_deviceSyncOwner":owner,"messages":[:]]),encoding:.utf8)!
let original=try JSONSerialization.data(withJSONObject:["json":state,"ver":1,"savedAt":1])
try original.write(to:core)
var db:OpaquePointer?;precondition(sqlite3_open(dbURL.path,&db)==SQLITE_OK)
defer{sqlite3_close(db)}
precondition(sqlite3_exec(db,"PRAGMA journal_mode=WAL;CREATE TABLE t(value);INSERT INTO t VALUES(7);CREATE TABLE BlobFiles(fileName);INSERT INTO BlobFiles VALUES('1.blob');",nil,nil,nil)==SQLITE_OK)
try Data("audio-original".utf8).write(to:web.appendingPathComponent("1.blob"))
let destination=root.appendingPathComponent("snapshot")
`+(start<0?String.raw`
// Actual historical strategy copied the main database and missed its active WAL.
try f.createDirectory(at:destination,withIntermediateDirectories:true)
try f.copyItem(at:dbURL,to:destination.appendingPathComponent("IndexedDB.sqlite3"))
var copied:OpaquePointer?;sqlite3_open_v2(destination.appendingPathComponent("IndexedDB.sqlite3").path,&copied,SQLITE_OPEN_READONLY,nil)
var statement:OpaquePointer?;let ready=sqlite3_prepare_v2(copied,"SELECT value FROM t",-1,&statement,nil)==SQLITE_OK
let matches=ready && sqlite3_step(statement)==SQLITE_ROW && sqlite3_column_int(statement,0)==7
sqlite3_finalize(statement);sqlite3_close(copied)
precondition(matches,"raw main-file copy loses the committed WAL state")
`:String.raw`
var wrote=false
try PrivateReadOnlySnapshot.create(library:library,store:store,webRoot:web,extras:[],destination:destination,owner:owner,check:{},progress:{_,_ in
 if !wrote {wrote=true;precondition(sqlite3_exec(db,"UPDATE t SET value=8",nil,nil,nil)==SQLITE_OK)}
})
let copied=destination.appendingPathComponent("Library/WebKit/WebsiteData/Default/IndexedDB/test/IndexedDB.sqlite3")
var output:OpaquePointer?;precondition(sqlite3_open_v2(copied.path,&output,SQLITE_OPEN_READONLY,nil)==SQLITE_OK)
var query:OpaquePointer?;precondition(sqlite3_prepare_v2(output,"SELECT value FROM t",-1,&query,nil)==SQLITE_OK)
precondition(sqlite3_step(query)==SQLITE_ROW && sqlite3_column_int(query,0)==7,"snapshot must retain its pinned version despite concurrent writes")
sqlite3_finalize(query);sqlite3_close(output)
let proof=try Data(contentsOf:destination.appendingPathComponent("backup-manifest.json"))
var blocked=false
do{try PrivateReadOnlySnapshot.create(library:library,store:store,webRoot:web,extras:[],destination:destination,owner:owner,check:{},progress:{_,_ in})}catch{blocked=true}
precondition(blocked && (try! Data(contentsOf:destination.appendingPathComponent("backup-manifest.json")))==proof,"existing proof must be preserved")
let changing=root.appendingPathComponent("changing")
blocked=false
do{try PrivateReadOnlySnapshot.create(library:library,store:store,webRoot:web,extras:[],destination:changing,owner:owner,check:{},progress:{_,_ in try! Data("changed".utf8).write(to:core)})}catch{blocked=true}
precondition(blocked && !f.fileExists(atPath:changing.path),"changed core may not publish a complete manifest")
try original.write(to:core)
try f.removeItem(at:web.appendingPathComponent("1.blob"))
blocked=false
let missing=root.appendingPathComponent("missing")
do{try PrivateReadOnlySnapshot.create(library:library,store:store,webRoot:web,extras:[],destination:missing,owner:owner,check:{},progress:{_,_ in})}catch{blocked=true}
precondition(blocked && !f.fileExists(atPath:missing.path),"missing referenced blob must reject complete proof")
let cancelled=root.appendingPathComponent("cancelled")
blocked=false
do{try PrivateReadOnlySnapshot.create(library:library,store:store,webRoot:web,extras:[],destination:cancelled,owner:owner,check:{throw PrivateReadOnlySnapshot.failure("cancelled")},progress:{_,_ in})}catch{blocked=true}
precondition(blocked && !f.fileExists(atPath:cancelled.path),"cancelled job must not publish")
precondition((try! Data(contentsOf:core))==original,"source core must never be written by the snapshot")
print("snapshot-wal-core-blob-cancel-evidence-verified")
`);
 const output=cp.execFileSync('swift',['-'],{input:program,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
 assert(output.includes('snapshot-wal-core-blob-cancel-evidence-verified'));
});


test('native snapshot job produces a ZIP, scopes status and preserves its completed artifact on reopen', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
 const engine=source.slice(source.indexOf('enum PrivateReadOnlySnapshot {'),source.indexOf('// PRIVATE_NATIVE_CAS_GLOBAL_QUEUE_V1:'));
 const program=`import Foundation\nimport CryptoKit\nimport SQLite3\n${engine}\n`+String.raw`
let f=FileManager.default,root=f.temporaryDirectory.appendingPathComponent("smallphone-snapshot-job-"+UUID().uuidString)
defer{try? f.removeItem(at:root)}
let library=root.appendingPathComponent("Library"),store=library.appendingPathComponent("Application Support/SmallPhonePrivateStore"),web=library.appendingPathComponent("WebKit/WebsiteData/Default/IndexedDB/test")
try f.createDirectory(at:store,withIntermediateDirectories:true);try f.createDirectory(at:web,withIntermediateDirectories:true)
let owner="10000000-0000-0000-0000-000000000001"
let state=String(data:try JSONSerialization.data(withJSONObject:["_deviceSyncOwner":owner,"messages":[:]]),encoding:.utf8)!
try JSONSerialization.data(withJSONObject:["json":state,"ver":1,"savedAt":1]).write(to:store.appendingPathComponent("__core_state.json"))
var db:OpaquePointer?;precondition(sqlite3_open(web.appendingPathComponent("IndexedDB.sqlite3").path,&db)==SQLITE_OK)
precondition(sqlite3_exec(db,"CREATE TABLE t(value);INSERT INTO t VALUES(7)",nil,nil,nil)==SQLITE_OK);sqlite3_close(db)
let jobs=PrivateReadOnlySnapshotJobs.shared
let first=try jobs.begin(library:library,store:store,webRoot:web,extras:[],owner:owner),token=first["token"] as! String
var status=first
for _ in 0..<2000 {
 status=try jobs.status(owner:owner,token:token)
 if !["copying","packaging"].contains(status["phase"] as! String){break}
 Thread.sleep(forTimeInterval:0.01)
}
precondition(status["phase"] as? String == "ready",String(describing:status))
let archive=try jobs.archive(owner:owner,token:token),before=try PrivateReadOnlySnapshot.digest(archive)
let handle=try FileHandle(forReadingFrom:archive);let prefix=try handle.read(upToCount:2);try handle.close();precondition(prefix==Data([0x50,0x4b]))
var denied=false;do{_ = try jobs.status(owner:"10000000-0000-0000-0000-000000000002",token:token)}catch{denied=true};precondition(denied)
denied=false;do{_ = try jobs.archive(owner:owner,token:"wrong-token")}catch{denied=true};precondition(denied)
let repeated=try jobs.begin(library:library,store:store,webRoot:web,extras:[],owner:owner)
precondition(repeated["phase"] as? String == "ready")
precondition((try! PrivateReadOnlySnapshot.digest(archive))==before,"existing archive may not be replaced on another click")
let process=Process();process.executableURL=URL(fileURLWithPath:"/usr/bin/unzip");process.arguments=["-tqq",archive.path];let output=Pipe();process.standardOutput=output;process.standardError=output;try process.run();process.waitUntilExit();precondition(process.terminationStatus==0)

precondition((status["capturedAt"] as? Double ?? 0)>0)
denied=false;do{try jobs.remove(owner:owner,token:token,confirmed:false)}catch{denied=true};precondition(denied)
_ = try jobs.archive(owner:owner,token:token,beginSharing:true)
denied=false;do{try jobs.remove(owner:owner,token:token,confirmed:true)}catch{denied=true};precondition(denied,"a sharing file cannot be deleted")
jobs.finishSharing(owner:owner,token:token)
let coreBefore=try Data(contentsOf:store.appendingPathComponent("__core_state.json"))
try jobs.remove(owner:owner,token:token,confirmed:true)
for _ in 0..<2000 {if try jobs.status(owner:owner,token:token)["phase"] as? String != "removing" {break};Thread.sleep(forTimeInterval:0.01)}
precondition(!f.fileExists(atPath:archive.path))
precondition((try! Data(contentsOf:store.appendingPathComponent("__core_state.json")))==coreBefore,"explicit staging cleanup must never delete or alter the live core")
let next=try jobs.begin(library:library,store:store,webRoot:web,extras:[],owner:owner),nextToken=next["token"] as! String
precondition(nextToken != token)
var final=next
for _ in 0..<2000 {final=try jobs.status(owner:owner,token:nextToken);if final["phase"] as? String=="ready" || final["phase"] as? String=="failed" {break};Thread.sleep(forTimeInterval:0.01)}
precondition(final["phase"] as? String=="ready",String(describing:final))
// A killed previous generation has no proof. Retry must retain its unique bytes.
try jobs.remove(owner:owner,token:nextToken,confirmed:true)
for _ in 0..<2000 {if try jobs.status(owner:owner,token:nextToken)["phase"] as? String != "removing" {break};Thread.sleep(forTimeInterval:0.01)}
let stageRoot=library.appendingPathComponent("Application Support/SmallPhoneReadOnlyBackup")
let failedStage=stageRoot.appendingPathComponent("Snapshot")
try f.createDirectory(at:failedStage,withIntermediateDirectories:true)
let unique=Data("unique-interrupted-evidence".utf8)
try unique.write(to:failedStage.appendingPathComponent("evidence.bin"))
try JSONSerialization.data(withJSONObject:["owner":owner]).write(to:stageRoot.appendingPathComponent("job.json"))
let blocked=try jobs.begin(library:library,store:store,webRoot:web,extras:[],owner:owner)
precondition(blocked["phase"] as? String=="failed")
let retry=try jobs.begin(library:library,store:store,webRoot:web,extras:[],owner:owner,retryFailed:true)
var retried=retry
for _ in 0..<2000 {retried=try jobs.status(owner:owner,token:(retry["token"] as! String));if retried["phase"] as? String=="ready" || retried["phase"] as? String=="failed" {break};Thread.sleep(forTimeInterval:0.01)}
precondition(retried["phase"] as? String=="ready",String(describing:retried))
precondition((try! Data(contentsOf:stageRoot.appendingPathComponent("FailedSnapshot/evidence.bin")))==unique)
precondition((try! Data(contentsOf:store.appendingPathComponent("__core_state.json")))==coreBefore)
print("snapshot-job-zip-owner-evidence-verified")
`;
 const output=cp.execFileSync('swift',['-'],{input:program,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});assert(output.includes('snapshot-job-zip-owner-evidence-verified'));
});


test('snapshot WebKit paths select canonical account UUIDs and never fall back to the default owner', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'),start=source.indexOf('enum PrivateNativeWebsiteStoreIdentity {'),end=source.indexOf('\nextension Notification.Name',start);
 const program='import Foundation\n'+source.slice(start,end)+String.raw`
let library=FileManager.default.temporaryDirectory.appendingPathComponent("missing-snapshot-owner-"+UUID().uuidString)
let owner=UUID(uuidString:"abcdef00-0000-0000-0000-000000000001")!
let scoped=PrivateNativeWebsiteStoreIdentity.snapshotDirectory(library:library,identifier:owner)
precondition(scoped.lastPathComponent==owner.uuidString.lowercased())
precondition(scoped.path.contains("/WebsiteDataStore/"))
let defaultStore=PrivateNativeWebsiteStoreIdentity.snapshotDirectory(library:library,identifier:nil)
precondition(defaultStore.lastPathComponent=="WebsiteData" && defaultStore != scoped)
print("snapshot-owner-path-verified")
`;
 assert(cp.execFileSync('swift',['-'],{input:program,encoding:'utf8',timeout:60000}).includes('snapshot-owner-path-verified'));
});


test('native snapshot hashing has bounded resident memory for a large file and preserves its SHA', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'),a=source.indexOf('    static func digest('),b=source.indexOf('    static func checked(',a),fixture=ROOT+'/.codex_tmp/snapshot-hash-memory-fixture';
 fs.mkdirSync(ROOT+'/.codex_tmp',{recursive:true});const handle=fs.openSync(fixture,'wx',0o600);fs.ftruncateSync(handle,256*1024*1024);fs.closeSync(handle);
 const hash=crypto.createHash('sha256'),chunk=Buffer.alloc(1024*1024);for(let i=0;i<256;i++)hash.update(chunk);const expected=hash.digest('hex');
 const program='import Foundation\nimport CryptoKit\nimport Darwin\nenum Reader {\n'+source.slice(a,b)+'}\n'+String.raw`
func resident()->UInt64 {var info=mach_task_basic_info_data_t();var count=mach_msg_type_number_t(MemoryLayout<mach_task_basic_info_data_t>.size/MemoryLayout<natural_t>.size);let code=withUnsafeMutablePointer(to:&info){$0.withMemoryRebound(to:integer_t.self,capacity:Int(count)){task_info(mach_task_self_,task_flavor_t(MACH_TASK_BASIC_INFO),$0,&count)}};precondition(code==KERN_SUCCESS);return info.resident_size}
`+`let file=URL(fileURLWithPath:${JSON.stringify(fixture)})\n`+String.raw`
let result=try autoreleasepool { () throws -> [String:Any] in
 let before=resident(),sha=try Reader.digest(file),after=resident()
 return ["sha256":sha,"growthMiB":Double(after>before ? after-before:0)/1048576]
}
print(String(data:try JSONSerialization.data(withJSONObject:result),encoding:.utf8)!)
`;
 try{const result=JSON.parse(cp.execFileSync('swift',['-'],{input:program,encoding:'utf8',timeout:60000,maxBuffer:1024*1024}));assert.equal(result.sha256,expected);console.log(JSON.stringify({snapshotHashFixtureMiB:256,residentGrowthMiB:result.growthMiB}));assert(result.growthMiB<64,'256 MiB file hashing retained '+result.growthMiB.toFixed(1)+' MiB; each block must drain its Foundation autorelease pool');}
 finally{fs.unlinkSync(fixture);}
});
