import {execFileSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from './worker.mjs';
const post=(fn,body={},extra={})=>new Request('https://license.smallphoneapp.com/rest/v1/rpc/'+fn,{method:'POST',headers:{Origin:'https://fenglina35-dotcom.github.io','Content-Type':'application/json',apikey:'fixture',Authorization:'Bearer fixture',...extra},body:JSON.stringify(body)});
test('friend relay keeps the original RPC, body and auth; one upstream write only',async()=>{const calls=[],body={p_from_id:'fixture',p_secret:'fixture',p_body:'群消息'};const handle=createHandler(async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({id:'confirmed'}));});const response=await handle(post('phone_friend_send_group_message',body));assert.equal(response.status,200);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://lkhlyfpssmrjkkzhuzag.supabase.co/rest/v1/rpc/phone_friend_send_group_message');assert.deepEqual(JSON.parse(calls[0].init.body),body);assert.equal(calls[0].init.redirect,'manual');assert.equal(calls[0].init.headers.Authorization,'Bearer fixture');assert.equal(response.headers.get('cache-control'),'no-store');});
test('reject arbitrary RPC, query, origin, missing auth and malformed body before network',async()=>{let calls=0;const handle=createHandler(async()=>{calls++;return new Response('{}');});for(const [req,status]of[[post('admin_delete_order'),404],[post('phone_friend_search?upstream=other'),400],[post('phone_friend_search',{}, {Origin:'https://other.example'}),403],[post('phone_friend_search',{}, {Authorization:''}),401],[post('phone_friend_search',[]),400]])assert.equal((await handle(req)).status,status);assert.equal(calls,0);});
test('friend CORS preflight includes auth but sends no upstream request',async()=>{let calls=0;const handle=createHandler(async()=>{calls++;});const response=await handle(new Request('https://license.smallphoneapp.com/rest/v1/rpc/phone_friend_search',{method:'OPTIONS',headers:{Origin:'https://fenglina35-dotcom.github.io'}}));assert.equal(response.status,204);assert.match(response.headers.get('access-control-allow-headers'),/apikey/);assert.equal(calls,0);});
test('uncertain transfer/send is never retried and errors do not echo credentials',async()=>{let calls=0;const handle=createHandler(async()=>{calls++;throw Error('private-credential');});const response=await handle(post('phone_friend_send_message'));assert.equal(response.status,502);assert.equal(calls,1);assert(!String(await response.text()).includes('private-credential'));});


// Retire only role sync transport; authorization, friends and external TTS keep their existing tests.
test('retired role transport rejects every legacy path without forwarding any user data',async()=>{
 const old=execFileSync('git',['show','93d71cd8:services/phone-license-relay/worker.mjs'],{encoding:'utf8'});
 const baseline=await import('data:text/javascript;base64,'+Buffer.from(old).toString('base64'));
 assert.equal((await baseline.createHandler(async()=>new Response('{}'))(new Request('https://license.smallphoneapp.com/companion/health'))).status,200);
 let calls=0;const h=createHandler(async()=>{calls++;return new Response('{}');});
 for(const path of ['health','rest/v1/rpc/phone_role_push_pull','rest/v1/rpc/phone_role_push_ack','rest/v1/rpc/phone_role_background_enqueue','functions/v1/phone-role-push']){
  for(const method of ['GET','POST','OPTIONS']){
   const r=await h(new Request('https://license.smallphoneapp.com/companion/'+path,{method,headers:{Origin:'null'}}));
   assert.equal(r.status,410);assert.equal((await r.json()).code,'role-sync-relay-retired');
  }
 }
 assert.equal(calls,0);const health=createHandler(async()=>new Response(JSON.stringify({ok:false,code:'license-request-failed',error:'本浏览器还没有授权'}),{status:400}));assert.equal((await health(new Request('https://license.smallphoneapp.com/health'))).status,200);
});

const inboxPost=(fn,args={},headers={})=>new Request('https://license.smallphoneapp.com/role-inbox/v1/'+fn,{method:'POST',headers:{Origin:'null','Content-Type':'application/json',apikey:'fixture',Authorization:'Bearer fixture',...headers},body:JSON.stringify({p_target:'fixture-device',p_owner_secret:'fixture-owner-secret-123456',...args})});
test('inbox candidate forwards only pull ack and status to the original owner-checked RPC',async()=>{
 const calls=[],h=createHandler(async(url,init)=>{calls.push({url,init});return new Response('[]');});
 for(const [fn,args]of [['phone_role_push_pull',{p_limit:20}],['phone_role_push_ack',{p_ids:['fixture-id']}],['phone_role_push_status',{p_role_id:'fixture-role'}]]){
  const r=await h(inboxPost(fn,args));assert.equal(r.status,200);assert.equal(calls.at(-1).url,'https://qvuahlqimcfgeoetosnl.supabase.co/rest/v1/rpc/'+fn);assert.equal(calls.at(-1).init.redirect,'manual');assert.equal(JSON.parse(calls.at(-1).init.body).p_owner_secret,'fixture-owner-secret-123456');
 }
 assert.equal(calls.length,3);
});
test('inbox candidate cannot upload profiles models commands or execute arbitrary URLs',async()=>{
 let calls=0;const h=createHandler(async()=>{calls++;return new Response('{}');});
 for(const fn of ['phone_role_push_upsert_profile','phone_companion_enqueue_command','phone_role_background_enqueue','phone_friend_send_message','https://other.example'])assert.equal((await h(inboxPost(fn))).status,404);
 for(const extra of [{apiKey:'model-key'},{p_profile:{persona:'private-role'}},{url:'https://other.example'},{p_payload:{}}])assert.equal((await h(inboxPost('phone_role_push_pull',extra))).status,400);
 assert.equal(calls,0);
});
test('inbox candidate preserves authorization denial, performs no uncertain ACK retry and never follows redirects',async()=>{
 const denied=createHandler(async()=>new Response('{"message":"owner denied"}',{status:403}));assert.equal((await denied(inboxPost('phone_role_push_pull'))).status,403);
 let calls=0;const h=createHandler(async()=>{calls++;throw Error('secret must not appear');});const r=await h(inboxPost('phone_role_push_ack',{p_ids:['id']}));assert.equal(r.status,502);assert.equal(calls,1);assert(!String(await r.text()).includes('secret must'));
 const redirect=createHandler(async()=>new Response('',{status:302,headers:{Location:'https://other.example'}}));assert.equal((await redirect(inboxPost('phone_role_push_pull'))).status,502);
});
test('inbox upstream deadline includes its response body; old full relay stays retired',async()=>{
 const h=createHandler(async(_url,init)=>({status:200,text:()=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('slow body')),{once:true}))}),10);
 const r=await h(inboxPost('phone_role_push_pull'));assert.equal(r.status,502);assert.equal((await r.json()).code,'inbox-timeout');assert.equal((await h(new Request('https://license.smallphoneapp.com/companion/health'))).status,410);
});
