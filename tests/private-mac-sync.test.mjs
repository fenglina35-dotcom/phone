import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {read, REL, iosProject, macProjectConfigurations} from './_helpers.mjs';
import {createSyncHandler, createSupabaseSync} from '../supabase/functions/phone-device-sync/core.mjs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

test('Mac account: native login, renewal and account races keep credentials isolated', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionMac/MacPhoneBridge.swift');
 const native=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
 const sync=native.slice(native.indexOf('// PRIVATE_DEVICE_SYNC_V1:'),native.lastIndexOf('#if os(macOS)'))
  .replace('let config = URLSessionConfiguration.ephemeral','let config = URLSessionConfiguration.ephemeral\nconfig.protocolClasses = [FixtureProtocol.self]');
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
  } else if url.path=="/functions/v1/phone-device-sync" {
   precondition(body["platform"] as? String == "macOS" && body["userId"]==nil && body["sessionId"]==nil)
   precondition(request.value(forHTTPHeaderField:"Authorization")=="Bearer fixture-refreshed-access")
   result=["ok":true,"device":["id":"fixture-device"]]
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
  let synced=try await account.handle("account.sync",["action":"register","label":"电脑","platform":"iOS","userId":"forged","sessionId":"forged"])
  precondition(synced["ok"] as? Bool == true, "fixed native account sync endpoint")
  let beforeInvalid=Fixture.calls
  do{_ = try await account.handle("account.sync",["action":"arbitrary-proxy","url":"https://example.com"]);fatalError("allowed arbitrary proxy")}catch{}
  precondition(Fixture.calls==beforeInvalid)
  print("native-account-isolation-ok");exit(0)
 } catch {print("native-account-test-failed");exit(1)}
}
dispatchMain()
`;
 const output=cp.execFileSync('swift',['-'],{input:fixture+sync+actor+run,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
 assert(output.includes('native-account-isolation-ok'));
});


test('Mac target has two coherent version configurations while original iOS targets retain twelve',()=>{
 const project=read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj'),mac=macProjectConfigurations(project);
 assert.equal(mac.length,2);
 for(const config of mac){assert(config.includes('CURRENT_PROJECT_VERSION = '+REL.ios+';'));assert(config.includes('MARKETING_VERSION = 1.0.'+REL.ios+';'));}
 assert.equal((iosProject(project).match(/CURRENT_PROJECT_VERSION = /g)||[]).length,12);
 assert.equal((project.match(/CURRENT_PROJECT_VERSION = /g)||[]).length,14);
});

test('iPhone account refresh coalesces sync/backup requests and cannot revive a signed-out session', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
 const methods=source.slice(source.indexOf('    private func privateAccountSession('),source.indexOf('    private struct PrivateAccountHTTPResponse'));
 const fixture=String.raw`
