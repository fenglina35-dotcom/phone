/* Fish 会员登录（MCP 模式）：用 Fish 账号 OAuth 登录并选团队，经 Fish 官方 MCP 生成语音，消耗会员套餐点数。
   锁住：原来的 API Key 模式不变；会员登录不需要 Key；凭证只在本机 localStorage，不进 S（云备份/导出/分享都读 S）；
   PKCE 正确；工具结果里的音频能取出来；两个包的模块完全一致。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const PRIVATE='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const mod=read('fish-mcp.js');

function sandbox(fetchImpl,proto='file:'){
  const store=new Map(),opened=[];
  const ctx={localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    location:{protocol:proto,origin:'https://fenglina35-dotcom.github.io',pathname:'/phone/小手机.html',search:'',href:''},
    history:{replaceState(){}},crypto:{getRandomValues:a=>{for(let i=0;i<a.length;i++)a[i]=(i*37+11)&255;return a;}},
    TextEncoder,URLSearchParams,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
    fetch:fetchImpl||(async()=>{throw new Error('no network in tests');}),setTimeout,console,Uint8Array,Uint32Array,Promise,Date,Math,JSON,String,Object,Array,RegExp,Error};
  ctx.open=u=>{opened.push(u);};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(mod,ctx);return {ctx,F:ctx.NorthFishMcp,store,opened};
}
const res=(status,body,headers={})=>({ok:status>=200&&status<300,status,headers:{get:k=>headers[k]||headers[k.toLowerCase()]||null},text:async()=>typeof body==='string'?body:JSON.stringify(body),arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer});

test('PKCE: SHA-256 and the S256 challenge match Node crypto',()=>{
  const {F}=sandbox();
  assert.equal(Buffer.from(F._test.sha256Bytes(new TextEncoder().encode('abc'))).toString('hex'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  for(const v of ['dBjftJeZ4CVP-mJ92K9qpvU1mxMFP2iG0tE5MGRCFbo','x'.repeat(55),'y'.repeat(56),'z'.repeat(128)])assert.equal(F._test.challengeFor(v),crypto.createHash('sha256').update(v).digest('base64url'),v.length+' chars');
});

test('private App login: registers a public client, opens Fish in Safari, pasted code (or whole URL) finishes; tokens stay out of S',async()=>{
  const calls=[];const {F,store,opened}=sandbox(async(url,init)=>{calls.push([url,init]);
    if(url.endsWith('/oauth/register'))return res(201,{client_id:'cid1'});
    if(url.endsWith('/oauth/token'))return res(200,{access_token:'AT',refresh_token:'RT',expires_in:3600});
    throw new Error('unexpected '+url);});
  const url=await F.begin();
  assert.equal(opened[0],url,'non-web pages hand the authorize URL to iOS (Safari)');
  assert.match(url,/^https:\/\/fish\.audio\/oauth\/authorize\?/);
  assert.match(url,/code_challenge_method=S256/);assert.match(url,/redirect_uri=https%3A%2F%2Ffenglina35-dotcom\.github\.io%2Fphone%2Ffish-oauth\.html/);
  assert.equal(JSON.parse(calls[0][1].body).token_endpoint_auth_method,'none');
  assert.equal(F.status().pending,true);
  const state=JSON.parse(store.get('north_fish_mcp_pending_v1')).state;
  await assert.rejects(F.finish('https://x/cb?code=C1&state=WRONG'),/状态不匹配/);
  await F.finish('https://fenglina35-dotcom.github.io/phone/fish-oauth.html?code=C1&state='+state);
  const body=new URLSearchParams(calls.at(-1)[1].body);
  assert.equal(body.get('code'),'C1');assert.equal(body.get('grant_type'),'authorization_code');assert.ok(body.get('code_verifier').length>=43);
  assert.equal(F.status().loggedIn,true);assert.equal(F.status().pending,false);
  assert.equal(JSON.stringify([...store.keys()].sort()),JSON.stringify(['north_fish_mcp_clients_v1','north_fish_mcp_v1']));
  F.logout();assert.equal(F.status().loggedIn,false);assert.equal(store.has('north_fish_mcp_v1'),false,'logout clears the token');
});

test('MCP via own relay (Fish rejects browser origins): session id kept, SSE read, real text_to_speech schema, audio fetched through relay',async()=>{
  const seen=[];const {F,store}=sandbox(async(url,init)=>{
    if(url==='https://license.smallphoneapp.com/fish-mcp'){const b=JSON.parse(init.body);seen.push([b.method,init.headers['Mcp-Session-Id']||'',init.headers.Authorization]);
      if(b.method==='initialize')return res(200,{jsonrpc:'2.0',id:b.id,result:{protocolVersion:'2025-06-18'}},{'Mcp-Session-Id':'S1','Content-Type':'application/json'});
      if(b.method==='notifications/initialized')return res(202,'');
      if(b.method==='tools/list')return res(200,'event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:b.id,result:{tools:[{name:'list_voices'},{name:'speech_to_text'},{name:'text_to_speech',inputSchema:{properties:{text:{},voice_id:{},language:{}},required:['text']}}]}})+'\n\n',{'Content-Type':'text/event-stream'});
      if(b.method==='tools/call'){assert.equal(b.params.name,'text_to_speech');assert.equal(JSON.stringify(b.params.arguments),JSON.stringify({text:'[laughing] 你好',voice_id:'v1'}));
        return res(200,{jsonrpc:'2.0',id:b.id,result:{content:[{type:'text',text:'done: https://cdn.fish.audio/a/1.mp3'}]}},{'Content-Type':'application/json'});}}
    if(url==='https://license.smallphoneapp.com/fish-mcp-audio'){assert.equal(JSON.parse(init.body).url,'https://cdn.fish.audio/a/1.mp3');assert.equal(init.headers.Authorization,'Bearer AT');return res(200,'');}
    throw new Error('unexpected '+url);});
  store.set('north_fish_mcp_v1',JSON.stringify({access:'AT',refresh:'RT',exp:Date.now()+600000,client:'c'}));
  const out=await F.speak({text:'[laughing] 你好',voiceId:'v1',model:'drama-3'});
  assert.equal(out.err,undefined,out.err);assert.equal(out.buf.byteLength,3);
  assert.deepEqual(seen.map(x=>x[0]),['initialize','notifications/initialized','tools/list','tools/call']);
  assert.equal(seen[3][1],'S1','later calls carry the session id');assert.equal(seen[3][2],'Bearer AT');
});

test('not logged in: a clear error instead of a silent failure; audio blocks and structured URLs are recognised',async()=>{
  const {F}=sandbox();
  assert.match((await F.speak({text:'hi'})).err,/还没有登录 Fish/);
  const J=x=>JSON.stringify(x);
  assert.equal(J(F._test.audioFrom({content:[{type:'audio',data:'AAA=',mimeType:'audio/mpeg'}]})),J({data:'AAA=',mime:'audio/mpeg'}));
  assert.equal(J(F._test.audioFrom({structuredContent:{audio_url:'https://x/y.mp3'}})),J({url:'https://x/y.mp3'}));
  assert.equal(F._test.ttsTool([{name:'speech_to_text'},{name:'clone_voice'}]),null,'never picks transcription or cloning');
});

test('app: fishmcp provider needs no key and calls the module; the API Key path is untouched; both bundles ship it',()=>{
  for(const p of ['app.js',PRIVATE+'app.js']){const s=read(p);
    assert.match(s,/function ttsExternalOn\(t\)\{return !!\(t&&t\.base&&\(t\.key\|\|ttsProviderKind\(t\)==='fishmcp'\)\);\}/,p);
    assert.match(s,/else if\(provider==='fishmcp'\)\{if\(typeof NorthFishMcp==='undefined'\)return \{err:'Fish 会员登录模块没有加载'\};return await NorthFishMcp\.speak\(\{text:t,voiceId:vid,model:tts\.model\}\);\}\n  else if\(provider==='fish'\)r=await externalTtsRelay\(tts,\{voice_id:vid,text:t\}\);/,p);
    assert.match(s,/\['fish','Fish Audio（API Key）'\],\['fishmcp','Fish 会员登录（用套餐点数）'\]/,p);
    assert.match(s,/\['https:\/\/api\.fish\.audio','drama-3','Fish Drama 3·会员点数','fishmcp'\]/,p);
    assert.match(s,/NorthFishMcp\.panel\(\(S\.settings\.tts\|\|\{\}\)\.provider\)/,p);
    assert.doesNotMatch(s,/north_fish_mcp_v1/,'the token key never appears in app.js, so no backup or export path can carry it');}
  assert.equal(read(PRIVATE+'fish-mcp.js'),mod,'shared module is byte-identical');
  for(const p of ['小手机.html',PRIVATE+'index.html',PRIVATE+'小手机.html'])assert.match(read(p),/<script src="fish-mcp\.js\?v=\d+"><\/script>/,p);
  assert.match(read('native/private-small-phone/.gitignore'),/!XcodeProject\/PhoneCompanionTest\/PhoneWeb\.bundle\/fish-mcp\.js/);
  assert.match(read('native/private-small-phone/Resources/private-phone-web.manifest.json'),/"fish-mcp\.js"/);
  const cb=read('fish-oauth.html');assert.doesNotMatch(cb,/<script[^>]+src=/,'callback page loads no external script');assert.match(cb,/no-referrer/);
});
