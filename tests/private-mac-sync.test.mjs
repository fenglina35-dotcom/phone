import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {read, fnSource, REL, iosProject, macProjectConfigurations} from './_helpers.mjs';
import {createSyncHandler, createSupabaseSync} from '../supabase/functions/phone-device-sync/core.mjs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

function syncCodecFixture(){
 const ctx=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob});
 vm.runInContext(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-device-sync.js'),ctx);
 return ctx.NorthPrivateDeviceSyncCore.createStateCodec();
}

test('iPhone boot reads the native account before the later account UI binding leaves its temporal dead zone',()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'),owner='a1000000-0000-0000-0000-00000000abcd';
 const ctx=vm.createContext({window:{__SMALL_PHONE_ACCOUNT_SYNC__:true,__SMALL_PHONE_NATIVE_ACCOUNT__:{userId:owner.toUpperCase()},__SMALL_PHONE_LEGACY_OWNER__:owner}});
 vm.runInContext(fnSource(source,'privateAccountDataIdentity'),ctx);
 vm.runInContext('globalThis.bootOwner=privateAccountDataIdentity();let _privatePhoneAccount={loaded:false};globalThis.afterOwner=privateAccountDataIdentity();',ctx);
 assert.equal(ctx.bootOwner,owner,'load() runs before the account UI let initializer; a TDZ exception must not skip native identity');
 assert.equal(ctx.afterOwner,owner,'the same UUID namespace is used throughout boot');
});

test('legacy iPhone startup never substitutes a stale IndexedDB core after a guest-scope native read fails',async()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'),owner='10000000-0000-0000-0000-000000000001',calls=[];
 const current={ver:1,savedAt:200,json:JSON.stringify({settings:{model:'current'},me:{homeBg:'idb:current-wallpaper'},contacts:[{id:'kept'}],moments:[{id:'current'}],messages:{__idb:'messages'}})},stale={ver:1,savedAt:100,json:JSON.stringify({settings:{model:'stale'},me:{homeBg:'idb:old-wallpaper'},contacts:[{id:'deleted-role'}],moments:Array.from({length:49},(_,i)=>({id:'old'+i})),messages:{__idb:'messages'}})};
 const ctx=vm.createContext({window:{__SMALL_PHONE_ACCOUNT_SYNC__:true,__SMALL_PHONE_NATIVE_ACCOUNT__:{userId:owner,storageReady:true},__SMALL_PHONE_LEGACY_OWNER__:owner,SmallPhoneNative:{async request(action,body){calls.push({action,owner:body.owner});assert.equal(action,'storage.get','boot only reads');if(body.owner!==owner)throw new Error('storage_account_changed');return {found:true,primaryOnly:true,ver:1,savedAt:current.savedAt,stateJSON:current.json};}}},
  _privateNativeCoreHeads:new Map(),crypto:webcrypto,TextEncoder,localStorage:{getItem:()=>JSON.stringify({settings:{},__coreIdb:{ver:1,savedAt:200}})},KEY:'fixture',NORTH_PREVIEW:false,NORTH_ANDROID:false,CORE_IDB_KEY:'__core_state',RECOVERY_IDB_KEY:'__recovery_state',defState:()=>({settings:{},me:{},contacts:[],messages:{}}),
  privateNativeCoreStorageKey:()=>true,imgGetIDB:async()=>stale,storedTextBytes:x=>x.length,normalizeLoadedState:()=>{},recoveryStateStats:()=>({}),recoveryStateMeaningful:()=>true,TextDecoder,Uint8Array,atob,toast:()=>{},setTimeout:()=>0,imgPut:async()=>assert.fail('startup must not rewrite data'),writeCoreBootShell:()=>assert.fail('startup must not replace its source')});
 vm.runInContext('var _coreBootRef=null,_coreOverflowMode=false,_androidOrphanCoreProbe=false,_coreLogicalBytes=0;',ctx);
 for(const name of ['privateAccountDataIdentity','privateAccountLegacyIdentity','privateAccountStateIdentity','privateAccountShellMatches','privateAccountStorageReady','coreBootShell','mergeStateData','load','privateNativeCoreGet','privateVerifyCoreMirror','privateSelectStoredCore','newestStoredCore','imgGet','bootOverflowCore'])if(source.includes('function '+name+'('))vm.runInContext(fnSource(source,name),ctx);
 const result=await vm.runInContext('let S=load();let _privatePhoneAccount={loaded:false};bootOverflowCore().then(()=>({blocked:false,model:S.settings.model})).catch(error=>({blocked:true,error:error.message}));',ctx);
 assert(result.blocked||result.model==='current','an unreadable native scope must not select old wallpaper, settings and deleted records from IDB');
 assert.equal(calls[0].owner,owner,'the first native read already carries the correct account');
 assert.equal(JSON.parse(current.json).moments.length,1,'the native source is unchanged');
});

test('sync boot refuses divergent native and IndexedDB cores even when stale data has a newer save time',()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');
 const ctx=vm.createContext({window:{__SMALL_PHONE_ACCOUNT_SYNC__:true},privateAccountShellMatches:state=>!state._deviceSyncOwner||state._deviceSyncOwner==='account-a'});
 if(source.includes('function privateSelectStoredCore('))vm.runInContext(fnSource(source,'privateSelectStoredCore'),ctx);
 vm.runInContext(fnSource(source,'newestStoredCore'),ctx);
 const current={savedAt:10,json:JSON.stringify({settings:{model:'latest'},moments:[{id:'new'}]})},stale={savedAt:30,json:JSON.stringify({settings:{model:'old'},moments:[{id:'deleted-old'}]})};
 assert.throws(()=>ctx.newestStoredCore(current,stale),/不一致/,'a later autosave cannot authorize a rollback');
 const same={savedAt:40,json:JSON.stringify({...JSON.parse(current.json),_persistedAt:40})};assert.equal(ctx.newestStoredCore(current,same).json,same.json);
 assert.throws(()=>ctx.newestStoredCore({...current,json:JSON.stringify({settings:{},_deviceSyncOwner:'other-account'})},null),/归属/);
});

test('local deletions stay deleted when a later remote field is materialized',async()=>{
 const codec=syncCodecFixture(),state={settings:{hist:12},me:{},contacts:[{id:'a',name:'保留角色'},{id:'removed',name:'已删除角色'}],messages:{a:[{id:'keep',content:'保留'},{id:'removed',content:'已删除消息'}]},moments:[{id:'latest',text:'最新动态'}]};
 codec.setLocalProjection(await codec.project(state));
 state.contacts.pop();state.messages.a.pop();delete state.moments;
 codec.setLocalProjection(await codec.project(state));
 const remote=syncCodecFixture(),projection=await remote.project({...state,settings:{hist:32}});
 codec.accept(Object.entries(projection).filter(([,node])=>node.kind==='field'&&node.path[0]==='settings').map(([key,value])=>({key,value})));
 const materialized=(await codec.materialize()).state;
 assert.deepEqual(Array.from(materialized.contacts,x=>x.id),['a']);
 assert.deepEqual(Array.from(materialized.messages.a,x=>x.id),['keep']);
 assert.equal(Object.hasOwn(materialized,'moments'),false);
 assert.equal(materialized.settings.hist,32);
});