import Foundation
@MainActor final class AccountFixture {
 private struct PrivateAccountSession:Codable {
  let accessToken:String,refreshToken:String;let expiresAt:TimeInterval;let userID:String,phone:String
 }
 private struct PrivateAccountHTTPResponse {let status:Int;let body:Any?}
 private var privateAccountRenewal:Task<PrivateAccountSession,Error>?
 private var privateAccountEpoch=0
 private var stored:PrivateAccountSession? = PrivateAccountSession(accessToken:"expired",refreshToken:"old",expiresAt:0,userID:"owner",phone:"+8613900000000")
 var calls=0,saves=0,fail=false
 private func loadPrivateAccountSession()->PrivateAccountSession?{stored}
 private func savePrivateAccountSession(_ session:PrivateAccountSession)throws{stored=session;saves+=1}
 private func privateAccountJSONRequest(path:String,method:String,body:[String:Any])async throws->PrivateAccountHTTPResponse{
  precondition(path=="/auth/v1/token?grant_type=refresh_token" && method=="POST" && body["refresh_token"] as? String=="old")
  calls+=1;try await Task.sleep(nanoseconds:60_000_000)
  return PrivateAccountHTTPResponse(status:fail ? 503:200,body:["access_token":"new","refresh_token":"rotated","expires_in":3600,"user":["id":"owner"]])
 }
 func signOut(){privateAccountEpoch+=1;privateAccountRenewal?.cancel();privateAccountRenewal=nil;stored=nil}
 func get()async throws->String{try await validPrivateAccountSession().accessToken}
 func exists()->Bool{stored != nil}
 func refresh()->String{stored?.refreshToken ?? ""}
`;
 const run=String.raw`
}
Task { @MainActor in
 do{
  let account=AccountFixture()
  async let first=account.get();async let second=account.get()
  let values=try await(first,second)
  precondition(values.0=="new" && values.1=="new" && account.calls==1 && account.saves==1 && account.refresh()=="rotated")
  let failure=AccountFixture();failure.fail=true
  do{_ = try await failure.get();fatalError("accepted failed refresh")}catch{}
  precondition(failure.exists() && failure.refresh()=="old" && failure.saves==0)
  failure.fail=false;_ = try await failure.get();precondition(failure.calls==2 && failure.saves==1)
  let signedOut=AccountFixture()
  let pending=Task{try? await signedOut.get()}
  try await Task.sleep(nanoseconds:10_000_000);signedOut.signOut();_ = await pending.value
  precondition(!signedOut.exists() && signedOut.saves==0)
  print("phone-refresh-isolation-ok");exit(0)
 }catch{print("phone-refresh-isolation-failed");exit(1)}
}
dispatchMain()
`;
 const output=cp.execFileSync('swift',['-'],{input:fixture+methods+run,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
 assert(output.includes('phone-refresh-isolation-ok'));
});

test('private device journal: account isolation, CAS conflicts, retries and revocation preserve data',async()=>{
 const require=createRequire(import.meta.url),{PGlite}=require(path.join(os.homedir(),'AppData/Local/CodexHardwareTests/robot-voice-sql-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
 const db=new PGlite(),owner='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002';
 const phoneSession='20000000-0000-0000-0000-000000000001',macSession='20000000-0000-0000-0000-000000000002',otherSession='20000000-0000-0000-0000-000000000003';
 const mid=n=>'30000000-0000-0000-0000-'+String(n).padStart(12,'0');
 try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;
   create table public.private_phone_backups(user_id uuid,payload jsonb);insert into public.private_phone_backups values('${owner}','{"original":"untouched"}');
   insert into auth.users values('${owner}'),('${other}');`);
  await db.exec(read('supabase/migrations/202611170001_private_phone_device_sync.sql'));
  const rpc=async(name,args)=>(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') value',args)).rows[0].value;
  const register=(user,session,platform)=>rpc('private_phone_sync_device',[user,session,platform,platform]);
  const phone=await register(owner,phoneSession,'iOS'),mac=await register(owner,macSession,'macOS'),foreign=await register(other,otherSession,'macOS');
  assert.equal((await register(owner,macSession,'macOS')).id,mac.id);
  await assert.rejects(rpc('private_phone_sync_seed',[owner,macSession,mac.id,false]),/seed_requires_phone/);
  assert.equal((await rpc('private_phone_sync_seed',[owner,phoneSession,phone.id,false])).phase,'pending');
  await assert.rejects(rpc('private_phone_sync_seed',[owner,macSession,mac.id,false]),/seed_in_progress/);
  await assert.rejects(rpc('private_phone_sync_seed',[owner,phoneSession,phone.id,true]),/empty_seed/);
  const changes=(device,session,rows)=>rpc('private_phone_sync_apply',[owner,session,device,JSON.stringify(rows)]);
  const change=(n,key,baseRevision,ciphertext='opaque-ciphertext',deleted=false)=>({key,baseRevision,mutationId:mid(n),ciphertext,deleted,digest:String(n%10).repeat(64)});
  const key='state/chat/main/role-a/one',first=change(1,key,0);
  const applied=await changes(phone.id,phoneSession,[first]);assert.equal(applied.outcomes[0].status,'applied');
  await rpc('private_phone_sync_seed',[owner,phoneSession,phone.id,true]);
  assert.deepEqual(await changes(phone.id,phoneSession,[first]),applied,'lost acknowledgement never creates another revision');
  await assert.rejects(changes(phone.id,phoneSession,[{...first,digest:'z'.repeat(64)}]),/mutation_payload_changed/);
  const conflict=await changes(mac.id,macSession,[change(2,key,0,'mac-edit')]);assert.equal(conflict.outcomes[0].status,'conflict');
  assert.equal((await db.query('select ciphertext from private_phone_sync_records where record_key=$1',[key])).rows[0].ciphertext,'opaque-ciphertext');
  assert.equal((await db.query('select ciphertext from private_phone_sync_conflicts')).rows[0].ciphertext,'mac-edit');
  const pending=(await rpc('private_phone_sync_inspect',[owner,phoneSession,phone.id])).conflicts;
  assert.equal(pending.length,1);
  const accepted=await rpc('private_phone_sync_resolve',[owner,phoneSession,phone.id,pending[0].id,'candidate',1,mid(50),'r'.repeat(64)]);
  assert.equal(accepted.resolved,true);
  assert.deepEqual(await rpc('private_phone_sync_resolve',[owner,phoneSession,phone.id,pending[0].id,'candidate',1,mid(50),'r'.repeat(64)]),accepted);
  await assert.rejects(rpc('private_phone_sync_resolve',[owner,phoneSession,phone.id,pending[0].id,'server',1,mid(51),'s'.repeat(64)]),/mutation_payload_changed/);
  assert.equal((await db.query('select ciphertext from private_phone_sync_records where record_key=$1',[key])).rows[0].ciphertext,'mac-edit');
  await changes(mac.id,macSession,[change(3,'state/chat/main/role-a/two',0)]);
  const pull=(user,session,device,after='0')=>rpc('private_phone_sync_pull',[user,session,device,after]);
  assert.equal((await pull(owner,phoneSession,phone.id)).records.length,2);
  assert.equal((await pull(other,otherSession,foreign.id)).records.length,0);
  await assert.rejects(pull(owner,phoneSession,foreign.id),/device_revoked_or_unknown/);
  await changes(phone.id,phoneSession,[change(4,key,2,null,true)]);
  assert.equal((await changes(mac.id,macSession,[change(5,key,1,'stale-edit')])).outcomes[0].status,'conflict');
  assert.equal((await db.query('select deleted from private_phone_sync_records where record_key=$1',[key])).rows[0].deleted,true);
  await rpc('private_phone_sync_revoke',[owner,phoneSession,phone.id,mac.id]);
  await assert.rejects(pull(owner,macSession,mac.id),/device_revoked_or_unknown/);
  await assert.rejects(register(owner,macSession,'macOS'),/device_revoked/);
  await assert.rejects(rpc('private_phone_sync_revoke',[other,otherSession,foreign.id,phone.id]),/device_not_found/);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from private_phone_sync_records'),/permission denied/);
  await assert.rejects(register(owner,phoneSession,'iOS'),/permission denied/);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select payload from private_phone_backups')).rows[0].payload,{original:'untouched'});
 }finally{await db.close();}
});

