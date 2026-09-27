import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from './worker.mjs';
const base='https://probe.example/health';
const expected=()=>new Response(JSON.stringify({ok:false,error:'本浏览器还没有授权',code:'license-request-failed',permanent:false}),{status:400});

test('probe only forwards a fixed empty session check once; never forwards client secrets',async()=>{
 const calls=[];
 const handle=createHandler(async(url,init)=>{calls.push({url,init});return expected();});
 const response=await handle(new Request(base,{headers:{Origin:'https://fenglina35-dotcom.github.io',Authorization:'Bearer fixture-secret',Cookie:'private=fixture'}}));
 assert.equal(response.status,200);assert.equal((await response.json()).code,'license-backend-reachable');
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://lovbzibismsjqvjujilz.supabase.co/functions/v1/phone-license');
 assert.deepEqual(JSON.parse(calls[0].init.body),{action:'session_check',sessionToken:''});
 assert.deepEqual(calls[0].init.headers,{'Content-Type':'application/json',Origin:'https://fenglina35-dotcom.github.io'});
 assert.equal(calls[0].init.redirect,'manual');assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(response.headers.get('access-control-allow-origin'),'https://fenglina35-dotcom.github.io');
});

test('rejects activation payloads, arbitrary paths, query parameters and foreign origins without network requests',async()=>{
 let calls=0;const handle=createHandler(async()=>{calls++;return expected();});
 for(const [request,status] of [
  [new Request(base,{method:'POST',body:'{"action":"activate","inviteCode":"fixture"}'}),405],
  [new Request('https://probe.example/functions/v1/phone-license'),405],
  [new Request(base+'?upstream=https://other.example'),400],
  [new Request(base,{headers:{Origin:'https://other.example'}}),403],
 ])assert.equal((await handle(request)).status,status);
 assert.equal(calls,0);
});

test('preflight is local and normal direct visits are permitted',async()=>{
 let calls=0;const handle=createHandler(async()=>{calls++;return expected();});
 assert.equal((await handle(new Request(base,{method:'OPTIONS',headers:{Origin:'https://fenglina35-dotcom.github.io'}}))).status,204);
 assert.equal(calls,0);assert.equal((await handle(new Request(base))).status,200);assert.equal(calls,1);
});

test('upstream errors are sanitized and never automatically retried',async()=>{
 let calls=0;const handle=createHandler(async()=>{calls++;throw new Error('private-detail');});
 const response=await handle(new Request(base));assert.equal(response.status,502);
 const body=await response.json();assert.equal(body.code,'upstream-unreachable');assert.equal(body.permanent,false);assert.ok(!JSON.stringify(body).includes('private-detail'));assert.equal(calls,1);
});

test('rejects unrelated HTML responses',async()=>{
 const handle=createHandler(async()=>new Response('<html>error</html>',{status:200}));
 assert.equal((await handle(new Request(base))).status,502);
});

test('rejects redirects without following them',async()=>{
 let calls=0;const handle=createHandler(async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://other.example'}});});
 const response=await handle(new Request(base));assert.equal(response.status,502);
 assert.equal((await response.json()).upstreamStatus,302);assert.equal(calls,1);
});

test('timeout includes upstream body reading',async()=>{
 const handle=createHandler(async(url,init)=>({status:400,json:()=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('abort')),{once:true}))}),10);
 const response=await handle(new Request(base));assert.equal((await response.json()).code,'upstream-timeout');
});

const activationURL='https://license.smallphoneapp.com/functions/v1/phone-license';
const post=(body,headers={})=>new Request(activationURL,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://fenglina35-dotcom.github.io',...headers},body:JSON.stringify(body)});
test('activation preserves the original backend identity, device label, user agent and complete session',async()=>{
 const original={ok:true,session:{token:'fixture-session',licenseId:'original-license',sessionId:'original-session'},extra:{unchanged:true}};
 const input={action:'activate',inviteCode:'YB2-FIXTURE',deviceLabel:'安卓手机 · OPPO'};let calls=0;
 const handle=createHandler(async(url,init)=>{
  calls++;assert.equal(url,'https://lovbzibismsjqvjujilz.supabase.co/functions/v1/phone-license');
  assert.deepEqual(JSON.parse(init.body),input);assert.equal(init.headers['User-Agent'],'OPPO fixture UA');
  assert.deepEqual(Object.keys(init.headers).sort(),['Content-Type','Origin','User-Agent']);
  return Response.json(original);
 });
 const result=await handle(post(input,{'User-Agent':'OPPO fixture UA','Authorization':'admin-secret','Cookie':'private','x-admin-token':'do-not-forward'}));
 assert.equal(result.status,200);assert.deepEqual(await result.json(),original);assert.equal(calls,1);
 assert.equal(result.headers.get('Cache-Control'),'no-store');
});
test('session revocation and blocked-user errors retain server status and permanent flag',async()=>{
 const blocked={ok:false,error:'已被管理员移出',code:'license-admin-blocked',permanent:true};
 const handle=createHandler(async()=>Response.json(blocked,{status:403}));
 const result=await handle(post({action:'session_check',sessionToken:'fixture'}));
 assert.equal(result.status,403);assert.deepEqual(await result.json(),blocked);
});
test('passkey actions preserve browser origin and original challenge response',async()=>{
 for(const action of ['register_options','register_verify','restore_options','restore_verify','session_list','session_revoke','ai_identity_sync','phone_friend_identity_sync','legacy_activate']) {
  const handle=createHandler(async(url,init)=>{assert.equal(init.headers.Origin,'https://fenglina35-dotcom.github.io');assert.equal(JSON.parse(init.body).action,action);return Response.json({ok:true,challenge:'original'});});
  assert.equal((await handle(post({action}))).status,200);
 }
});
test('rejects admin actions, arbitrary proxy destinations, malformed and oversized bodies',async()=>{
 let calls=0;const handle=createHandler(async()=>{calls++;return expected();});
 for(const action of ['admin_auth','admin_license_users','admin_invite_generate','anything']) assert.equal((await handle(post({action}))).status,403);
 assert.equal((await handle(new Request(activationURL+'?upstream=https://other.example',{method:'POST'}))).status,400);
 assert.equal((await handle(post({action:'activate',padding:'x'.repeat(65536)}))).status,413);
 assert.equal((await handle(new Request(activationURL,{method:'POST',body:'not-json',headers:{'Content-Type':'application/json'}}))).status,400);
 assert.equal((await handle(new Request(activationURL,{method:'POST',body:'{}'}))).status,415);
 assert.equal(calls,0);
});
test('failed activation is never retried by the relay',async()=>{
 let calls=0;const handle=createHandler(async()=>{calls++;throw Error('network');});
 const result=await handle(post({action:'activate',inviteCode:'YB2-FIXTURE'}));
 assert.equal(result.status,502);assert.equal((await result.json()).permanent,false);assert.equal(calls,1);
});
