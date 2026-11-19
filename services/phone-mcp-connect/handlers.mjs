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
export const UPSTREAM = 'https://gmail.googleapis.com/gmail/v1/users/me';
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
export function html(body,headers=new Headers(),status=200,script='',googleRedirect=false){
 headers=new Headers(headers);headers.set('Content-Type','text/html;charset=utf-8');headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');
 // MCP_GMAIL_BROWSER_REDIRECT_V1: Chromium applies form-action to the OAuth 302 destination too.
 const nonce=crypto.randomUUID();headers.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; form-action 'self'"+(googleRedirect?' https://accounts.google.com':'')+"; frame-ancestors 'none'");headers.set('X-Frame-Options','DENY');
 return new Response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>小手机 · Gmail 连接</title><style>body{margin:0;background:#000;color:#f2f2f7;font:15px/1.7 -apple-system,sans-serif;padding:24px}main{max-width:440px;margin:8vh auto;background:#1c1c1e;border:1px solid #35353a;border-radius:24px;padding:25px}h1{font-size:23px}p,li{color:#afb0ba}button,input{font:inherit;border-radius:14px;padding:12px;border:1px solid #45454c;box-sizing:border-box}button{background:#0a84ff;color:#fff;cursor:pointer;margin:8px 8px 0 0}button[value=deny]{background:#303035}input[type=text]{width:100%;color:#eee;background:#27272d}small{color:#74b8ff}strong{color:#eee;overflow-wrap:anywhere}</style><main>'+body+'</main>'+(script?'<script nonce="'+nonce+'">'+script+'</script>':'')+'</html>',{status,headers});
}
export function receiptPage(request){
 return html('<small>小手机 · 授权回执</small><h1>返回小手机完成连接</h1><p>复制本次完整回执，回到小手机选择“粘贴回执”。回执不代表工具目录已经验证成功。</p><input type="text" readonly id="receipt" value="'+esc(request.url)+'"><button id="copy">复制完整回执</button><p id="status">请勿分享此回执链接。</p>',new Headers(),200,"document.getElementById('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(document.getElementById('receipt').value);document.getElementById('status').textContent='已复制，返回小手机粘贴。';}catch(_){document.getElementById('receipt').select();document.getElementById('status').textContent='请手动复制选中的完整链接。';}})");
}
// MCP_GMAIL_OAUTH_STAGE_V1: expose fixed stages only, never Google error descriptions or credentials.
export function oauthFailurePage(code){
 const detail=code==='google_client_configuration'?['GMAIL_CLIENT_CONFIG','Google 应用凭据未通过','请核对后端的 Google Client ID 和 Client Secret 是否来自同一个客户端、密钥是否仍有效。不要把密钥发到聊天里。',502]:code==='invalid_grant'?['GMAIL_CODE_REJECTED','Google 未接受本次授权码','本次授权码可能已使用或失效，请重新开始授权。',400]:code==='temporarily_unavailable'?['GMAIL_TOKEN_UNAVAILABLE','Google 换取凭据未完成','Google 暂未完成换取凭据，请保留此提示供排查。',503]:['GMAIL_AUTH_TRANSACTION','授权事务未完成','请返回小手机重新开始，核对浏览器中的本次授权流程。',400];
 return html('<small>'+detail[0]+'</small><h1>'+detail[1]+'</h1><p>'+detail[2]+'</p><p>没有自动重试工具请求。</p>',new Headers(),detail[3]);
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
 if(!ok||!data.access_token){const code=['invalid_client','unauthorized_client'].includes(data.error)?'google_client_configuration':data.error==='invalid_grant'?'invalid_grant':'temporarily_unavailable',e=new Error(code);e.code=code;throw e;}
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
// MCP_GMAIL_REST_V1: retain the existing OAuth grant, mailbox and five tools.
// All Google paths are fixed here; no caller-supplied URL or send/delete route.
const textField={type:'string',maxLength:4000};
const pageFields={query:textField,pageToken:{type:'string',maxLength:2048},pageSize:{type:'integer',minimum:1,maximum:50}};
const tools=[
 {name:'list_labels',description:'只读列出当前已授权邮箱的标签，不读取邮件正文。',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'search_threads',description:'只读搜索邮件会话。query 使用 Gmail 搜索语法，默认仅返回会话标识与摘要；继续读取正文必须调用 get_thread。',inputSchema:{type:'object',properties:{...pageFields,includeTrash:{type:'boolean'},view:{type:'string',enum:['THREAD_VIEW_UNSPECIFIED','THREAD_VIEW_METADATA_ONLY','THREAD_VIEW_MINIMAL','THREAD_VIEW_IDS_ONLY','THREAD_VIEW_SUMMARY']}},additionalProperties:false}},
 {name:'get_thread',description:'只读获取已知 threadId 的会话。默认读取正文；只需元数据时选择 METADATA_ONLY，不能猜测 ID。',inputSchema:{type:'object',required:['threadId'],properties:{threadId:{type:'string',maxLength:256},messageFormat:{type:'string',enum:['MESSAGE_FORMAT_UNSPECIFIED','MINIMAL','FULL_CONTENT','METADATA_ONLY','PLAIN_TEXT']}},additionalProperties:false}},
 {name:'list_drafts',description:'只读列出草稿。默认仅草稿和会话标识；DRAFT_VIEW_METADATA_ONLY 读取元数据，DRAFT_VIEW_FULL 才读取正文，不发送或修改草稿。',inputSchema:{type:'object',properties:{...pageFields,view:{type:'string',enum:['DRAFT_VIEW_UNSPECIFIED','DRAFT_VIEW_METADATA_ONLY','DRAFT_VIEW_FULL']}},additionalProperties:false}},
 {name:'create_draft',description:'仅创建邮件草稿，绝不发送。支持纯文本、HTML、收件人、附件及回复已有消息。签名请写入正文；不读取邮箱签名设置。',inputSchema:{type:'object',properties:{subject:textField,body:{type:'string'},htmlBody:{type:'string'},to:{type:'array',items:{type:'string'}},cc:{type:'array',items:{type:'string'}},bcc:{type:'array',items:{type:'string'}},replyToMessageId:{type:'string',maxLength:256},attachments:{type:'array',maxItems:10,items:{type:'object',required:['content'],properties:{content:{type:'string'},filename:{type:'string'},mimeType:{type:'string'},inline:{type:'boolean'}},additionalProperties:false}}},additionalProperties:false}}
].map(t=>({...t,annotations:{readOnlyHint:t.name!=='create_draft',destructiveHint:false,idempotentHint:t.name!=='create_draft',openWorldHint:true}}));
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function invalid(message){const e=new Error(message);e.invalid=true;throw e;}
function stringArg(value,name,max=4000){if(value===undefined)return '';if(typeof value!=='string'||value.length>max)invalid(name+' 格式不正确。');return value;}
function googleID(value){if(typeof value!=='string'||!/^[-a-zA-Z0-9_]{1,256}$/.test(value))invalid('请提供真实的邮件或会话 ID。');return encodeURIComponent(value);}
function pageArgs(args){const n=args.pageSize??20;if(!Number.isInteger(n)||n<1||n>50)invalid('pageSize 必须为 1 到 50。');const token=stringArg(args.pageToken,'pageToken',2048),query=stringArg(args.query,'query');return {maxResults:String(n),...(token?{pageToken:token}:{}),...(query?{q:query}:{})};}
function base64(text){const bytes=new TextEncoder().encode(text);let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);return btoa(raw);}
const wrapped=value=>value.match(/.{1,76}/g)?.join('\r\n')||'';
function header(value){if(typeof value!=='string'||/[\r\n\x00]/.test(value)||value.length>4000)invalid('邮件标题或头部格式不正确。');return value;}
function addresses(value){if(value===undefined)return '';if(!Array.isArray(value)||value.length>100||value.some(x=>typeof x!=='string'||!/^[^\s@<>(),;:"\\\x00-\x1f\x7f-\uffff]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(x)))invalid('收件人必须是普通邮箱地址数组。');return value.join(', ');}
function mimeBody(args){
 const part=(type,body)=>'Content-Type: '+type+'; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n'+wrapped(base64(body));
 const plain=stringArg(args.body,'body',64000),html=stringArg(args.htmlBody,'htmlBody',64000),attachments=args.attachments??[];
 if(!Array.isArray(attachments)||attachments.length>10)invalid('附件格式不正确。');
 let content=part('text/plain',plain);
 const combine=(type,parts)=>{const boundary='north_'+crypto.randomUUID();return 'Content-Type: multipart/'+type+'; boundary="'+boundary+'"\r\n\r\n'+parts.map(x=>'--'+boundary+'\r\n'+x).join('\r\n')+'\r\n--'+boundary+'--';};
 if(html)content=plain?combine('alternative',[content,part('text/html',html)]):part('text/html',html);
 if(attachments.length){const parts=[content];for(const [i,a] of attachments.entries()){
  if(!object(a)||typeof a.content!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.content))invalid('附件内容必须是有效的 Base64。');
  const type=a.mimeType??'application/octet-stream';if(typeof type!=='string'||!/^[-a-zA-Z0-9!#$&^_.+]+\/[-a-zA-Z0-9!#$&^_.+]+$/.test(type))invalid('附件类型不正确。');
  const name=encodeURIComponent(header(a.filename??'attachment')).replace(/'/g,'%27');
  parts.push('Content-Type: '+type+'\r\nContent-Disposition: '+(a.inline?'inline':'attachment')+"; filename*=UTF-8''"+name+'\r\n'+(a.inline?'Content-ID: <att'+i+'>\r\n':'')+'Content-Transfer-Encoding: base64\r\n\r\n'+wrapped(a.content));
 }content=combine('mixed',parts);}return content;
}
function readableMessage(message,plainOnly=false){
 const parts=[];const walk=p=>{if(!p||parts.length>=100)return;if(p.body?.data&&['text/plain','text/html'].includes(p.mimeType)&&(!plainOnly||p.mimeType==='text/plain')){const raw=atob(p.body.data.replace(/-/g,'+').replace(/_/g,'/'));parts.push({mimeType:p.mimeType,text:new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0)))});}for(const c of p.parts||[])walk(c);};walk(message.payload);
 const clean=p=>{if(!p)return p;const {body,parts,...rest}=p;return {...rest,...(body?{body:{size:body.size,...(body.attachmentId?{attachmentId:body.attachmentId}:{})}}:{}),...(parts?{parts:parts.map(clean)}:{})};};
 return {...message,payload:clean(message.payload),textParts:parts};
}
async function gmailAPI(body,props,fetchFn,signal){
 const name=String(body.params.name).replace(/^gmail[._/]/,''),args=body.params.arguments;
 const definition=tools.find(t=>t.name===name),allowed=new Set(Object.keys(definition.inputSchema.properties));
 for(const key of Object.keys(args))if(!allowed.has(key)&&!(key==='includeSignature'&&args[key]===false))invalid('此工具不支持参数 '+key+'。');
 const api=async(path,params={},payload)=>{
  const url=new URL(UPSTREAM+'/'+path);url.search=new URLSearchParams(params).toString();
  const response=await fetchFn(url.href,{method:payload?'POST':'GET',headers:{Authorization:'Bearer '+props.googleAccessToken,Accept:'application/json',...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{}),redirect:'manual',signal});
  if(!response.ok){let reason='';try{const value=JSON.parse(await readLimited(response.body,32768));reason=value.error?.errors?.[0]?.reason||value.error?.details?.find(x=>x.reason)?.reason||'';}catch(_){}
   const e=new Error(response.status===401?'Google 明确拒绝了当前登录，请刷新授权。':/SERVICE_DISABLED|accessNotConfigured/i.test(reason)?'此 Google 项目尚未启用正式 Gmail API，现有登录仍保留。':response.status===403?'Google 拒绝了本次 API 权限，请核对已授权范围。':'Google Gmail API 请求未完成（HTTP '+response.status+'），未自动重试。');e.status=response.status>=300&&response.status<400?502:response.status;throw e;
  }
  const data=JSON.parse(await readLimited(response.body));if(!object(data)||data.jsonrpc)throw new Error('invalid_gmail_response');return data;
 };
 if(name==='list_labels'){const data=await api('labels');if(!Array.isArray(data.labels))throw new Error('invalid_labels_response');return data;}
 if(name==='get_thread'){
  const format=args.messageFormat??'FULL_CONTENT';if(!['MESSAGE_FORMAT_UNSPECIFIED','MINIMAL','FULL_CONTENT','METADATA_ONLY','PLAIN_TEXT'].includes(format))invalid('messageFormat 不正确。');
  const value=await api('threads/'+googleID(args.threadId),{format:format==='MINIMAL'?'minimal':format==='METADATA_ONLY'?'metadata':'full'});
  return ['MINIMAL','METADATA_ONLY'].includes(format)?value:{...value,messages:(value.messages||[]).map(m=>readableMessage(m,format==='PLAIN_TEXT'))};
 }
 if(name==='search_threads'){
  if(args.includeTrash!==undefined&&typeof args.includeTrash!=='boolean')invalid('includeTrash 必须为布尔值。');
  if(args.view!==undefined&&!definition.inputSchema.properties.view.enum.includes(args.view))invalid('view 不正确。');
  const p=pageArgs(args);p.q=[p.q||'','-in:drafts','-in:spam',args.includeTrash?'':'-in:trash'].filter(Boolean).join(' ');p.includeSpamTrash=String(!!args.includeTrash);
  const value=await api('threads',p);if(!args.view||['THREAD_VIEW_IDS_ONLY','THREAD_VIEW_UNSPECIFIED','THREAD_VIEW_MINIMAL'].includes(args.view))return value;
  const threads=[];for(const t of value.threads||[]){const x=await api('threads/'+googleID(t.id),{format:'metadata'});if(args.view==='THREAD_VIEW_METADATA_ONLY'){delete x.snippet;for(const m of x.messages||[])delete m.snippet;}if(args.view==='THREAD_VIEW_SUMMARY')x.messages=(x.messages||[]).slice(-1);threads.push(x);}return {...value,threads};
 }
 if(name==='list_drafts'){
  if(args.view!==undefined&&!definition.inputSchema.properties.view.enum.includes(args.view))invalid('view 不正确。');
  const value=await api('drafts',pageArgs(args));if(!args.view||args.view==='DRAFT_VIEW_UNSPECIFIED')return value;const drafts=[];for(const d of value.drafts||[]){const x=await api('drafts/'+googleID(d.id),{format:args.view==='DRAFT_VIEW_FULL'?'full':'metadata'});drafts.push(args.view==='DRAFT_VIEW_FULL'?{...x,message:readableMessage(x.message)}:x);}return {...value,drafts};
 }
 if(name==='create_draft'){
  const heads=['MIME-Version: 1.0'];for(const key of ['to','cc','bcc']){const value=addresses(args[key]);if(value)heads.push(key+': '+value);}let subject=stringArg(args.subject,'subject');const message={};
  if(args.replyToMessageId){const original=await api('messages/'+googleID(args.replyToMessageId),{format:'metadata'}),headers=original.payload?.headers||[],id=headers.find(h=>h.name.toLowerCase()==='message-id')?.value;
   if(!original.threadId||!id)invalid('原邮件缺少可确认的回复标识，未创建草稿。');message.threadId=original.threadId;heads.push('In-Reply-To: '+header(id));const refs=headers.find(h=>h.name.toLowerCase()==='references')?.value||'';heads.push('References: '+header((refs+' '+id).trim()));if(!subject)subject='Re: '+(headers.find(h=>h.name.toLowerCase()==='subject')?.value||'');
  }
  heads.push('Subject: =?UTF-8?B?'+base64(header(subject))+'?=');const raw=heads.join('\r\n')+'\r\n'+mimeBody(args);message.raw=base64(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');const data=await api('drafts',{}, {message});if(typeof data.id!=='string'||!data.message?.id)throw new Error('draft_outcome_unknown');return data;
 }
 invalid('此连接没有开放该工具。');
}
export async function gmailProxy(request,env,context,fetchFn=fetch){
 const props=context.props||{};
 if(!ownerAllowed(env,props.email)||!props.subject||!scopeAllowed(context,'mcp:read'))return rpcError(null,-32001,'连接授权无效，请重新登录。',403);
 if(request.method!=='POST')return rpcError(null,-32600,'仅支持本次工具请求。',405);
 let body;try{body=JSON.parse(await readLimited(request.body,64*1024));}catch(_){return rpcError(null,-32700,'请求格式无效。',400);}
 if(!object(body)||body.jsonrpc!=='2.0'||!METHODS.has(body.method))return rpcError(body?.id,-32601,'此连接只开放邮件查询与草稿工具。');
 if(body.method==='tools/call'){
  if(!(typeof body.id==='string'&&body.id.length<=100||Number.isSafeInteger(body.id)))return rpcError(null,-32600,'工具调用必须包含有效的请求 ID。',400);
  const kind=toolKind(body.params?.name);
  if(!kind)return rpcError(body.id,-32601,'此连接没有开放该工具。');
  if(kind==='write'&&!scopeAllowed(context,'mcp:write'))return rpcError(body.id,-32001,'本次授权不包含创建草稿。',403);
  if(!body.params.arguments||typeof body.params.arguments!=='object'||Array.isArray(body.params.arguments))return rpcError(body.id,-32602,'工具参数必须是对象。');
 }
 if(!props.googleAccessToken||Number(props.googleExpiresAt)<=Date.now()+5000)return rpcError(body.id,-32001,'Google 授权已过期，请刷新连接或重新登录。',401);
 const result=value=>Response.json({jsonrpc:'2.0',id:body.id??null,result:redact(value,env,props)},{headers:{'Cache-Control':'no-store'}});
 if(body.method==='initialize')return result({protocolVersion:'2025-11-25',serverInfo:{name:'SmallPhone Gmail API',version:'1'},capabilities:{tools:{}}});
 if(body.method==='notifications/initialized')return new Response(null,{status:202});
 if(body.method==='ping')return result({});
 const available=tools.filter(t=>t.name!=='create_draft'||scopeAllowed(context,'mcp:write'));
 if(body.method==='tools/list')return result({tools:available});
 if(body.method==='server/discover')return result({supportedVersions:['2026-07-28'],serverInfo:{name:'SmallPhone Gmail API',version:'1'},capabilities:{tools:{}},tools:available});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const data=await gmailAPI(body,props,fetchFn,controller.signal);return result({content:[{type:'text',text:JSON.stringify(data)}]});
 }catch(e){return rpcError(body.id,e.invalid?-32602:-32603,e.invalid||e.status?e.message:'本次请求未能确认结果，请查看外部服务；不会自动重试。',e.invalid?400:e.status||502);}
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
  return html('<small>小手机 · Gmail</small><h1>允许连接你的 Gmail？</h1><p>请求应用：<strong>'+esc(client?.clientName||client?.client_name||'小手机')+'</strong></p><p>授权回执将返回：<strong>'+esc(new URL(parsed.redirectUri).hostname)+'</strong></p><ul><li>搜索邮件、读取会话和标签</li>'+(scopes.includes('mcp:write')?'<li>创建邮件草稿</li>':'')+'<li>保持登录，凭据仅由此服务端处理</li></ul><p>本连接不开放发送邮件、删除邮件工具。</p><form method="post"><input type="hidden" name="handle" value="'+esc(consent.handle)+'">'+scopes.map(s=>'<input type="hidden" name="scope" value="'+esc(s)+'">').join('')+'<button name="decision" value="approve">前往 Google 授权</button><button name="decision" value="deny">取消</button></form>',consent.headers,200,'',true);
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