test('primary device requires fresh password, transfers atomically and alone can revoke another device',async()=>{
 const require=createRequire(import.meta.url),{PGlite}=require(path.join(os.homedir(),'AppData/Local/CodexHardwareTests/robot-voice-sql-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
 const db=new PGlite(),user='10000000-0000-0000-0000-000000000001',foreign='10000000-0000-0000-0000-000000000002';
 try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;insert into auth.users values('${user}'),('${foreign}');`);
  await db.exec(read('supabase/migrations/202611170001_private_phone_device_sync.sql'));
  const migration=process.env.FIX_TEST_OLD==='1'?'':read('supabase/migrations/202611170003_private_phone_primary_device.sql');if(migration)await db.exec(migration);
  const ids={phone:{userID:user,sessionID:webcrypto.randomUUID()},mac:{userID:user,sessionID:webcrypto.randomUUID()},other:{userID:foreign,sessionID:webcrypto.randomUUID()}};
  let verifications=0;
  const rpc=async(name,args)=>(await db.query('select public.'+name+'('+Object.keys(args).map((k,i)=>k+'=>$'+(i+1)).join(',')+') value',Object.values(args).map(x=>Array.isArray(x)?JSON.stringify(x):x))).rows[0].value;
  const store={rpc,async key(owner,candidate){await db.query('insert into private_phone_sync_keys(user_id,wrapped_key) values($1,$2) on conflict(user_id) do nothing',[owner,candidate]);return (await db.query('select wrapped_key from private_phone_sync_keys where user_id=$1',[owner])).rows[0].wrapped_key;}};
  const handler=createSyncHandler({store,authenticate:async token=>ids[token],verifyPassword:async(identity,password)=>{verifications++;assert.equal(identity.userID,user);return password==='fixture-correct-password';},masterKey:'a'.repeat(43),cryptoAPI:webcrypto});
  async function send(token,body){return (await handler(new Request('https://fixture.test/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({protocolVersion:2,...body})}))).json();}
  const phone=(await send('phone',{action:'register',platform:'iOS',label:'主手机'})).device.id,mac=(await send('mac',{action:'register',platform:'macOS',label:'电脑'})).device.id;
  await send('phone',{action:'seed',deviceId:phone,finish:false});
  await send('phone',{action:'push',deviceId:phone,changes:[{key:'state/schema',baseRevision:'0',mutationId:webcrypto.randomUUID(),deleted:false,value:{kind:'schema',version:1}}]});
  await send('phone',{action:'seed',deviceId:phone,finish:true});
  const recordsBefore=JSON.stringify((await db.query('select * from private_phone_sync_records')).rows);
  assert.equal((await send('mac',{action:'revoke',deviceId:mac,targetId:phone})).error,'primary_required');
  const initial=await send('phone',{action:'inspect',deviceId:phone});assert.equal(initial.isPrimary,true);assert.equal(initial.primaryDeviceId,phone);
  assert.equal((await send('mac',{action:'primary',deviceId:mac,primaryRevision:'1',password:'fixture-wrong-password'})).error,'password_verification_failed');
  assert.equal((await send('mac',{action:'primary',deviceId:mac,primaryRevision:'0',password:'fixture-correct-password'})).error,'primary_changed');
  const promoted=await send('mac',{action:'primary',deviceId:mac,primaryRevision:'1',password:'fixture-correct-password'});
  assert.equal(promoted.isPrimary,true);assert.equal(promoted.primaryRevision,'2');assert.equal(verifications,3);
  const demoted=await send('phone',{action:'inspect',deviceId:phone});assert.equal(demoted.isPrimary,false);assert.equal(demoted.primaryDeviceId,mac);
  assert.equal((await send('phone',{action:'revoke',deviceId:phone,targetId:mac})).error,'primary_required');
  assert.equal((await send('mac',{action:'revoke',deviceId:mac,targetId:mac})).error,'cannot_revoke_primary');
  assert.equal((await send('mac',{action:'revoke',deviceId:mac,targetId:phone})).ok,true);
  for(const action of ['inspect','pull','push','primary','media.get'])assert.equal((await send('phone',{action,deviceId:phone,password:'fixture-correct-password',primaryRevision:'2'})).error,'device_revoked_or_unknown');
  assert.equal((await send('phone',{action:'register',platform:'iOS',label:'旧令牌重入'})).error,'device_revoked');
  assert.equal((await send('mac',{action:'pull',deviceId:mac,cursor:'0'})).ok,true);
  assert.equal(JSON.stringify((await db.query('select * from private_phone_sync_records')).rows),recordsBefore,'authority changes and revocation do not rewrite app data');
  assert.equal((await db.query('select count(*) n from private_phone_sync_primary where user_id=$1',[user])).rows[0].n,1);
  await db.exec('set role authenticated');await assert.rejects(rpc('private_phone_sync_promote',{p_user:user,p_session:ids.mac.sessionID,p_device:mac,p_expected:'2'}),/permission denied/);await db.exec('reset role');
  await db.exec('revoke execute on function public.private_phone_sync_pull(uuid,uuid,uuid,bigint) from service_role');await db.exec(migration);
  assert.equal((await db.query("select has_function_privilege('service_role','public.private_phone_sync_pull(uuid,uuid,uuid,bigint)','execute') allowed")).rows[0].allowed,false,'migration preserves the incident pause');
 }finally{await db.close();}
});

test('revoked device loses visible and model permissions, signs out, and preserves its local data',async()=>{
 const ctx=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob,setTimeout:()=>1,clearTimeout:()=>{}});
 vm.runInContext(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-device-sync.js'),ctx);
 vm.runInContext(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-device-sync-client.js'),ctx);
 const owner='10000000-0000-0000-0000-000000000001',deviceId='20000000-0000-0000-0000-000000000001',disk=new Map(),copy=x=>JSON.parse(JSON.stringify(x));
 const state={_deviceSyncOwner:owner,settings:{hist:32},me:{},contacts:[{id:'a',name:'角色'}],messages:{a:[{id:'m',content:'保留的聊天'}]}};
 let revoked=false,loggedIn=true,signouts=0,resets=0,reveals=0;
 const seed={phase:'ready',sourceDeviceId:deviceId};
 const host={core:ctx.NorthPrivateDeviceSyncCore,platform:'iOS',label:'测试手机',snapshot:async()=>copy(state),getState:()=>state,boundOwner:()=>owner,stateOwner:()=>owner,bindOwner:async()=>{},
  read:async key=>disk.has(key)?copy(disk.get(key)):null,write:async(key,value)=>disk.set(key,copy(value)),isBusy:()=>false,isVisible:()=>true,applying:()=>false,meaningful:()=>true,emptyState:()=>({}),replaceState:async()=>assert.fail('no incoming records in this fixture'),status:()=>{},onAccount:()=>{},cancelReplies:()=>{},accountReset:()=>{resets++;},reveal:()=>{reveals++;},
  async native(action,body){
   if(action==='account.status')return {ok:true,loggedIn,userId:loggedIn?owner:''};
   if(action==='account.signout'){loggedIn=false;signouts++;return {ok:true,loggedIn:false};}
   if(revoked)return {ok:false,error:body.action==='register'?'device_revoked':'device_revoked_or_unknown'};
   if(body.action==='register')return {ok:true,device:{id:deviceId}};
   if(body.action==='inspect')return {ok:true,seed,isPrimary:true,primaryDeviceId:deviceId,primaryRevision:'1',conflicts:[]};
   if(body.action==='push')return {ok:true,outcomes:body.changes.map(row=>({key:row.key,mutationId:row.mutationId,status:'applied',revision:'1'}))};
   if(body.action==='pull')return {ok:true,records:[],cursor:'0',more:false,seed};
   assert.fail('unexpected sync action '+body.action);
  }};
 let client=ctx.NorthPrivateDeviceSyncRuntime.createClient(host);
 try{
  await client.syncNow();assert.equal(client.gateAllowed(),true);assert.equal(client.backgroundAllowed(),true);
  const before=JSON.stringify(state),diskBefore=JSON.stringify([...disk]);revoked=true;
  await client.syncNow();assert.equal(signouts,0,'an ambiguous device failure must be confirmed by registration');await client.syncNow();assert.equal(client.status().phase,'authentication');assert.equal(client.gateAllowed(),false);assert.equal(client.backgroundAllowed(),false);assert.equal(client.modelAllowed({}),false);assert.equal(signouts,1);assert.equal(resets,1);
  assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify([...disk].filter(([key])=>!key.endsWith('_access'))),diskBefore,'outbox and account-local cache remain available');assert([...disk].some(([key,value])=>key.endsWith('_access')&&value.revoked===true),'confirmed removal prevents offline reuse of the revoked session');
  client.stop();loggedIn=true;client=ctx.NorthPrivateDeviceSyncRuntime.createClient(host);const beforeReveal=reveals;await client.syncNow();assert.equal(reveals,beforeReveal,'cached content is not revealed before the server accepts the device');assert.equal(client.gateAllowed(),false);
 }finally{client.stop();}
});

test('a quarantined interrupted bootstrap stays intact and cannot enter the new sync generation',async()=>{
 const require=createRequire(import.meta.url),{PGlite}=require(path.join(os.homedir(),'AppData/Local/CodexHardwareTests/robot-voice-sql-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
 const db=new PGlite(),owner='10000000-0000-0000-0000-000000000001',phoneSession=webcrypto.randomUUID(),macSession=webcrypto.randomUUID();
 try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;insert into auth.users values('${owner}');`);
  await db.exec(read('supabase/migrations/202611170001_private_phone_device_sync.sql'));await db.exec(read('supabase/migrations/202611170003_private_phone_primary_device.sql'));
  const rpc=async(name,args)=>(await db.query('select public.'+name+'('+Object.keys(args).map((k,i)=>k+'=>$'+(i+1)).join(',')+') value',Object.values(args).map(x=>Array.isArray(x)?JSON.stringify(x):x))).rows[0].value;
  const phone=(await rpc('private_phone_sync_device',{p_user:owner,p_session:phoneSession,p_platform:'iOS',p_label:'已有手机'})).id;
  const scope={p_user:owner,p_session:phoneSession,p_device:phone};await rpc('private_phone_sync_seed',{...scope,p_finish:false});
  await rpc('private_phone_sync_apply',{...scope,p_changes:[{key:'state/old-deleted-role',mutationId:webcrypto.randomUUID(),baseRevision:'0',deleted:false,digest:'a'.repeat(43),ciphertext:'old-incomplete-bootstrap-envelope'}]});
  const before=JSON.stringify((await db.query('select * from private_phone_sync_records')).rows);
  const store={rpc,async key(user,candidate){await db.query('insert into private_phone_sync_keys(user_id,wrapped_key) values($1,$2) on conflict(user_id) do nothing',[user,candidate]);return (await db.query('select wrapped_key from private_phone_sync_keys where user_id=$1',[user])).rows[0].wrapped_key;}};
  const handler=createSyncHandler({store,authenticate:async token=>({userID:owner,sessionID:token==='phone'?phoneSession:macSession}),masterKey:'a'.repeat(43),cryptoAPI:webcrypto});
  const send=async(token,body)=>(await handler(new Request('https://fixture.test/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({protocolVersion:2,...body})}))).json();
  assert.equal((await send('mac',{action:'register',platform:'macOS',label:'旧客户端',protocolVersion:1})).error,'sync_upgrade_required');
  const mac=(await send('mac',{action:'register',platform:'macOS',label:'电脑'})).device.id;
  assert.equal((await send('mac',{action:'inspect',deviceId:mac})).seed,null);assert.equal((await send('mac',{action:'pull',deviceId:mac,cursor:'0'})).records.length,0);
  assert.equal((await send('phone',{action:'seed',deviceId:phone,finish:false})).seed.format,2);
  const values=[['state/schema',{kind:'schema',version:1}],['state/current-setting',{kind:'field',path:['settings','model'],value:'current-model'}]];
  await send('phone',{action:'push',deviceId:phone,changes:values.map(([key,value])=>({key,value,baseRevision:'0',mutationId:webcrypto.randomUUID(),deleted:false}))});
  await send('phone',{action:'seed',deviceId:phone,finish:true});const downloaded=await send('mac',{action:'pull',deviceId:mac,cursor:'0'});
  assert.equal(downloaded.seed.format,2);assert.deepEqual(downloaded.records.map(x=>x.key).sort(),values.map(x=>x[0]).sort());assert(!JSON.stringify(downloaded).includes('old-deleted-role'));
  assert.equal(JSON.stringify((await db.query("select * from private_phone_sync_records where record_key='state/old-deleted-role'")).rows),before,'old records are retained byte-for-byte rather than overwritten or deleted');
  const archived=(await db.query('select state from private_phone_sync_bootstrap_archive')).rows[0].state;assert.equal(archived.format,1);assert.equal(archived.phase,'pending');
 }finally{await db.close();}
});

test('revoked JWT cannot read or overwrite legacy backups while normal sessions and other buckets retain access',async()=>{
 const require=createRequire(import.meta.url),{PGlite}=require(path.join(os.homedir(),'AppData/Local/CodexHardwareTests/robot-voice-sql-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
 const db=new PGlite(),owner='10000000-0000-0000-0000-000000000001',phoneSession=webcrypto.randomUUID(),macSession=webcrypto.randomUUID();
 try{
  await db.exec(`create schema auth;create schema storage;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;insert into auth.users values('${owner}');
   create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
   create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
   grant usage on schema auth,storage to authenticated;
   create table public.private_phone_backups(user_id uuid,payload text);create table public.private_phone_backup_files(user_id uuid,payload text);create table storage.objects(bucket_id text,payload text);
   alter table public.private_phone_backups enable row level security;alter table public.private_phone_backup_files enable row level security;alter table storage.objects enable row level security;
   create policy owner_access on public.private_phone_backups for all to authenticated using (user_id=auth.uid()) with check(user_id=auth.uid());
   create policy owner_access on public.private_phone_backup_files for all to authenticated using (user_id=auth.uid()) with check(user_id=auth.uid());
   create policy fixture_access on storage.objects for all to authenticated using(true) with check(true);
   grant select,insert,update,delete on public.private_phone_backups,public.private_phone_backup_files,storage.objects to authenticated;
   insert into public.private_phone_backups values('${owner}','preserved-backup');insert into public.private_phone_backup_files values('${owner}','preserved-manifest');insert into storage.objects values('private-phone-backups','private-object'),('other-bucket','unrelated-object');`);
  await db.exec(read('supabase/migrations/202611170001_private_phone_device_sync.sql'));await db.exec(read('supabase/migrations/202611170003_private_phone_primary_device.sql'));
  const rpc=async(name,args)=>(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') value',args)).rows[0].value;
  const phone=(await rpc('private_phone_sync_device',[owner,phoneSession,'iOS','主设备'])).id,mac=(await rpc('private_phone_sync_device',[owner,macSession,'macOS','副设备'])).id;
  await rpc('private_phone_sync_promote',[owner,phoneSession,phone,0]);
  const asSession=async session=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:owner,session_id:session})]);await db.exec('set role authenticated');};
  await asSession(macSession);assert.equal((await db.query('select * from public.private_phone_backups')).rows.length,1);
  await db.exec('reset role');await rpc('private_phone_sync_revoke',[owner,phoneSession,phone,mac]);await asSession(macSession);
  for(const table of ['private_phone_backups','private_phone_backup_files']){assert.equal((await db.query('select * from public.'+table)).rows.length,0);await assert.rejects(db.query('insert into public.'+table+' values($1,$2)',[owner,'forbidden-write']),/row-level security/);}
  assert.deepEqual((await db.query('select bucket_id from storage.objects')).rows.map(x=>x.bucket_id),['other-bucket']);
  await asSession(phoneSession);assert.equal((await db.query('select * from public.private_phone_backups')).rows[0].payload,'preserved-backup');assert.equal((await db.query('select * from storage.objects')).rows.length,2);
  await asSession(webcrypto.randomUUID());assert.equal((await db.query('select * from public.private_phone_backups')).rows.length,1,'a normal fresh password session retains the existing backup path');
 }finally{await db.close();}
});

