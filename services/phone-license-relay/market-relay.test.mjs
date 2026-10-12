import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from './worker.mjs';
const BASE='https://license.smallphoneapp.com';
const post=(fn,body={},extra={})=>new Request(BASE+'/rest/v1/rpc/'+fn,{method:'POST',headers:{Origin:'https://fenglina35-dotcom.github.io','Content-Type':'application/json',apikey:'fixture',Authorization:'Bearer fixture',...extra},body:JSON.stringify(body)});
const FOLDER='0123456789abcdef0123456789abcdef',FILE=FOLDER+'/11111111-2222-3333-4444-555555555555.jpg';

test('market RPC allowlist forwards to the original database with original body and auth, once',async()=>{
  const calls=[],h=createHandler(async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({ok:true,shops:[]}));});
  for(const fn of ['list','shop','quote','role_catalog','role_checkout','save_shop','runner_reward']){
    const r=await h(post('north_market_'+fn,{p_phone_id:'p',p_secret:'s'}));assert.equal(r.status,200,fn);
    assert.equal(calls.at(-1).url,'https://lkhlyfpssmrjkkzhuzag.supabase.co/rest/v1/rpc/north_market_'+fn);
    assert.equal(calls.at(-1).init.redirect,'manual');assert.equal(JSON.parse(calls.at(-1).init.body).p_secret,'s');
  }
  assert.equal(calls.length,7);
});
test('market relay refuses admin, triggers and internal functions without any network',async()=>{
  let calls=0;const h=createHandler(async()=>{calls++;return new Response('{}');});
  for(const fn of ['north_market_admin_credit','north_market_stock_order_trigger','north_market_identity','north_market_storage_owner','north_market_auto_deliver','north_market_split_expire'])assert.equal((await h(post(fn))).status,404,fn);
  assert.equal((await h(post('north_market_list',{},{Origin:'https://evil.example'}))).status,403);
  assert.equal(calls,0);
});
test('market write failure is a single attempt and reports 502',async()=>{
  let calls=0;const h=createHandler(async()=>{calls++;throw Error('reset');});
  const r=await h(post('north_market_role_checkout',{p_total:100}));assert.equal(r.status,502);assert.equal(calls,1);
});
test('market images: public GET is relayed and cacheable, only image content, fixed bucket and safe paths',async()=>{
  const calls=[],h=createHandler(async(url,init)=>{calls.push({url,init});return new Response('img',{status:200,headers:{'Content-Type':'image/jpeg'}});});
  const r=await h(new Request(BASE+'/market-media/'+FILE));assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'image/jpeg');assert.match(r.headers.get('Cache-Control'),/max-age/);
  assert.equal(calls[0].url,'https://lkhlyfpssmrjkkzhuzag.supabase.co/storage/v1/object/public/north-market/'+FILE);
  for(const bad of ['../secret.jpg','a/b.html',FOLDER+'/x.jpg?x=1','%2e%2e/x.jpg'])assert.notEqual((await h(new Request(BASE+'/market-media/'+bad))).status,200,bad);
  const html=createHandler(async()=>new Response('<script>',{status:200,headers:{'Content-Type':'text/html'}}));assert.equal((await html(new Request(BASE+'/market-media/'+FILE))).status,502);
});
test('market upload forwards owner headers to the fixed bucket, image only, size capped',async()=>{
  const calls=[],h=createHandler(async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({Key:'north-market/'+FILE}));});
  const up=(headers,body=new Uint8Array(10))=>new Request(BASE+'/market-upload/'+FILE,{method:'POST',headers:{Origin:'null','Content-Type':'image/jpeg',apikey:'fixture',Authorization:'Bearer fixture','x-north-phone':'phone','x-north-secret':'secret',...headers},body});
  assert.equal((await h(up({}))).status,200);assert.equal(calls[0].url,'https://lkhlyfpssmrjkkzhuzag.supabase.co/storage/v1/object/north-market/'+FILE);assert.equal(calls[0].init.headers['x-north-secret'],'secret');
  assert.equal((await h(up({'Content-Type':'text/html'}))).status,415);
  assert.equal((await h(up({'x-north-secret':''}))).status,401);
  assert.equal((await h(up({},new Uint8Array(1048577)))).status,413);
  assert.equal(calls.length,1);
});
test('market-ready answers without touching the database',async()=>{let calls=0;const h=createHandler(async()=>{calls++;});const r=await h(new Request(BASE+'/market-ready',{headers:{Origin:'null'}}));assert.equal(r.status,200);assert.equal((await r.json()).code,'market-relay-v1');assert.equal(calls,0);});
test('non-JSON upstream answers carry status and a short sanitized snippet; empty answers become null',async()=>{
  const h=createHandler(async()=>new Response('<html>error code: 1016 sb_publishable_ABCDEFGHIJKLMNOP</html>',{status:530,headers:{'Content-Type':'text/html'}}));
  const r=await h(post('north_market_list',{}));assert.equal(r.status,502);const j=await r.json();
  assert.equal(j.message,'friend-upstream-non-json');assert.equal(j.upstreamStatus,530);assert.match(j.upstreamSnippet,/1016/);assert.doesNotMatch(j.upstreamSnippet,/ABCDEFGHIJ/);
  const e=createHandler(async()=>new Response(null,{status:204}));const r2=await e(post('phone_friend_mark_received',{}));assert.equal(r2.status,200);assert.equal(await r2.text(),'null');
});