test('encrypted native sync: real SQL/crypto isolate accounts, preserve retries, conflicts and bounded pages',async()=>{
 const require=createRequire(import.meta.url),{PGlite}=require(path.join(os.homedir(),'AppData/Local/CodexHardwareTests/robot-voice-sql-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
 const db=new PGlite(),a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002';
 const identities={phone:{userID:a,sessionID:'20000000-0000-0000-0000-000000000001'},mac:{userID:a,sessionID:'20000000-0000-0000-0000-000000000002'},other:{userID:b,sessionID:'20000000-0000-0000-0000-000000000003'}};
 const mid=n=>'40000000-0000-0000-0000-'+String(n).padStart(12,'0');
 try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;
   insert into auth.users values('${a}'),('${b}');`);
  await db.exec(read('supabase/migrations/202611170001_private_phone_device_sync.sql'));
  const calls=[],objects=new Map();
  const store={
   async putBlob(key,bytes){if(!objects.has(key))objects.set(key,new Uint8Array(bytes));},
   async getBlob(key){if(!objects.has(key))throw new Error('media_unavailable');return objects.get(key);},
   async key(owner,candidate){
    await db.query('insert into private_phone_sync_keys(user_id,wrapped_key) values($1,$2) on conflict(user_id) do nothing',[owner,candidate]);
    return (await db.query('select wrapped_key from private_phone_sync_keys where user_id=$1',[owner])).rows[0].wrapped_key;
   },
   async rpc(name,args){calls.push({name,args});return (await db.query('select public.'+name+'('+Object.keys(args).map((k,i)=>k+'=>$'+(i+1)).join(',')+') value',Object.values(args).map(x=>Array.isArray(x)?JSON.stringify(x):x))).rows[0].value;}
  };
  const handler=createSyncHandler({store,authenticate:async token=>identities[token],masterKey:'a'.repeat(43),cryptoAPI:webcrypto});
  const send=async(token,body,headers={})=>{
   const response=await handler(new Request('https://example.test/sync',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...headers},body:JSON.stringify(body)}));
   const json=await response.json();assert.equal(response.headers.get('Cache-Control'),'no-store');return {status:response.status,json};
  };
  const phone=(await send('phone',{action:'register',platform:'iOS',label:'手机'})).json.device.id;
  const mac=(await send('mac',{action:'register',platform:'macOS',label:'电脑'})).json.device.id;
  const other=(await send('other',{action:'register',platform:'macOS',label:'另一账号'})).json.device.id;
  assert.equal((await send('mac',{action:'seed',deviceId:mac,finish:false})).json.error,'seed_requires_phone');
  assert.equal((await send('phone',{action:'seed',deviceId:phone,finish:false})).json.seed.phase,'pending');
  assert.equal((await send('mac',{action:'push',deviceId:mac,changes:[]})).json.error,'seed_not_ready');
  assert.equal((await send('phone',{action:'seed',deviceId:phone,finish:true})).json.error,'empty_seed');
  const make=(n,key,value,base='0')=>({mutationId:mid(n),key,baseRevision:base,deleted:false,value});
  const first=make(1,'state/chat/main/role-a/message-a',{text:'秘密聊天内容',apiKey:'fixture-only-secret'});
  const push=(token,device,changes)=>send(token,{action:'push',deviceId:device,changes});
  const initial=await push('phone',phone,[first]);assert.equal(initial.json.outcomes[0].status,'applied');
  assert.equal((await send('phone',{action:'seed',deviceId:phone,finish:true})).json.seed.phase,'ready');
  assert.deepEqual((await push('phone',phone,[first])).json,initial.json);
  const raw=(await db.query('select ciphertext from private_phone_sync_records')).rows[0].ciphertext;
  assert(!raw.includes('秘密')&&!raw.includes('fixture-only-secret'));
  assert(!JSON.stringify((await db.query('select * from private_phone_sync_keys')).rows).includes('fixture-only-secret'));
  assert.equal((await push('phone',phone,[{...first,value:{text:'changed'}}])).json.error,'mutation_payload_changed');
  const pulled=(await send('mac',{action:'pull',deviceId:mac,cursor:'0',userId:b})).json;
  assert.deepEqual(pulled.records[0].value,first.value);assert(!JSON.stringify(pulled).includes('ciphertext'));
  assert.equal((await send('other',{action:'pull',deviceId:other})).json.records.length,0);
  assert.equal((await send('other',{action:'pull',deviceId:mac})).json.error,'device_revoked_or_unknown');
  const media=new TextEncoder().encode('fixture-private-picture-bytes');
  const mediaHash=Buffer.from(await webcrypto.subtle.digest('SHA-256',media)).toString('hex');
  const upload={action:'media.put',deviceId:phone,hash:mediaHash,base64:Buffer.from(media).toString('base64url')};
  assert.equal((await send('phone',upload)).status,200);
  assert.equal(objects.size,1);const encryptedMedia=[...objects.values()][0];
  assert(!Buffer.from(encryptedMedia).includes(Buffer.from('fixture-private-picture-bytes')));
  await send('phone',upload);assert.equal(objects.size,1);assert.deepEqual([...objects.values()][0],encryptedMedia,'existing encrypted media is immutable');
  assert.equal((await send('mac',{action:'media.get',deviceId:mac,hash:mediaHash})).json.base64,upload.base64);
  assert.equal((await send('other',{action:'media.get',deviceId:other,hash:mediaHash})).json.ok,false,'another account has a distinct private media address');
  assert.equal((await send('phone',{...upload,hash:'0'.repeat(64)})).json.error,'media_integrity_failed');
  assert.equal((await db.query('select count(*) as n from private_phone_sync_records')).rows[0].n,1,'media body is not duplicated into database records');
  assert.equal((await push('mac',mac,[make(2,first.key,{text:'电脑离线修改'})])).json.outcomes[0].status,'conflict');
  const inspect=(await send('mac',{action:'inspect',deviceId:mac})).json;
  assert.equal(inspect.conflicts.length,1);assert(!JSON.stringify(inspect).includes('电脑离线修改'));
  const id=inspect.conflicts[0].id;
  assert.equal((await send('mac',{action:'conflict',deviceId:mac,conflictId:id})).json.conflict.value.text,'电脑离线修改');
  const choice={action:'resolve',deviceId:mac,conflictId:id,choice:'candidate',baseRevision:'1',mutationId:mid(3)};
  const resolved=(await send('mac',choice)).json;assert.equal(resolved.resolved,true);
  assert.deepEqual((await send('mac',choice)).json,resolved,'resolution acknowledgement can be retried');
  assert.equal((await send('phone',{action:'pull',deviceId:phone})).json.records[0].value.text,'电脑离线修改');
  const before=calls.length;
  assert.equal((await send('phone',{action:'inspect',deviceId:phone},{Origin:'null'})).status,403);
  assert.equal(calls.length,before,'provider/browser origins never reach account database');
  assert.equal((await push('mac',mac,[make(4,'state/__proto__/bad',{})])).json.error,'invalid_record_key');
  assert.equal((await push('mac',mac,[make(4,'state/large','x'.repeat(240001))])).status,413);
  assert.equal((await send('mac',{action:'push',deviceId:mac,changes:[],padding:'x'.repeat(3_000_001)})).status,413);
  // A copied or modified envelope cannot decrypt under another record's authenticated key.
  await db.query('update private_phone_sync_records set ciphertext=$1 where record_key=$2',[raw.slice(0,-4)+'AAAA',first.key]);
  const broken=await send('mac',{action:'pull',deviceId:mac});assert.equal(broken.json.error,'encrypted_data_unreadable');assert(!('cursor' in broken.json));
  await db.query('update private_phone_sync_records set ciphertext=$1 where record_key=$2',[raw,first.key]);
  // Actual encrypted large records exercise the SQL byte limit, then cursor continuation.
  const big=Array.from({length:5},(_,i)=>make(100+i,'blob/part-'+i,'中'.repeat(79000)));
  assert.equal((await push('phone',phone,big)).status,200);
  let page=(await send('mac',{action:'pull',deviceId:mac})).json,seen=[];
  assert.equal(page.more,true);assert(page.records.length<6);
  for(let i=0;i<5;i++){
   seen.push(...page.records.map(x=>x.key));if(!page.more)break;
   page=(await send('mac',{action:'pull',deviceId:mac,cursor:page.cursor})).json;
  }
  assert.equal(new Set(seen).size,6);assert.equal(seen.length,6);assert.equal(page.more,false);
  assert.equal((await send('phone',{action:'revoke',deviceId:phone,targetId:mac})).status,200);
  assert.equal((await send('mac',{action:'pull',deviceId:mac})).json.error,'device_revoked_or_unknown');
  assert.equal((await send('mac',{action:'register',platform:'macOS',label:'换名字重入'})).json.error,'device_revoked');
  assert.equal((await send('missing',{action:'register',platform:'macOS',label:'未知'})).status,401);
 }finally{await db.close();}
});

test('sync REST adapter verifies Auth before trusting session claims and never leaks service credentials',async()=>{
 const user='10000000-0000-0000-0000-000000000001',session='20000000-0000-0000-0000-000000000001',calls=[];
 const token='header.'+Buffer.from(JSON.stringify({sub:user,session_id:session,role:'authenticated',exp:Math.floor(Date.now()/1000)+300})).toString('base64url')+'.signature';
 let rejectAuth=false;
 const handler=createSupabaseSync({url:'https://fixture.supabase.co',serviceKey:'fixture-server-only-key',masterKey:'a'.repeat(43),fetchAPI:async(url,options)=>{
  const path=new URL(url).pathname;calls.push({path,options});
  assert.equal(options.redirect,'error');assert(options.signal);
  if(path==='/auth/v1/user'){
   assert.equal(options.headers.Authorization,'Bearer '+token);
   return new Response(JSON.stringify(rejectAuth?{message:'fixture-server-only-key'}:{id:user}),{status:rejectAuth?401:200});
  }
  assert.equal(options.headers.Authorization,'Bearer fixture-server-only-key');
  const args=JSON.parse(options.body);assert.equal(args.p_user,user);assert.equal(args.p_session,session);
  return Response.json({id:'30000000-0000-0000-0000-000000000001',platform:args.p_platform,label:args.p_label});
 }});
 const request=()=>new Request('https://fixture.test/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'register',platform:'macOS',label:'本机',userId:'forged'})});
 const good=await handler(request());assert.equal(good.status,200);assert.equal(calls.length,2);
 rejectAuth=true;
 const bad=await handler(request());assert.equal(bad.status,401);assert.equal(calls.length,3);assert(!(await bad.text()).includes('fixture-server-only-key'));
});

test('durable two-device journal merges message IDs, replays lost ACK/inbox and never retries unresolved edits',async()=>{
 const require=createRequire(import.meta.url),{PGlite}=require(path.join(os.homedir(),'AppData/Local/CodexHardwareTests/robot-voice-sql-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
 const db=new PGlite(),owner='10000000-0000-0000-0000-000000000001';
 const context=vm.createContext({crypto:webcrypto,TextEncoder,Uint8Array});
 vm.runInContext(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-device-sync.js'),context);
 const core=context.NorthPrivateDeviceSyncCore,copy=v=>JSON.parse(JSON.stringify(v));
 try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;insert into auth.users values('${owner}');`);
  await db.exec(read('supabase/migrations/202611170001_private_phone_device_sync.sql'));
  const store={async key(user,candidate){await db.query('insert into private_phone_sync_keys(user_id,wrapped_key) values($1,$2) on conflict(user_id) do nothing',[user,candidate]);return (await db.query('select wrapped_key from private_phone_sync_keys where user_id=$1',[user])).rows[0].wrapped_key;},
   async rpc(name,args){return (await db.query('select public.'+name+'('+Object.keys(args).map((k,i)=>k+'=>$'+(i+1)).join(',')+') value',Object.values(args).map(x=>Array.isArray(x)?JSON.stringify(x):x))).rows[0].value;}};
  const ids={phone:'20000000-0000-0000-0000-000000000001',mac:'20000000-0000-0000-0000-000000000002',fresh:'20000000-0000-0000-0000-000000000003'};
  const server=createSyncHandler({store,authenticate:async token=>({userID:owner,sessionID:ids[token]}),masterKey:'b'.repeat(43),cryptoAPI:webcrypto});
  function device(token,publish){
   const data={},disk=new Map(),requests=[];let currentOwner=owner,dropAck=false,failApply=false,switchDuringPull=false;
   const options={owner,platform:token==='phone'?'iOS':'macOS',label:token,getOwner:()=>currentOwner,canPublish:()=>publish,
    storage:{read:async user=>disk.has(user)?copy(disk.get(user)):null,write:async(user,value)=>{assert.equal(user,owner);disk.set(user,copy(value));}},
    snapshot:async()=>copy(data),
    async apply(rows,check){for(const row of rows){check();if(row.deleted)delete data[row.key];else data[row.key]=copy(row.value);if(failApply){failApply=false;throw new Error('fixture interrupted app save');}}},
    async transport(body){requests.push(copy(body));const response=await server(new Request('https://example.test/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)}));const result=await response.json();if(body.action==='push'&&dropAck){dropAck=false;throw new Error('fixture lost acknowledgement');}if(body.action==='pull'&&switchDuringPull){switchDuringPull=false;currentOwner='other-owner';}return result;}};
   let journal=core.createJournal(options);
   return {data,disk,requests,get journal(){return journal;},reopen(){journal.close();journal=core.createJournal(options);},publish(){publish=true;},loseAck(){dropAck=true;},interruptApply(){failApply=true;},switchAccountDuringPull(){switchDuringPull=true;}};
  }
  const phone=device('phone',true),mac=device('mac',false),a='state/chat/main/role/a',b='state/chat/main/role/b',c='state/chat/main/role/c';
  phone.data[a]={id:'a',text:'第一条'};await phone.journal.seed(false);await phone.journal.cycle();await phone.journal.seed(true);
  await mac.journal.cycle();assert.deepEqual(mac.data,phone.data);assert.equal(mac.requests.filter(x=>x.action==='push').length,0);
  mac.publish();mac.data[b]={id:'b',text:'电脑追加'};phone.data[c]={id:'c',text:'手机追加'};
  await phone.journal.cycle();await mac.journal.cycle();await phone.journal.cycle();
  assert.deepEqual(mac.data,phone.data);assert.equal(Object.keys(mac.data).length,3);
  phone.data[a].text='手机离线编辑';mac.data[a].text='电脑离线编辑';
  await phone.journal.cycle();await mac.journal.cycle();
  assert.equal(mac.data[a].text,'电脑离线编辑','local conflicting candidate remains recoverable');
  assert.equal(phone.data[a].text,'手机离线编辑','server accepted data is never silently overwritten');
  assert.equal((await mac.journal.inspect()).conflicts.length,1);
  const conflictCalls=mac.requests.filter(x=>x.action==='push').length;
  await mac.journal.cycle();await mac.journal.cycle();
  assert.equal(mac.requests.filter(x=>x.action==='push').length,conflictCalls,'blocked edits do not repeatedly call server');
  const extra='state/chat/main/role/lost';phone.data[extra]={id:'lost',text:'只发送一次'};
  phone.loseAck();await assert.rejects(phone.journal.cycle(),/lost acknowledgement/);
  const sent=phone.requests.filter(x=>x.action==='push').at(-1).changes.find(x=>x.key===extra);
  phone.reopen();await phone.journal.cycle();
  const retry=phone.requests.filter(x=>x.action==='push').at(-1).changes.find(x=>x.key===extra);
  assert.equal(retry.mutationId,sent.mutationId,'restart reuses the durable mutation UUID');
  assert.equal((await db.query('select revision from private_phone_sync_records where record_key=$1',[extra])).rows[0].revision,1);
  const fresh=device('fresh',false);fresh.interruptApply();await assert.rejects(fresh.journal.cycle(),/interrupted app save/);
  assert(fresh.disk.get(owner).inbox,'inbox is durable before app changes');
  fresh.reopen();await fresh.journal.cycle();assert.deepEqual(fresh.data,phone.data);assert(!fresh.disk.get(owner).inbox);
  const cursorBefore=fresh.journal.state().cursor,rowsBefore=copy(fresh.data);
  phone.data['state/new-after-switch']={text:'不能进入另一个账号'};await phone.journal.cycle();
  fresh.switchAccountDuringPull();await assert.rejects(fresh.journal.cycle(),/账号或设备已变化/);
  assert.equal(fresh.disk.get(owner).cursor,cursorBefore);assert.deepEqual(fresh.data,rowsBefore);
  delete phone.data[c];await phone.journal.cycle();
  assert.equal((await db.query('select deleted from private_phone_sync_records where record_key=$1',[c])).rows[0].deleted,true);
 }finally{await db.close();}
});