test('actual account client: automatic first migration, fresh login, two-way messages, interrupted pages and account switch',async()=>{
 const require=createRequire(import.meta.url),{PGlite}=require(path.join(os.homedir(),'AppData/Local/CodexHardwareTests/robot-voice-sql-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
 const db=new PGlite(),user='10000000-0000-0000-0000-000000000001',second='10000000-0000-0000-0000-000000000002';
 let timer=0;const ctx=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob,setTimeout:()=>++timer,clearTimeout:()=>{}});
 vm.runInContext(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-device-sync.js'),ctx);
 vm.runInContext(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-device-sync-client.js'),ctx);
 const copy=x=>JSON.parse(JSON.stringify(x)),empty=()=>({settings:{hist:12},me:{name:'本人'},contacts:[],messages:{}}),devices=[];
 try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;insert into auth.users values('${user}'),('${second}');`);
  await db.exec(read('supabase/migrations/202611170001_private_phone_device_sync.sql'));
  if(!process.env.FIX_TEST_OLD)await db.exec(read('supabase/migrations/202611170003_private_phone_primary_device.sql'));
  const identities={phone:{userID:user,sessionID:'20000000-0000-0000-0000-000000000001'},mac:{userID:user,sessionID:'20000000-0000-0000-0000-000000000002'},other:{userID:second,sessionID:'20000000-0000-0000-0000-000000000003'}};
  const store={async key(owner,candidate){await db.query('insert into private_phone_sync_keys(user_id,wrapped_key) values($1,$2) on conflict(user_id) do nothing',[owner,candidate]);return (await db.query('select wrapped_key from private_phone_sync_keys where user_id=$1',[owner])).rows[0].wrapped_key;},
   async rpc(name,args){return (await db.query('select public.'+name+'('+Object.keys(args).map((k,i)=>k+'=>$'+(i+1)).join(',')+') value',Object.values(args).map(x=>Array.isArray(x)?JSON.stringify(x):x))).rows[0].value;}};
  const server=createSyncHandler({store,authenticate:async token=>identities[token],masterKey:'d'.repeat(43),cryptoAPI:webcrypto});
  function make(token,initial,platform,advisoryOwner=''){
   let state=copy(initial),bound=advisoryOwner,offline=false,pushes=0,cutAt=Infinity,onPull=null,reveals=0;const disk=new Map(),calls=[];
   const host={core:ctx.NorthPrivateDeviceSyncCore,platform,label:platform,read:async key=>disk.has(key)?copy(disk.get(key)):null,write:async(key,value)=>disk.set(key,copy(value)),snapshot:async()=>copy(state),getState:()=>state,
    legacyOwner:()=>platform==='iOS'?identities[token].userID:'',nativeOwner:()=>identities[token].userID,hasPersistedSource:()=>platform==='iOS',
    stateOwner:()=>state._deviceSyncOwner||'',boundOwner:()=>state._deviceSyncOwner||bound,async bindOwner(owner){state._deviceSyncOwner=owner;bound=owner;},emptyState:empty,
    meaningful:s=>s.contacts.length>0||Object.values(s.messages).some(x=>Array.isArray(x)&&x.length>0),isBusy:()=>false,isVisible:()=>true,applying:()=>false,
    async replaceState(next,guard){guard();state=copy(next);state._deviceSyncOwner=identities[token].userID;},reveal:()=>{reveals++;},cancelReplies:()=>{},onAccount:()=>{},status:()=>{},
    async native(action,body){calls.push({action,body:copy(body||{})});if(action==='account.status')return {ok:true,loggedIn:true,userId:identities[token].userID};
     if(action==='account.backup.info')return {ok:true,found:true};
     assert.equal(action,'account.sync','sync never sends any model request');if(offline)throw new Error('fixture network offline');
     if(body.action==='push'&&++pushes>cutAt)throw new Error('fixture network interrupted');
     const response=await server(new Request('https://fixture.test/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({protocolVersion:2,...body})}));
     const result=await response.json();if(body.action==='pull'&&onPull){const callback=onPull;onPull=null;await callback();}return result;}
   };
   let client=ctx.NorthPrivateDeviceSyncRuntime.createClient(host);devices.push(()=>client.stop());
   return {get state(){return state;},get client(){return client;},get reveals(){return reveals;},disk,calls,
    cutAfter(n){cutAt=n;},resume(){cutAt=Infinity;offline=false;},offline(){offline=true;},onPull(fn){onPull=fn;},
    reopen(){client.stop();client=ctx.NorthPrivateDeviceSyncRuntime.createClient(host);},switchAccount(){token='other';client.accountChanged();}};
  }
  const original=empty();original.settings.hist=32;original.contacts=[{id:'a',name:'角色甲',persona:'原有人设'},{id:'b',name:'角色乙',persona:'另一人设'}];
  original.roleBody={a:{energy:95,lastTick:0}};
  original.messages.a=Array.from({length:420},(_,i)=>({id:'m'+i,role:i%2?'assistant':'user',content:'消息'+i,time:i+1}));
  const phone=make('phone',original,'iOS',second),mac=make('mac',empty(),'macOS');
  phone.cutAfter(1);await phone.client.syncNow();assert.equal(phone.state.messages.a.length,420,'partial source upload never replaces original S');
  assert.equal((await db.query('select phase from private_phone_sync_state')).rows[0].phase,'pending');
  await mac.client.syncNow();assert.equal(mac.reveals,0,'secondary never reveals a partial first page');assert.equal(mac.state.contacts.length,0);
  phone.resume();for(let n=0;n<10;n++){phone.onPull(()=>{phone.state.roleBody.a.lastTick++;phone.client.markDirty();});await phone.client.syncNow();if((await db.query('select phase from private_phone_sync_state')).rows[0].phase==='ready')break;}
  assert.equal((await db.query('select phase from private_phone_sync_state')).rows[0].phase,'ready');assert.equal(phone.state.messages.a.length,420);
  assert(Object.values(phone.client.context().journal.state().pending).some(x=>x.value?.path?.[0]==='roleBody'),'a newer in-flight body tick remains durable after the initial checkpoint');
  await phone.client.syncNow();
  await mac.client.syncNow();assert.equal(mac.client.status().ready,true);assert.equal(mac.state.contacts.length,2);assert.equal(mac.state.messages.a.length,420);assert.equal(mac.state.settings.hist,32);
  mac.state.messages.a.push({id:'mac-new',role:'user',content:'Mac追加',time:500});mac.client.markDirty();await mac.client.syncNow();await phone.client.syncNow();
  assert.equal(phone.state.messages.a.filter(x=>x.id==='mac-new').length,1);
  phone.state.messages.a.push({id:'phone-new',role:'user',content:'手机追加',time:501});phone.client.markDirty();await phone.client.syncNow();await mac.client.syncNow();
  assert.equal(mac.state.messages.a.filter(x=>x.id==='phone-new').length,1);
  // A local edit during a remote pull must retain its old base, not silently overwrite the remote edit.
  mac.state.settings.hist=48;mac.client.markDirty();await mac.client.syncNow();
  phone.onPull(()=>{phone.state.settings.hist=40;phone.client.markDirty();});await phone.client.syncNow();await phone.client.syncNow();
  assert.equal(phone.state.settings.hist,40);assert.equal(mac.state.settings.hist,48);
  assert((await db.query('select count(*) as n from private_phone_sync_conflicts')).rows[0].n>=1,'in-flight edit is a retained conflict');
  mac.reopen();await mac.client.syncNow();assert.equal(mac.state.messages.a.length,422,'reopen uses same account content');
  mac.switchAccount();await mac.client.syncNow();assert.equal(mac.state.contacts.length,0);assert.equal(Object.keys(mac.state.messages).length,0);
  assert.equal((await db.query('select count(*) as n from private_phone_sync_records where user_id=$1',[second])).rows[0].n,0,'account A content never uploads to B');
  assert(!mac.calls.some(x=>/model|chat.completions/.test(x.action)));
 }finally{for(const stop of devices)stop();await db.close();}
});

test('first seed checkpoint retains newer updates and media while unacknowledged records still block it',async()=>{
 const env=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob});
 vm.runInContext(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-device-sync.js'),env);
 const owner='10000000-0000-0000-0000-000000000001',deviceId='20000000-0000-0000-0000-000000000001',copy=x=>JSON.parse(JSON.stringify(x));
 async function run(extra,allowed){
  let disk={version:1,owner,deviceId,initialized:true,cursor:'9',known:{'state/schema':{revision:'1',deleted:false},'state/body':{revision:'4',deleted:false}},
   pending:{'state/body':{key:'state/body',value:{kind:'field',path:['roleBody'],value:{lastTick:99}},baseRevision:'4',mutationId:webcrypto.randomUUID()},...extra},seed:{phase:'pending',sourceDeviceId:deviceId}};
  const before=JSON.stringify(disk.pending);let finishes=0;
  const journal=env.NorthPrivateDeviceSyncCore.createJournal({owner,getOwner:()=>owner,platform:'iOS',label:'fixture',canPublish:()=>true,snapshot:async()=>null,apply:async()=>{},
   storage:{read:async()=>copy(disk),write:async(_,v)=>{disk=copy(v);}},transport:async body=>{
    if(body.action==='register')return {ok:true,device:{id:deviceId}};
    assert.equal(body.action,'seed');finishes++;return {ok:true,seed:{phase:'ready',sourceDeviceId:deviceId}};
   }});
  try{
   if(allowed){assert.equal((await journal.seed(true)).phase,'ready');assert.equal(finishes,1);assert.equal(JSON.stringify(disk.pending),before,'newer edits and not-yet-uploaded media remain durable');}
   else{await assert.rejects(journal.seed(true));assert.equal(finishes,0);assert.equal(JSON.stringify(disk.pending),before);}
  }finally{journal.close();}
 }
 const row=(key,value)=>({[key]:{key,value,baseRevision:'0',mutationId:webcrypto.randomUUID()}});
 await run(row('state/media/fixture',{kind:'media',localKey:'avatar'}),true);
 await run(row('state/new-message',{kind:'message',id:'new',value:{content:'尚未确认'}}),false);
 await run(row('blob/record/fixture',{base64:'Zml4dHVyZQ'}),false);
});

test('account state codec: real role/message/settings roundtrip, long Unicode parts and device grants stay separate',async()=>{
 const a=syncCodecFixture(),b=syncCodecFixture(),copy=x=>JSON.parse(JSON.stringify(x));
 const original={settings:{chat:{base:'https://fixture.test',key:'fixture-model-secret',model:'fixture'},hist:32,smartHomeAir:{nativeGrant:true}},
  me:{name:'本人',avatar:'idb:avatar-a',locked:false,battery:12,phoneFriend:{id:'friend-a',messages:{peer:[{id:'f1',text:'朋友消息'}]}}},
  contacts:[{id:'a',name:'角色甲',persona:'人物设定🙂'.repeat(30000),_initiative:{nextAt:50}},{id:'b',name:'角色乙',persona:'第二个人设'}],
  messages:{a:[{id:'a1',role:'user',content:'第一条',time:100},{id:'a2',role:'assistant',content:'已回复',time:101}],alt_a:[{id:'alt1',role:'user',content:'小号消息',time:100}]},
  couple:{cid:'a',companion:{deviceSecret:'fixture-device-only'},other:{enabled:true}},moments:[{id:'moment1',text:'朋友圈'}],_persistedAt:1,_proactiveCount:{a:{n:2}}};
 const projected=copy(await a.project(copy(original)));a.setLocalProjection(projected);
 assert(Object.keys(projected).some(k=>k.startsWith('blob/record/')));
 assert(!JSON.stringify(projected).includes('fixture-device-only'));
 const rows=Object.entries(projected).map(([key,value])=>({key,value,deleted:false}));
 b.accept(rows.filter(x=>!x.key.startsWith('blob/record/')));
 assert.equal((await b.materialize()).complete,false,'long values wait for verified complete parts');
 b.accept(rows);const restored=copy((await b.materialize()).state);
 assert.deepEqual(restored.contacts.map(x=>x.id),['a','b']);assert.equal(restored.contacts[0].persona,original.contacts[0].persona);
 assert.deepEqual(restored.messages,original.messages);assert.deepEqual(restored.settings.chat,original.settings.chat);
 assert(!('smartHomeAir' in restored.settings));assert(!('battery' in restored.me));assert(!('companion' in restored.couple));
 const kept=copy(b.preserveDeviceState(restored,original));assert.deepEqual(kept.couple.companion,original.couple.companion);
 assert.deepEqual(kept._proactiveCount,original._proactiveCount);assert.deepEqual(kept.contacts[0]._initiative,original.contacts[0]._initiative);
 const anotherRole=copy(restored);anotherRole.couple.cid='b';assert(!b.preserveDeviceState(anotherRole,original).couple.companion,'native grants do not transfer to a different role');
 const changed=copy(original);changed.messages.a.push({id:'a3',role:'user',content:'只追加这一条',time:102});
 const after=copy(await a.project(changed)),delta=Object.keys(after).filter(key=>JSON.stringify(after[key])!==JSON.stringify(projected[key]));
 assert.equal(delta.length,1,'one new message changes one logical record');
 b.accept(delta.map(key=>({key,value:after[key]})));assert.equal((await b.materialize()).state.messages.a.length,3);
 const beforeDelete=copy(after);changed.messages.a=changed.messages.a.filter(x=>x.id!=='a1');const afterDelete=copy(await a.project(changed));
 const deleted=Object.keys(beforeDelete).filter(key=>!Object.hasOwn(afterDelete,key));assert.equal(deleted.length,1);
 b.accept(deleted.map(key=>({key,deleted:true})));assert.equal((await b.materialize()).state.messages.a.some(x=>x.id==='a1'),false);
 const bytes=new TextEncoder().encode('图片分块'),digest=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
 const manifest=await a.addMediaManifest({localKey:'avatar-a',type:'string',bytes:bytes.length,hash:digest,parts:[digest]});
 b.accept([manifest]);assert.equal((await b.materialize()).complete,true);assert.equal(b.mediaManifest('avatar-a').hash,digest);
 const reloaded=syncCodecFixture();reloaded.load(copy(b.dump()));assert.equal(reloaded.mediaManifest('avatar-a').hash,digest);
 assert(Object.hasOwn(await a.project(changed),manifest.key),'media aliases survive normal state snapshots');
});

test('legacy messages keep the same sync identity when an earlier different message is inserted or removed',async()=>{
 const codec=syncCodecFixture(),initial={settings:{},me:{},contacts:[],messages:{a:[{role:'user',content:'旧消息一',time:1},{role:'assistant',content:'旧消息二',time:2}]}};
 const base=await codec.project(initial),keys=Object.keys(base).filter(k=>k.startsWith('state/message/'));
 initial.messages.a.unshift({id:'new-message',role:'user',content:'前面新插入',time:0});
 const next=await codec.project(initial);assert(keys.every(key=>Object.hasOwn(next,key)));
 codec.setLocalProjection(next);const hydrated=(await codec.materialize()).state;
 assert(hydrated.messages.a.every(x=>typeof x.id==='string'&&x.id));
 const roundtrip=await codec.project(JSON.parse(JSON.stringify(hydrated)));assert.deepEqual(Object.keys(roundtrip).filter(k=>k.startsWith('state/message/')).sort(),Object.keys(next).filter(k=>k.startsWith('state/message/')).sort());
 hydrated.messages.a.shift();const deleted=await codec.project(JSON.parse(JSON.stringify(hydrated)));assert(keys.every(key=>Object.hasOwn(deleted,key)));
});

test('Mac account: native login, renewal and account races keep credentials isolated', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionMac/MacPhoneBridge.swift');
 const native=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
 const sync=native.slice(native.indexOf('// PRIVATE_DEVICE_SYNC_V1:'),native.lastIndexOf('#if os(macOS)'))
  .replace(/enum PrivateAccountInstallationID \{[\s\S]*?\n\}\n/,'enum PrivateAccountInstallationID { static func value() throws -> String { \"10000000-0000-0000-0000-000000000099\" } }\n')
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
  } else if url.path=="/functions/v1/phone-device-sync" || url.path=="/functions/v1/phone-mcp-vault" {
   precondition(body["platform"] as? String == "macOS" && body["userId"]==nil && body["sessionId"]==nil)
   if body["action"] as? String == "register" { precondition(body["installationId"] as? String == "10000000-0000-0000-0000-000000000099") }
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
  let synced=try await account.handle("account.sync",["action":"register","label":"电脑","platform":"iOS","userId":"forged","sessionId":"forged","installationId":"forged-by-js"])
  precondition(synced["ok"] as? Bool == true, "fixed native account sync endpoint")
  let managed=try await account.handle("account.mcp",["action":"list","deviceId":"fixture-device","platform":"iOS","userId":"forged","sessionId":"forged"])
  precondition(managed["ok"] as? Bool == true, "fixed native account MCP endpoint")
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

test('Mac content reveal requires a matching account, real cloud readiness and saved hydrated records', {skip:process.platform!=='darwin'},()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionMac/MacPhoneBridge.swift');
 const event=source.slice(source.indexOf('struct MacPhoneSyncEvent {'),source.indexOf('\n@MainActor\nfinal class MacPhoneBridge'));
 const fixture=String.raw`
import Foundation
`+event+String.raw`
let owner="10000000-0000-0000-0000-000000000001"
let ready:[String:Any] = ["stage":"ready","owner":owner,"hydrated":true,"recordCount":15]
precondition(MacPhoneSyncEvent.decode(action:"account.sync.ui",payload:ready,owner:owner,cloudReady:false)==nil,"account login alone must not reveal an empty shell")
precondition(MacPhoneSyncEvent.decode(action:"account.sync.ui",payload:ready,owner:owner,cloudReady:true)?.stage == .ready)
precondition(MacPhoneSyncEvent.decode(action:"account.sync.ui",payload:ready,owner:"10000000-0000-0000-0000-000000000002",cloudReady:true)==nil,"stale account cannot change current view")
var incomplete=ready;incomplete["hydrated"]=false
precondition(MacPhoneSyncEvent.decode(action:"account.sync.ui",payload:incomplete,owner:owner,cloudReady:true)==nil)
incomplete=ready;incomplete["recordCount"]=0
precondition(MacPhoneSyncEvent.decode(action:"account.sync.ui",payload:incomplete,owner:owner,cloudReady:true)==nil)
let progress=MacPhoneSyncEvent.decode(action:"account.sync.ui.progress",payload:["userId":owner,"phase":"pulling","completed":50,"total":20],owner:owner,cloudReady:false)!
precondition(progress.completed==20 && progress.total==20 && progress.stage == .progress)
let error=MacPhoneSyncEvent.decode(action:"account.sync.ui",payload:["owner":owner,"stage":"error","phase":"network","message":"fixture-secret-never-display"],owner:owner,cloudReady:false)!
precondition(!error.detail.contains("fixture-secret") && error.stage == .error)
print("mac-account-content-state-ok")
`;
 const output=cp.execFileSync('swift',['-'],{input:fixture,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
 assert(output.includes('mac-account-content-state-ok'));
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
  await db.exec(read('supabase/migrations/202611170003_private_phone_primary_device.sql'));
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
  const turn=(device,session,action,key,token,done=false)=>rpc('private_phone_sync_turn',[owner,session,device,action,'main/role-a',key,token,done]);
  assert.equal((await turn(phone.id,phoneSession,'acquire','user-message-a',mid(80))).acquired,true);
  assert.equal((await turn(mac.id,macSession,'acquire','user-message-a',mid(81))).busy,true,'same message cannot trigger two model turns');
  assert.equal((await turn(phone.id,phoneSession,'renew','user-message-a',mid(80))).acquired,true);
  await assert.rejects(turn(mac.id,macSession,'finish','user-message-a',mid(81),true),/turn_lease_lost/);
  assert.equal((await turn(phone.id,phoneSession,'finish','user-message-a',mid(80),true)).finished,true);
  assert.equal((await turn(mac.id,macSession,'acquire','user-message-a',mid(82))).completed,true);
  assert.equal((await turn(mac.id,macSession,'acquire','user-message-b',mid(83))).acquired,true);
  await turn(mac.id,macSession,'finish','user-message-b',mid(83),false);
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
  await assert.rejects(rpc('private_phone_sync_revoke',[other,otherSession,foreign.id,phone.id]),/primary_required/);
  const install=mid(90),newSession=mid(91),thirdSession=mid(92);
  const stable=await rpc('private_phone_sync_device',[owner,phoneSession,'iOS','Phone',install]);
  assert.equal(stable.id,phone.id);
  assert.equal((await rpc('private_phone_sync_device',[owner,newSession,'iOS','Phone again',install])).id,phone.id,'password login preserves physical source device');
  await assert.rejects(rpc('private_phone_sync_device',[owner,phoneSession,'iOS','old session',install]),/device_revoked/);
  await assert.rejects(pull(owner,phoneSession,phone.id),/device_revoked_or_unknown/);
  await assert.rejects(rpc('private_phone_sync_revoke',[owner,newSession,phone.id,phone.id]),/cannot_revoke_primary/);
  const replacementSession=mid(96),replacement=await register(owner,replacementSession,'iOS');
  await rpc('private_phone_sync_promote',[owner,replacementSession,replacement.id,1]);
  await rpc('private_phone_sync_revoke',[owner,replacementSession,replacement.id,phone.id]);
  await assert.rejects(rpc('private_phone_sync_device',[owner,newSession,'iOS','revoked',install]),/device_revoked/);
  assert.equal((await rpc('private_phone_sync_device',[owner,thirdSession,'iOS','fresh password login',install])).id,phone.id);
  await assert.rejects(rpc('private_phone_sync_device',[owner,newSession,'iOS','retired session',install]),/device_revoked/);
  await assert.rejects(rpc('private_phone_sync_device',[owner,mid(93),'macOS','wrong platform',install]),/invalid_device/);
  assert.notEqual((await rpc('private_phone_sync_device',[owner,mid(94),'iOS','another phone',mid(95)])).id,phone.id);
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
  await db.exec(read('supabase/migrations/202611170003_private_phone_primary_device.sql'));
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
   const response=await handler(new Request('https://example.test/sync',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...headers},body:JSON.stringify({protocolVersion:2,...body})}));
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
  const first=make(1,'state/schema',{kind:'schema',version:1,text:'秘密聊天内容',apiKey:'fixture-only-secret'});
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
  await db.query('update private_phone_sync_records set ciphertext=$1 where record_key=$2',[raw.slice(0,-4)+'AAAA',first.key.replace(/^(state|blob)\//,'$1/sync2/')]);
  const broken=await send('mac',{action:'pull',deviceId:mac});assert.equal(broken.json.error,'encrypted_data_unreadable');assert(!('cursor' in broken.json));
  await db.query('update private_phone_sync_records set ciphertext=$1 where record_key=$2',[raw,first.key.replace(/^(state|blob)\//,'$1/sync2/')]);
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
 const request=()=>new Request('https://fixture.test/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({protocolVersion:2,action:'register',platform:'macOS',label:'本机',userId:'forged'})});
 const good=await handler(request());assert.equal(good.status,200);assert.equal(calls.length,2);
 rejectAuth=true;
 const bad=await handler(request());assert.equal(bad.status,401);assert.equal(calls.length,3);assert(!(await bad.text()).includes('fixture-server-only-key'));
});

test('primary REST verification uses the authenticated account and discards the temporary password session',async()=>{
 const user='10000000-0000-0000-0000-000000000001',session='20000000-0000-0000-0000-000000000001',device='30000000-0000-0000-0000-000000000001';
 const token='header.'+Buffer.from(JSON.stringify({sub:user,session_id:session,role:'authenticated',exp:Math.floor(Date.now()/1000)+300})).toString('base64url')+'.signature',calls=[];let wrong=false,foreign=false;
 const handler=createSupabaseSync({url:'https://fixture.supabase.co',serviceKey:'fixture-service-secret',masterKey:'a'.repeat(43),fetchAPI:async(url,options)=>{
  const path=new URL(url).pathname,query=new URL(url).search,body=options.body?JSON.parse(options.body):null;calls.push({path,query,body,bearer:options.headers.Authorization});
  if(path==='/auth/v1/user')return Response.json({id:user,email:'authenticated-owner@example.com'});
  if(path==='/auth/v1/token'){assert.equal(query,'?grant_type=password');assert.equal(body.email,'authenticated-owner@example.com');return Response.json(wrong?{message:'Invalid login credentials'}:{user:{id:foreign?'other-user':user},access_token:'verification-only-token'},{status:wrong?400:200});}
  if(path==='/auth/v1/logout'){assert.equal(query,'?scope=local');assert.equal(options.headers.Authorization,'Bearer verification-only-token');return Response.json({});}
  assert.equal(options.headers.Authorization,'Bearer fixture-service-secret');assert.equal(body.p_user,user);assert.equal(body.p_session,session);assert(!JSON.stringify(body).includes('password'));
  if(path.endsWith('/private_phone_sync_promote'))return Response.json({ok:true,isPrimary:true,primaryDeviceId:device,primaryRevision:'2'});
  return Response.json(null);
 }});
 async function send(){return handler(new Request('https://fixture.test/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({protocolVersion:2,action:'primary',deviceId:device,primaryRevision:'1',password:'fixture-only-password',email:'attacker@example.com'})}));}
 const good=await send(),text=await good.text();assert.equal(good.status,200);assert(!/verification-only-token|fixture-service-secret|fixture-only-password/.test(text));
 assert.equal(calls.filter(x=>x.path.endsWith('/private_phone_sync_promote')).length,1);assert.equal(calls.filter(x=>x.path==='/auth/v1/logout').length,1);
 wrong=true;const bad=await send();assert.equal(bad.status,403);assert.equal((await bad.json()).error,'password_verification_failed');assert.equal(calls.filter(x=>x.path.endsWith('/private_phone_sync_promote')).length,1);
 wrong=false;foreign=true;const other=await send();assert.equal(other.status,403);assert.equal(calls.filter(x=>x.path.endsWith('/private_phone_sync_promote')).length,1);assert.equal(calls.filter(x=>x.path==='/auth/v1/logout').length,2,'even an unexpected identity is signed out');
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
  await db.exec(read('supabase/migrations/202611170003_private_phone_primary_device.sql'));
  const store={async key(user,candidate){await db.query('insert into private_phone_sync_keys(user_id,wrapped_key) values($1,$2) on conflict(user_id) do nothing',[user,candidate]);return (await db.query('select wrapped_key from private_phone_sync_keys where user_id=$1',[user])).rows[0].wrapped_key;},
   async rpc(name,args){return (await db.query('select public.'+name+'('+Object.keys(args).map((k,i)=>k+'=>$'+(i+1)).join(',')+') value',Object.values(args).map(x=>Array.isArray(x)?JSON.stringify(x):x))).rows[0].value;}};
  const ids={phone:'20000000-0000-0000-0000-000000000001',mac:'20000000-0000-0000-0000-000000000002',fresh:'20000000-0000-0000-0000-000000000003'};
  const server=createSyncHandler({store,authenticate:async token=>({userID:owner,sessionID:ids[token]}),masterKey:'b'.repeat(43),cryptoAPI:webcrypto});
  function device(token,publish){
   const data={},disk=new Map(),requests=[];let currentOwner=owner,dropAck=false,dropResolutionAck=false,failApply=false,switchDuringPull=false,switchDuringResolve=false;
   const options={owner,platform:token==='phone'?'iOS':'macOS',label:token,getOwner:()=>currentOwner,canPublish:()=>publish,
    storage:{read:async user=>disk.has(user)?copy(disk.get(user)):null,write:async(user,value)=>{assert.equal(user,owner);disk.set(user,copy(value));}},
    snapshot:async()=>copy(data),
    async apply(rows,check){for(const row of rows){check();if(row.deleted)delete data[row.key];else data[row.key]=copy(row.value);if(failApply){failApply=false;throw new Error('fixture interrupted app save');}}},
    async transport(body){requests.push(copy(body));const response=await server(new Request('https://example.test/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({protocolVersion:2,...body})}));const result=await response.json();if(body.action==='push'&&dropAck){dropAck=false;throw new Error('fixture lost acknowledgement');}if(body.action==='resolve'&&dropResolutionAck){dropResolutionAck=false;throw new Error('fixture lost resolution acknowledgement');}if(body.action==='resolve'&&switchDuringResolve){switchDuringResolve=false;currentOwner='other-owner';}if(body.action==='pull'&&switchDuringPull){switchDuringPull=false;currentOwner='other-owner';}return result;}};
   let journal=core.createJournal(options);
   return {data,disk,requests,get journal(){return journal;},reopen(){journal.close();journal=core.createJournal(options);},publish(){publish=true;},loseAck(){dropAck=true;},loseResolutionAck(){dropResolutionAck=true;},switchAccountDuringResolve(){switchDuringResolve=true;},interruptApply(){failApply=true;},switchAccountDuringPull(){switchDuringPull=true;}};
  }
  const phone=device('phone',true),mac=device('mac',false),a='state/chat/main/role/a',b='state/chat/main/role/b',c='state/chat/main/role/c';
  const blobValue={base64:'5Lit5paH5YiG54mH'},blobKey='blob/record/'+await core.hash('5Lit5paH5YiG54mH');
  phone.data['state/schema']={kind:'schema',version:1};phone.data[a]={id:'a',text:'第一条'};phone.data[blobKey]=blobValue;
  await phone.journal.seed(false);await phone.journal.cycle();
  const sourceDevice=phone.journal.state().deviceId;
  async function rawConflict(id){
   const response=await server(new Request('https://example.test/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer phone'},body:JSON.stringify({protocolVersion:2,action:'conflict',deviceId:sourceDevice,conflictId:id})}));
   return response.json();
  }
  const duplicateMutation=webcrypto.randomUUID();
  const duplicate=await phone.journal.request({action:'push',changes:[{key:blobKey,value:blobValue,deleted:false,baseRevision:'0',mutationId:duplicateMutation}]});
  assert.equal(duplicate.outcomes[0].status,'conflict');
  const duplicateId=duplicate.outcomes[0].conflictId;
  const saved=phone.disk.get(owner);
  saved.pending[blobKey]={key:blobKey,value:blobValue,deleted:false,hash:await core.hash(blobValue),mutationId:duplicateMutation,baseRevision:'0',submitted:true,blocked:duplicateId};
  phone.disk.set(owner,copy(saved));phone.reopen();
  await phone.journal.cycle();
  assert(!phone.journal.state().pending[blobKey]?.blocked,'an exact duplicate content-addressed blob must not block the installed source journal forever');
  assert((await rawConflict(duplicateId)).conflict.resolvedAt,'equal decrypted content is safely reconciled');
  assert.equal((await db.query('select revision from private_phone_sync_records where record_key=$1',[blobKey.replace(/^(state|blob)\//,'$1/sync2/')])).rows[0].revision,1,'safe equality reconciliation does not rewrite the immutable piece');
  // A second duplicate is read concurrently, and repeated reads must remain harmless.
  const repeated=await phone.journal.request({action:'push',changes:[{key:blobKey,value:blobValue,deleted:false,baseRevision:'0',mutationId:webcrypto.randomUUID()}]});
  const repeatedId=repeated.outcomes[0].conflictId;
  const parallel=await Promise.all([rawConflict(repeatedId),rawConflict(repeatedId),rawConflict(repeatedId)]);
  for(const result of parallel){assert.equal(result.ok,true);assert(result.conflict.resolvedAt);assert.deepEqual(result.current.value,blobValue);}
  assert((await rawConflict(repeatedId)).conflict.resolvedAt,'retry observes the same resolved conflict');
  const different=await phone.journal.request({action:'push',changes:[{key:blobKey,value:{base64:'a-different-fragment'},deleted:false,baseRevision:'0',mutationId:webcrypto.randomUUID()}]});
  const differentId=different.outcomes[0].conflictId,differentDetail=await rawConflict(differentId);
  assert.equal(differentDetail.conflict.resolvedAt,null,'a matching blob key alone must never choose between different decrypted values');
  assert.equal(differentDetail.conflict.value.base64,'a-different-fragment');assert.deepEqual(differentDetail.current.value,blobValue);
  assert.equal((await db.query('select revision from private_phone_sync_records where record_key=$1',[blobKey.replace(/^(state|blob)\//,'$1/sync2/')])).rows[0].revision,1);
  await phone.journal.resolve(differentId,'server',differentDetail.current.revision);
  await phone.journal.seed(true);assert.equal(phone.journal.state().seed.phase,'ready','first migration finishes without a new app build');
  await mac.journal.cycle();assert.deepEqual(mac.data,phone.data);assert.equal(mac.requests.filter(x=>x.action==='push').length,0);
  mac.publish();mac.data[b]={id:'b',text:'电脑追加'};phone.data[c]={id:'c',text:'手机追加'};
  await phone.journal.cycle();await mac.journal.cycle();await phone.journal.cycle();
  assert.deepEqual(mac.data,phone.data);assert.equal(Object.keys(mac.data).length,5);
  phone.data[a].text='手机离线编辑';mac.data[a].text='电脑离线编辑';
  await phone.journal.cycle();await mac.journal.cycle();
  assert.equal(mac.data[a].text,'电脑离线编辑','local conflicting candidate remains recoverable');
  assert.equal(phone.data[a].text,'手机离线编辑','server accepted data is never silently overwritten');
  assert.equal((await mac.journal.inspect()).conflicts.length,1);
  const conflictCalls=mac.requests.filter(x=>x.action==='push').length;
  await mac.journal.cycle();await mac.journal.cycle();
  assert.equal(mac.requests.filter(x=>x.action==='push').length,conflictCalls,'blocked edits do not repeatedly call server');
  const blocked=(await mac.journal.inspect()).conflicts[0];
  await phone.journal.request({action:'resolve',conflictId:blocked.id,choice:'server',baseRevision:blocked.revision,mutationId:webcrypto.randomUUID()});
  await mac.journal.cycle();
  assert.deepEqual(mac.data[a],phone.data[a],'a conflict resolved on another device must release the original blocked record');
  async function disagree(phoneText,macText){
   phone.data[a].text=phoneText;mac.data[a].text=macText;
   await phone.journal.cycle();await mac.journal.cycle();
   return (await mac.journal.inspect()).conflicts.find(item=>item.key===a);
  }
  const candidate=await disagree('手机下一版','保留电脑候选');
  const candidateDetail=await mac.journal.request({action:'conflict',conflictId:candidate.id});
  assert.equal(candidateDetail.current.value.text,'手机下一版');
  assert.equal(candidateDetail.conflict.value.text,'保留电脑候选');
  const chosen=await mac.journal.resolve(candidate.id,'candidate',candidateDetail.current.revision);
  assert.equal(chosen.resolved,true);assert.equal(mac.data[a].text,'保留电脑候选');
  await phone.journal.cycle();assert.deepEqual(mac.data[a],phone.data[a]);
  assert.equal(Object.values(mac.journal.state().pending).filter(item=>item.blocked).length,0);
  const stale=await disagree('手机预览版','电脑尚未确认');
  const staleDetail=await mac.journal.request({action:'conflict',conflictId:stale.id});
  phone.data[a].text='预览后手机又有更新';await phone.journal.cycle();
  const staleChoice=await mac.journal.resolve(stale.id,'candidate',staleDetail.current.revision);
  assert.equal(staleChoice.resolved,false);assert.equal(staleChoice.reason,'revision_changed');
  assert.equal(phone.data[a].text,'预览后手机又有更新');assert.equal(mac.data[a].text,'电脑尚未确认');
  assert.equal((await mac.journal.inspect()).conflicts.length,1,'a stale preview does not create a duplicate conflict');
  mac.loseResolutionAck();
  await assert.rejects(mac.journal.resolve(stale.id,'candidate'),/lost resolution acknowledgement/);
  const pendingChoice=mac.disk.get(owner).resolutions[stale.id];assert(pendingChoice?.mutationId,'resolution is durable before HTTP');
  const committedRevision=(await db.query('select revision from private_phone_sync_records where record_key=$1',[a.replace(/^(state|blob)\//,'$1/sync2/')])).rows[0].revision;
  mac.reopen();await mac.journal.cycle();
  const retriedChoice=mac.requests.filter(item=>item.action==='resolve').at(-1);
  assert.equal(retriedChoice.mutationId,pendingChoice.mutationId,'restart retries the same chosen operation, never a new write');
  assert.equal((await db.query('select revision from private_phone_sync_records where record_key=$1',[a.replace(/^(state|blob)\//,'$1/sync2/')])).rows[0].revision,committedRevision);
  assert.equal(Object.keys(mac.disk.get(owner).resolutions||{}).length,0);
  await phone.journal.cycle();assert.deepEqual(mac.data[a],phone.data[a]);assert.equal(mac.data[a].text,'电脑尚未确认');
  const keepServer=await disagree('再保留手机云端','电脑这一份不选');
  mac.loseResolutionAck();await assert.rejects(mac.journal.resolve(keepServer.id,'server'),/lost resolution acknowledgement/);
  mac.reopen();await mac.journal.cycle();await phone.journal.cycle();
  assert.deepEqual(mac.data[a],phone.data[a]);assert.equal(mac.data[a].text,'再保留手机云端');
  assert.equal((await mac.journal.inspect()).conflicts.length,0);
  const extra='state/chat/main/role/lost';phone.data[extra]={id:'lost',text:'只发送一次'};
  phone.loseAck();await assert.rejects(phone.journal.cycle(),/lost acknowledgement/);
  const sent=phone.requests.filter(x=>x.action==='push').at(-1).changes.find(x=>x.key===extra);
  phone.reopen();await phone.journal.cycle();
  const retry=phone.requests.filter(x=>x.action==='push').at(-1).changes.find(x=>x.key===extra);
  assert.equal(retry.mutationId,sent.mutationId,'restart reuses the durable mutation UUID');
  assert.equal((await db.query('select revision from private_phone_sync_records where record_key=$1',[extra.replace(/^(state|blob)\//,'$1/sync2/')])).rows[0].revision,1);
  const fresh=device('fresh',false);fresh.interruptApply();await assert.rejects(fresh.journal.cycle(),/interrupted app save/);
  assert(fresh.disk.get(owner).inbox,'inbox is durable before app changes');
  fresh.reopen();await fresh.journal.cycle();assert.deepEqual(fresh.data,phone.data);assert(!fresh.disk.get(owner).inbox);
  const cursorBefore=fresh.journal.state().cursor,rowsBefore=copy(fresh.data);
  phone.data['state/new-after-switch']={text:'不能进入另一个账号'};await phone.journal.cycle();
  fresh.switchAccountDuringPull();await assert.rejects(fresh.journal.cycle(),/账号或设备已变化/);
  assert.equal(fresh.disk.get(owner).cursor,cursorBefore);assert.deepEqual(fresh.data,rowsBefore);
  const late=await disagree('迟到回复前手机修改','迟到回复前电脑修改');
  const localBefore=copy(mac.data),diskBefore=copy(mac.disk.get(owner));
  mac.switchAccountDuringResolve();await assert.rejects(mac.journal.resolve(late.id,'server'),/账号或设备已变化/);
  assert.deepEqual(mac.data,localBefore,'late successful resolution cannot mutate the new account view');
  assert.equal(mac.disk.get(owner).known[a].revision,diskBefore.known[a].revision);
  delete phone.data[c];await phone.journal.cycle();
  assert.equal((await db.query('select deleted from private_phone_sync_records where record_key=$1',[c.replace(/^(state|blob)\//,'$1/sync2/')])).rows[0].deleted,true);
 }finally{await db.close();}
});

test('secondary automatic pet motion never writes shared coordinates while a manual drag still saves',()=>{
 const source=read('desk-pet.js'),state={x:120,y:300,perch:null},pet={x:8,y:9};let saves=0,primary=false;
 const ctx=vm.createContext({state,cfg:()=>pet,Math,save:()=>{saves++;},window:{__SMALL_PHONE_ACCOUNT_SYNC__:true,privatePhoneAutomaticStateAllowed:()=>primary}});
 vm.runInContext(fnSource(source,'persist'),ctx);
 ctx.persist();assert.deepEqual(pet,{x:8,y:9});assert.equal(saves,0,'secondary animation stays on screen without creating shared-state writes');
 ctx.persist(true);assert.deepEqual(pet,{x:120,y:300});assert.equal(saves,1,'an explicit drag continues to save and sync normally');
 primary=true;state.x=130;ctx.persist();assert.equal(pet.x,130);assert.equal(saves,2,'the primary retains its existing automatic persistence');
});

test('media reads stay responsive during a durable push and reject late replies after an account change',async()=>{
 const env=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob,setTimeout:()=>1,clearTimeout:()=>{}});
 vm.runInContext(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-device-sync.js'),env);
 vm.runInContext(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-device-sync-client.js'),env);
 const owner='10000000-0000-0000-0000-000000000001',deviceId='20000000-0000-0000-0000-000000000001',copy=x=>JSON.parse(JSON.stringify(x)),disk=new Map(),seed={phase:'ready',sourceDeviceId:deviceId};
 let state={_deviceSyncOwner:owner,settings:{hist:12},me:{},contacts:[{id:'a'}],messages:{a:[]}},holdPush=false,holdMedia=false,pushStarted,releasePush,releaseMedia;
 const started=new Promise(resolve=>{pushStarted=resolve;});
 const host={core:env.NorthPrivateDeviceSyncCore,platform:'macOS',label:'fixture',snapshot:async()=>copy(state),getState:()=>state,boundOwner:()=>owner,stateOwner:()=>owner,bindOwner:async()=>{},meaningful:()=>true,emptyState:()=>({}),replaceState:async next=>{state=copy(next);},isVisible:()=>true,isBusy:()=>false,applying:()=>false,onAccount:()=>{},status:()=>{},reveal:()=>{},cancelReplies:()=>{},accountReset:()=>{},
  read:async k=>disk.has(k)?copy(disk.get(k)):null,write:async(k,v)=>disk.set(k,copy(v)),
  native:async(action,body)=>{
   if(action==='account.status')return {ok:true,loggedIn:true,userId:owner};
   if(body.action==='register')return {ok:true,device:{id:deviceId}};
   if(body.action==='inspect')return {ok:true,seed,isPrimary:false,conflicts:[]};
   if(body.action==='pull')return {ok:true,seed,records:[],cursor:'0',more:false};
   if(body.action==='push'){if(holdPush){pushStarted();await new Promise(resolve=>{releasePush=resolve;});}return {ok:true,outcomes:body.changes.map(x=>({key:x.key,mutationId:x.mutationId,status:'applied',revision:'1'}))};}
   if(body.action==='media.get'){if(holdMedia)await new Promise(resolve=>{releaseMedia=resolve;});return {ok:true,hash:body.hash,base64:'Zml4dHVyZQ'};}
   assert.fail('unexpected '+body.action);
  }};
 const client=env.NorthPrivateDeviceSyncRuntime.createClient(host);let cycle,image;
 try{
  await client.syncNow();holdPush=true;state.settings.hist=13;client.markDirty();cycle=client.syncNow();await started;
  image=client.request({action:'media.get',hash:'a'.repeat(64)});
  const result=await Promise.race([image,new Promise(resolve=>setTimeout(()=>resolve({blocked:true}),100))]);
  assert.equal(result.ok,true,'a small visible image is independent of a long durable journal push');
  releasePush();await cycle;holdPush=false;holdMedia=true;
  const late=client.request({action:'media.get',hash:'b'.repeat(64)});while(!releaseMedia)await new Promise(resolve=>setTimeout(resolve,1));
  client.accountChanged();releaseMedia();await assert.rejects(late,/账号已变化/);
 }finally{releasePush?.();releaseMedia?.();client.stop();await Promise.allSettled([cycle,image].filter(Boolean));}
});

test('authentication outages and role demotion preserve the existing account, local data and outbox',async()=>{
 const env=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob,setTimeout:()=>1,clearTimeout:()=>{}});
 vm.runInContext(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-device-sync.js'),env);
 vm.runInContext(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-device-sync-client.js'),env);
 const owner='10000000-0000-0000-0000-000000000001',deviceId='20000000-0000-0000-0000-000000000001',copy=x=>JSON.parse(JSON.stringify(x)),disk=new Map(),seed={phase:'ready',sourceDeviceId:deviceId};
 const state={_deviceSyncOwner:owner,settings:{hist:32},me:{},contacts:[{id:'a',name:'保留角色'}],messages:{a:[{id:'m1',content:'保留聊天'}]}};let errorMode='timeout',signouts=0,primary=true,reveals=0,releaseAuth,authStarted;const started=new Promise(resolve=>{authStarted=resolve;});const pushed=[];
 const host={core:env.NorthPrivateDeviceSyncCore,platform:'iOS',label:'fixture',snapshot:async()=>copy(state),getState:()=>state,boundOwner:()=>owner,stateOwner:()=>owner,nativeOwner:()=>owner,legacyOwner:()=>owner,hasPersistedSource:()=>true,bindOwner:async()=>{},meaningful:()=>true,emptyState:()=>({}),replaceState:async()=>assert.fail('no incoming records'),isVisible:()=>true,isBusy:()=>false,applying:()=>false,onAccount:()=>{},status:()=>{},reveal:()=>{reveals++;},cancelReplies:()=>{},accountReset:()=>{},
  read:async k=>disk.has(k)?copy(disk.get(k)):null,write:async(k,v)=>disk.set(k,copy(v)),native:async(action,body)=>{
   if(action==='account.status')return {ok:true,loggedIn:true,userId:owner};
   if(action==='account.signout'){signouts++;return {ok:true,loggedIn:false};}
   if(errorMode==='hold'){authStarted();await new Promise(resolve=>{releaseAuth=resolve;});return {ok:false,code:'account_auth_timeout',message:'账号认证服务器响应超时'};}
   if(errorMode==='timeout')return {ok:false,code:'account_auth_timeout',message:'账号认证服务器响应超时；手机号登录凭证仍保留在本机，请稍后刷新'};
   if(errorMode==='authentication')return {ok:false,error:'authentication_required'};
   if(errorMode==='unknown'&&body.action==='inspect'){errorMode='';return {ok:false,error:'device_revoked_or_unknown'};}
   if(body.action==='register')return {ok:true,device:{id:deviceId}};
   if(body.action==='inspect')return {ok:true,seed,isPrimary:primary,primaryDeviceId:primary?deviceId:'20000000-0000-0000-0000-000000000002',primaryRevision:primary?'1':'2',conflicts:[]};
   if(body.action==='push'){pushed.push(...body.changes);return {ok:true,outcomes:body.changes.map(x=>({key:x.key,mutationId:x.mutationId,status:'applied',revision:'1'}))};}
   if(body.action==='pull')return {ok:true,seed,records:[],cursor:'0',more:false};
   assert.fail('unexpected '+body.action);
  }};
 let client=env.NorthPrivateDeviceSyncRuntime.createClient(host);
 try{
  const original=JSON.stringify(state);errorMode='hold';const cycle=client.syncNow();await started;assert.equal(client.gateAllowed(),true,'a verified local source opens before background authentication returns');await client.waitForIdle();releaseAuth();await cycle;assert.equal(client.status().phase,'network');assert.equal(client.status().owner,owner);assert.equal(client.gateAllowed(),true,'verified owner data stays usable after a refresh timeout');assert.equal(client.status().secondary,null,'unknown authority is not displayed as a demotion');assert.equal(signouts,0);assert.equal(JSON.stringify(state),original);
  state.messages.a.push({id:'offline-new',content:'断线期间的新聊天'});client.markDirty();client.stop();client=env.NorthPrivateDeviceSyncRuntime.createClient(host);
  errorMode='authentication';await client.syncNow();assert.equal(client.status().phase,'network');assert.equal(client.gateAllowed(),true);assert.equal(signouts,0,'an authentication failure never invokes destructive local sign-out');
  errorMode='';await client.syncNow();assert.equal(client.backgroundAllowed(),true);assert(pushed.some(x=>x.value?.kind==='message'&&x.value.id==='offline-new'));
  const saved=JSON.stringify(state);primary=false;await client.syncNow();assert.equal(client.status().secondary,true);assert.equal(client.gateAllowed(),true,'becoming secondary does not sign the device out');assert.equal(signouts,0);assert.equal(JSON.stringify(state),saved);assert(reveals>0);
  const existingContext=client.context();errorMode='unknown';await client.syncNow();assert.equal(client.gateAllowed(),true,'an ambiguous device error does not interrupt local use');assert.equal(client.context(),existingContext);await client.syncNow();assert.equal(client.status().phase,'ready');assert.equal(client.context(),existingContext,'registration confirmation preserves the current conversation context');assert.equal(signouts,0);
 }finally{client.stop();}
});

test('Auth service outages remain retryable and cannot masquerade as account invalidation',async()=>{
 const module=await import('data:text/javascript;base64,'+Buffer.from(read('supabase/functions/phone-device-sync/core.mjs')).toString('base64'));
 for(const status of [429,500,502,503]){
  let calls=0;const handler=module.createSupabaseSync({url:'https://fixture.supabase.co',serviceKey:'fixture-service-key',masterKey:'a'.repeat(43),fetchAPI:async url=>{calls++;assert.equal(new URL(url).pathname,'/auth/v1/user');return Response.json({message:'fixture-sensitive-upstream-message'},{status});}});
  const response=await handler(new Request('https://fixture.test/sync',{method:'POST',headers:{Authorization:'Bearer header.payload.signature','Content-Type':'application/json'},body:JSON.stringify({protocolVersion:2,action:'register',platform:'iOS',label:'fixture'})}));
  const result=await response.json();assert.equal(response.status,503);assert.equal(result.error,'account_auth_temporarily_unavailable');assert(!JSON.stringify(result).includes('fixture-sensitive'));assert.equal(calls,1);
 }
});
test('iPhone session replacement failure preserves the existing Keychain credential',()=>{
 const source=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'),start=source.indexOf('private func savePrivateAccountSession(');assert(start>=0);const open=source.indexOf('{',start);let level=1,end=open+1;while(level&&end<source.length){if(source[end]==='{')level++;if(source[end]==='}')level--;end++;}
 const method=source.slice(start,end).replace('private func','func');
 const swift="import Foundation\ntypealias CFDictionary=NSDictionary\ntypealias OSStatus=Int32\nlet kSecClass=\"class\",kSecAttrService=\"service\",kSecAttrAccount=\"account\",kSecValueData=\"data\",kSecAttrAccessible=\"accessible\"\nlet kSecClassGenericPassword=\"generic\",kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly=\"after-unlock\"\nlet errSecSuccess:OSStatus=0,errSecItemNotFound:OSStatus = -25300\nvar stored:Data?=Data(\"previous-credential\".utf8),updateStatus:OSStatus = -50,addStatus:OSStatus = -50,deletions=0\nfunc SecItemUpdate(_ query:CFDictionary,_ attributes:CFDictionary)->OSStatus{if updateStatus==0{stored=attributes[kSecValueData] as? Data};return updateStatus}\nfunc SecItemAdd(_ item:CFDictionary,_ result:Any?)->OSStatus{if addStatus==0{stored=item[kSecValueData] as? Data};return addStatus}\nfunc SecItemDelete(_ query:CFDictionary)->OSStatus{deletions+=1;stored=nil;return 0}\nstruct PrivateAccountSession:Codable{let value:String}\nfinal class Probe{\n static let privateAccountKeychainService=\"fixture-service\"\n"+method+"\n}\nlet bridge=Probe(),previous=stored\ndo{try bridge.savePrivateAccountSession(PrivateAccountSession(value:\"new\"));assertionFailure(\"write must fail\")}catch{}\nprecondition(stored==previous,\"failed replacement must retain the previous credential\")\nprecondition(deletions==0,\"renewal never deletes a credential\")\nupdateStatus=0;try bridge.savePrivateAccountSession(PrivateAccountSession(value:\"updated\"));precondition(stored != previous)\nstored=nil;updateStatus=errSecItemNotFound;addStatus=0;try bridge.savePrivateAccountSession(PrivateAccountSession(value:\"new-install\"));precondition(stored != nil)\nprint(\"atomic-credential-preserved\")\n";
 const output=cp.execFileSync('swift',['-'],{input:swift,encoding:'utf8',maxBuffer:2*1024*1024});assert(output.includes('atomic-credential-preserved'));
});
