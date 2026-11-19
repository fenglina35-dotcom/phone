import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {webcrypto} from 'node:crypto';
import {read,PRIV_DIR} from './_helpers.mjs';
import {createVaultHandler,createSupabaseVault} from '../supabase/functions/phone-mcp-vault/core.mjs';
import {createAccountCipher} from '../supabase/functions/phone-device-sync/core.mjs';
import vm from 'node:vm';

test('private MCP vault: actual SQL/crypto migration, account isolation, approval, refresh and unknown writes',async()=>{
 const require=createRequire(import.meta.url),{PGlite}=require(path.join(os.homedir(),'AppData/Local/CodexHardwareTests/robot-voice-sql-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
 const db=new PGlite(),owner='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002';
 const sessions={phone:'20000000-0000-0000-0000-000000000001',mac:'20000000-0000-0000-0000-000000000002',other:'20000000-0000-0000-0000-000000000003'};
 const oid=n=>'50000000-0000-0000-0000-'+String(n).padStart(12,'0');
 try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;insert into auth.users values('${owner}'),('${other}');`);
  await db.exec(read('supabase/migrations/202611170001_private_phone_device_sync.sql'));
  await db.exec(read('supabase/migrations/202611170002_private_phone_mcp_vault.sql'));
  const rpc=async(name,args)=>(await db.query('select public.'+name+'('+Object.keys(args).map((k,i)=>k+'=>$'+(i+1)).join(',')+') result',Object.values(args))).rows[0].result;
  const devices={};for(const token of Object.keys(sessions))devices[token]=(await rpc('private_phone_sync_device',{p_user:token==='other'?other:owner,p_session:sessions[token],p_platform:token==='phone'?'iOS':'macOS',p_label:token})).id;
  const store={rpc,async key(user,candidate){await db.query('insert into private_phone_sync_keys(user_id,wrapped_key) values($1,$2) on conflict(user_id) do nothing',[user,candidate]);return(await db.query('select wrapped_key from private_phone_sync_keys where user_id=$1',[user])).rows[0].wrapped_key;}};
  let refreshes=0,providerCalls=0,writes=0,refreshFail=false,toolFail=false,largeReply=false;
  const calls=[];
  const provider=async(url,options)=>{
   const u=new URL(url);assert.equal(u.hostname,'mcp.cloudflare.com');assert.equal(options.redirect,'error');assert(options.signal);
   if(u.pathname==='/token'){
    refreshes++;const form=new URLSearchParams(options.body);assert.equal(form.get('grant_type'),'refresh_token');assert(form.get('refresh_token').startsWith('fixture-refresh-'));
    await new Promise(r=>setTimeout(r,40));if(refreshFail)throw new Error('fixture unknown refresh');
    return Response.json({access_token:'fixture-access-rotated-'+refreshes,refresh_token:'fixture-refresh-rotated-'+refreshes,expires_in:7200});
   }
   providerCalls++;const body=JSON.parse(options.body);calls.push(body);assert(options.headers.Authorization.startsWith('Bearer fixture-access-'));
   if(body.method==='tools/call'){if(body.params.name==='write')writes++;await new Promise(r=>setTimeout(r,40));if(toolFail)throw new Error('fixture submitted response lost');}
   return Response.json({jsonrpc:'2.0',id:body.id,result:{content:[{type:'text',text:largeReply?'\\'.repeat(500000):'真实受控结果；fixture-access-rotated-'+refreshes}]}});
  };
  const masterKey='c'.repeat(43),handler=createVaultHandler({store,authenticate:async token=>({userID:token==='other'?other:owner,sessionID:sessions[token]}),masterKey,fetchAPI:provider,cryptoAPI:webcrypto,pause:ms=>new Promise(r=>setTimeout(r,Math.min(ms,30)))});
  const send=async(token,body,headers={})=>{const response=await handler(new Request('https://fixture.test/vault',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...headers},body:JSON.stringify({deviceId:devices[token],accountId:'main',...body})}));const json=await response.json();assert.equal(response.headers.get('Cache-Control'),'no-store');return {status:response.status,json};};
  const connection={id:'m-cloudflare',name:'Cloudflare',provider:'cloudflare',url:'https://mcp.cloudflare.com/mcp',auth:'oauth',token:'fixture-access-original',refresh:'fixture-refresh-original',exp:Date.now()-1000,clientId:'fixture-client',clientAuth:'none',clientSecret:'',oauth:{token_endpoint:'https://mcp.cloudflare.com/token'},oauthResource:'https://mcp.cloudflare.com/mcp',roles:['role-a'],disabledTools:[],enabled:true,mode:'ask',state:'connected',rev:1,tools:[{name:'read',title:'读取',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:true}},{name:'write',title:'写入',inputSchema:{type:'object',properties:{text:{type:'string'}},required:['text'],additionalProperties:false},annotations:{readOnlyHint:false}}]};
  async function prepare(n,c=connection,revision='0'){
   const body={action:'put',phase:'prepare',migrationId:oid(n),baseRevision:revision,connection:c};const out=await send('phone',body);assert.equal(out.status,200,JSON.stringify(out.json));return {...body,digest:out.json.digest};
  }
  async function activate(prepared){const result=await send('phone',{action:'put',phase:'activate',connectionId:prepared.connection.id,migrationId:prepared.migrationId,baseRevision:prepared.baseRevision,digest:prepared.digest});assert.equal(result.status,200,JSON.stringify(result.json));return result.json;}
  const pending=await prepare(1);
  assert.equal((await send('mac',{action:'list'})).json.connections.length,0,'staged credentials are not executable or visible as connected');
  assert.equal((await send('mac',{action:'list',connectionId:connection.id})).json.connection.active,false);
  const active=await activate(pending);assert.equal(active.revision,'1');
  assert.deepEqual(await activate(pending),active,'lost activation ACK reuses the same migration identity');
  assert.equal((await send('phone',{action:'put',phase:'activate',connectionId:connection.id,migrationId:pending.migrationId,baseRevision:'0',digest:'x'.repeat(43)})).json.error,'mutation_payload_changed');
  const publicData=(await send('mac',{action:'list'})).json.connections[0];
  assert.equal(publicData.accountManaged,true);assert.equal(publicData.token,'');assert.equal(publicData.refresh,'');assert.equal(publicData.clientSecret,'');assert(!JSON.stringify(publicData).includes('fixture-access-original'));
  const encrypted=(await db.query('select ciphertext from private_phone_mcp_connections')).rows[0].ciphertext;
  assert(!encrypted.includes('fixture-access-original')&&!encrypted.includes('fixture-refresh-original'));
  assert.equal((await send('other',{action:'list'})).json.connections.length,0);
  assert.equal((await send('mac',{action:'list',accountId:'other-wechat'})).json.connections.length,0);
  assert.equal((await send('mac',{action:'list'},{Origin:'null'})).status,403);
  assert.equal((await send('phone',{...pending,connection:{...connection,url:'https://127.0.0.1/mcp'}})).json.error,'unsupported_destination');
  assert.equal((await send('phone',{...pending,connection:{...connection,oauth:{token_endpoint:'https://mcp.notion.com/token'}}})).json.error,'unsupported_oauth_destination');
  const base={action:'rpc',connectionId:connection.id,connectionRevision:'1',operationId:oid(20),method:'tools/call',params:{name:'write',arguments:{text:'hello'}},roleId:'role-a',rpcId:71,protocolVersion:'2025-11-25'};
  assert.equal((await send('mac',{...base,roleId:'role-b',phase:'approval'})).json.error,'role_not_allowed');
  assert.equal((await send('mac',{...base,params:{name:'write',arguments:{extra:'bad'}},phase:'approval'})).json.error,'invalid_parameters');
  assert.equal((await send('mac',{...base,confirmed:true})).json.error,'approval_required');assert.equal(providerCalls,0);
  const approval=(await send('mac',{...base,phase:'approval'})).json.approvalToken;assert(approval);
  assert.equal((await send('mac',{...base,params:{name:'write',arguments:{text:'changed'}},approvalToken:approval})).json.error,'invalid_approval');
  assert.equal((await send('mac',{...base,operationId:oid(21),approvalToken:approval})).json.error,'invalid_approval');
  const write=await send('mac',{...base,approvalToken:approval});assert.equal(write.status,200);assert.equal(writes,1);assert.equal(refreshes,1);
  assert(!write.json.text.includes('fixture-access-rotated-1'),'transport credentials are removed from provider echoes');
  assert.deepEqual((await send('mac',{...base,approvalToken:approval})).json,write.json);assert.equal(writes,1,'same operation does not execute twice');
  const keys=await createAccountCipher({store,masterKey,cryptoAPI:webcrypto}).accountKeys(owner);
  const accountCipher=createAccountCipher({store,masterKey,cryptoAPI:webcrypto});
  const saved=JSON.parse(await accountCipher.open(keys.aes,(await db.query('select ciphertext from private_phone_mcp_connections')).rows[0].ciphertext,'private-phone-mcp/connection/'+owner+'/main/'+connection.id,1800000));
  assert.equal(saved.refresh,'fixture-refresh-rotated-1');
  // Escaped valid provider JSON stays below 1 MiB, but its durable outer outcome
  // exceeds the old 1.8M envelope/2M native limit. A lost ACK must read the stored
  // outcome, not turn into "unknown" or submit the external write again.
  largeReply=true;const largeWrite={...base,operationId:oid(22),rpcId:72},largeApproval=(await send('phone',{...largeWrite,phase:'approval'})).json.approvalToken,beforeLarge=writes;
  const largeResult=await send('phone',{...largeWrite,approvalToken:largeApproval});assert.equal(largeResult.status,200,JSON.stringify(largeResult.json));assert.equal(largeResult.json.unknown,undefined);
  assert.equal(JSON.parse(largeResult.json.text).result.content[0].text.length,500000);assert(Buffer.byteLength(largeResult.json.text)<1048576);assert(Buffer.byteLength(JSON.stringify(largeResult.json))>2000000);
  const largeStored=(await db.query('select ciphertext,state from private_phone_mcp_operations where id=$1',[largeWrite.operationId])).rows[0];assert.equal(largeStored.state,'complete');assert(largeStored.ciphertext.length>1800000&&largeStored.ciphertext.length<4000000);
  assert.deepEqual((await send('phone',{...largeWrite,approvalToken:largeApproval})).json,largeResult.json);assert.equal(writes,beforeLarge+1,'large cached result never replays the write');largeReply=false;
  const restAdapter=createSupabaseVault({url:'https://fixture.supabase.co',serviceKey:'fixture-service-key',masterKey,fetchAPI:async(url,options)=>{const pathname=new URL(url).pathname;if(pathname==='/auth/v1/user')return Response.json({id:owner});if(pathname==='/rest/v1/private_phone_sync_keys')return Response.json((await db.query('select wrapped_key,key_version from private_phone_sync_keys where user_id=$1',[owner])).rows);if(pathname.startsWith('/rest/v1/rpc/'))return Response.json(await rpc(pathname.split('/').at(-1),JSON.parse(options.body)));throw new Error('cached ACK cannot contact provider');}});
  const jwt='h.'+Buffer.from(JSON.stringify({sub:owner,session_id:sessions.phone,role:'authenticated',exp:Math.floor(Date.now()/1000)+300})).toString('base64url')+'.s';
  const restCached=await restAdapter(new Request('https://fixture.test/vault',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt},body:JSON.stringify({deviceId:devices.phone,accountId:'main',...largeWrite,approvalToken:largeApproval})}));assert.equal(restCached.status,200);assert.deepEqual(await restCached.json(),largeResult.json);assert.equal(writes,beforeLarge+1);
  // A fresh credential update expires at the same time on two devices; only one refresh happens.
  const fresh={...connection,token:'fixture-access-second',refresh:'fixture-refresh-second',rev:2};await activate(await prepare(2,fresh,'1'));
  const beforeRefresh=refreshes;
  const reads=await Promise.all(['phone','mac'].map((token,i)=>send(token,{...base,connectionRevision:'2',method:'tools/call',params:{name:'read',arguments:{id:'parallel-'+i}},operationId:oid(30+i),rpcId:80+i})));
  assert(reads.every(r=>r.status===200),JSON.stringify(reads));assert.equal(refreshes,beforeRefresh+1,'central rotating refresh is serialized');
  // A submitted external write with no reply is never replayed, including after another device asks.
  toolFail=true;const unknown={...base,connectionRevision:'2',operationId:oid(40),rpcId:90};const ticket=(await send('phone',{...unknown,phase:'approval'})).json.approvalToken;
  const beforeWrite=writes;assert.equal((await send('phone',{...unknown,approvalToken:ticket})).json.unknown,true);assert.equal(writes,beforeWrite+1);
  assert.equal((await send('phone',{...unknown,approvalToken:ticket})).json.error,'operation_result_unknown');assert.equal(writes,beforeWrite+1);
  toolFail=false;
  // Unknown refresh freezes old credentials instead of reusing a possibly consumed refresh token.
  await activate(await prepare(3,{...connection,rev:3},'2'));refreshFail=true;
  const lostRefresh={...base,connectionRevision:'3',operationId:oid(50),params:{name:'read',arguments:{id:'refresh-unknown'}}};
  assert.equal((await send('phone',lostRefresh)).json.unknown,true);const frozenCount=refreshes;
  assert.equal((await send('mac',{...lostRefresh,operationId:oid(51)})).json.error,'refresh_result_unknown');assert.equal(refreshes,frozenCount);
  refreshFail=false;await activate(await prepare(4,{...connection,rev:4,exp:Date.now()+3600000},'3'));
  const cloud=(await send('phone',{action:'list'})).json.connections[0];
  await activate(await prepare(7,{...cloud,name:'账号共享后的连接名称'},'4'));
  const metadataOnly=JSON.parse(await accountCipher.open(keys.aes,(await db.query('select ciphertext from private_phone_mcp_connections')).rows[0].ciphertext,'private-phone-mcp/connection/'+owner+'/main/'+connection.id,1800000));
  assert.equal(metadataOnly.refresh,'fixture-refresh-original','editing role/config metadata preserves the server-owned credential');assert.equal(metadataOnly.name,'账号共享后的连接名称');
  assert.equal((await send('phone',{action:'put',phase:'prepare',migrationId:oid(5),baseRevision:'5',connection:{...cloud,url:'https://mcp.notion.com/mcp',provider:'notion'}})).json.error,'credential_destination_changed');
  assert.equal((await send('phone',{action:'put',phase:'prepare',migrationId:oid(6),baseRevision:'0',connection:cloud})).json.error,'connection_changed');
  const disconnected=await send('phone',{action:'remove',connectionId:connection.id,baseRevision:'5',keep:true});assert.equal(disconnected.status,200);
  const stopped=(await send('mac',{action:'list'})).json.connections[0];assert.equal(stopped.enabled,false);assert.equal(stopped.state,'disconnected');assert.equal(stopped.cloudRevision,'6');
  const rawStopped=JSON.parse(await accountCipher.open(keys.aes,(await db.query('select ciphertext from private_phone_mcp_connections')).rows[0].ciphertext,'private-phone-mcp/connection/'+owner+'/main/'+connection.id,1800000));
  assert.equal(rawStopped.refresh,'');assert.equal(rawStopped.token,'');
  assert.equal((await send('phone',{action:'remove',connectionId:connection.id,baseRevision:'6'})).status,200);
  assert.equal((await send('mac',{action:'list'})).json.connections[0].deleted,true);
  // A metadata stage must not replace credentials rotated by another device before activation.
  const race={...connection,id:'m-race',rev:1,exp:Date.now()-1000};await activate(await prepare(200,race));
  const racePublic=(await send('phone',{action:'list',connectionId:race.id})).json.connection.value;
  const raceStage=await prepare(201,{...racePublic,name:'修改连接名称'},'1');
  const racedRead={...base,connectionId:race.id,connectionRevision:'1',operationId:oid(202),params:{name:'read',arguments:{id:'credential-race'}}};
  assert.equal((await send('mac',racedRead)).status,200);
  assert.equal((await send('phone',{action:'put',phase:'activate',connectionId:race.id,migrationId:raceStage.migrationId,baseRevision:'1',digest:raceStage.digest})).json.error,'credential_changed');
  const rotated=(await send('phone',{action:'list',connectionId:race.id})).json.connection.value;
  await activate(await prepare(203,{...rotated,name:'修改连接名称'},'1'));
  const raceCipher=(await db.query('select ciphertext from private_phone_mcp_connections where id=$1',[race.id])).rows[0].ciphertext;
  const raceFinal=JSON.parse(await accountCipher.open(keys.aes,raceCipher,'private-phone-mcp/connection/'+owner+'/main/'+race.id,1800000));
  assert.equal(raceFinal.refresh,'fixture-refresh-rotated-'+refreshes);assert.equal(raceFinal.name,'修改连接名称');
  await rpc('private_phone_sync_revoke',{p_user:owner,p_session:sessions.phone,p_device:devices.phone,p_target:devices.mac});
  assert.equal((await send('mac',{action:'list'})).json.error,'device_revoked_or_unknown');
  await db.exec('set role authenticated');await assert.rejects(db.query('select * from private_phone_mcp_connections'),/permission denied/);await assert.rejects(rpc('private_phone_mcp_read',{p_user:owner,p_session:sessions.phone,p_device:devices.phone,p_account:'main'}),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});

test('legacy non-expiring managed connections remain readable and metadata updates preserve credentials',async()=>{
 for(const auth of ['none','bearer']){
  const owner='10000000-0000-0000-0000-000000000001',id='legacy-'+auth,masterKey='c'.repeat(43),calls=[];let wrapped,ciphertext,preparedCipher;
  const value={id,name:'已验证连接',provider:'cloudflare',url:'https://docs.mcp.cloudflare.com/mcp',auth,token:auth==='bearer'?'fixture-credential-must-survive':'',refresh:'',clientSecret:'',enabled:true,roles:['role-a'],disabledTools:[],mode:'ask',state:'connected',rev:2,tools:[{name:'read',inputSchema:{type:'object'},annotations:{readOnlyHint:true}}],description:'保留原文 {"exp":undefined}'};
  const store={key:async(_,candidate)=>wrapped||(wrapped=candidate),rpc:async(name,args)=>{calls.push(name);if(name==='private_phone_sync_assert_device')return {};if(name==='private_phone_mcp_read')return args.p_id?{connection:{id,active:true,deleted:false,revision:'2',ciphertext}}:{connections:[{id,active:true,deleted:false,revision:'2',ciphertext}],nextCursor:null};if(name==='private_phone_mcp_put'){preparedCipher=args.p_ciphertext;return {};}throw new Error('unexpected RPC');}};
  const cipher=createAccountCipher({store,masterKey,cryptoAPI:webcrypto}),keys=await cipher.accountKeys(owner),aad='private-phone-mcp/connection/'+owner+'/main/'+id;
  ciphertext=await cipher.seal(keys.aes,JSON.stringify(value).slice(0,-1)+',"exp":undefined}',aad);
  const handler=createVaultHandler({store,authenticate:async()=>({userID:owner,sessionID:'20000000-0000-0000-0000-000000000001'}),masterKey,cryptoAPI:webcrypto});
  const send=async body=>{const r=await handler(new Request('https://fixture.test/vault',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer fixture'},body:JSON.stringify({deviceId:'30000000-0000-0000-0000-000000000001',accountId:'main',...body})}));return {status:r.status,json:await r.json()};};
  const result=await send({action:'list'});assert.equal(result.status,200,JSON.stringify(result.json));assert.equal(result.json.connections[0].description,value.description);assert.equal(result.json.connections[0].token,'');assert.deepEqual(result.json.connections[0].roles,['role-a']);assert(!calls.includes('private_phone_mcp_put'),'reading old format never rewrites existing encrypted credentials');
  const migrated=await send({action:'put',phase:'prepare',migrationId:'50000000-0000-0000-0000-000000000001',baseRevision:'2',connection:{...result.json.connections[0],mode:'auto'}});assert.equal(migrated.status,200,JSON.stringify(migrated.json));
  const restored=JSON.parse(await cipher.open(keys.aes,preparedCipher,aad,1800000));assert.equal(restored.token,value.token);assert.equal(restored.description,value.description);assert(!Object.hasOwn(restored,'exp'));
  ciphertext=await cipher.seal(keys.aes,JSON.stringify(value).slice(0,-1)+',"other":undefined}',aad);assert.equal((await send({action:'list'})).status,503,'no general tolerant parser for arbitrary malformed credentials');
 }
});

test('MCP vault Auth outages remain temporary instead of impersonating expired login',async()=>{
 for(const status of [429,500,502,503]){
  let calls=0;const handler=createSupabaseVault({url:'https://fixture.supabase.co',serviceKey:'fixture-server-only',masterKey:'c'.repeat(43),fetchAPI:async url=>{calls++;assert.equal(new URL(url).pathname,'/auth/v1/user');return Response.json({message:'fixture-secret-upstream'},{status});}});
  const response=await handler(new Request('https://fixture.test/vault',{method:'POST',headers:{Authorization:'Bearer header.payload.signature','Content-Type':'application/json'},body:JSON.stringify({action:'list',deviceId:'30000000-0000-0000-0000-000000000001',accountId:'main'})}));
  const result=await response.json();assert.equal(response.status,503);assert.equal(result.error,'account_auth_temporarily_unavailable');assert(!JSON.stringify(result).includes('fixture-secret'));assert.equal(calls,1);
 }
});

test('MCP stage diagnostics reveal no credential, owner, request or raw failure',async()=>{
 const events=[],secret='never-log-this-credential';
 const handler=createVaultHandler({authenticate:async()=>({userID:'10000000-0000-0000-0000-000000000001',sessionID:'20000000-0000-0000-0000-000000000001'}),store:{rpc:async()=>({}),key:async()=>{throw new TypeError(secret);}},masterKey:'c'.repeat(43),reportError:row=>events.push(row)});
 const r=await handler(new Request('https://fixture.test/vault',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({action:'list',deviceId:'30000000-0000-0000-0000-000000000001',accountId:'main'})}));
 assert.equal(r.status,503);assert.deepEqual(events,[{event:'mcp_vault_failure',stage:'account-key',code:'vault_service_unavailable',kind:'TypeError'}]);assert(!JSON.stringify(events).includes(secret));assert(!JSON.stringify(events).includes('10000000'));
});

test('vault REST auth: invalid Auth, foreign sub and expired JWT cannot reach any data RPC',async()=>{
 const user='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002';
 let rejectAuth=true;const calls=[];
 const handler=createSupabaseVault({url:'https://fixture.supabase.co',serviceKey:'fixture-server-only',masterKey:'c'.repeat(43),fetchAPI:async(url,options)=>{
  calls.push(String(url));assert.equal(new URL(url).pathname,'/auth/v1/user','unverified claims cannot reach a table or RPC');assert.equal(options.redirect,'error');
  return Response.json(rejectAuth?{message:'fixture-server-only'}:{id:user},{status:rejectAuth?401:200});
 }});
 function request(sub,exp){const token='h.'+Buffer.from(JSON.stringify({sub,session_id:'20000000-0000-0000-0000-000000000001',role:'authenticated',exp})).toString('base64url')+'.s';return new Request('https://fixture.test/vault',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'list',deviceId:'30000000-0000-0000-0000-000000000001',accountId:'main'})});}
 const failed=await handler(request(user,Math.floor(Date.now()/1000)+300));assert.equal(failed.status,401);assert(!(await failed.text()).includes('fixture-server-only'));
 rejectAuth=false;assert.equal((await handler(request(other,Math.floor(Date.now()/1000)+300))).status,401);
 assert.equal((await handler(request(user,Math.floor(Date.now()/1000)-1))).status,401);
 assert.equal(calls.length,3);
});

test('private MCP client: activation ACK loss freezes direct tokens, then adopts shared metadata without copying credentials',async()=>{
 const owner='10000000-0000-0000-0000-000000000001',device='30000000-0000-0000-0000-000000000001';
 const full=read(PRIV_DIR+'app.js'),start=full.indexOf('const MCPTools=(()=>{'),end=full.indexOf('\n})();',start);
 assert(start>=0&&end>start);
 const source=full.slice(start,end+6)+'\n;globalThis.vaultTest=MCPTools;';
 const connection={id:'m-fixture',provider:'cloudflare',name:'Cloudflare',url:'https://mcp.cloudflare.com/mcp',auth:'oauth',token:'fixture-local-access',refresh:'fixture-local-refresh',clientSecret:'fixture-local-client-secret',clientId:'fixture-client',clientAuth:'none',oauth:{token_endpoint:'https://mcp.cloudflare.com/token'},roles:['role-a'],disabledTools:[],mode:'ask',enabled:true,state:'connected',rev:1,tools:[],exp:Date.now()+3600000};
 const oldKey='fixture-license|account:'+owner+':main',newKey='account:'+owner+':main',stored=new Map([['smallphone-mcp-local-v1',JSON.stringify({[oldKey]:{connections:[connection],receipts:[]}})]]);
 const active=new Map(),staged=new Map(),nativeCalls=[],timers=new Map();let timer=0,dropActivation=true,revision=0,changedDuringPrepare=false,vaultListFail=false,vaultRPCFail=false;
 const publicValue=c=>({...JSON.parse(JSON.stringify(c)),token:'',refresh:'',clientSecret:'',pending:null,accountManaged:true,accountPreparing:false,accountMigrating:false,cloudRevision:String(revision)});
 const native=async(action,body)=>{
  nativeCalls.push({action,body:JSON.parse(JSON.stringify(body))});
  if(action==='account.sync')return {ok:true,device:{id:device}};
  if(vaultListFail&&action==='account.mcp'&&body.action==='list')return {ok:false,error:'account_auth_temporarily_unavailable'};
  if(vaultRPCFail&&action==='account.mcp'&&body.action==='rpc')return {ok:false,error:'account_auth_temporarily_unavailable'};
  assert.equal(action,'account.mcp','there is no fallback to direct credential transport');
  assert.equal(body.deviceId,device);assert.equal(body.accountId,'main');
  if(body.action==='list'){
   if(body.connectionId){const row=active.get(body.connectionId),stage=staged.get(body.connectionId);return{ok:true,connection:row?{active:true,deleted:false,revision:String(revision),activatedNonce:row.nonce,value:publicValue(row.c)}:stage?{active:false,revision:'0',stagingNonce:stage.nonce}:null};}
   return {ok:true,connections:Array.from(active.values(),x=>publicValue(x.c)),nextCursor:null};
  }
  if(body.action==='put'){
   if(body.baseRevision!==String(revision))return{ok:false,error:'connection_changed'};
   if(body.phase==='prepare'){
    staged.set(body.connection.id,{nonce:body.migrationId,c:body.connection});
    if(!changedDuringPrepare){changedDuringPrepare=true;const all=JSON.parse(stored.get('smallphone-mcp-local-v1')),local=all[newKey].connections[0];local.token='fixture-local-access-refreshed';local.refresh='fixture-local-refresh-refreshed';stored.set('smallphone-mcp-local-v1',JSON.stringify(all));}
    return{ok:true,digest:'d'.repeat(43)};
   }
   const stage=staged.get(body.connectionId);assert.equal(stage.nonce,body.migrationId);revision++;active.set(body.connectionId,stage);
   if(dropActivation){dropActivation=false;throw new Error('fixture lost activation ACK');}return{ok:true,revision:String(revision)};
  }
  if(body.action==='rpc'){
   const result=body.method==='initialize'?{protocolVersion:'2025-11-25'}:body.method==='tools/list'?{tools:[]}:{};
   return {ok:true,status:200,headers:{},text:JSON.stringify({jsonrpc:'2.0',id:body.rpcId,result})};
  }
  throw new Error('unexpected vault action');
 };
 const root={__SMALL_PHONE_PRIVATE__:true,__SMALL_PHONE_MCP_HTTP__:true,SmallPhoneNative:{request:native}};
 const context=vm.createContext({window:root,_privatePhoneAccount:{loggedIn:true,userId:owner},privatePhoneAccountAvailable:()=>true,privateNativeAppOn:()=>true,
  NorthLicense:{session:()=>({licenseId:'fixture-license'})},actId:()=> 'main',S:{contacts:[{id:'role-a'}],messages:{},settings:{}},getC:id=>id==='role-a'?{id}:null,
  cur:()=>({p:'home'}),crypto:webcrypto,URL,URLSearchParams,TextEncoder,TextDecoder,AbortController,Set,Map,Uint8Array,
  btoa:v=>Buffer.from(v,'binary').toString('base64'),atob:v=>Buffer.from(v,'base64').toString('binary'),
  localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},
  setTimeout:(fn,ms)=>{timers.set(++timer,{fn,ms});return timer;},clearTimeout:id=>timers.delete(id),setInterval:()=>++timer,clearInterval:()=>{},
  document:{getElementById:()=>null},toast:()=>{},northLocaleDate:()=>'',fetch:()=>{throw new Error('direct fetch must stay frozen');}});
 vm.runInContext(source,context);const api=context.vaultTest;
 assert.equal(api.scope(),newKey);
  await assert.rejects(api.accountSync(true),/当前账号/);
  assert.equal(active.size,0,'credentials changed during prepare cannot activate stale staging');
  assert.equal(api.connection(connection.id).refresh,'fixture-local-refresh-refreshed');
  assert.equal(api.connection(connection.id).accountPreparing,false,'a rejected inactive stage keeps local connection usable');
 await assert.rejects(api.accountSync(true),/lost activation ACK/);
 let local=JSON.parse(stored.get('smallphone-mcp-local-v1'))[newKey].connections[0];
  assert.equal(local.accountMigrating,true);assert.equal(local.token,'fixture-local-access-refreshed','credentials are not deleted before ownership is confirmed');
 assert.equal(active.size,1,'server accepted activation even though the reply was lost');
  assert.equal(active.get(connection.id).c.refresh,'fixture-local-refresh-refreshed','the vault receives the latest local rotating credential');
 await assert.rejects(api.connect(connection.id),/安全迁移/);
 assert(!nativeCalls.some(x=>x.action==='mcp.http.request'),'uncertain activation never reuses the direct refresh token');
 await api.accountSync(true);
 local=JSON.parse(stored.get('smallphone-mcp-local-v1'))[newKey].connections[0];
 assert.equal(local.accountManaged,true);assert.equal(local.accountMigrating,false);assert.equal(local.token,'');assert.equal(local.refresh,'');assert.equal(local.clientSecret,'');
 const legacy=JSON.parse(stored.get('smallphone-mcp-local-v1'))[oldKey].connections[0];assert.equal(legacy.token,'');assert.equal(legacy.refresh,'');
 await api.connect(connection.id);
 assert.deepEqual(nativeCalls.filter(x=>x.action==='account.mcp'&&x.body.action==='rpc').map(x=>x.body.method),['initialize','notifications/initialized','tools/list']);
 const listsBefore=nativeCalls.filter(x=>x.action==='account.mcp'&&x.body.action==='list').length;
 vaultListFail=true;await api.connect(connection.id);vaultListFail=false;
 assert.equal(nativeCalls.filter(x=>x.action==='account.mcp'&&x.body.action==='list').length,listsBefore,'an already synchronized connection never waits for another account list');
 const verified=JSON.stringify(api.connection(connection.id));vaultRPCFail=true;await assert.rejects(api.connect(connection.id),/暂时繁忙/);vaultRPCFail=false;
 assert.equal(api.connection(connection.id).state,'connected','a temporary verification failure preserves the verified connection');assert.equal(api.connection(connection.id).accountManaged,true);assert.equal(JSON.stringify(api.connection(connection.id)),verified,'temporary failure changes no credentials, tools or role grants');
 const ctx=api.context('role-a');assert.equal(ctx,null,'an empty tool catalog does not pretend role tools exist');
  api.configure(connection.id,{roles:['role-a','role-b'],mode:'auto'});
  await api.accountSync(true);
  assert.deepEqual(Array.from(active.get(connection.id).c.roles),['role-a','role-b']);assert.equal(active.get(connection.id).c.mode,'auto');
  assert.equal(api.connection(connection.id).token,'','configuration updates do not restore local access tokens');
  // A concurrent metadata revision stays visible as a conflict, not a silent lost permission change.
  api.configure(connection.id,{mode:'ask'});revision++;
  await assert.rejects(api.accountSync(true),/其他设备/);
  assert(api.connection(connection.id).accountConflict);assert.equal(api.connection(connection.id).mode,'ask');
  await api.resolveAccountConflict(connection.id,false);assert.equal(api.connection(connection.id).mode,'auto');
 api.accountReset();
  stored.set('smallphone-mcp-local-v1',JSON.stringify({'fixture-license:main':{connections:[connection],receipts:[]}}));
  assert.equal(api.data().connections.length,0,'a license-only scope is not guessed into the current private account');
  root.NorthPrivateDeviceSyncClient={legacySourceOwned:id=>id===owner};
  assert.equal(api.data().connections.length,1,'the current native legacy owner can claim its precise old license scope');
  stored.set('smallphone-mcp-local-v1',JSON.stringify({'fixture-license:main':{connections:[connection],receipts:[]},'fixture-license|account:10000000-0000-0000-0000-000000000002:main':{connections:[],receipts:[]}}));
  assert.equal(api.data().connections.length,0,'an ambiguous older private owner prevents license-only migration');
});
