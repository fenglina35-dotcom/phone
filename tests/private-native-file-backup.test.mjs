import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {createRequire} from 'node:module';
import os from 'node:os';
import cp from 'node:child_process';
import {read as versionedRead} from './_helpers.mjs';
import { REL, vre, iosProject } from './_helpers.mjs';

const root=path.resolve(import.meta.dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const prefix='native/private-small-phone/XcodeProject/';
const bundle=prefix+'PhoneCompanionTest/PhoneWeb.bundle/';
const bridge=read(prefix+'PhoneCompanionTest/PhoneNativeBridge.swift');
const webView=read(prefix+'PhoneCompanionTest/LocalPhoneWebView.swift');
const project=iosProject(read(prefix+'PhoneCompanionTest.xcodeproj/project.pbxproj'));
const backup=read(bundle+'private-cloud-backup.js');
const privateApp=read(bundle+'app.js');
const publicApp=read('app.js');

test('private v1355 loads daily backup after the diagnostic overlay while public advances independently',()=>{
  for(const name of ['index.html','小手机.html']){
    const html=read(bundle+name);
    assert.match(html,vre(String.raw`window\.__NORTH_SHELL_BUILD__='{PRIV}'`));
    assert.ok(html.indexOf(`private-cloud-backup.js?v=${REL.private}`)>html.indexOf('private-runtime-diagnostics.js?v=339'));
  }
  assert.match(privateApp,vre(String.raw`APP_VER='v{PRIV} · {PRIVLABEL}'`));
  assert.match(publicApp,vre(String.raw`APP_VER='v{WEB} · {WEBLABEL}'`));
  assert.equal((project.match(vre(String.raw`CURRENT_PROJECT_VERSION = {IOS};`, 'g'))||[]).length,12);
  assert.equal((project.match(vre(String.raw`MARKETING_VERSION = 1.0.{IOS};`, 'g'))||[]).length,12);
});

test('web backup sends bounded ordered chunks and records a day only after confirmed save',()=>{
  assert.match(backup,/const CHUNK=192\*1024/);
  assert.match(backup,/account\.backup\.file\.begin/);
  assert.match(backup,/blob\.slice\(offset,offset\+CHUNK\)\.arrayBuffer\(\)/);
  assert.match(backup,/account\.backup\.file\.chunk/);
  assert.match(backup,/account\.backup\.file\.commit/);
  assert.match(backup,/account\.backup\.file\.abort/);
  assert.ok(backup.indexOf('if(!result.saved)')<backup.indexOf('write({allowed:true,lastDay:day()'));
  assert.match(backup,/recoveryStateMeaningful\(recoveryStateStats\(S\)\)/);
  assert.match(backup,/cloudAt>\(local\.capturedAt\|\|0\)\+1/);
  assert.match(backup,/document\.hidden/);
  assert.match(backup,/Date\.now\(\)-_privatePhoneLastInteractionAt<90000/);
});

test('native bridge persists account-bound backup chunks and confirms a small manifest',()=>{
  const dispatch=bridge.slice(bridge.indexOf('case "account.status"'),bridge.indexOf('case "robot.speech.transcribe"'));assert(dispatch.includes('"account.backup.capabilities"'),'capability probe must reach native account dispatch');
  for(const action of ['begin','chunk','commit','abort'])assert.match(bridge,new RegExp(`account\\.backup\\.file\\.${action}`));
  assert.match(bridge,/static let contractVersion = 42/);
  assert.match(bridge,/private actor PrivateBackupFileStore/);
  assert.match(bridge,/offset == current\.written/);
  assert.match(bridge,/current\.owner == owner/);
  assert.match(bridge,/data\.count <= 262144/);
  assert.match(bridge,/current\.written == current\.size/);
  assert.match(bridge,/privateBackupChunkBytes = 4 \* 1_024 \* 1_024/);
  assert.match(bridge,/PrivateBackupUploadProgressDelegate/);
  assert.match(bridge,/account\.backup\.file\.progress/);
  assert.match(bridge,/\/storage\/v1\/object\//);
  assert.match(bridge,/from: part/);
  assert.match(bridge,/save_private_phone_backup_manifest/);
  assert.match(bridge,/private_phone_backup_files/);
  assert.match(bridge,/restorePrivateBackupFile/);
  assert.match(bridge,/actualChecksum == expectedChecksum/);
  assert.doesNotMatch(bridge,/Data\("\{\\"p_payload\\":"\.utf8\)/);
  assert.match(bridge,/backup_upload_timeout/);
  assert.match(bridge,/backup_storage_failed/);
  assert.match(bridge,/nativeError\.domain == "PrivateBackupStorage"/);
  assert.match(bridge,/nativeError\.domain == "PrivateBackupManifest"/);
  assert.match(backup,/正在上传私人云备份/);
  assert.match(bridge,/config\.timeoutIntervalForRequest = 180/);
  assert.match(bridge,/config\.timeoutIntervalForResource = 600/);
  assert.match(bridge,/row\?\["saved"\] as\? Bool == true/);
  assert.match(bridge,/await PrivateBackupFileStore\.shared\.remove\(token: token\)/);
  assert.match(webView,/action === 'account\.backup\.file\.commit' \? 1800000 : 60000/);
  assert.match(backup,/account\.backup\.file\.commit',\{token\},1920000/);
});


test('actual backup SQL retains full backups, isolates partial snapshots and protects lost-ACK objects',async()=>{
 const require=createRequire(import.meta.url),{PGlite}=require(path.join(os.homedir(),'AppData/Local/CodexHardwareTests/robot-voice-sql-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
 const db=new PGlite(),u='10000000-0000-0000-0000-000000000001',s='20000000-0000-0000-0000-000000000001',secondary='20000000-0000-0000-0000-000000000002';
 try{
  await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;create role service_role bypassrls;
   create table auth.users(id uuid primary key);insert into auth.users values('${u}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.owner',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('session_id',current_setting('test.session',true))$$;
   grant usage on schema auth,storage to authenticated;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(name text primary key,bucket_id text,owner_id text);alter table storage.objects enable row level security;
   grant select,insert,delete on storage.objects to authenticated;
   create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  for(const f of ['202608110001_private_phone_accounts.sql','202609210001_private_phone_backup_files.sql','202611170001_private_phone_device_sync.sql','202611170003_private_phone_primary_device.sql'])await db.exec(read('supabase/migrations/'+f));
  const phone=(await db.query("select public.private_phone_sync_device($1,$2,'iOS','phone',null) value",[u,s])).rows[0].value.id;
  await db.query("select public.private_phone_sync_device($1,$2,'macOS','secondary',null)",[u,secondary]);
  await db.query('insert into private_phone_sync_primary(user_id,device_id) values($1,$2)',[u,phone]);
  const oldMode=process.env.FIX_TEST_OLD==='1';
  if(!oldMode)await db.exec(read('supabase/migrations/202611190002_private_phone_backup_preservation.sql'));
  await db.query("select set_config('test.owner',$1,false),set_config('test.session',$2,false)",[u,s]);
  const prefix=n=>u+'/'+String(n).padStart(8,'0')+'-0000-0000-0000-000000000000';
  for(let i=1;i<=6;i++)await db.query("insert into storage.objects values($1,'private-phone-backups',$2)",[prefix(i)+'/part-00000.bin',u]);
  await db.exec('set role authenticated');
  const commit=async(n,missing=0)=>{const args=[new Date(1700000000000+n*1000).toISOString(),'fixture','a'.repeat(64),100,prefix(n),1,100];return (await db.query('select * from public.'+(oldMode?'save_private_phone_backup_manifest':'save_private_phone_backup_manifest_v2')+'('+args.map((_,i)=>'$'+(i+1)).join(',')+(oldMode?'':',$8')+')',oldMode?args:[...args,missing])).rows[0];};
  assert.equal((await commit(1)).saved,true);assert.equal((await commit(2)).saved,true);
  const deleted=await db.query('delete from storage.objects where name=$1 returning name',[prefix(1)+'/part-00000.bin']);
  assert.equal(deleted.rows.length,0,'the previous backup must survive old-client cleanup');
  assert.equal((await commit(3,177)).saved,true);
  assert.equal((await db.query('select storage_prefix from private_phone_backup_files')).rows[0].storage_prefix,prefix(2),'partial never overwrites full backup');
  assert.equal((await commit(4,178)).saved,true);
  for(const n of [1,2,3,4])assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[prefix(n)+'/part-00000.bin'])).rows.length,0);
  const info=(await db.query('select public.private_phone_backup_info_v2() value')).rows[0].value;
  assert.equal(info.backup.missing_images,178);assert.equal(info.backup.storage_prefix,prefix(4));
  assert.equal((await commit(4,178)).saved,true,'retry of exact manifest is idempotent');
  assert.equal((await commit(3,177)).saved,false,'older partial cannot replace latest');
  await assert.rejects(db.query("update private_phone_backup_files set storage_prefix='foreign'"),/permission denied/);
  await db.query("select set_config('test.session',$1,false)",[secondary]);
  await assert.rejects(commit(5),/backup_primary_required/);
  await assert.rejects(db.query('select * from save_private_phone_backup_manifest($1,$2,$3,$4,$5,$6,$7)',[new Date().toISOString(),'old','b'.repeat(64),100,prefix(5),1,100]),/backup_primary_required/);
  await db.query("select set_config('test.session',$1,false)",[s]);
  assert.equal((await commit(5)).saved,true);
  assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[prefix(5)+'/part-00000.bin'])).rows.length,0,'lost commit ACK cleanup cannot delete committed data');
  assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[prefix(6)+'/part-00000.bin'])).rows.length,1,'unreferenced failed uploads remain cleanable');
  await assert.rejects(commit(7),/backup_parts_missing/,'cleanup before publication must never produce a dangling manifest');
  await db.exec('reset role');await db.query("insert into storage.objects values($1,'private-phone-backups',$2)",[prefix(6)+'/part-00000.bin',u]);
  const mac=(await db.query('select id from private_phone_sync_devices where session_id=$1',[secondary])).rows[0].id;
  await db.query('select public.private_phone_sync_promote($1,$2,$3,1)',[u,secondary,mac]);await db.exec('set role authenticated');
  await assert.rejects(commit(6),/backup_primary_required/,'a primary transfer invalidates the old phone at commit time');
  await db.query("select set_config('test.session',$1,false)",[secondary]);assert.equal((await commit(6)).saved,true);
  await db.exec('reset role');await db.query('update private_phone_sync_devices set revoked_at=now() where id=$1',[mac]);await db.exec('set role authenticated');
  await assert.rejects(commit(7),/backup_primary_not_verified/);await assert.rejects(db.query('select private_phone_backup_info_v2()'),/backup_session_unavailable/);
  await db.exec('reset role');
  const beforeRetirement=JSON.stringify((await db.query('select * from private_phone_backup_files')).rows);
  await db.exec(read('supabase/migrations/202611190003_private_phone_backup_authority.sql'));
  assert.equal(JSON.stringify((await db.query('select * from private_phone_backup_files')).rows),beforeRetirement,'retirement never rewrites backup data');
  await db.query("insert into storage.objects values($1,'private-phone-backups',$2)",[prefix(7)+'/part-00000.bin',u]);await db.exec('set role authenticated');
  const local=(await db.query('select private_phone_backup_info_v2() value')).rows[0].value;assert.equal(local.deviceSyncRetired,true);assert.equal(local.owner,u);
  assert.equal((await commit(7)).saved,true,'valid account backup no longer depends on device synchronization roles');
  assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[prefix(7)+'/part-00000.bin'])).rows.length,0,'retirement retains published backup protection');
  await db.query("select set_config('test.session','30000000-0000-0000-0000-000000000099',false)");
  assert.equal((await db.query('select private_phone_backup_info_v2() value')).rows[0].value.owner,u,'an existing account needs no device registration to inspect its backup');
  await db.query("select set_config('test.owner','30000000-0000-0000-0000-000000000098',false)");
  assert.equal((await db.query('select private_phone_backup_info_v2() value')).rows[0].value.backup,null,'removing device policy never exposes another account backup');
  assert.equal((await db.query('select * from private_phone_backup_preserved')).rows.length,0);
  await db.query("select set_config('test.owner','',false)");await assert.rejects(commit(8),/authentication required/);


 }finally{await db.close();}
});


