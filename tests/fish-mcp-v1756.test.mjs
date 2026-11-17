/* Fish 会员登录（MCP 模式）：用 Fish 账号 OAuth 登录并选团队，经 Fish 官方 MCP 生成语音，消耗会员套餐点数。
   锁住：原来的 API Key 模式不变；会员登录不需要 Key；凭证只在本机 localStorage，不进 S（云备份/导出/分享都读 S）；
   PKCE 正确；工具结果里的音频能取出来；两个包的模块完全一致。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import {BUNDLES,read as readProject,fnSource} from './_helpers.mjs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
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
    assert.match(s,/else if\(provider==='fishmcp'\)\{if\(typeof NorthFishMcp==='undefined'\)return \{err:'Fish 会员登录模块没有加载'\};return await NorthFishMcp\.speak\(\{text:t,voiceId:vid,model:tts\.model,timeoutMs:opt&&opt\.timeoutMs\}\);\}\n  else if\(provider==='fish'\)r=await externalTtsRelay\(tts,\{voice_id:vid,text:t\},opt&&opt\.timeoutMs\);/,p); // TTS_CALL_TIMEOUT_V1 (2026-10-30) added the per-try time limit
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

test('the Fish code page is never replaced by the cached phone shell (Safari that once opened the web build)',()=>{
  const src=read('sw.js'),L={};
  const ctx=vm.createContext({self:{addEventListener:(t,f)=>L[t]=f,location:{origin:'https://fenglina35-dotcom.github.io',href:'https://fenglina35-dotcom.github.io/phone/sw.js'},registration:{scope:'https://fenglina35-dotcom.github.io/phone/'}},
    URL,caches:{open:async()=>({match:async()=>null,put:async()=>{}})},fetch:async()=>new Response('x'),Response,Request,console,setTimeout,decodeURIComponent,Promise});
  vm.runInContext(src,ctx);
  const nav=p=>{let used=false;L.fetch({request:{mode:'navigate',method:'GET',url:'https://fenglina35-dotcom.github.io'+encodeURI(p),cache:'default',headers:new Headers()},respondWith(){used=true;},waitUntil(){}});return used;};
  assert.equal(nav('/phone/fish-oauth.html?code=abc&state=x'),false,'goes straight to the network');
  assert.equal(nav('/phone/小手机.html'),true,'the app itself still uses the cached shell');
});

test('member login (fishmcp) always gets the Fish expressive treatment, whatever the model field says',()=>{
  for(const file of ['voice-expressive.js',PRIVATE+'voice-expressive.js']){
    const ctx=vm.createContext({S:{settings:{voiceExpressive:true},me:{name:'North'}},Math,Date,String,Array,Float32Array,ArrayBuffer,DataView,Promise,Map,RegExp,Object,setTimeout,
      ttsStyleKind:()=>'',ttsCfg:()=>({}),ttsCleanBase:t=>String(t||''),ttsCueKind:()=>''});
    vm.runInContext(read(file),ctx);const V=ctx.NorthVoiceExpressive;
    assert.notEqual(V.performance('[轻笑]我才不信',{id:'r'},{provider:'fishmcp',base:'https://api.fish.audio',model:''},{}),null,file+': model field empty');
    assert.equal(V.performance('[轻笑]我才不信',{id:'r2'},{provider:'fish',base:'https://api.fish.audio',model:''},{}),null,file+': API Key mode still follows the model field');
  }
});

// 通用 MCP 工具中心的执行与隔离检查，沿用这份既有 MCP 回归文件。
{
const settingsSource=read('src/app/011-saveSettings.js');
const source=settingsSource.slice(settingsSource.indexOf('/* MCP_ROLE_TOOLS_V1'));
const reply=(b,status=200,headers={})=>new Response(typeof b==='string'?b:JSON.stringify(b),{status,headers:{'Content-Type':'application/json',...headers}});
const readTool={name:'read_note',description:'Read a note',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']},annotations:{readOnlyHint:true}};
const writeTool={name:'write_note',description:'Update note',inputSchema:{type:'object',properties:{text:{type:'string'}},required:['text']}};
function sandbox(handler,override){
 const storage=new Map(),nodes=new Map(),panels=[],role={id:'role-a',name:'角色甲'},state={me:{active:'main'},contacts:[role],settings:{unchanged:true}},calls=[];
 const ctx={S:state,actId:()=>state.me.active,getC:id=>state.contacts.find(c=>c.id===id),NorthLicense:{session:()=>({licenseId:'owner-a'})},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},crypto:crypto.webcrypto,TextEncoder,TextDecoder,URL,URLSearchParams,Uint8Array,Uint32Array,AbortController,Response,
  setTimeout,clearTimeout,setInterval,clearInterval,btoa:s=>Buffer.from(s,'binary').toString('base64'),
  esc:s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
  document:{getElementById:id=>nodes.get(id)||null,createElement:()=>({setAttribute(){},querySelector:()=>({focus(){}}),remove(){nodes.delete(this.id);}}),head:{appendChild:n=>nodes.set(n.id,n)},body:{appendChild:n=>{nodes.set(n.id,n);panels.push(n);}}},
  fetch:async(url,init)=>{const body=init.body&&init.headers?.['Content-Type']==='application/json'?JSON.parse(init.body):null;calls.push({url,init,body});if(handler){const custom=await handler(url,init,body);if(custom)return custom;}if(body?.method==='initialize')return reply({jsonrpc:'2.0',id:body.id,result:{protocolVersion:'2025-11-25',capabilities:{tools:{}}}},200);if(body?.method==='notifications/initialized')return reply('',202);if(body?.method==='tools/list')return reply({jsonrpc:'2.0',id:body.id,result:{tools:[readTool,writeTool]}});if(body?.method==='tools/call')return reply({jsonrpc:'2.0',id:body.id,result:{content:[{type:'text',text:'actual-server-result'}]}});throw Error('unexpected network '+url);},
  chatResultText:async(m,o,d)=>d.choices[0].message.content,toast(){},uiConfirm:async()=>true,cur:()=>({p:'chat'}),render(){},console};
 vm.createContext(ctx);vm.runInContext((override||source)+'\nglobalThis.M=MCPTools;globalThis.pkce=mcpPkce;',ctx);
 return{ctx,M:ctx.M,storage,panels,nodes,calls,state};
}
async function connected(s,mode='ask'){const c=s.M.add({name:'测试连接',url:'https://mcp.fixture.invalid/mcp',auth:'bearer',token:'fixture-secret-token'});await s.M.connect(c.id);s.M.configure(c.id,{roles:['role-a'],mode});return s.M.connection(c.id);}
function call(alias,args={id:'1'}){return JSON.stringify({mcp_call:{tool:alias,arguments:args}});}

// These new behavioral regressions read HEAD when FIX_TEST_OLD=1.
function forVariant(raw,variant){let section='';return raw.split('\n').filter(line=>{const m=line.match(/^\/\/@@ (web|private|end)$/);if(m){section=m[1]==='end'?'':m[1];return false;}return !section||section===variant;}).join('\n');}
function guideSandbox(handler,variant='web'){
 const raw=readProject('src/app/011-saveSettings.js'),filtered=forVariant(raw,variant),s=sandbox(handler,filtered.slice(filtered.indexOf('/* MCP_ROLE_TOOLS_V1')));s.modals=[];
 s.ctx.openModal=html=>{s.modals.push(html);const id=html.match(/id="mcp-setup" data-connection="([^"]+)"/);if(id)s.nodes.set('mcp-setup',{getAttribute:()=>id[1]});else s.nodes.delete('mcp-setup');};
 return s;
}
test('MCP guide: plus opens official login steps without claiming connected or submitting requests',()=>{
 const s=guideSandbox();s.M.start('cloudflare');const c=s.M.data().connections[0];assert(c);assert.equal(c.state,'saved');assert.equal(c.tools.length,0);assert.equal(c.roles.length,0);assert.equal(s.calls.length,0);const modal=s.modals.at(-1);assert(modal.includes('开始官网登录'));assert(modal.includes('https://dash.cloudflare.com/'));assert(modal.includes('验证工具'));assert(modal.includes('保存连接不代表已登录'));assert(s.M.render().includes('0 个已连接'));
});
test('MCP guide: existing incomplete connections resume guided setup without resetting credentials or role grants',()=>{
 const s=guideSandbox(),c=s.M.add({provider:'cloudflare',url:'https://mcp.cloudflare.com/mcp',auth:'oauth',token:'fixture-existing'});s.M.configure(c.id,{roles:['role-a']});const before=JSON.stringify(s.M.connection(c.id));s.M.detail(c.id,true);assert(s.modals.at(-1).includes('开始官网登录'));assert.equal(JSON.stringify(s.M.connection(c.id)),before);assert.equal(s.calls.length,0);
});
test('MCP guide: OAuth discovery failure remains inline with retry and a real official entry',async()=>{
 const s=guideSandbox(()=>{throw new TypeError('network fixture');});s.M.start('notion');const c=s.M.data().connections[0];await s.M.authorize(c.id);const html=s.modals.at(-1);assert(html.includes('role="alert"'));assert(html.includes('开始官网登录'));assert(html.includes('https://www.notion.so/'));assert(!html.includes('network fixture'));assert.notEqual(s.M.connection(c.id).state,'connected');
});
test('MCP guide: public preview and unhosted Spotify explain prerequisites without saving pretend connections',()=>{
 const s=guideSandbox();s.M.start('spotify');assert.equal(s.M.data().connections.length,0);assert(s.modals.at(-1).includes('Premium'));s.M.start('gmail');assert.equal(s.M.data().connections.length,0);assert(s.modals.at(-1).includes('开发者预览'));
});
test('MCP guide: GitHub gives an official token entry and will not validate an empty credential',async()=>{
 const s=guideSandbox();s.M.start('github');const c=s.M.data().connections[0];assert(s.modals.at(-1).includes('https://github.com/settings/personal-access-tokens/new'));await s.M.verifySetup(c.id);assert.equal(s.calls.length,0);assert(s.modals.at(-1).includes('请先从官方入口获取访问凭据'));
});
test('MCP guide: verified service offers a bounded role picker and natural chat examples',async()=>{
 const s=guideSandbox();s.state.contacts=Array.from({length:80},(_,i)=>({id:'r'+i,name:'角色'+i}));s.M.start('cloudflare-docs');const c=s.M.data().connections[0];assert(s.modals.at(-1).includes('立即连接'));await s.M.verifySetup(c.id);assert.equal(s.M.connection(c.id).state,'connected');assert.equal(s.M.connection(c.id).roles.length,0);const html=s.modals.at(-1);assert(html.includes('已验证 · 2 个工具'));assert.equal((html.match(/data-mcp-role-id=/g)||[]).length,80);assert(html.includes('mcp-role-list'));assert(html.includes('Cloudflare Workers'));assert(html.includes('完成设置'));
});
test('MCP guide: tools/list failure stays failed and does not show successful role setup',async()=>{
 const s=guideSandbox((u,i,b)=>b?.method==='tools/list'?reply({error:'unavailable'},503):null);s.M.start('cloudflare-docs');const c=s.M.data().connections[0];await s.M.verifySetup(c.id);assert.equal(s.M.connection(c.id).state,'failed');assert(s.modals.at(-1).includes('HTTP 503'));assert(!s.modals.at(-1).includes('已验证 ·'));
});
test('MCP guide: private Gmail uses the configured public client descriptor, callback and scopes without DCR',async()=>{
 const s=guideSandbox((url)=>url.includes('oauth-protected-resource')?reply({resource:'https://smallphone-gmail-mcp.fenglina35.workers.dev/mcp',authorization_servers:['https://smallphone-gmail-mcp.fenglina35.workers.dev']}):url.includes('oauth-authorization-server')?reply({issuer:'https://smallphone-gmail-mcp.fenglina35.workers.dev',authorization_endpoint:'https://smallphone-gmail-mcp.fenglina35.workers.dev/authorize',token_endpoint:'https://smallphone-gmail-mcp.fenglina35.workers.dev/oauth/token',registration_endpoint:'https://smallphone-gmail-mcp.fenglina35.workers.dev/register',code_challenge_methods_supported:['S256']}):null,'private');
 s.M.start('gmail');const c=s.M.data().connections[0];assert.equal(c.auth,'oauth');assert.equal(c.serviceCallback,true);const url=new URL(await s.M.beginOAuth(c.id));assert.equal(url.searchParams.get('client_id'),'https://smallphone-gmail-mcp.fenglina35.workers.dev/client-metadata.json');assert.equal(url.searchParams.get('redirect_uri'),'https://smallphone-gmail-mcp.fenglina35.workers.dev/client-callback');assert.equal(url.searchParams.get('scope'),'mcp:read mcp:write offline_access');assert(!s.calls.some(x=>x.url.endsWith('/register')));
});
test('MCP OAuth: canonical resource is used for login, code exchange and refresh while read-only query stays on RPC',async()=>{
 const host='https://resource.fixture.invalid',s=guideSandbox((url,init)=>url.includes('oauth-protected-resource')?reply({resource:host+'/mcp',authorization_servers:[host],scopes_supported:['read']}):url.includes('oauth-authorization-server')?reply({issuer:host,authorization_endpoint:host+'/authorize',token_endpoint:host+'/token',code_challenge_methods_supported:['S256']}):url===host+'/token'?reply({access_token:'fixture-token',refresh_token:'fixture-refresh',expires_in:3600}):null),c=s.M.add({url:host+'/mcp?read_only=true',auth:'oauth',clientId:'fixture-client'});
 const url=new URL(await s.M.beginOAuth(c.id));assert.equal(url.searchParams.get('resource'),host+'/mcp');const pending=s.M.connection(c.id).pending,receipt=pending.redirect+'&code=fixture-code&state='+pending.state;await s.M.finishOAuth(c.id,receipt);s.M.configure(c.id,{exp:Date.now()-1});await s.M.connect(c.id);
 const tokens=s.calls.filter(x=>x.url===host+'/token');assert.equal(tokens.length,2);for(const call of tokens)assert.equal(new URLSearchParams(call.init.body).get('resource'),host+'/mcp');assert(s.calls.filter(x=>x.body&&x.body.method).every(x=>x.url===host+'/mcp?read_only=true'));
});
test('MCP native HTTP: allowed requests use the bridge once, preserve headers and parse tools without fetch',async()=>{
 const s=guideSandbox(null,'private'),calls=[];s.ctx.privateNativeAppOn=()=>true;s.ctx.window={__SMALL_PHONE_MCP_HTTP__:true,SmallPhoneNative:{request:async(method,payload)=>{calls.push({method,payload});const b=JSON.parse(payload.body),result=b.method==='initialize'?{protocolVersion:'2025-11-25'}:b.method==='tools/list'?{tools:[readTool]}:{};return{status:200,headers:{'content-type':'application/json','mcp-session-id':'fixture-session'},text:JSON.stringify({jsonrpc:'2.0',id:b.id,result})};}}};
 const c=s.M.add({provider:'cloudflare-docs',url:'https://docs.mcp.cloudflare.com/mcp',auth:'none'});await s.M.connect(c.id);assert.equal(calls.length,3);assert.equal(s.calls.length,0);assert.equal(s.M.connection(c.id).tools.length,1);assert(calls.every(x=>x.method==='mcp.http.request'));assert.equal(calls[2].payload.headers['Mcp-Session-Id'],'fixture-session');
});
test('MCP native HTTP: a bridge failure never retries through fetch or marks connected',async()=>{
 const s=guideSandbox(null,'private'),calls=[];s.ctx.privateNativeAppOn=()=>true;s.ctx.window={__SMALL_PHONE_MCP_HTTP__:true,SmallPhoneNative:{request:async(method,p)=>{calls.push(method);throw Error('mcp_network_unavailable');}}};const c=s.M.add({provider:'cloudflare-docs',url:'https://docs.mcp.cloudflare.com/mcp',auth:'none'});await assert.rejects(s.M.connect(c.id),/手机未能连接/);assert.deepEqual(calls,['mcp.http.request']);assert.equal(s.calls.length,0);assert.equal(s.M.connection(c.id).state,'failed');
});
test('MCP native HTTP: disabling native capability keeps the original web path',async()=>{
 const s=guideSandbox();s.ctx.privateNativeAppOn=()=>true;s.ctx.window={__SMALL_PHONE_MCP_HTTP__:false,SmallPhoneNative:{request:()=>{throw Error('unexpected bridge');}}};const c=s.M.add({url:'https://docs.mcp.cloudflare.com/mcp',auth:'none'});await s.M.connect(c.id);assert.equal(s.calls.length,3);
});
test('MCP guide: modal and underlying manager both update role search and selected counts',()=>{
 const s=guideSandbox();s.M.start('cloudflare-docs');const c=s.M.data().connections[0];
 function panel(){const input={},badge={},empty={},row={hidden:false,getAttribute:k=>k==='data-mcp-role-id'?'role-a':'角色甲',querySelector:()=>input};return{input,badge,row,querySelectorAll:()=>[row],querySelector:k=>k==='[data-mcp-role-count]'?badge:empty};}
 const panels=[panel(),panel()];s.ctx.document.querySelectorAll=()=>panels;s.M.setRole(c.id,'role-a',true);for(const p of panels){assert.equal(p.input.checked,true);assert.equal(p.badge.textContent,'已选 1 / 1');}s.M.roleFilter(c.id,'找不到');for(const p of panels)assert.equal(p.row.hidden,true);s.M.roleFilter(c.id,'角色');for(const p of panels)assert.equal(p.row.hidden,false);
});
test('MCP native HTTP: cancellation before dispatch sends nothing; in-flight cancellation sends one cancel',async()=>{
 const raw=readProject('src/app/011-saveSettings.js'),s=sandbox(null,raw.slice(raw.indexOf('/* MCP_ROLE_TOOLS_V1')).replace('return{catalog,','return{nativeHTTPRequest,catalog,')),calls=[];
 s.ctx.window={SmallPhoneNative:{request:(method,payload)=>{calls.push(method);return method==='mcp.http.cancel'?Promise.resolve({}):new Promise(()=>{});}}};
 const first=new AbortController();first.abort();await assert.rejects(s.M.nativeHTTPRequest('https://docs.mcp.cloudflare.com/mcp',{},first.signal,100,null),e=>e.name==='AbortError');assert.equal(calls.length,0);
 const second=new AbortController(),pending=s.M.nativeHTTPRequest('https://docs.mcp.cloudflare.com/mcp',{},second.signal,100,null);second.abort();await assert.rejects(pending,e=>e.name==='AbortError');assert.deepEqual(calls,['mcp.http.request','mcp.http.cancel']);
});
if(process.env.NORTH_MCP_NATIVE_LIVE==='1')test('MCP native live: actual Foundation transport and private JS negotiate the public document tools',async()=>{
 const s=guideSandbox(null,'private'),native=readProject('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'),classSource=native.slice(native.indexOf('private final class PrivateMCPNetworkRequest:'));
 const nativeRequest=async(method,payload)=>{assert.equal(method,'mcp.http.request');const json=Buffer.from(JSON.stringify(payload)).toString('base64');const main='\nlet group=DispatchGroup();group.enter()\nlet data=Data(base64Encoded:"'+json+'")!\nlet args=try! JSONSerialization.jsonObject(with:data) as! [String:Any]\nprivate let request=try! PrivateMCPNetworkRequest(arguments:args){result,error in let out:[String:Any]=["result":result ?? [:],"error":error ?? ""];print(String(data:try! JSONSerialization.data(withJSONObject:out),encoding:.utf8)!);group.leave()}\nrequest.start()\nif group.wait(timeout:.now()+50) == .timedOut {exit(1)}\n';const out=cp.execFileSync('swift',['-'],{input:'import Foundation\n'+classSource+main,encoding:'utf8',timeout:55000,maxBuffer:2e6}),result=JSON.parse(out);if(result.error)throw Error(result.error);return result.result;};
 s.ctx.privateNativeAppOn=()=>true;s.ctx.window={__SMALL_PHONE_MCP_HTTP__:true,SmallPhoneNative:{request:nativeRequest}};
 const p=s.M.catalog.find(p=>p.id==='cloudflare-docs'),c=s.M.add({...p,provider:p.id});s.M.configure(c.id,{roles:['role-a'],mode:'auto'});await s.M.connect(c.id);const actual=s.M.connection(c.id);assert.equal(actual.state,'connected');assert(actual.tools.length>0);assert.equal(s.calls.length,0);console.log('Actual Foundation + private JS document tools:',actual.tools.map(t=>t.name).join(', '));const ctx=s.M.context('role-a'),item=ctx.catalog.find(x=>x.t.name==='search_cloudflare_documentation');assert(item&&item.t.inputSchema.properties.query);const result=await s.M.execute(ctx,item,{query:'Cloudflare Workers free plan limits'});assert.notEqual(result.isError,true);assert(JSON.stringify(result).length>100);assert.equal(s.calls.length,0);console.log('Actual Foundation document search succeeded; result bytes:',Buffer.byteLength(JSON.stringify(result)));
});
test('MCP native HTTP: Foundation policy rejects local targets, redirects destinations, credentials and unsupported methods',()=>{
 const text=readProject('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'),marker=text.indexOf('private final class PrivateMCPNetworkRequest:');assert(marker>=0,'missing native MCP transport');
 const swift='import Foundation\n'+text.slice(marker)+`
func check(_ yes: Bool, line: Int = #line) { if !yes { print("MCP transport policy regression at line",line); exit(1) } }
check(PrivateMCPNetworkRequest.destination("https://mcp.cloudflare.com/mcp") != nil)
for u in ["http://mcp.cloudflare.com/mcp","https://127.0.0.1/mcp","https://localhost/mcp","https://mcp.cloudflare.com.evil.test/mcp","https://user:pass@mcp.cloudflare.com/mcp","https://mcp.cloudflare.com:4433/mcp","https://mcp.cloudflare.com/mcp?access_token=secret","https://mcp.cloudflare.com/mcp#fragment"] { check(PrivateMCPNetworkRequest.destination(u) == nil) }
func valid(_ changes: [String:Any]) -> Bool { var p: [String:Any] = ["url":"https://mcp.cloudflare.com/mcp","method":"POST","headers":["Content-Type":"application/json"],"body":"{}"] ; p.merge(changes){_,new in new};return (try? PrivateMCPNetworkRequest(arguments:p){_,_ in}) != nil }
check(valid([:]))
for p: [String:Any] in [["method":"DELETE"],["method":"GET","body":"payload"],["headers":["Cookie":"secret"]],["headers":["Authorization":"Bearer bad\\r\\nInjected: value"]],["body":String(repeating:"字",count:50000)]] { if valid(p) { print("unexpected accepted policy fixture",p.keys.sorted()); exit(1) } }
check(PrivateMCPNetworkRequest.matchedEvent(#"data: {"jsonrpc":"2.0","id":7,"result":{}}"#,id:"7"))
check(!PrivateMCPNetworkRequest.matchedEvent(#"data: {"jsonrpc":"2.0","id":8,"result":{}}"#,id:"7"))
check(!PrivateMCPNetworkRequest.matchedEvent(#"data: {"jsonrpc":"2.0","id":7,"result":"#,id:"7"))
print("native MCP policy and parser passed")
`;
 if(process.platform==='darwin'){const out=cp.execFileSync('swift',['-'],{input:swift,encoding:'utf8',timeout:60000,maxBuffer:1e6});assert(out.includes('policy and parser passed'));}
});

test('official cards: Spotify track uses the provider player instead of custom music controls',async()=>{
 const s=sandbox((u,i,b)=>b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id,result:{structuredContent:{name:'歌曲',uri:'spotify:track:4uLU6hMCjMI75M1A2tKUQC'},content:[]}}):null);await connected(s);const message={role:'user'},ctx=s.M.context('role-a',()=>true,message);await s.M.execute(ctx,ctx.catalog[0],{id:'1'});const html=s.M.chatTraceHTML(message,'role-a');assert(html.includes('data-mcp-official="spotify"'));assert(!html.includes('mcp-inline-play'));assert(!html.includes('class="mcp-result-card"'));
});
test('official cards: preserve declared UI metadata and keep app-only tools out of model context',async()=>{
 const tools=[{...readTool,_meta:{ui:{resourceUri:'ui://github-mcp-server/get-me',visibility:['model','app']}}},{...writeTool,_meta:{ui:{visibility:['app']}}}];const s=sandbox((u,i,b)=>b?.method==='tools/list'?reply({jsonrpc:'2.0',id:b.id,result:{tools}}):null),c=await connected(s);assert.equal(s.M.connection(c.id).tools[0]._meta.ui.resourceUri,'ui://github-mcp-server/get-me');assert.equal(s.M.context('role-a').catalog.length,1);
});
test('official cards: email and quota results remain useful without inventing provider cards',async()=>{
 const s=sandbox((u,i,b)=>b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id,result:{structuredContent:{remaining:10,unit:'requests'},content:[]}}):null);await connected(s);const message={role:'user'},ctx=s.M.context('role-a',()=>true,message);await s.M.execute(ctx,ctx.catalog[0],{id:'1'});const html=s.M.chatTraceHTML(message,'role-a');assert(!html.includes('class="mcp-result-card"'));assert(html.includes('requests'));
});

test('official UI: only an official connection can supply executable card resources',async()=>{
 const tool={...readTool,_meta:{ui:{resourceUri:'ui://github-mcp-server/get-me',visibility:['model','app']}}},s=sandbox((u,i,b)=>b?.method==='tools/list'?reply({jsonrpc:'2.0',id:b.id,result:{tools:[tool]}}):null);await connected(s);const m={role:'user'},ctx=s.M.context('role-a',()=>true,m);await s.M.execute(ctx,ctx.catalog[0],{id:'1'});await new Promise(r=>setTimeout(r,0));assert.equal(s.calls.filter(c=>c.body?.method==='resources/read').length,0);assert(!m._mcpTrace.cards?.some(c=>c.kind==='app'));
});
test('official UI: preserve provider HTML only in scoped memory, never in saved messages or credentials',async()=>{
 const tool={...readTool,_meta:{ui:{resourceUri:'ui://github-mcp-server/get-me',visibility:['model','app']}}};const s=sandbox((u,i,b)=>b?.method==='tools/list'?reply({jsonrpc:'2.0',id:b.id,result:{tools:[tool]}}):b?.method==='resources/read'?reply({jsonrpc:'2.0',id:b.id,result:{contents:[{uri:b.params.uri,mimeType:'text/html;profile=mcp-app',text:'<!doctype html><p>private-provider-html</p>'}]}}):null);const c=await connected(s);s.M.configure(c.id,{url:'https://api.githubcopilot.com/mcp/'});const m={role:'user'},ctx=s.M.context('role-a',()=>true,m);await s.M.execute(ctx,ctx.catalog[0],{id:'1'});await new Promise(r=>setTimeout(r,0));assert(m._mcpTrace.cards.some(c=>c.kind==='app'));assert(s.M.chatTraceHTML(m,'role-a').includes('data-mcp-official="app"'));assert(!JSON.stringify(m).includes('private-provider-html'));assert(!JSON.stringify(s.state).includes('fixture-secret-token'));s.M.configure(c.id,{roles:[]});assert(!s.M.chatTraceHTML(m,'role-a').includes('data-mcp-official="app"'));
});
test('official UI: resource failure never changes a successful tool into a replay or failed write',async()=>{
 const tool={...readTool,_meta:{ui:{resourceUri:'ui://github-mcp-server/get-me'}}};const s=sandbox((u,i,b)=>b?.method==='tools/list'?reply({jsonrpc:'2.0',id:b.id,result:{tools:[tool]}}):b?.method==='resources/read'?reply({},404):null),c=await connected(s);s.M.configure(c.id,{url:'https://api.githubcopilot.com/mcp/'});const m={role:'user'},ctx=s.M.context('role-a',()=>true,m),out=await s.M.execute(ctx,ctx.catalog[0],{id:'1'});await new Promise(r=>setTimeout(r,0));assert(!out.isError);assert.equal(m._mcpTrace.steps.at(-1).state,'ok');assert.equal(s.calls.filter(c=>c.body?.method==='tools/call').length,1);assert(!m._mcpTrace.cards?.some(c=>c.kind==='app'));
});
test('official UI: revoked permission cancels a late resource before creating a card',async()=>{
 let release;const tool={...readTool,_meta:{ui:{resourceUri:'ui://github-mcp-server/get-me'}}};const s=sandbox((u,i,b)=>b?.method==='tools/list'?reply({jsonrpc:'2.0',id:b.id,result:{tools:[tool]}}):b?.method==='resources/read'?new Promise(r=>release=()=>r(reply({jsonrpc:'2.0',id:b.id,result:{contents:[{uri:b.params.uri,mimeType:'text/html;profile=mcp-app',text:'<p>late</p>'}]}}))):null),c=await connected(s);s.M.configure(c.id,{url:'https://api.githubcopilot.com/mcp/'});const m={role:'user'},ctx=s.M.context('role-a',()=>true,m);await s.M.execute(ctx,ctx.catalog[0],{id:'1'});for(let i=0;i<5&&!release;i++)await new Promise(r=>setTimeout(r,0));assert(release);s.M.configure(c.id,{roles:[]});release();await new Promise(r=>setTimeout(r,0));assert(!m._mcpTrace.cards?.some(c=>c.kind==='app'));
});
test('official UI: older native Apps do not advertise UI before the isolated container exists',async()=>{
 const s=sandbox();s.ctx.privateNativeAppOn=()=>true;await connected(s);const init=s.calls.find(c=>c.body?.method==='initialize');assert.equal(init.body.params.capabilities.extensions,undefined);
});

test('official cards: reordering results preserves the matching provider frame identity',async()=>{
 const s=sandbox((u,i,b)=>b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id,result:{structuredContent:{tracks:[{name:'A',uri:'spotify:track:4uLU6hMCjMI75M1A2tKUQC'},{name:'B',uri:'spotify:track:0Lr4kGOYn9l83EjuK6cZFQ'}]},content:[]}}):null);await connected(s);const m={role:'user'},ctx=s.M.context('role-a',()=>true,m);await s.M.execute(ctx,ctx.catalog[0],{id:'1'});const ids=html=>Array.from(html.matchAll(/data-mcp-view="([^"]+)"/g),x=>x[1]),before=ids(s.M.chatTraceHTML(m,'role-a'));assert.equal(before.length,2);m._mcpTrace.cards.reverse();const after=ids(s.M.chatTraceHTML(m,'role-a'));assert.deepEqual(after,[before[1],before[0]]);
});

test('PKCE is S256 in insecure WKWebView as well as browsers',()=>{const {pkce}=sandbox().ctx;for(const v of ['abc','v'.repeat(55),'v'.repeat(56),'v'.repeat(64),'v'.repeat(128)])assert.equal(pkce(v),crypto.createHash('sha256').update(v).digest('base64url'));});

test('saving alone is not connection success; scopes, credentials and receipts stay outside app data',async()=>{
 const s=sandbox(),before=JSON.stringify(s.state),c=s.M.add({name:'A',url:'https://mcp.fixture.invalid/mcp',auth:'bearer',token:'fixture-secret-token'});
 assert.equal(c.state,'saved');assert.equal(s.M.context('role-a'),null);await s.M.connect(c.id);assert.equal(s.M.connection(c.id).state,'connected');assert.equal(s.M.context('role-a'),null);
 s.M.configure(c.id,{roles:['role-a']});assert(s.M.context('role-a'));assert.equal(JSON.stringify(s.state),before);assert(!JSON.stringify(s.M.data().receipts).includes('fixture-secret-token'));
 s.state.me.active='other';assert.equal(s.M.data().connections.length,0);assert.equal(s.M.context('role-a'),null);s.state.me.active='main';assert.equal(s.M.data().connections.length,1);
 s.ctx.NorthLicense.session=()=>({licenseId:'owner-b'});assert.equal(s.M.data().connections.length,0);
});

test('role uses actual tool result in its next model request, without a separate planner call',async()=>{
 const s=sandbox(),c=await connected(s),ctx=s.M.context('role-a'),requests=[];s.ctx.chatAPI=async(rows,opt)=>{requests.push(rows);assert.equal(opt.mcpContext,null);return requests.length===1?call(ctx.catalog[0].alias):'根据实际记录回答';};
 assert.equal(await s.M.roleReply([{role:'user',content:'查一下笔记'}],{mcpContext:ctx}),'根据实际记录回答');
 assert.equal(requests.length,2);assert(requests[1].at(-1).content.includes('actual-server-result'));assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);assert.equal(s.panels.length,0,'authorized read needs no write confirmation');
 assert(!JSON.stringify(requests).includes(c.token));
});

test('write confirmation can reject or accept exactly one call; auto mode executes without popup',async()=>{
 const s=sandbox(),c=await connected(s);let ctx=s.M.context('role-a'),item=ctx.catalog[1];const denied=s.M.execute(ctx,item,{text:'new note'});await new Promise(r=>setImmediate(r));assert.equal(s.panels.length,1);let id=s.panels.at(-1).id.replace('mcp-confirm-','');s.M.approve(id,false);assert.equal((await denied).isError,true);assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,0);
 ctx=s.M.context('role-a');item=ctx.catalog[1];const accepted=s.M.execute(ctx,item,{text:'new note'});await new Promise(r=>setImmediate(r));s.M.approve(s.panels.at(-1).id.replace('mcp-confirm-',''),true);assert.equal((await accepted).isError,undefined);assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);
 s.M.configure(c.id,{mode:'auto'});ctx=s.M.context('role-a');const panels=s.panels.length;await s.M.execute(ctx,ctx.catalog[1],{text:'auto write'});assert.equal(s.panels.length,panels);assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,2);
});

test('pending approval is revoked on account switch, role removal or permission change',async()=>{
 for(const revoke of ['account','permission','role']){const s=sandbox(),c=await connected(s),ctx=s.M.context('role-a'),p=s.M.execute(ctx,ctx.catalog[1],{text:'x'});await new Promise(r=>setImmediate(r));if(revoke==='account')s.state.me.active='other';if(revoke==='permission')s.M.configure(c.id,{roles:[]});if(revoke==='role')s.state.contacts[0].deleted=true;s.M.approve(s.panels.at(-1).id.replace('mcp-confirm-',''),true);await assert.rejects(p,/已变化/);assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,0);}
});

test('ambiguous network failure never replays a write and duplicate calls reuse the refusal/result',async()=>{
 const s=sandbox((u,i,b)=>{if(b?.method==='tools/call')throw new TypeError('Failed to fetch');}),c=await connected(s,'auto'),ctx=s.M.context('role-a'),item=ctx.catalog[1];
 const first=await s.M.execute(ctx,item,{text:'once'});assert.equal(first.isError,true);assert(s.M.data().receipts.some(r=>r.state==='unknown'));
 await s.M.execute(ctx,item,{text:'once'});assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);
});

test('late tool result cannot go to a changed account or replaced state',async()=>{
 let release;const s=sandbox(async(u,i,b)=>{if(b?.method==='tools/call')return new Promise(resolve=>{release=()=>resolve(reply({jsonrpc:'2.0',id:b.id,result:{content:[{type:'text',text:'private-result'}]}}));});}),c=await connected(s,'auto'),ctx=s.M.context('role-a');const p=s.M.execute(ctx,ctx.catalog[0],{id:'1'});while(!release)await new Promise(r=>setImmediate(r));s.state.me.active='other';release();await assert.rejects(p,/已变化/);assert.equal(s.M.data().receipts.length,0);
});

test('chat trace follows approval and actual result without storing arguments, credentials or result body',async()=>{
 let release;const s=sandbox((u,i,b)=>b?.method==='tools/call'?new Promise(resolve=>{release=()=>resolve(reply({jsonrpc:'2.0',id:b.id,result:{content:[{type:'text',text:'private-result-body'}]}}));}):null);
 await connected(s);const message={id:'trace-source',role:'user',content:'修改笔记'},ctx=s.M.context('role-a',()=>true,message);let n=0;s.ctx.chatAPI=async()=>++n===1?call(ctx.catalog[1].alias,{text:'private-argument'}):'改好了。';
 const turn=s.M.roleReply([{role:'user',content:message.content}],{mcpContext:ctx});while(!s.panels.length)await new Promise(r=>setImmediate(r));assert.equal(message._mcpTrace.state,'awaiting');assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,0);
 s.M.approve(s.panels.at(-1).id.replace('mcp-confirm-',''),true);while(!release)await new Promise(r=>setImmediate(r));assert.equal(message._mcpTrace.state,'running');release();assert.equal(await turn,'改好了。');assert.equal(message._mcpTrace.state,'ok');assert(message._mcpTrace.endedAt);
 const persisted=JSON.stringify(message._mcpTrace);for(const secret of ['private-argument','private-result-body','fixture-secret-token'])assert(!persisted.includes(secret));assert(s.M.chatTraceHTML(message,'role-a').includes('已完成'));s.state.me.active='other';assert.equal(s.M.chatTraceHTML(message,'role-a'),'');
});

test('missing required or wrong typed parameters never reach the remote tool and role receives the real preflight error',async()=>{
 const s=sandbox();await connected(s,'auto');const message={role:'user',content:'读取'},ctx=s.M.context('role-a',()=>true,message),requests=[];s.ctx.chatAPI=async rows=>{requests.push(rows);return requests.length===1?call(ctx.catalog[0].alias,{id:7}):'需要你补充正确的笔记编号。';};
 assert.equal(await s.M.roleReply([{role:'user',content:message.content}],{mcpContext:ctx}),'需要你补充正确的笔记编号。');assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,0);assert(requests[1].at(-1).content.includes('类型不正确'));assert.equal(message._mcpTrace.state,'failed');
 const next=s.M.context('role-a');assert((await s.M.execute(next,next.catalog[0],{})).isError);assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,0);
 assert(requests[0].some(x=>x.content.includes('缺少必填信息时先询问')));assert(requests[0].some(x=>x.content.includes('inputSchema')));
});

test('chat trace distinguishes rejection, service failure and ambiguous writes from successful execution',async()=>{
 for(const state of ['cancelled','failed','unknown']){
  const s=sandbox((u,i,b)=>{if(b?.method!=='tools/call')return null;if(state==='unknown')throw new TypeError('Failed to fetch');return reply({jsonrpc:'2.0',id:b.id,result:{isError:true,content:[{type:'text',text:'not allowed'}]}});});await connected(s,state==='cancelled'?'ask':'auto');const message={role:'user'},ctx=s.M.context('role-a',()=>true,message);let n=0;s.ctx.chatAPI=async()=>++n===1?call(ctx.catalog[1].alias,{text:'new'}):'操作没有确认完成。';const turn=s.M.roleReply([{role:'user',content:'修改'}],{mcpContext:ctx});if(state==='cancelled'){while(!s.panels.length)await new Promise(r=>setImmediate(r));s.M.approve(s.panels.at(-1).id.replace('mcp-confirm-',''),false);}await turn;assert.equal(message._mcpTrace.state,state);assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,state==='cancelled'?0:1);
 }
});

test('chat trace never persists a remote error that echoes submitted arguments',async()=>{
 const s=sandbox((u,i,b)=>b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id,error:{code:-32602,message:'rejected private-argument-echo'}}):null);await connected(s,'auto');const message={role:'user'},ctx=s.M.context('role-a',()=>true,message);let n=0;s.ctx.chatAPI=async()=>++n===1?call(ctx.catalog[1].alias,{text:'private-argument-echo'}):'这次没有完成。';await s.M.roleReply([{role:'user',content:'修改'}],{mcpContext:ctx});assert.equal(message._mcpTrace.state,'failed');assert(!JSON.stringify(message._mcpTrace).includes('private-argument-echo'));
});

test('ordinary role reply creates no trace and interrupted persisted trace never displays a false live status',async()=>{
 const s=sandbox();await connected(s);const message={role:'user'},ctx=s.M.context('role-a',()=>true,message);s.ctx.chatAPI=async()=>'普通聊天';assert.equal(await s.M.roleReply([{role:'user',content:'你好'}],{mcpContext:ctx}),'普通聊天');assert.equal(message._mcpTrace,undefined);
 for(const [state,label] of [['running','结果待核对'],['awaiting','已取消']]){message._mcpTrace={id:'interrupted',account:'main',roleId:'role-a',state,steps:[{service:'测试',state}]};assert(s.M.chatTraceHTML(message,'role-a').includes(label));}
});

test('MCP budget: tiny chat settings do not cap tool requests and normal configuration is untouched',async()=>{
 const s=sandbox();s.state.settings.hist=2;s.state.settings.chat={maxTokens:16,reasoningEnabled:true};await connected(s,'auto');
 const before=JSON.stringify(s.state),ctx=s.M.context('role-a'),requests=[],messages=[{role:'system',content:'人设与笔记'.repeat(30000)},{role:'user',content:'把笔记写成周六去植物园。'}];
 s.ctx.chatAPI=async(rows,opt)=>{requests.push({rows:JSON.parse(JSON.stringify(rows)),opt});assert(opt.max>=4096);assert.equal(opt.complete,false);assert.equal(opt.mcpBudget,true);assert(Buffer.byteLength(JSON.stringify(rows))<=16000);return requests.length===1?call(ctx.catalog[1].alias,{text:'周六去植物园。'}):'笔记更新好了。';};
 assert.equal(await s.M.roleReply(messages,{mcpContext:ctx,max:16}),'笔记更新好了。');assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);assert.equal(JSON.stringify(s.state),before);assert.equal(messages[0].content.length,150000);assert(JSON.stringify(requests[0].rows).includes('把笔记写成周六去植物园。'));
});

test('MCP budget: persona and recent context take priority over unrelated module prompts',async()=>{
 const s=sandbox();s.state.contacts[0].persona='我是温柔的园艺师，叫林川。';await connected(s);const ctx=s.M.context('role-a');let n=0;
 s.ctx.chatAPI=async rows=>{const text=JSON.stringify(rows);assert(text.includes('温柔的园艺师'));assert(text.includes('昨天说想去植物园'));assert(!text.includes('unrelated-module-private-context'));return ++n===1?call(ctx.catalog[0].alias):'给你查好了。';};
 assert.equal(await s.M.roleReply([{role:'system',content:'unrelated-module-private-context'},{role:'user',content:'昨天说想去植物园'},{role:'assistant',content:'我记着。'},{role:'user',content:'帮我查笔记。'}],{mcpContext:ctx}),'给你查好了。');
});

test('MCP cards: Spotify uses its official player and preserves legacy direct-audio API compatibility',async()=>{
 const track={id:'4uLU6hMCjMI75M1A2tKUQC',type:'track',name:'真实返回的歌名',artists:[{name:'真实歌手'}],preview_url:'https://p.scdn.co/mp3-preview/fixture',external_urls:{spotify:'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'}},s=sandbox((u,i,b)=>b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id,result:{structuredContent:{tracks:{items:[track]}},content:[]}}):null);
 const c=await connected(s);s.M.configure(c.id,{provider:'spotify'});const message={id:'song-source',role:'user',content:'推荐音乐'},ctx=s.M.context('role-a',()=>true,message);await s.M.execute(ctx,ctx.catalog[0],{id:'1'});
 assert.equal(message._mcpTrace.cards.length,1);const card=message._mcpTrace.cards[0];assert.equal(card.kind,'music');assert.equal(card.title,track.name);assert.equal(card.audio,track.preview_url);const html=s.M.chatTraceHTML(message,'role-a');assert(html.includes('播放'));assert(html.includes('data-mcp-official="spotify"'));assert(!html.includes('class="mcp-result-card"'));assert(!html.includes('<iframe'));assert(!html.includes('<audio'));
 let modal='',played='';s.ctx.msgsForAccount=()=>[message];s.ctx.cur=()=>({p:'chat',id:'role-a'});s.ctx.openModal=x=>{modal=x;};s.ctx.musicInit=()=>{s.state.music=s.state.music||{songs:[]};};s.ctx.musicPlay=async id=>{played=id;};await s.M.openCard('role-a',message._mcpTrace.id,0);assert.equal(modal,'');assert(played);assert.equal(s.state.music.songs[0].src.url,track.preview_url);assert.equal(s.state.music.songs[0].mcpAccount,'main');const count=s.state.music.songs.length;await s.M.openCard('role-a',message._mcpTrace.id,0);assert.equal(s.state.music.songs.length,count);s.state.me.active='other';played='';await s.M.openCard('role-a',message._mcpTrace.id,0);assert.equal(played,'');
});

test('MCP cards: a Gmail draft has an honest view destination and never claims it was sent',async()=>{
 const s=sandbox((u,i,b)=>b?.method==='tools/list'?reply({jsonrpc:'2.0',id:b.id,result:{tools:[{...writeTool,name:'create_draft'}]}}):b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id,result:{structuredContent:{id:'draft-only-api-id',message:{id:'message-api-id',snippet:'private-body-must-not-be-in-card'}},content:[]}}):null);
 const c=await connected(s,'auto');s.M.configure(c.id,{provider:'gmail'});const message={id:'draft-source',role:'user',content:'写草稿'},ctx=s.M.context('role-a',()=>true,message);await s.M.execute(ctx,ctx.catalog[0],{text:'新邮件'});
 const cards=message._mcpTrace.cards;assert.equal(cards.length,1);assert.equal(cards[0].href,'https://mail.google.com/mail/u/0/#drafts');assert.equal(cards[0].kind,'mail');const html=s.M.chatTraceHTML(message,'role-a');assert(html.includes('草稿箱'));assert(!html.includes('class="mcp-result-card"'));assert(html.includes('未发送'));assert(html.includes('已授权的邮箱'));assert(!JSON.stringify(cards).includes('private-body-must-not-be-in-card'));assert(!cards[0].href.includes('draft-only-api-id'));
});

test('MCP cards: untrusted links, failures and cross-account imported cards do not activate',async()=>{
 const s=sandbox((u,i,b)=>b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id,result:{structuredContent:{items:[{title:'evil',url:'javascript:alert(1)'},{title:'secret',url:'https://service.invalid/x?token=fixture-secret-token'},{title:'local',url:'https://127.0.0.1/admin'},{title:'有效任务',url:'https://linear.app/workspace/issue/ABC-12'}]},content:[]}}):null);await connected(s);const message={role:'user'},ctx=s.M.context('role-a',()=>true,message);await s.M.execute(ctx,ctx.catalog[0],{id:'1'});assert.equal(message._mcpTrace.cards.length,1);assert.equal(message._mcpTrace.cards[0].title,'有效任务');s.state.me.active='other';assert.equal(s.M.chatTraceHTML(message,'role-a'),'');
});

test('MCP cards: a Spotify link alone is not presented as a direct playable audio source',async()=>{
 const s=sandbox((u,i,b)=>b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id,result:{content:[{type:'text',text:'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'}]}}):null),c=await connected(s);s.M.configure(c.id,{provider:'spotify'});const message={id:'link-only',role:'user'},ctx=s.M.context('role-a',()=>true,message);await s.M.execute(ctx,ctx.catalog[0],{id:'1'});
 s.ctx.msgsForAccount=()=>[message];s.ctx.cur=()=>({p:'chat',id:'role-a'});let html='';s.ctx.openModal=x=>{html=x;};await s.M.openCard('role-a',message._mcpTrace.id,0);assert.equal(html,'');const cardHTML=s.M.chatTraceHTML(message,'role-a');assert(!cardHTML.includes('<iframe'));assert(cardHTML.includes('data-mcp-official="spotify"'));assert(!cardHTML.includes('disabled'));assert(!cardHTML.includes('mcp-inline-play'));
});

test('MCP data cards: cloud remaining, used, limit and units are real fields, not inferred balances',async()=>{
 const data={resource:'Workers',remaining:9623000,used:377000,limit:10000000,unit:'requests',period:'本月'},s=sandbox((u,i,b)=>b?.method==='tools/list'?reply({jsonrpc:'2.0',id:b.id,result:{tools:[{...readTool,name:'get_account_usage'}]}}):b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id,result:{structuredContent:{data},content:[]}}):null);const c=await connected(s);s.M.configure(c.id,{provider:'cloudflare'});const message={role:'user'},ctx=s.M.context('role-a',()=>true,message);await s.M.execute(ctx,ctx.catalog[0],{id:'1'});const card=message._mcpTrace.cards.find(c=>c.kind==='data');assert(card);const html=s.M.chatTraceHTML(message,'role-a');for(const text of ['9623000','377000','10000000','requests','本月'])assert(html.includes(text));assert(!html.includes('余额：'));assert(card.rows.some(x=>x.label==='剩余'&&x.value==='9623000'));
});

test('MCP cards: unsuccessful services never create success cards',async()=>{
 const s=sandbox((u,i,b)=>b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id,result:{isError:true,structuredContent:{name:'不得显示的歌曲',type:'track',id:'4uLU6hMCjMI75M1A2tKUQC'},content:[]}}):null),c=await connected(s);s.M.configure(c.id,{provider:'spotify'});const message={role:'user'},ctx=s.M.context('role-a',()=>true,message);await s.M.execute(ctx,ctx.catalog[0],{id:'1'});assert.equal(message._mcpTrace.cards,undefined);assert(!s.M.chatTraceHTML(message,'role-a').includes('mcp-result-card'));
});

test('MCP budget: context rejection compacts only a model request and keeps exact current task',async()=>{
 const s=sandbox();await connected(s);const ctx=s.M.context('role-a'),seen=[];let n=0;
 s.ctx.chatAPI=async(rows,opt)=>{seen.push({size:Buffer.byteLength(JSON.stringify(rows)),max:opt.max,rows});if(++n===1){const e=new Error('maximum context length exceeded');e.status=400;throw e;}return n===2?call(ctx.catalog[0].alias):'读取完成。';};
 assert.equal(await s.M.roleReply([{role:'user',content:'旧聊天'.repeat(9000)},{role:'assistant',content:'旧回答'.repeat(9000)},{role:'user',content:'查编号 1 的笔记。'}],{mcpContext:ctx}),'读取完成。');assert(seen[1].size<seen[0].size);assert(JSON.stringify(seen[1].rows).includes('查编号 1 的笔记。'));assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);
});

test('MCP budget: truncated model parameters regenerate before dispatch, never concatenate half JSON',async()=>{
 const s=sandbox();await connected(s,'auto');const ctx=s.M.context('role-a'),seen=[];let n=0;
 s.ctx.chatAPI=async(rows,opt)=>{seen.push({rows,opt});if(++n===1){const e=new Error('tool response truncated');e.mcpCapacity='output';throw e;}return n===2?call(ctx.catalog[1].alias,{text:'完整的新笔记'}):'修改完成。';};
 assert.equal(await s.M.roleReply([{role:'user',content:'修改笔记'}],{mcpContext:ctx,max:1}),'修改完成。');assert(seen[1].opt.max>seen[0].opt.max);assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);assert(!JSON.stringify(seen[1].rows).includes('tool response truncated'));
});

test('MCP budget: truncated protocol without a finish reason is regenerated without dispatching its prefix',async()=>{
 const s=sandbox();await connected(s,'auto');const ctx=s.M.context('role-a'),limits=[];let n=0;
 s.ctx.chatAPI=async(rows,opt)=>{limits.push(opt.max);if(++n===1)return '{"mcp_call":{"tool":"'+ctx.catalog[1].alias+'","arguments":{"text":"只写一半';return n===2?call(ctx.catalog[1].alias,{text:'完整参数'}):'已完整写入。';};
 assert.equal(await s.M.roleReply([{role:'user',content:'修改笔记'}],{mcpContext:ctx}),'已完整写入。');assert.equal(limits[0],4096);assert.equal(limits[1],8192);assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);
});

test('MCP budget: large results remain readable to their last character without replaying the external tool',async()=>{
 const result='长结果'.repeat(16000)+'END-OF-REAL-RESULT',s=sandbox((u,i,b)=>b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id,result:{content:[{type:'text',text:result}]}}):null);await connected(s);const ctx=s.M.context('role-a');let n=0,ref='',tailSeen=false;
 s.ctx.chatAPI=async rows=>{n++;assert(Buffer.byteLength(JSON.stringify(rows))<=16000);if(n===1)return call(ctx.catalog[0].alias);if(n===2){const text=rows.at(-1).content;const meta=JSON.parse(text.slice(text.indexOf('\n')+1));assert(meta.mcp_ref);ref=meta.mcp_ref;return JSON.stringify({mcp_read:{ref,offset:meta.totalChars-200,length:200}});}tailSeen=rows.at(-1).content.includes('END-OF-REAL-RESULT');return '已读取结果末尾。';};
 assert.equal(await s.M.roleReply([{role:'user',content:'读取并核对最后一行'}],{mcpContext:ctx}),'已读取结果末尾。');assert(tailSeen);assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);assert(!JSON.stringify(s.state).includes('END-OF-REAL-RESULT'));
});

test('MCP budget: explicit skip resumes the exact ordinary chat request and its original output limit',async()=>{
 const s=sandbox();await connected(s);const ctx=s.M.context('role-a'),messages=[{role:'system',content:'原始人设'},{role:'user',content:'晚安呀'}];let n=0;
 s.ctx.chatAPI=async(rows,opt)=>{if(++n===1)return '{"mcp_skip":true}';assert.equal(JSON.stringify(rows),JSON.stringify(messages));assert.equal(opt.max,25);assert.equal(opt.mcpContext,null);assert(!opt.mcpBudget);return '晚安，早点休息。';};
 assert.equal(await s.M.roleReply(messages,{mcpContext:ctx,max:25}),'晚安，早点休息。');assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,0);
});

test('MCP budget: exhausted final model capacity keeps a successful write single and reports its real state',async()=>{
 const s=sandbox();await connected(s,'auto');const sourceMessage={role:'user',content:'写笔记'},ctx=s.M.context('role-a',()=>true,sourceMessage);let n=0;
 s.ctx.chatAPI=async()=>{if(++n===1)return call(ctx.catalog[1].alias,{text:'只写一次'});const e=new Error('maximum context length exceeded');e.status=400;throw e;};
 const out=await s.M.roleReply([{role:'user',content:'写笔记'}],{mcpContext:ctx});assert(out.includes('工具流程已停止'));assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);assert(n<=6);assert.equal(sourceMessage._mcpTrace.state,'failed');
});

test('MCP budget: even valid JSON with a length finish reason is rejected before execution',async()=>{
 const ctx=vm.createContext({Error});vm.runInContext(fnSource(readProject('src/app/004-roleImageTimeRangeActive.js'),'chatResultText')+'\nthis.check=chatResultText;',ctx);
 for(const finish of ['length','max_tokens'])await assert.rejects(ctx.check([],{mcpBudget:true},{choices:[{message:{content:call('valid',{text:'完整但未确认结束'})},finish_reason:finish}]}),e=>e.mcpCapacity==='output');
});

test('MCP budget: Claude thought preview cannot inject ordinary thinking budget into a tool request',()=>{
 const ctx=vm.createContext({roleThinkingOn:()=>true,roleThinkingBudget:()=>32768});vm.runInContext(fnSource(readProject('src/app/004-roleImageTimeRangeActive.js'),'roleThinkingRequest')+'\nthis.request=roleThinkingRequest;',ctx);const rows=[{role:'user',content:'查笔记'}],opt={reasoningCapture:{rows:[]},allowWechatThought:true,max:16},cfg={base:'https://fixture.invalid',model:'claude-fixture',key:'fixture'};
 const tool=ctx.request(rows,{...opt,mcpBudget:true,max:4096},cfg);assert.equal(tool.url,'https://fixture.invalid/messages');assert.equal(tool.body.max_tokens,4096);assert.equal(tool.body.thinking,undefined);assert.equal(ctx.request(rows,opt,cfg).body.max_tokens,32784);
});

test('MCP budget: independent recent history is account-scoped and permission revocation cancels capacity recovery',async()=>{
 const s=sandbox();await connected(s,'auto');const sourceMessage={id:'latest-task',role:'user',content:'照刚才的安排更新笔记'},history=[{role:'user',content:'只用账号 main 的周六植物园安排'},...Array.from({length:5},(_,i)=>({role:i%2?'user':'assistant',content:'补充'+i})),sourceMessage];
 s.ctx.msgsForAccount=(id,account)=>{assert.equal(id,'role-a');assert.equal(account,'main');return history;};s.ctx.msgToText=m=>m.content;const ctx=s.M.context('role-a',()=>true,sourceMessage);let seen=0;
 s.ctx.chatAPI=async rows=>{seen++;assert(JSON.stringify(rows).includes('植物园安排'));s.state.me.active='other';const e=new Error('context_length_exceeded');e.status=400;throw e;};
 await assert.rejects(s.M.roleReply([{role:'user',content:sourceMessage.content}],{mcpContext:ctx}),/已变化/);assert.equal(seen,1);assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,0);assert.equal(ctx.work,undefined);
});

test('MCP budget: unread task blocks a write but reading the exact text permits the same arguments once',async()=>{
 const s=sandbox();await connected(s,'auto');const text='请完整阅读这份修改要求。'.repeat(95),ctx=s.M.context('role-a');let n=0,offset=0,taskRef='';
 s.ctx.chatAPI=async rows=>{n++;if(!taskRef){const taskRow=rows.find(x=>x.content.startsWith('当前任务：'));const start=taskRow.content.indexOf('{'),end=taskRow.content.indexOf('\n角色资料：');const meta=JSON.parse(taskRow.content.slice(start,end));taskRef=meta.mcp_ref;assert(taskRef);}if(n===1)return call(ctx.catalog[1].alias,{text:'完整修改'});if(n===2)assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,0);
  if(offset<text.length){if(rows.at(-1).content.startsWith('[本地资料读取')){const part=JSON.parse(rows.at(-1).content.split('\n').slice(1).join('\n'));offset=part.nextOffset;}if(offset<text.length)return JSON.stringify({mcp_read:{ref:taskRef,offset,length:600}});}
  if(s.calls.filter(x=>x.body?.method==='tools/call').length===0)return call(ctx.catalog[1].alias,{text:'完整修改'});return'已按完整要求修改。';};
 assert.equal(await s.M.roleReply([{role:'user',content:text}],{mcpContext:ctx}),'已按完整要求修改。');assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);assert.equal(ctx.work,undefined);
});

test('MCP budget: provider output cap is handled without changing the saved route or retrying network failures',async()=>{
 const s=sandbox();await connected(s);const ctx=s.M.context('role-a'),saved=JSON.stringify(s.state);let n=0;
 s.ctx.chatAPI=async(rows,opt)=>{if(++n===1){assert.equal(opt.max,4096);const e=new Error('max_tokens must be at most 2048');e.status=400;throw e;}assert.equal(opt.max,2048);return n===2?call(ctx.catalog[0].alias):'读取完成。';};
 assert.equal(await s.M.roleReply([{role:'user',content:'读取笔记'}],{mcpContext:ctx}),'读取完成。');assert.equal(JSON.stringify(s.state),saved);
 const next=s.M.context('role-a');n=0;s.ctx.chatAPI=async()=>{n++;throw new TypeError('Failed to fetch');};await assert.rejects(s.M.roleReply([{role:'user',content:'再读取'}],{mcpContext:next}),/Failed to fetch/);assert.equal(n,1);
});

test('session id, paginated catalog and matching SSE response are handled; open SSE is closed after final result',async()=>{
 let page=0,cancelled=false;const s=sandbox((u,i,b)=>{if(b?.method==='initialize')return reply({jsonrpc:'2.0',id:b.id,result:{protocolVersion:'2025-06-18'}},200,{'Mcp-Session-Id':'session-fixture'});if(b?.method==='tools/list'){assert.equal(i.headers['Mcp-Session-Id'],'session-fixture');page++;const content={tools:[page===1?readTool:writeTool],...(page===1?{nextCursor:'two'}:{})};const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:999,result:{ignored:true}})+'\n\n'+'data: '+JSON.stringify({jsonrpc:'2.0',id:b.id,result:content})+'\n\n'));},cancel(){cancelled=true;}});return new Response(stream,{headers:{'Content-Type':'text/event-stream'}});}});
 const c=s.M.add({name:'SSE',url:'https://mcp.fixture.invalid/mcp'});assert.equal((await s.M.connect(c.id)).length,2);assert.equal(page,2);assert(cancelled);
});

test('modern server can negotiate stateless protocol without legacy session retry',async()=>{
 const s=sandbox((u,i,b)=>{if(b?.method==='initialize')return reply({jsonrpc:'2.0',id:b.id,error:{code:-32022,message:'unsupported',data:{supported:['2026-07-28']}}},400);if(b?.method==='server/discover')return reply({jsonrpc:'2.0',id:b.id,result:{resultType:'complete',serverInfo:{name:'modern'},capabilities:{tools:{}}}});if(b?.method==='tools/list'){assert.equal(b.params._meta['io.modelcontextprotocol/protocolVersion'],'2026-07-28');assert.equal(i.headers['MCP-Protocol-Version'],'2026-07-28');assert.equal(i.headers['Mcp-Session-Id'],undefined);}});const c=s.M.add({url:'https://mcp.fixture.invalid/mcp'});await s.M.connect(c.id);assert(!s.calls.some(x=>x.body?.method==='notifications/initialized'));
});

test('OAuth DCR and PKCE bind state, resource and callback; wrong state cannot exchange code',async()=>{
 const oauth=[];const s=sandbox((u,i,b)=>{if(u.includes('oauth-protected-resource'))return reply({resource:'https://mcp.fixture.invalid/mcp',authorization_servers:['https://auth.fixture.invalid'],scopes_supported:['read','write']});if(u.includes('oauth-authorization-server'))return reply({issuer:'https://auth.fixture.invalid',authorization_endpoint:'https://auth.fixture.invalid/authorize',token_endpoint:'https://auth.fixture.invalid/token',registration_endpoint:'https://auth.fixture.invalid/register',code_challenge_methods_supported:['S256']});if(u.endsWith('/register'))return reply({client_id:'public-client'});if(u.endsWith('/token')){oauth.push(new URLSearchParams(i.body));return reply({access_token:'oauth-access-fixture',refresh_token:'oauth-refresh-fixture',expires_in:3600});}});
 const c=s.M.add({name:'OAuth',url:'https://mcp.fixture.invalid/mcp',auth:'oauth'}),url=new URL(await s.M.beginOAuth(c.id));assert.equal(url.searchParams.get('scope'),'read');assert.equal(url.searchParams.get('code_challenge_method'),'S256');const callback=new URL(url.searchParams.get('redirect_uri'));callback.searchParams.set('code','fixture-code');callback.searchParams.set('state','wrong');await assert.rejects(s.M.finishOAuth(c.id,callback.href),/不匹配/);assert.equal(oauth.length,0);callback.searchParams.set('state',url.searchParams.get('state'));await s.M.finishOAuth(c.id,callback.href);assert.equal(oauth.length,1);assert.equal(oauth[0].get('resource'),c.url);assert.equal(s.M.connection(c.id).state,'connected');assert.equal(s.M.connection(c.id).pending,null);assert(!JSON.stringify(s.state).includes('oauth-access-fixture'));
});

test('own Gmail gateway can use its registered same-service receipt without changing existing callback defaults',async()=>{
 let exchanges=0;const host='https://own-gmail.fixture.invalid',s=sandbox((url,init,b)=>{
  if(url.includes('oauth-protected-resource'))return reply({resource:host+'/mcp',authorization_servers:[host],scopes_supported:['mcp:read','mcp:write','offline_access']});
  if(url.includes('oauth-authorization-server'))return reply({issuer:host,authorization_endpoint:host+'/authorize',token_endpoint:host+'/oauth/token',code_challenge_methods_supported:['S256']});
  if(url===host+'/oauth/token'){exchanges++;const form=new URLSearchParams(init.body);assert.equal(form.get('redirect_uri'),host+'/client-callback');assert(!form.has('client_secret'));return reply({access_token:'gateway-opaque-token',refresh_token:'gateway-refresh',expires_in:3300});}
 });
 const c=s.M.add({name:'Gmail',provider:'gmail',url:host+'/mcp',auth:'oauth',clientId:'registered-public-client',serviceCallback:true});
 const authorization=new URL(await s.M.beginOAuth(c.id));assert.equal(authorization.searchParams.get('redirect_uri'),host+'/client-callback');assert.equal(authorization.searchParams.get('client_id'),'registered-public-client');const state=s.M.connection(c.id).pending.state;
 await assert.rejects(s.M.finishOAuth(c.id,'https://fenglina35-dotcom.github.io/phone/fish-oauth.html?mcp=1&code=x&state='+state),/不匹配/);
 await s.M.finishOAuth(c.id,host+'/client-callback?code=fixture&state='+state);assert.equal(exchanges,1);assert.equal(s.M.connection(c.id).state,'connected');assert(!JSON.stringify(s.state).includes('gateway-opaque-token'));
});

test('OAuth refresh rotates once for simultaneous role requests and later RPCs use the new token',async()=>{
 let renew=0;const seen=[];const s=sandbox(async(u,i,b)=>{if(u.endsWith('/token')){renew++;await new Promise(r=>setTimeout(r,5));return reply({access_token:'rotated-access',refresh_token:'rotated-refresh',expires_in:3600});}if(b)seen.push(i.headers.Authorization);});
 const c=await connected(s,'auto');s.M.configure(c.id,{auth:'oauth',token:'old-access',refresh:'old-refresh',exp:1,clientId:'public-client',oauth:{token_endpoint:'https://auth.fixture.invalid/token'}});
 const a=s.M.context('role-a'),b=s.M.context('role-a');await Promise.all([s.M.execute(a,a.catalog[0],{id:'a'}),s.M.execute(b,b.catalog[0],{id:'b'})]);assert.equal(renew,1);assert.equal(s.M.connection(c.id).refresh,'rotated-refresh');assert.equal(seen.at(-1),'Bearer rotated-access');
});

test('malformed catalog never produces connected status or role capability',async()=>{
 const s=sandbox((u,i,b)=>b?.method==='tools/list'?reply({jsonrpc:'2.0',id:b.id+1,result:{tools:[readTool]}}):null),c=s.M.add({url:'https://mcp.fixture.invalid/mcp'});
 await assert.rejects(s.M.connect(c.id),/匹配的 MCP/);assert.equal(s.M.connection(c.id).state,'failed');assert.equal(s.M.context('role-a'),null);assert(!s.M.data().receipts.some(r=>r.stage==='连接完成'));
});

test('a tool error is fed to the role as failure, with no automatic re-execution',async()=>{
 const s=sandbox((u,i,b)=>b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id,result:{isError:true,content:[{type:'text',text:'permission-denied'}]}}):null),c=await connected(s,'auto'),ctx=s.M.context('role-a');let n=0;s.ctx.chatAPI=async rows=>{n++;if(n===1)return call(ctx.catalog[0].alias);assert(rows.at(-1).content.includes('"isError":true'));return'这次服务没有允许读取。';};
 assert.equal(await s.M.roleReply([{role:'user',content:'read'}],{mcpContext:ctx}),'这次服务没有允许读取。');assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);
});

test('a rejected final reply guard cannot replay an already submitted operation',async()=>{
 const s=sandbox(),c=await connected(s,'auto'),ctx=s.M.context('role-a');let n=0;s.ctx.chatAPI=async()=>++n===1?call(ctx.catalog[1].alias,{text:'one write'}):'final';s.ctx.chatResultText=async()=>{throw new Error('final reply guard rejected');};
 const out=await s.M.roleReply([{role:'user',content:'write'}],{mcpContext:ctx});assert(out.includes('工具流程已停止'));assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);
});

test('a malformed write reply is marked unknown and cannot be silently resubmitted',async()=>{
 const s=sandbox((u,i,b)=>b?.method==='tools/call'?reply({jsonrpc:'2.0',id:b.id+1,result:{content:[]}}):null),c=await connected(s,'auto'),ctx=s.M.context('role-a');await s.M.execute(ctx,ctx.catalog[1],{text:'once'});assert(s.M.data().receipts.some(r=>r.state==='unknown'));await s.M.execute(ctx,ctx.catalog[1],{text:'once'});assert.equal(s.calls.filter(x=>x.body?.method==='tools/call').length,1);
});

test('Spotify and Gmail presets require real configuration and keep provider branding on a custom Host',async()=>{
 const s=sandbox(),spotify=s.M.catalog.find(x=>x.id==='spotify'),gmail=s.M.catalog.find(x=>x.id==='gmail');assert(spotify&&spotify.requiresHost);assert(!spotify.url,'never invent a public Spotify MCP address');assert.equal(gmail.url,'https://gmailmcp.googleapis.com/mcp/v1');assert.equal(gmail.auth,'bearer');assert.equal(gmail.preview,true);
 let modal='';s.ctx.openModal=html=>{modal=html;};s.M.edit('','spotify');assert(modal.includes('Spotify'));assert(modal.includes('Premium'));assert(modal.includes('name="mcp-provider"'));assert(!modal.includes('client-secret'));const form=modal.match(/id="mcp-url"[^>]*value="([^"]*)"/);assert(form);assert.equal(form[1],'');
 const c=s.M.add({name:'Spotify',provider:'spotify',url:'https://own-music.fixture.invalid/mcp',auth:'none'});assert.equal(s.M.connection(c.id).provider,'spotify');assert.equal(s.M.context('role-a'),null);await s.M.connect(c.id);s.M.configure(c.id,{roles:['role-a']});const ctx=s.M.context('role-a'),message={role:'user'};ctx.source=message;let n=0;s.ctx.chatAPI=async()=>++n===1?call(ctx.catalog[0].alias):'读取完成';await s.M.roleReply([{role:'user',content:'查音乐'}],{mcpContext:ctx});assert.equal(message._mcpTrace.steps[0].brand,'spotify');assert(s.M.render().includes('mcp-logo-spotify'));
});

test('preset service icons are unmodified embedded official assets and work without image requests',()=>{
 const assets=JSON.parse(source.match(/ const brandAssets=(.*);/)[1]);assert.deepEqual(Object.keys(assets).sort(),['cloudflare','github','gmail','linear','mcp','notion','spotify','supabase']);for(const [id,a] of Object.entries(assets)){const b=Buffer.from(a.src.split(',')[1],'base64');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),a.sha256,id);assert.equal(b.length,a.bytes);assert(a.src.startsWith('data:image/'));assert(/^https:\/\//.test(a.source));}assert(assets.cloudflare.source.includes('cloudflare/cloudflare-docs/'));assert(Buffer.from(assets.cloudflare.src.split(',')[1],'base64').includes(Buffer.from('#FF5F08')));
});

test('invalid endpoints and unrecognized tool envelopes do not dispatch anything',async()=>{
 const s=sandbox();for(const url of ['http://example.com/mcp','https://user:password@example.com/mcp','https://example.com/mcp?api_key=private','file:///tmp/mcp'])assert.throws(()=>s.M.add({url}));assert.equal(s.calls.length,0);
 assert.equal(s.M.parseCall('普通聊天'),null);assert.equal(s.M.parseCall('这是一个例子：'+call('x')),null);assert.throws(()=>s.M.parseCall('{"mcp_call":{"tool":"x"}}'));
});

test('both bundles include real chat hook, optional context and Cloudflare catalog without native companion changes',()=>{
 for(const [name,file] of BUNDLES){const text=read(file);assert(text.includes(forVariant(source,name)),name);assert(text.includes('if(opt.mcpContext&&!opt.mcpInternal)return MCPTools.roleReply(messages,opt)'));assert(text.includes('if(!note)_md.mcpContext=MCPTools.context(id,()=>!replyStale(id,replyToken,replyAccount)&&actId()===replyAccount,_lu)'));assert(text.includes("else if(c.p==='mcp')html=MCPTools.render()"));}
 assert(source.includes('https://mcp.cloudflare.com/mcp'));assert(source.includes('https://docs.mcp.cloudflare.com/mcp'));
});

}

test('browser consent permits the Google redirect and blocks other form destinations',async()=>{
 const {createRequire}=await import('node:module'),{chromium}=createRequire(import.meta.url)('playwright');
 const {defaultHandler}=await import('data:text/javascript;base64,'+Buffer.from(readProject('services/phone-mcp-connect/handlers.mjs')).toString('base64'));
 const base='https://own-gmail.fixture.invalid',fixture={PUBLIC_URL:base,GOOGLE_CLIENT_ID:'fixture-client',GOOGLE_CLIENT_SECRET:'fixture-secret',ALLOWED_EMAILS:'owner@fixture.invalid',OAUTH_KV:{}};fixture.OAUTH_PROVIDER={
  parseAuthRequest:async()=>({clientId:'fixture',scope:['mcp:read'],redirectUri:base+'/client-callback'}),
  lookupClient:async()=>({clientName:'SmallPhone fixture'}),
  beginConsent:async()=>({handle:'fixture-consent',headers:new Headers()})
 };
 const response=await defaultHandler(new Request(base+'/authorize'),fixture),body=await response.text();
 const browser=await chromium.launch({headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage();let destination='https://accounts.google.com/o/oauth2/v2/auth?fixture=1',forbiddenRequests=0;
  // Redirected navigations can bypass Playwright's original route handler. Block their
  // network dispatch at Chromium itself; observe the attempted navigation, never Google.
  const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs',{urls:['https://accounts.google.com/*','https://untrusted.fixture.invalid/*']});
  const observed=[];page.on('requestfailed',r=>observed.push({url:r.url(),failure:r.failure()}));const policies=[];page.on('console',message=>{if(message.text().includes('form-action'))policies.push(message.text());});
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());observed.push({method:request.method(),url:url.href});
   if(url.origin===base)return route.fulfill(request.method()==='POST'?{status:302,headers:{Location:destination},body:''}:{status:200,headers:Object.fromEntries(response.headers),body});
   if(url.origin==='https://accounts.google.com')return route.fulfill({status:200,contentType:'text/html',body:'<h1>Google consent fixture</h1>'});
   forbiddenRequests++;return route.abort();
  });
  await page.goto(base+'/authorize');
  const googleNavigation=page.waitForEvent('request',{predicate:request=>new URL(request.url()).origin==='https://accounts.google.com',timeout:5000});
  await page.getByRole('button',{name:'前往 Google 授权'}).click({noWaitAfter:true});
  try{assert.equal((await googleNavigation).url(),destination);}catch(error){assert.fail('Google redirect was not allowed: '+JSON.stringify({policies,observed,error:error.message}));}
  assert.equal(policies.length,0);
  destination='https://untrusted.fixture.invalid/steal';await page.goto(base+'/authorize');
  const blocked=page.waitForEvent('console',{predicate:message=>message.text().includes('form-action'),timeout:5000});
  await page.getByRole('button',{name:'前往 Google 授权'}).click({noWaitAfter:true});await blocked;
  assert.equal(new URL(page.url()).origin,base);assert.equal(forbiddenRequests,0);assert(!observed.some(row=>row.url.startsWith('https://untrusted.fixture.invalid')));
 }finally{await browser.close();}
});
