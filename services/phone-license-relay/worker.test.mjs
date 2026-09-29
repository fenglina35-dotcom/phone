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
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://lkhlyfpssmrjkkzhuzag.supabase.co/functions/v1/phone-license');
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
  calls++;assert.equal(url,'https://lkhlyfpssmrjkkzhuzag.supabase.co/functions/v1/phone-license');
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
test('admin actions use the same fixed backend and forward only the explicit admin credential',async()=>{
 const seen=[];const handle=createHandler(async(url,init)=>{seen.push({url,init});return Response.json({ok:true,role:'owner'});});
 for(const action of ['admin_auth','admin_owner_pair_create','admin_license_users','admin_invite_generate','admin_orders','admin_review','admin_config','admin_subscribe']) {
  const response=await handle(post({action},{'x-admin-token':'fixture-admin','Authorization':'Bearer private','Cookie':'private=1'}));
  assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
 }
 assert.equal(seen.length,8);
 for(const call of seen){
  assert.equal(call.url,'https://lkhlyfpssmrjkkzhuzag.supabase.co/functions/v1/phone-license');
  assert.equal(call.init.headers['x-admin-token'],'fixture-admin');
  assert.equal(call.init.headers.Authorization,undefined);assert.equal(call.init.headers.Cookie,undefined);
 }
});
test('one-time owner device claim is the only admin action allowed without a long-lived admin credential',async()=>{
 let call;const handle=createHandler(async(url,init)=>{call={url,init};return Response.json({ok:true,admin_token:'fixture-owner'});});
 const response=await handle(post({action:'admin_owner_pair_claim',pair_code:'23456789ABCD'}));
 assert.equal(response.status,200);assert.equal((await response.json()).admin_token,'fixture-owner');
 assert.equal(call.url,'https://lkhlyfpssmrjkkzhuzag.supabase.co/functions/v1/phone-license');
 assert.equal(call.init.headers['x-admin-token'],undefined);
});
test('rejects missing admin credentials, arbitrary actions, proxy destinations, malformed and oversized bodies',async()=>{
 let calls=0;const handle=createHandler(async()=>{calls++;return expected();});
 for(const action of ['admin_auth','admin_license_users','admin_invite_generate']) assert.equal((await handle(post({action}))).status,401);
 assert.equal((await handle(post({action:'anything'}))).status,403);
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

const externalURL='https://license.smallphoneapp.com/functions/v1/external-tts';
const externalPost=(body,origin='https://fenglina35-dotcom.github.io')=>new Request(externalURL,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
test('Fish external TTS uses the caller key and free model without any phone account or point fields',async()=>{
 const calls=[];const audio=new Uint8Array([1,2,3,4]);
 const handle=createHandler(async(url,init)=>{calls.push({url,init});return new Response(audio,{status:200,headers:{'Content-Type':'audio/mpeg'}});});
 const response=await handle(externalPost({provider:'fish',key:'fish-user-key',model:'s2.1-pro-free',voice_id:'fish-voice',text:'测试'}));
 assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://fenglina35-dotcom.github.io');
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.fish.audio/v1/tts');
 assert.equal(calls[0].init.headers.Authorization,'Bearer fish-user-key');assert.equal(calls[0].init.headers.model,'s2.1-pro-free');
 assert.deepEqual(JSON.parse(calls[0].init.body),{text:'测试',reference_id:'fish-voice',format:'mp3',normalize:true});
 assert.doesNotMatch(calls[0].init.body,/user_id|client_secret|points|balance/);
});
test('MiniMax external TTS preserves GroupId and voice controls without using the internal route',async()=>{
 let call;const handle=createHandler(async(url,init)=>{call={url,init};return Response.json({base_resp:{status_code:0},data:{audio:'00ff'}});});
 const response=await handle(externalPost({provider:'minimax',base:'https://api.minimax.io',key:'mini-user-key',model:'speech-02-turbo',group:'group-1',voice_id:'male-qn-qingse',text:'你好',language_boost:'Chinese',voice_setting:{speed:1.2,vol:1.1,pitch:2,emotion:'happy'}}));
 assert.equal(response.status,200);assert.equal(call.url,'https://api.minimax.io/v1/t2a_v2?GroupId=group-1');
 const body=JSON.parse(call.init.body);assert.equal(body.model,'speech-02-turbo');assert.equal(body.voice_setting.voice_id,'male-qn-qingse');assert.equal(body.voice_setting.speed,1.2);assert.equal(call.init.headers.Authorization,'Bearer mini-user-key');
});
test('Mossland synthesis and all three voice-list routes stay on fixed provider hosts',async()=>{
 const calls=[];const handle=createHandler(async(url,init)=>{calls.push({url,init});return Response.json({data:[]});});
 await handle(externalPost({provider:'mossland',key:'moss-user-key',model:'moss-tts',voice_id:'moss-voice',text:'你好'}));
 for(const provider of ['fish','mossland','minimax'])await handle(externalPost({provider,operation:'list_voices',key:'user-key',group:'g'}));
 assert.deepEqual(calls.map(x=>x.url),[
  'https://api.mosi.cn/v1/audio/speech',
  'https://api.fish.audio/model?self=true&page_size=100',
  'https://api.mosi.cn/v1/audio/voices?limit=200',
  'https://api.minimaxi.com/v1/get_voice?GroupId=g',
 ]);
 assert.equal(calls[0].init.headers.Authorization,'Bearer moss-user-key');
});
test('ElevenLabs and Hume use only their fixed official hosts and caller-owned keys',async()=>{
 const calls=[];const handle=createHandler(async(url,init)=>{calls.push({url,init});return new Response(new Uint8Array([1]),{headers:{'Content-Type':'audio/mpeg'}});});
 await handle(externalPost({provider:'elevenlabs',key:'eleven-user-key',model:'eleven_v3',voice_id:'voice/a b',text:'hello'}));
 await handle(externalPost({provider:'hume',key:'hume-user-key',model:'octave-2',voice_id:'hume-voice',text:'hello'}));
 assert.equal(calls[0].url,'https://api.elevenlabs.io/v1/text-to-speech/voice%2Fa%20b');assert.equal(calls[0].init.headers['xi-api-key'],'eleven-user-key');
 assert.equal(calls[1].url,'https://api.hume.ai/v0/tts/file');assert.equal(calls[1].init.headers['X-Hume-Api-Key'],'hume-user-key');
 assert.equal(JSON.parse(calls[1].init.body).version,'2');
});
test('external TTS rejects arbitrary providers, foreign origins, oversized text and redirects',async()=>{
 let calls=0;const handle=createHandler(async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://evil.example'}});});
 assert.equal((await handle(externalPost({provider:'other',key:'k',text:'x'}))).status,400);
 assert.equal((await handle(externalPost({provider:'minimax',base:'https://evil.example',key:'k',voice_id:'v',text:'x'}))).status,400);
 assert.equal((await handle(externalPost({provider:'fish',key:'k',text:'x'},'https://evil.example'))).status,403);
 assert.equal((await handle(externalPost({provider:'fish',key:'k',text:'x'.repeat(301)}))).status,400);
 const redirected=await handle(externalPost({provider:'fish',key:'k',text:'x'}));assert.equal(redirected.status,502);assert.equal((await redirected.json()).code,'upstream-redirect-rejected');
 assert.equal(calls,1);
});
test('private file-origin preflight is accepted without opening arbitrary browser origins',async()=>{
 let calls=0;const handle=createHandler(async()=>{calls++;return Response.json({});});
 const response=await handle(new Request(externalURL,{method:'OPTIONS',headers:{Origin:'null'}}));
 assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'null');assert.equal(calls,0);
});
test('MiniMax external TTS omits an empty or unknown emotion instead of sending an invalid voice_setting',async()=>{
 const bodies=[];const handle=createHandler(async(url,init)=>{bodies.push(JSON.parse(init.body));return Response.json({base_resp:{status_code:0},data:{audio:'00ff'}});});
 await handle(externalPost({provider:'minimax',key:'k',model:'speech-2.8-turbo',voice_id:'male-qn-qingse',text:'你好',voice_setting:{speed:1,vol:1,pitch:0}}));
 await handle(externalPost({provider:'minimax',key:'k',model:'speech-2.8-hd',voice_id:'male-qn-qingse',text:'你好',voice_setting:{emotion:''}}));
 await handle(externalPost({provider:'minimax',key:'k',model:'speech-02-hd',voice_id:'male-qn-qingse',text:'你好',voice_setting:{emotion:'soft'}}));
 await handle(externalPost({provider:'minimax',key:'k',model:'speech-02-hd',voice_id:'male-qn-qingse',text:'你好',voice_setting:{emotion:'Sad'}}));
 assert.equal(bodies.length,4);
 for(const body of bodies.slice(0,3))assert.equal('emotion' in body.voice_setting,false);
 assert.equal(bodies[3].voice_setting.emotion,'sad');
});
