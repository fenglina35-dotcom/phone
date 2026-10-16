/* Fish Audio MCP 模式：用 Fish 账号登录（OAuth，选择团队），通过 Fish 官方 MCP 服务生成语音，消耗会员套餐点数，不消耗开发者 API 余额。
   原来的 API Key 模式保留不动，二选一。

   隐私：
   - 登录在 Fish 官方页面完成，小手机拿不到密码；拿到的凭证权限只够在所选团队里用 MCP。
   - 凭证只存在本机 localStorage（north_fish_mcp_v1），不写进 S，所以不进云备份、导出、分享；换设备或恢复备份后需要重新登录。
   - 登录直连 Fish；生成语音经自己的中转（license.smallphoneapp.com）转发给 Fish，凭证只随请求经过，中转不保存、不记录。
   官方说明：https://docs.fish.audio/overview/mcp （endpoint https://api.fish.audio/mcp，streamable HTTP，OAuth，按套餐点数计费）。

   登录方式：
   - 网页版：跳到 Fish 登录并选团队，回到本页自动完成。
   - 私人 App：iOS 里会用 Safari 打开 Fish 登录页，登录后跳到 fish-oauth.html 显示授权码，复制回小手机粘贴一次即可（方案 A，不改原生代码）。 */
(function(root){'use strict';
const AUTH='https://fish.audio/oauth/authorize',TOKEN='https://api.fish.audio/oauth/token',REG='https://api.fish.audio/oauth/register',MCP='https://api.fish.audio/mcp';
/* Fish 的 MCP 服务拒绝所有浏览器来源（实测 2026-10-16：无来源 200，github.io 和 file 来源都 403），所以 MCP 请求和音频下载经自己的中转转发；登录（OAuth）仍直连 Fish。 */
const RELAY='https://license.smallphoneapp.com',MCP_VIA=RELAY+'/fish-mcp',AUDIO_VIA=RELAY+'/fish-mcp-audio';
const STORE='north_fish_mcp_v1',PENDING='north_fish_mcp_pending_v1',CLIENTS='north_fish_mcp_clients_v1';
const CALLBACK_FOR_APP='https://fenglina35-dotcom.github.io/phone/fish-oauth.html',PROTOCOL='2025-06-18';
const ls={get(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(_){return null;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(_){return false;}},del(k){try{localStorage.removeItem(k);}catch(_){}}};
function webPage(){try{return location.protocol==='http:'||location.protocol==='https:';}catch(_){return false;}}
function redirectUri(){return webPage()?location.origin+location.pathname:CALLBACK_FOR_APP;}

/* PKCE：自带 SHA-256，iOS 本地页面里 crypto.subtle 不一定可用 */
function sha256Bytes(bytes){const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];const l=bytes.length,withPad=((l+9+63)>>6)<<6,m=new Uint8Array(withPad);m.set(bytes);m[l]=0x80;const bits=l*8;for(let i=0;i<8;i++)m[withPad-1-i]=Math.floor(bits/Math.pow(2,8*i))&255;
  const w=new Uint32Array(64),ror=(x,n)=>(x>>>n)|(x<<(32-n));for(let o=0;o<withPad;o+=64){for(let i=0;i<16;i++)w[i]=(m[o+4*i]<<24)|(m[o+4*i+1]<<16)|(m[o+4*i+2]<<8)|m[o+4*i+3];for(let i=16;i<64;i++){const s0=ror(w[i-15],7)^ror(w[i-15],18)^(w[i-15]>>>3),s1=ror(w[i-2],17)^ror(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
    let [a,b,c,d,e,f,g,hh]=h;for(let i=0;i<64;i++){const S1=ror(e,6)^ror(e,11)^ror(e,25),ch=(e&f)^(~e&g),t1=(hh+S1+ch+K[i]+w[i])>>>0,S0=ror(a,2)^ror(a,13)^ror(a,22),mj=(a&b)^(a&c)^(b&c),t2=(S0+mj)>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    h=[h[0]+a,h[1]+b,h[2]+c,h[3]+d,h[4]+e,h[5]+f,h[6]+g,h[7]+hh].map(x=>x>>>0);}
  const out=new Uint8Array(32);h.forEach((x,i)=>{out[4*i]=x>>>24;out[4*i+1]=(x>>>16)&255;out[4*i+2]=(x>>>8)&255;out[4*i+3]=x&255;});return out;}
function b64url(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function randomString(n){const a=new Uint8Array(n);try{crypto.getRandomValues(a);}catch(_){for(let i=0;i<n;i++)a[i]=Math.floor(Math.random()*256);}return b64url(a).slice(0,n);}
function challengeFor(verifier){return b64url(sha256Bytes(new TextEncoder().encode(verifier)));}

async function readJson(r){const t=await r.text();try{return t?JSON.parse(t):{};}catch(_){return {raw:t.slice(0,200)};}}
function failText(r,j,fallback){const d=j&&(j.error_description||j.error||j.message||(j.detail&&(j.detail.message||j.detail))||j.raw);return (fallback||'请求失败')+'（'+r.status+(d?' · '+String(d).slice(0,120):'')+'）';}

/* 动态注册一个公开客户端（Fish 支持 RFC 7591，不需要申请密钥），按回调地址缓存 */
async function clientFor(redirect){const all=ls.get(CLIENTS)||{};if(all[redirect])return all[redirect];
  const r=await fetch(REG,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'小手机 Small Phone',redirect_uris:[redirect],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none',scope:'mcp'})}),j=await readJson(r);
  if(!r.ok||!j.client_id)throw new Error(failText(r,j,'Fish 登录注册失败'));all[redirect]=j.client_id;ls.set(CLIENTS,all);return j.client_id;}

/* 第一步：打开 Fish 登录页（会让你选择团队） */
async function begin(){const redirect=redirectUri(),client=await clientFor(redirect),verifier=randomString(64),state=randomString(24);
  ls.set(PENDING,{verifier,state,client,redirect,at:Date.now()});
  const q=new URLSearchParams({response_type:'code',client_id:client,redirect_uri:redirect,code_challenge:challengeFor(verifier),code_challenge_method:'S256',scope:'mcp',state,resource:MCP}),url=AUTH+'?'+q.toString();
  if(webPage())location.href=url;else root.open(url,'_blank');return url;}

function saveToken(j,client,redirect){const prev=ls.get(STORE)||{};const tok={access:j.access_token,refresh:j.refresh_token||prev.refresh||'',exp:Date.now()+Math.max(60,(+j.expires_in||3600)-60)*1000,client,redirect,at:prev.at||Date.now(),team:j.team_name||j.team||prev.team||''};ls.set(STORE,tok);return tok;}
/* 第二步：用授权码换凭证。网页版回到本页自动调用；私人 App 由用户粘贴授权码后调用。粘贴的内容可以是授权码本身，也可以是带 code= 的整段网址。 */
async function finish(input,state){const p=ls.get(PENDING);if(!p)throw new Error('没有进行中的 Fish 登录，请重新点「登录 Fish」');let code=String(input||'').trim();
  const m=code.match(/[?&#]code=([^&#\s]+)/);if(m){const sm=code.match(/[?&#]state=([^&#\s]+)/);if(sm&&!state)state=decodeURIComponent(sm[1]);code=decodeURIComponent(m[1]);}
  if(!code)throw new Error('授权码是空的');if(state&&state!==p.state)throw new Error('登录状态不匹配，请重新点「登录 Fish」');if(Date.now()-p.at>30*60000)throw new Error('这次登录已超过 30 分钟，请重新点「登录 Fish」');
  const r=await fetch(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:p.redirect,client_id:p.client,code_verifier:p.verifier,resource:MCP}).toString()}),j=await readJson(r);
  if(!r.ok||!j.access_token)throw new Error(failText(r,j,'Fish 登录失败'));ls.del(PENDING);_session=null;_tools=null;return saveToken(j,p.client,p.redirect);}
/* 网页版：Fish 登录后回到本页时自动完成，并把地址栏里的 code 清掉 */
async function handleRedirect(){if(!webPage())return false;let q;try{q=new URLSearchParams(location.search);}catch(_){return false;}const code=q.get('code'),state=q.get('state'),p=ls.get(PENDING);if(!code||!state||!p||p.state!==state)return false;
  try{history.replaceState(null,'',location.pathname+location.hash);}catch(_){}
  try{await finish(code,state);try{refreshPanel();}catch(_){}if(typeof toast==='function')toast('Fish 已登录，语音会用会员点数生成');return true;}catch(e){if(typeof toast==='function')toast(String(e&&e.message||e),5200);return false;}}

async function refresh(tok){const r=await fetch(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:tok.refresh,client_id:tok.client,resource:MCP}).toString()}),j=await readJson(r);
  if(!r.ok||!j.access_token){if(r.status===400||r.status===401)ls.del(STORE);throw new Error(failText(r,j,'Fish 登录已过期，请重新登录'));}return saveToken(j,tok.client,tok.redirect);}
async function accessToken(force){let tok=ls.get(STORE);if(!tok||!tok.access)throw new Error('还没有登录 Fish（声音与通话 → Fish 接入方式 → 登录 Fish）');if(force||Date.now()>=tok.exp){if(!tok.refresh)throw new Error('Fish 登录已过期，请重新登录');tok=await refresh(tok);}return tok.access;}
function status(){const tok=ls.get(STORE),p=ls.get(PENDING);return {loggedIn:!!(tok&&tok.access),since:tok&&tok.at||0,team:tok&&tok.team||'',pending:!!p,redirect:redirectUri(),web:webPage()};}
function logout(){ls.del(STORE);ls.del(PENDING);_session=null;_tools=null;return true;}

/* MCP（streamable HTTP + JSON-RPC）。服务端可能回 JSON，也可能回 SSE；两种都认。 */
let _session=null,_tools=null,_rpcId=1;
function parseSse(text,id){let found=null;for(const block of String(text||'').split(/\r?\n\r?\n/)){const data=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('\n');if(!data)continue;try{const j=JSON.parse(data);if(id==null||j.id===id)found=j;}catch(_){}}return found;}
async function rpc(method,params,notify,retried){const token=await accessToken(),id=notify?undefined:_rpcId++,body={jsonrpc:'2.0',method};if(params!==undefined)body.params=params;if(!notify)body.id=id;
  const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+token,'Mcp-Protocol-Version':PROTOCOL};if(_session)headers['Mcp-Session-Id']=_session;
  const r=await fetch(MCP_VIA,{method:'POST',headers,body:JSON.stringify(body)});const sid=r.headers.get('Mcp-Session-Id');if(sid)_session=sid;
  if(r.status===401&&!retried){await accessToken(true);return rpc(method,params,notify,true);}
  if(r.status===404&&_session&&!retried&&method!=='initialize'){_session=null;await ensureSession();return rpc(method,params,notify,true);}
  if(notify)return null;const type=String(r.headers.get('Content-Type')||''),text=await r.text();let j=null;if(/event-stream/i.test(type))j=parseSse(text,id);else{try{j=JSON.parse(text);}catch(_){j=null;}}
  if(!r.ok&&!(j&&j.error))throw new Error('Fish MCP 请求失败（'+r.status+(text?' · '+text.slice(0,120):'')+'）');if(!j)throw new Error('Fish MCP 没有返回结果');if(j.error)throw new Error('Fish MCP：'+String(j.error.message||JSON.stringify(j.error)).slice(0,160));return j.result;}
async function ensureSession(){if(_session)return;await rpc('initialize',{protocolVersion:PROTOCOL,capabilities:{},clientInfo:{name:'small-phone',version:'1'}});try{await rpc('notifications/initialized',undefined,true);}catch(_){}}
async function tools(force){if(_tools&&!force)return _tools;await ensureSession();const r=await rpc('tools/list',{});_tools=Array.isArray(r&&r.tools)?r.tools:[];return _tools;}
async function call(name,args){await ensureSession();const r=await rpc('tools/call',{name,arguments:args||{}});if(r&&r.isError){const msg=(r.content||[]).map(c=>c&&c.text||'').join(' ').trim();throw new Error('Fish MCP：'+(msg||'工具调用失败').slice(0,200));}return r;}

/* 查会员点数：{plan, left, ends, team} */
async function balance(){const res=await call('get_credit_balance',{});let j=res&&res.structuredContent;if(!j){try{j=JSON.parse(((res&&res.content)||[]).map(c=>c&&c.text||'').join(''));}catch(_){j=null;}}if(!j)return null;const tok=ls.get(STORE);if(tok&&j.team_name&&tok.team!==j.team_name){tok.team=j.team_name;ls.set(STORE,tok);}return {plan:String(j.plan||''),left:(+j.package_balance||0)+(+j.package_extra_balance||0),ends:String(j.package_cycle_ends_at||''),team:String(j.team_name||'')};}
/* 从工具结果里找音频：音频块（base64）、资源链接、结构化结果或文字里的网址 */
function audioFrom(result){const items=(result&&result.content)||[];for(const c of items){if(c&&c.type==='audio'&&c.data)return {data:c.data,mime:c.mimeType||'audio/mpeg'};}
  for(const c of items){const uri=c&&(c.uri||(c.resource&&c.resource.uri));if(uri&&/^https?:/i.test(uri))return {url:uri};}
  const sc=result&&result.structuredContent;if(sc){const u=sc.audio_url||sc.url||sc.audioUrl||(sc.audio&&(sc.audio.url||sc.audio));if(typeof u==='string'&&/^https?:/i.test(u))return {url:u};}
  for(const c of items){const t=c&&c.type==='text'&&c.text;if(!t)continue;try{const j=JSON.parse(t),u=j&&(j.audio_url||j.url||j.audioUrl||(j.audio&&j.audio.url));if(typeof u==='string'&&/^https?:/i.test(u))return {url:u};}catch(_){}const m=String(t).match(/https?:\/\/[^\s"'<>)]+/);if(m)return {url:m[0]};}
  return null;}
function ttsTool(list){return list.find(t=>/^(?:text_to_speech|tts|generate_speech|create_speech|synthesize_speech|speech)$/i.test(t.name))||list.find(t=>/speech|tts/i.test(t.name)&&!/transcri|recogn|to_?text|stt|asr|list|search|clone/i.test(t.name))||null;}
function argsFor(tool,text,voiceId,model){const props=(tool&&tool.inputSchema&&tool.inputSchema.properties)||{},has=k=>Object.prototype.hasOwnProperty.call(props,k),pick=(...ks)=>ks.find(has),a={};
  a[pick('text','input','content','script')||'text']=text;const vk=pick('reference_id','voice_id','voice','model_id');if(voiceId&&vk)a[vk]=voiceId;const mk=pick('model','backend','tts_model');if(model&&mk)a[mk]=model;const fk=pick('format','audio_format');if(fk)a[fk]='mp3';return a;}
/* 生成一条语音，返回 {buf} 或 {err}，和原来的 _ttsOnce 一致 */
async function speak(opt){try{const list=await tools(),tool=ttsTool(list);if(!tool)return {err:'Fish MCP 里没有找到语音生成工具'};const res=await call(tool.name,argsFor(tool,String(opt&&opt.text||''),opt&&opt.voiceId,opt&&opt.model)),au=audioFrom(res);
    if(!au)return {err:'Fish MCP 没有返回音频'};if(au.data){const bin=atob(au.data),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);return {buf:buf.buffer};}
    let r;if(/^https:\/\/([a-z0-9-]+\.)*fish\.audio\//i.test(au.url))r=await fetch(AUDIO_VIA,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+await accessToken()},body:JSON.stringify({url:au.url})});else r=await fetch(au.url);
    if(!r.ok)return {err:'下载 Fish 音频失败（'+r.status+'）'};return {buf:await r.arrayBuffer()};}catch(e){return {err:String(e&&e.message||e)};}}

/* 设置页「声音与通话」里的登录小面板（语音平台选「Fish 会员登录」时显示） */
function h(x){return String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function say(t,ms){if(typeof toast==='function')toast(t,ms);}
function panelInner(provider){if(provider!=='fishmcp')return '';const st=status(),box='margin:2px 0 8px;padding:9px 11px;border-radius:12px;background:rgba(120,190,255,.08);border:1px solid rgba(120,190,255,.22);font-size:12px;line-height:1.55;color:#bcd',btn='display:inline-block;margin:6px 6px 0 0;padding:5px 11px;border-radius:9px;border:1px solid rgba(255,255,255,.18);background:#25272d;color:#e9f3ff;font-size:12px;cursor:pointer';
  const line=st.loggedIn?'✅ 已登录 Fish'+(st.team?'（团队：'+h(st.team)+'）':'')+'，语音用会员套餐点数生成，不用填 API Key。':st.pending&&!st.web?'⏳ 已打开 Fish 登录页。登录并选好团队后，把页面上的授权码复制回来，点「粘贴授权码」。':'还没登录。点「登录 Fish」，在 Fish 官方页面登录并选择有会员的团队。';
  return `<div style="${box}">${line}${st.loggedIn?'<div id="fishMcpBal" style="margin-top:3px"></div>':''}<div style="opacity:.75;margin-top:3px">凭证只存在这台设备上，不进云备份、导出或分享；小手机拿不到你的 Fish 密码。</div><div><span style="${btn}" onclick="NorthFishMcp.uiLogin()">${st.loggedIn?'重新登录 / 换团队':'登录 Fish'}</span>${st.web?'':`<span style="${btn}" onclick="NorthFishMcp.uiPaste()">粘贴授权码</span>`}${st.loggedIn?`<span style="${btn}" onclick="NorthFishMcp.uiLogout()">退出 Fish 登录</span>`:''}</div></div>`;}
function panel(provider){if(provider==='fishmcp'&&status().loggedIn)setTimeout(showBalance,300);return `<div id="fishMcpPanel" style="padding:0 14px">${panelInner(provider)}</div>`;}
function refreshPanel(){const el=document.getElementById('fishMcpPanel'),sel=document.getElementById('s_tprovider');if(!el)return;el.innerHTML=panelInner(sel?sel.value:'');showBalance();}
async function showBalance(){const box=document.getElementById('fishMcpBal');if(!box)return;box.textContent='正在查询剩余点数…';try{const b=await balance();if(!b){box.textContent='';return;}box.textContent='套餐 '+(b.plan||'未知')+' · 剩余 '+b.left.toLocaleString()+' 点'+(b.ends?' · '+b.ends.slice(0,10)+' 重置':'')+'（约 1 点 = 1 字节文字，一个汉字约 3 点）';}catch(e){box.textContent='剩余点数查询失败：'+String(e&&e.message||e).slice(0,80);}}
async function uiLogin(){try{if(!webPage())say('正在打开 Fish 登录页（Safari）…');await begin();if(!webPage()){refreshPanel();setTimeout(uiPaste,600);}}catch(e){say(String(e&&e.message||e),5200);}}
function uiPaste(){if(typeof openModal!=='function'){say('请在设置页使用');return;}openModal(`<h3>粘贴 Fish 授权码</h3><div class="hint">在 Safari 里登录 Fish 并选好团队后，页面会显示一串授权码，复制后粘贴到这里。30 分钟内有效。</div><div class="field"><input id="fishMcpCode" placeholder="授权码，或整段网址" autocomplete="off" autocapitalize="off" spellcheck="false"></div><button class="btn" onclick="NorthFishMcp.uiFinish()">完成登录</button><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
async function uiFinish(){const el=document.getElementById('fishMcpCode'),v=el?el.value:'';try{await finish(v);if(typeof closeModal==='function')closeModal();refreshPanel();say('Fish 已登录，语音会用会员点数生成');}catch(e){say(String(e&&e.message||e),5200);}}
function uiLogout(){logout();refreshPanel();say('已退出 Fish 登录，本机凭证已清除');}
root.NorthFishMcp={begin,finish,handleRedirect,status,logout,speak,tools,call,balance,redirectUri,panel,refreshPanel,uiLogin,uiPaste,uiFinish,uiLogout,_test:{sha256Bytes,b64url,challengeFor,audioFrom,ttsTool,argsFor,parseSse}};
try{if(typeof document!=='undefined'&&webPage()){const go=()=>setTimeout(()=>{handleRedirect();},400);if(document.readyState==='complete')go();else root.addEventListener('load',go);}}catch(_){}
})(typeof globalThis!=='undefined'?globalThis:this);
