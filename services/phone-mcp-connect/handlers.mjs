export function registrationPolicy(env,{clientMetadata,request}){
 const urls=clientMetadata.redirect_uris;
 if(!env.SETUP_KEY||request.headers.get('Authorization')!=='Bearer '+env.SETUP_KEY||clientMetadata.token_endpoint_auth_method!=='none'||!Array.isArray(urls)||urls.length!==1||urls[0]!==env.PUBLIC_URL+'/client-callback')return{code:'access_denied',description:'Client registration is restricted to the owner setup.',status:403};
}
// Gmail-only gateway. Google credentials stay in encrypted OAuth props on the Worker.
// MCP_GMAIL_CIMD_V1: a public, pinned client descriptor avoids a registration setup secret.
export const clientMetadata = env => ({
 client_id:env.PUBLIC_URL+'/client-metadata.json',client_name:'小手机私人连接',
 redirect_uris:[env.PUBLIC_URL+'/client-callback'],grant_types:['authorization_code','refresh_token'],
 response_types:['code'],token_endpoint_auth_method:'none',token_endpoint_auth_methods_supported:['none']
});
export const UPSTREAM = 'https://gmailmcp.googleapis.com/mcp/v1';
export const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
export const GOOGLE_SCOPES = ['openid','email','https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.compose'];
export const SCOPES = ['mcp:read','mcp:write','offline_access'];
const READ = new Set(['search_threads','get_thread','list_drafts','list_labels']);
const WRITE = new Set(['create_draft']);
const METHODS = new Set(['initialize','notifications/initialized','ping','server/discover','tools/list','tools/call']);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const toolKind = name => {const n=String(name).replace(/^gmail[._/]/,'');return READ.has(n)?'read':WRITE.has(n)?'write':null;};
export const ready = env => !!(env.PUBLIC_URL && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.ALLOWED_EMAILS && env.OAUTH_KV);
export const ownerAllowed = (env,email) => String(env.ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(String(email||'').toLowerCase());
export function html(body,headers=new Headers(),status=200,script=''){
 headers=new Headers(headers);headers.set('Content-Type','text/html;charset=utf-8');headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');
 const nonce=crypto.randomUUID();headers.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; form-action 'self'; frame-ancestors 'none'");headers.set('X-Frame-Options','DENY');
 return new Response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>小手机 · Gmail 连接</title><style>body{margin:0;background:#000;color:#f2f2f7;font:15px/1.7 -apple-system,sans-serif;padding:24px}main{max-width:440px;margin:8vh auto;background:#1c1c1e;border:1px solid #35353a;border-radius:24px;padding:25px}h1{font-size:23px}p,li{color:#afb0ba}button,input{font:inherit;border-radius:14px;padding:12px;border:1px solid #45454c;box-sizing:border-box}button{background:#0a84ff;color:#fff;cursor:pointer;margin:8px 8px 0 0}button[value=deny]{background:#303035}input[type=text]{width:100%;color:#eee;background:#27272d}small{color:#74b8ff}strong{color:#eee;overflow-wrap:anywhere}</style><main>'+body+'</main>'+(script?'<script nonce="'+nonce+'">'+script+'</script>':'')+'</html>',{status,headers});
}
export function receiptPage(request){
 return html('<small>小手机 · 授权回执</small><h1>返回小手机完成连接</h1><p>复制本次完整回执，回到小手机选择“粘贴回执”。回执不代表工具目录已经验证成功。</p><input type="text" readonly id="receipt" value="'+esc(request.url)+'"><button id="copy">复制完整回执</button><p id="status">请勿分享此回执链接。</p>',new Headers(),200,"document.getElementById('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(document.getElementById('receipt').value);document.getElementById('status').textContent='已复制，返回小手机粘贴。';}catch(_){document.getElementById('receipt').select();document.getElementById('status').textContent='请手动复制选中的完整链接。';}})");
}
export async function readLimited(body,limit=2*1024*1024){
 if(!body)return '';const reader=body.getReader(),decoder=new TextDecoder();let text='',size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw new Error('response_too_large');text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}
 finally{await reader.cancel().catch(()=>{});}
}
export async function readRpc(response,id){
 if(!String(response.headers.get('Content-Type')).includes('text/event-stream'))return JSON.parse(await readLimited(response.body));
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024)throw new Error('response_too_large');buffer+=decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');let at;
  while((at=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,at);buffer=buffer.slice(at+2);const data=event.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');if(!data||data==='[DONE]')continue;const result=JSON.parse(data);if(result.id===id)return result;}
 }throw new Error('missing_rpc_response');}finally{await reader.cancel().catch(()=>{});}
}
async function jsonFetch(url,init,fetchFn=fetch){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const response=await fetchFn(url,{...init,redirect:'manual',signal:controller.signal});let data;try{data=JSON.parse(await readLimited(response.body,256*1024));}catch(_){data={};}return{ok:response.ok,status:response.status,data};}finally{clearTimeout(timer);}
}
export async function googleTokens(env,fields,fetchFn=fetch){
 const {ok,data}=await jsonFetch(GOOGLE_TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...fields,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET}).toString()},fetchFn);
 if(!ok||!data.access_token){const e=new Error(data.error==='invalid_grant'?'invalid_grant':'temporarily_unavailable');e.code=e.message;throw e;}
 if(data.token_type && String(data.token_type).toLowerCase()!=='bearer')throw new Error('invalid_token_type');
 return{googleAccessToken:data.access_token,googleRefreshToken:data.refresh_token||fields.refresh_token,googleExpiresAt:Date.now()+Math.max(60,Number(data.expires_in)||3600)*1000,googleGrantedScopes:String(data.scope||'').split(/\s+/).filter(Boolean)};
}
export async function refreshGoogle(env,props,fetchFn=fetch){
 if(!ownerAllowed(env,props.email)||!props.googleRefreshToken){const e=new Error('invalid_grant');e.code='invalid_grant';throw e;}
 const next=await googleTokens(env,{grant_type:'refresh_token',refresh_token:props.googleRefreshToken},fetchFn);return{...props,...next,googleGrantedScopes:next.googleGrantedScopes.length?next.googleGrantedScopes:props.googleGrantedScopes};
}
function scopeAllowed(context,scope){return Array.isArray(context.auth?.scope)&&context.auth.scope.includes(scope);}
function rpcError(id,code,message,status=200){return Response.json({jsonrpc:'2.0',id:id??null,error:{code,message}},{status,headers:{'Cache-Control':'no-store'}});}
function redact(value,env,props){let out=JSON.stringify(value);for(const secret of [env.GOOGLE_CLIENT_SECRET,props.googleAccessToken,props.googleRefreshToken])if(secret)out=out.split(secret).join('[凭据已隐藏]');return JSON.parse(out);}
export async function gmailProxy(request,env,context,fetchFn=fetch){
 const props=context.props||{};
 if(!ownerAllowed(env,props.email)||!props.subject||!scopeAllowed(context,'mcp:read'))return rpcError(null,-32001,'连接授权无效，请重新登录。',403);
 if(request.method!=='POST')return rpcError(null,-32600,'仅支持本次工具请求。',405);
 let body;try{body=JSON.parse(await readLimited(request.body,64*1024));}catch(_){return rpcError(null,-32700,'请求格式无效。',400);}
 if(body.jsonrpc!=='2.0'||!METHODS.has(body.method))return rpcError(body.id,-32601,'此连接只开放邮件查询与草稿工具。');
 if(body.method==='tools/call'){
  const kind=toolKind(body.params?.name);
  if(!kind)return rpcError(body.id,-32601,'此连接没有开放该工具。');
  if(kind==='write'&&!scopeAllowed(context,'mcp:write'))return rpcError(body.id,-32001,'本次授权不包含创建草稿。',403);
  if(!body.params.arguments||typeof body.params.arguments!=='object'||Array.isArray(body.params.arguments))return rpcError(body.id,-32602,'工具参数必须是对象。');
 }
 if(!props.googleAccessToken||Number(props.googleExpiresAt)<=Date.now()+5000)return rpcError(body.id,-32001,'Google 授权已过期，请刷新连接或重新登录。',401);
 const headers=new Headers({'Authorization':'Bearer '+props.googleAccessToken,'Content-Type':'application/json','Accept':'application/json, text/event-stream'});
 for(const name of ['MCP-Protocol-Version','Mcp-Session-Id']){const v=request.headers.get(name);if(v)headers.set(name,v);}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetchFn(UPSTREAM,{method:'POST',headers,body:JSON.stringify(body),redirect:'manual',signal:controller.signal});
  if(!response.ok){await response.body?.cancel();return rpcError(body.id,-32002,response.status===401?'Google 登录已失效，请重新授权。':response.status===403?'Google 拒绝了访问，请核对 AI 应用、授权范围与预览资格。':response.status===429?'Google 调用额度暂时不足，请稍后再试。':'Google 暂时没有完成请求，请核对回执，不要重复提交修改。',(response.status>=300&&response.status<400)?502:response.status);}
  if(body.id===undefined){await response.body?.cancel();return new Response(null,{status:202});}
  const result=await readRpc(response,body.id);
  if(result.id!==body.id||result.jsonrpc!=='2.0')throw new Error('rpc_mismatch');
  if((body.method==='tools/list'||body.method==='server/discover')&&Array.isArray(result.result?.tools)){
   result.result.tools=result.result.tools.filter(t=>toolKind(t.name)).map(t=>({...t,annotations:{...t.annotations,readOnlyHint:toolKind(t.name)==='read'}}));
  }
  const out=new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});
  const session=response.headers.get('Mcp-Session-Id');if(session)out.set('Mcp-Session-Id',session);
  return Response.json(redact(result,env,props),{headers:out});
 }catch(_){return rpcError(body.id,-32603,'本次请求未能确认结果，请查看外部服务；不会自动重试。',502);}
 finally{clearTimeout(timer);}
}
export async function defaultHandler(request,env,fetchFn=fetch){
 const path=new URL(request.url).pathname,oauth=env.OAUTH_PROVIDER;
 if(path==='/client-metadata.json'&&request.method==='GET')return Response.json(clientMetadata(env),{headers:{'Cache-Control':'public, max-age=300'}});
 if(path==='/health')return Response.json({service:'smallphone-gmail-mcp',ready:ready(env),tools:'search,read,drafts',billing:'existing-included-quota-only'},{headers:{'Cache-Control':'no-store'}});
 if(path==='/client-callback'&&request.method==='GET')return receiptPage(request);
 if(!ready(env))return html('<h1>连接服务待配置</h1><p>请先完成 Google 应用配置，再从小手机重新发起登录。</p>',new Headers(),503);
 if(path==='/authorize'&&request.method==='GET'){
  const parsed=await oauth.parseAuthRequest(request),client=await oauth.lookupClient(parsed.clientId),consent=await oauth.beginConsent(parsed);
  const scopes=parsed.scope.filter(s=>SCOPES.includes(s));
  return html('<small>小手机 · Gmail</small><h1>允许连接你的 Gmail？</h1><p>请求应用：<strong>'+esc(client?.clientName||client?.client_name||'小手机')+'</strong></p><p>授权回执将返回：<strong>'+esc(new URL(parsed.redirectUri).hostname)+'</strong></p><ul><li>搜索邮件、读取会话和标签</li>'+(scopes.includes('mcp:write')?'<li>创建邮件草稿</li>':'')+'<li>保持登录，凭据仅由此服务端处理</li></ul><p>本连接不开放发送邮件、删除邮件工具。</p><form method="post"><input type="hidden" name="handle" value="'+esc(consent.handle)+'">'+scopes.map(s=>'<input type="hidden" name="scope" value="'+esc(s)+'">').join('')+'<button name="decision" value="approve">前往 Google 授权</button><button name="decision" value="deny">取消</button></form>',consent.headers);
 }
 if(path==='/authorize'&&request.method==='POST'){
  const form=await request.formData(),handle=String(form.get('handle')||'');
  if(form.get('decision')!=='approve'){const denied=await oauth.denyConsent(request,handle);return new Response(null,{status:302,headers:denied.headers});}
  const scopes=form.getAll('scope').map(String).filter(s=>SCOPES.includes(s));
  if(!scopes.includes('mcp:read'))return html('<h1>缺少邮件读取授权</h1><p>请返回小手机重新开始。</p>',new Headers(),400);
  const approved=await oauth.approveConsent(request,handle,{scope:scopes});
  const verifier=crypto.randomUUID()+crypto.randomUUID(),bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  const challenge=btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const flow=await oauth.beginUpstream(approved.request,{data:{verifier},headers:approved.headers});
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:env.PUBLIC_URL+'/oauth/google/callback',response_type:'code',scope:GOOGLE_SCOPES.filter(s=>scopes.includes('mcp:write')||!s.endsWith('/gmail.compose')).join(' '),state:flow.state,code_challenge:challenge,code_challenge_method:'S256',access_type:'offline',prompt:'consent'}).toString();
  flow.headers.set('Location',url.href);return new Response(null,{status:302,headers:flow.headers});
 }
 if(path==='/oauth/google/callback'&&request.method==='GET'){
  const flow=await oauth.finishUpstream(request),url=new URL(request.url);
  if(url.searchParams.has('error')||!url.searchParams.get('code'))return html('<h1>本次授权未完成</h1><p>请返回小手机重新发起；不会执行工具。</p>',flow.headers,400);
  const tokens=await googleTokens(env,{grant_type:'authorization_code',code:url.searchParams.get('code'),code_verifier:flow.data.verifier,redirect_uri:env.PUBLIC_URL+'/oauth/google/callback'},fetchFn);
  const needed=['https://www.googleapis.com/auth/gmail.readonly',...(flow.request.scope.includes('mcp:write')?['https://www.googleapis.com/auth/gmail.compose']:[])];
  if(!needed.every(scope=>tokens.googleGrantedScopes.includes(scope)))return html('<h1>本次授权范围不完整</h1><p>请返回小手机重新开始，并核对需要的邮件读取与草稿授权。</p>',flow.headers,403);
  if(!tokens.googleRefreshToken)return html('<h1>未获得持续登录授权</h1><p>请重新允许本次登录。</p>',flow.headers,400);
  const user=await jsonFetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.googleAccessToken}},fetchFn);
  if(!user.ok||user.data.email_verified!==true||!user.data.sub||!ownerAllowed(env,user.data.email))return html('<h1>该账号未获此服务授权</h1><p>请使用配置服务时指定的邮箱登录。</p>',flow.headers,403);
  const result=await oauth.completeAuthorization({request:flow.request,userId:user.data.sub,metadata:{label:'Gmail'},scope:flow.request.scope,props:{...tokens,subject:user.data.sub,email:user.data.email}});
  flow.headers.set('Location',result.redirectTo);return new Response(null,{status:302,headers:flow.headers});
 }
 return html('<h1>小手机 Gmail 连接</h1><p>请从小手机的 MCP 设置中发起连接。</p>',new Headers(),404);
}