test('actual native commit branch never cleans an upload after an unknown manifest reply', {skip:process.platform!=='darwin'},()=>{
 const source=versionedRead(prefix+'PhoneCompanionTest/PhoneNativeBridge.swift'),start=source.indexOf('                    let token = arguments["token"]',source.indexOf('case "account.backup.file.commit":')),end=source.indexOf('                case "account.backup.upload":',start),body=source.slice(start,end);
 assert(start>0&&end>start);
 const program=String.raw`import Foundation
struct Session { let userID="fixture-owner";let accessToken="fixture-token" }
struct Response { let status:Int;let body:Any? }
actor Deletes { static let shared=Deletes();var n=0;func add(){n+=1};func count()->Int{n};func reset(){n=0} }
enum Fixture {static var mode=0;static var uploads=0}
enum SmallPhoneDiagnosticsStore {static func append(_ name:String,fields:[String:Any]){}}
final class PrivateBackupUploadProgressDelegate {init(_ f:@escaping (Int64,Int64)->Void){}}
final class URLSession {
 init(configuration:URLSessionConfiguration){}
 func invalidateAndCancel(){}
 func upload(for request:URLRequest,from part:Data,delegate:PrivateBackupUploadProgressDelegate) async throws -> (Data,URLResponse) {
  Fixture.uploads+=1;if Fixture.mode==1 && Fixture.uploads==2 {throw URLError(.timedOut)}
  return (Data(),HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:nil,headerFields:nil)!)
 }
}
actor PrivateBackupFileStore {
 static let shared=PrivateBackupFileStore()
 struct Prepared {let bytes:Int64=4*1024*1024+3;let capturedAt:Double=1000;let build="fixture";let checksum=String(repeating:"a",count:64);let missingImages=177}
 func prepare(token:String,owner:String)throws->Prepared{Prepared()}
 func readPart(token:String,owner:String,offset:Int64,maximumBytes:Int)throws->Data{Data(repeating:1,count:min(maximumBytes,Int(Prepared().bytes-offset)))}
 func updateUploadProgress(token:String,owner:String,sentBytes:Int64,expectedBytes:Int64){}
 func remove(token:String){}
}
final class Bridge {
 static let privateBackupChunkBytes=4*1024*1024,privateAccountAPIKey="fixture"
 func validPrivateAccountSession() async throws->Session{Session()}
 func loadPrivateAccountSession()->Session?{Session()}
 func privateBackupObjectName(prefix:String,partIndex:Int)->String{prefix+"/part"}
 func privateBackupStorageURL(objectName:String)->URL{URL(string:"https://fixture.invalid/part")!}
 func privateAccountJSONRequest(path:String,method:String,body:[String:Any],bearer:String) async throws->Response {
  if Fixture.mode==0{throw URLError(.timedOut)}
  if Fixture.mode==2{return Response(status:403,body:[])}
  return Response(status:200,body:[["saved":true]])
 }
 func deletePrivateBackupParts(prefix:String,partCount:Int,session:Session) async{await Deletes.shared.add()}
 func reply(requestID:String,result:[String:Any]){}
 func run(arguments:[String:Any],requestID:String) async throws {
`+body+String.raw`
 }
}
for mode in [0,1,2,3] {
 Fixture.mode=mode;Fixture.uploads=0;await Deletes.shared.reset()
 let bridge=Bridge();try await bridge.run(arguments:["token":"fixture"],requestID:"fixture")
 try await Task.sleep(nanoseconds:20_000_000)
 let removed=await Deletes.shared.count()
 precondition(removed==(mode==1 ? 1:0),"unknown manifest reply must preserve parts; mode=\(mode), removed=\(removed)")
}
print("native-unknown-commit-protected")
`;
 assert(cp.execFileSync('swift',['-'],{input:program,encoding:'utf8',timeout:60000,maxBuffer:1024*1024}).includes('native-unknown-commit-protected'));
});
