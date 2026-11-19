import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultHandler,gmailProxy,googleTokens,refreshGoogle,registrationPolicy,ownerAllowed,readRpc,UPSTREAM,clientMetadata} from './handlers.mjs';
const base='https://own-gmail.fixture.invalid';
const env=()=>({PUBLIC_URL:base,GOOGLE_CLIENT_ID:'fixture-client',GOOGLE_CLIENT_SECRET:'fixture-secret',ALLOWED_EMAILS:'owner@fixture.invalid',SETUP_KEY:'fixture-setup',OAUTH_KV:{}});
const context=()=>({props:{email:'owner@fixture.invalid',subject:'owner-subject',googleAccessToken:'fixture-google-token',googleRefreshToken:'fixture-google-refresh',googleExpiresAt:Date.now()+3600000},auth:{scope:['mcp:read','mcp:write']}});
const rpc=(name,args={})=>new Request(base+'/mcp',{method:'POST',headers:{Authorization:'Bearer caller-opaque','Cookie':'must-not-forward','Content-Type':'application/json','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:7,method:name,...args})});
const json=d=>Response.json(d);
test('owner allowlist fails closed; unauthorized calls never reach Google',async()=>{
 assert(!ownerAllowed({},'owner@fixture.invalid'));let calls=0;
 const c=context();c.props.email='other@fixture.invalid';
 assert.equal((await gmailProxy(rpc('tools/list'),env(),c,async()=>{calls++;})).status,403);assert.equal(calls,0);
});
test('registration requires owner setup key, public PKCE client and exact own callback',()=>{
 const e=env(),metadata={redirect_uris:[base+'/client-callback'],token_endpoint_auth_method:'none'};
 const args={clientMetadata:metadata,request:new Request(base+'/register',{headers:{Authorization:'Bearer fixture-setup'}})};
 assert.equal(registrationPolicy(e,args),undefined);
 for(const a of [{...args,request:new Request(base+'/register')},{...args,clientMetadata:{...metadata,redirect_uris:['https://evil.invalid/callback']}},{...args,clientMetadata:{...metadata,token_endpoint_auth_method:'client_secret_post'}}])assert.equal(registrationPolicy(e,a).status,403);
});
test('REST tool catalog exposes implemented read, draft and send tools without the preview service',async()=>{
 let calls=0;const response=await gmailProxy(rpc('tools/list'),env(),context(),async()=>{calls++;throw Error('catalog must be local');});
 const data=await response.json();assert.deepEqual(data.result.tools.map(t=>t.name),['list_labels','search_threads','get_thread','list_drafts','create_draft','send_email']);assert(data.result.tools.slice(0,4).every(t=>t.annotations.readOnlyHint));assert.equal(data.result.tools[4].annotations.readOnlyHint,false);assert.equal(calls,0);
});
test('send/delete tools, missing write scope and oversized input are blocked before dispatch',async()=>{
 let calls=0;const fetchFn=async()=>{calls++;throw Error('unexpected');};
 for(const name of ['send_message','gmail.delete_thread','https://evil.invalid'])assert.equal((await (await gmailProxy(rpc('tools/call',{params:{name,arguments:{}}}),env(),context(),fetchFn)).json()).error.code,-32601);
 const c=context();c.auth.scope=['mcp:read'];assert.equal((await gmailProxy(rpc('tools/call',{params:{name:'create_draft',arguments:{to:'nobody@fixture.invalid'}}}),env(),c,fetchFn)).status,403);
 const large=rpc('tools/call',{params:{name:'create_draft',arguments:{text:'x'.repeat(70000)}}});assert.equal((await gmailProxy(large,env(),context(),fetchFn)).status,400);assert.equal(calls,0);
});
test('a failed write is never retried and upstream errors do not echo credentials',async()=>{
 let calls=0;const response=await gmailProxy(rpc('tools/call',{params:{name:'create_draft',arguments:{body:'private-body'}}}),env(),context(),async()=>{calls++;throw Error('fixture-secret private-body');});
 assert.equal(response.status,502);assert.equal(calls,1);const body=await response.text();assert(!body.includes('fixture-secret'));assert(!body.includes('private-body'));
});
test('upstream redirects never receive forwarded credentials or trigger another request',async()=>{
 let calls=0;const r=await gmailProxy(rpc('tools/call',{params:{name:'list_labels',arguments:{}}}),env(),context(),async(url,init)=>{calls++;assert.equal(url,UPSTREAM+'/labels');assert.equal(init.redirect,'manual');return new Response('',{status:302,headers:{Location:'https://evil.invalid/collect'}});});assert.equal(r.status,502);assert.equal(calls,1);assert(!r.headers.has('Location'));
});

test('matching SSE final response closes the upstream stream without waiting for EOF',async()=>{
 let cancelled=false;
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: '+JSON.stringify({jsonrpc:'2.0',id:7,result:{content:[{type:'text',text:'actual-result'}]}})+'\n\n'));},cancel(){cancelled=true;}});
 const result=await readRpc(new Response(stream,{headers:{'Content-Type':'text/event-stream'}}),7);assert.equal(result.result.content[0].text,'actual-result');assert(cancelled);
});
test('response mismatches and upstream 403 do not replay calls',async()=>{
 for(const kind of ['mismatch','403']){let n=0;const response=await gmailProxy(rpc('tools/call',{params:{name:'list_labels',arguments:{}}}),env(),context(),async()=>{n++;return kind==='403'?new Response('sensitive-upstream-error',{status:403}):json({jsonrpc:'2.0',id:8,result:{}});});assert.equal(n,1);assert.equal(response.status,kind==='403'?403:502);assert(!(await response.text()).includes('sensitive-upstream-error'));}
});
test('Google refresh rotates credentials; revoked grants are distinguished from transient failures',async()=>{
 const e=env(),props=context().props;
 const next=await refreshGoogle(e,props,async(url,init)=>{assert.equal(url,'https://oauth2.googleapis.com/token');const body=new URLSearchParams(init.body);assert.equal(body.get('client_secret'),'fixture-secret');return json({access_token:'new-token',refresh_token:'new-refresh',expires_in:3600,scope:'https://www.googleapis.com/auth/gmail.readonly',token_type:'Bearer'});});
 assert.equal(next.googleAccessToken,'new-token');assert.equal(next.googleRefreshToken,'new-refresh');
 for(const error of ['invalid_grant','server_error'])await assert.rejects(refreshGoogle(e,props,async()=>new Response(JSON.stringify({error,error_description:'fixture-secret'}),{status:400})),err=>err.code===(error==='invalid_grant'?'invalid_grant':'temporarily_unavailable')&&!err.message.includes('fixture-secret'));
});
test('Google client rejection is configuration failure, never a generic retry or leaked description',async()=>{
 for(const error of ['invalid_client','unauthorized_client']){
  let calls=0;await assert.rejects(googleTokens(env(),{grant_type:'authorization_code',code:'fixture-code'},async()=>{calls++;return new Response(JSON.stringify({error,error_description:'fixture-secret fixture-code'}),{status:401});}),e=>e.code==='google_client_configuration'&&!e.message.includes('fixture-secret')&&!e.message.includes('fixture-code'));
  assert.equal(calls,1);
 }
});
test('consent approval uses library-bound request and PKCE, without trusting form redirect fields',async()=>{
 const e=env(),original={clientId:'mcp-client',redirectUri:base+'/client-callback',scope:['mcp:read']};let approved=false,verifier='';
 e.OAUTH_PROVIDER={
  approveConsent:async(req,handle,opts)=>{assert.equal(handle,'bound-handle');assert.deepEqual(opts.scope,['mcp:read']);approved=true;return{request:original,headers:new Headers()};},
  beginUpstream:async(req,opts)=>{assert.equal(req,original);verifier=opts.data.verifier;return{state:'bound-state',headers:opts.headers};}
 };
 const body=new URLSearchParams({handle:'bound-handle',decision:'approve',scope:'mcp:read',redirect_uri:'https://evil.invalid'});
 const response=await defaultHandler(new Request(base+'/authorize',{method:'POST',body}),e,()=>{throw Error('no token exchange yet');});
 assert(approved);const url=new URL(response.headers.get('Location'));assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('redirect_uri'),base+'/oauth/google/callback');assert(!url.searchParams.get('scope').includes('gmail.compose'));assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert(verifier.length>=64);assert.equal(url.searchParams.get('state'),'bound-state');assert.equal(url.searchParams.get('access_type'),'offline');
});
test('denial or invalid browser-bound callback cannot contact Google or create a grant',async()=>{
 const e=env();let denied=false,calls=0;
 e.OAUTH_PROVIDER={denyConsent:async()=>{denied=true;return{headers:new Headers({Location:base+'/client-callback?error=access_denied'})};},finishUpstream:async()=>{throw Error('invalid browser state');}};
 const fetchFn=async()=>{calls++;};
 const r=await defaultHandler(new Request(base+'/authorize',{method:'POST',body:new URLSearchParams({handle:'x',decision:'deny'})}),e,fetchFn);assert.equal(r.status,302);assert(denied);
 await assert.rejects(defaultHandler(new Request(base+'/oauth/google/callback?code=stolen'),e,fetchFn));assert.equal(calls,0);
});
test('Google callback rejects incomplete scopes and wrong owners before minting MCP access',async()=>{
 for(const kind of ['scope','owner','ok']){
  const e=env();let grant=null;
  e.OAUTH_PROVIDER={finishUpstream:async()=>({request:{scope:['mcp:read','mcp:write']},data:{verifier:'bound-verifier'},headers:new Headers()}),completeAuthorization:async data=>{grant=data;return{redirectTo:base+'/client-callback?code=opaque-code'};}};
  const fetchFn=async(url,init)=>url==='https://oauth2.googleapis.com/token'?json({access_token:'google-token',refresh_token:'google-refresh',expires_in:3600,scope:kind==='scope'?'openid email':'openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose'}):json({sub:'subject',email:kind==='owner'?'other@fixture.invalid':'owner@fixture.invalid',email_verified:true});
  const response=await defaultHandler(new Request(base+'/oauth/google/callback?code=google-code'),e,fetchFn);
  assert.equal(response.status,kind==='ok'?302:403);assert.equal(!!grant,kind==='ok');if(grant){assert.equal(grant.props.googleRefreshToken,'google-refresh');assert.equal(grant.userId,'subject');}
 }
});
test('callback page is private, escaped and has no external scripts or assets',async()=>{
 const e=env(),r=await defaultHandler(new Request(base+'/client-callback?code=%22%3E%3Cscript%3Eevil'),e);
 const body=await r.text();assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('Referrer-Policy'),'no-referrer');assert(body.includes('&amp;')||body.includes('%22'));assert(!body.includes('<script>evil'));assert(r.headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));assert(!body.includes('script src='));
});

test('actual workerd OAuth PKCE flow, browser binding and Google refresh',async()=>{
 const {build}=await import('esbuild'),{Miniflare,convertV4MiniflareOptions}=await import('miniflare'),{fileURLToPath}=await import('node:url');
 const output=await build({absWorkingDir:fileURLToPath(new URL('.',import.meta.url)),entryPoints:['worker.mjs'],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',external:['cloudflare:workers']});
 let renewals=0,reads=0,tokenFailure='';
 const outbound=async request=>{
  const url=new URL(request.url);
  if(url.href===base+'/client-metadata.json')return Response.json(clientMetadata(env()));
  if(url.origin==='https://oauth2.googleapis.com'){
   const form=await request.formData();assert.equal(form.get('client_secret'),'fixture-secret');const renewal=form.get('grant_type')==='refresh_token';if(renewal)renewals++;
   if(tokenFailure)return Response.json({error:tokenFailure,error_description:'fixture-secret google-fixture-code'},{status:400});
   return Response.json({access_token:renewal?'renewed-google-token':'initial-google-token',refresh_token:'google-refresh',expires_in:3600,token_type:'Bearer',scope:'openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose'});
  }
  if(url.origin==='https://openidconnect.googleapis.com')return Response.json({sub:'subject',email:'owner@fixture.invalid',email_verified:true});
  if(url.href===UPSTREAM+'/labels'){reads++;assert(/^Bearer (?:initial|renewed)-google-token$/.test(request.headers.get('Authorization')));assert.equal(request.method,'GET');return Response.json({labels:[{id:'INBOX',name:'INBOX'}]});}
  throw Error('External network forbidden: '+url.origin);
 };
 const {readFile}=await import('node:fs/promises'),config=await readFile(new URL('./wrangler.toml',import.meta.url),'utf8'),date=config.match(/^compatibility_date = "([^"]+)"/m)[1],flags=JSON.parse(config.match(/^compatibility_flags = (.+)$/m)[1]);
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:output.outputFiles[0].text,compatibilityDate:date,compatibilityFlags:flags,kvNamespaces:['OAUTH_KV'],bindings:env(),outboundService:outbound}));
 try{
  const send=(path,options={})=>mf.dispatchFetch(base+path,{...options,redirect:'manual'});
  let r=await send('/.well-known/oauth-protected-resource/mcp');assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).resource,base+'/mcp');
  const registration={client_name:'小手机测试',redirect_uris:[base+'/client-callback'],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'};
  r=await send('/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(registration)});assert.equal(r.status,403);
  r=await send('/register',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer fixture-setup'},body:JSON.stringify(registration)});assert.equal(r.status,201,await r.clone().text());const registered=await r.json();assert(registered.client_id);assert(!registered.client_secret);const client={client_id:base+'/client-metadata.json'};
  const verifier='client-verifier-'+ 'v'.repeat(50),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)),challenge=Buffer.from(digest).toString('base64url');
  const query={client_id:client.client_id,response_type:'code',redirect_uri:base+'/client-callback',scope:'mcp:read mcp:write offline_access',resource:base+'/mcp',state:'client-state',code_challenge:challenge,code_challenge_method:'S256'};
  const jar=new Map(),cookies=()=>[...jar].map(([k,v])=>k+'='+v).join('; ');
  const remember=response=>{for(const line of response.headers.getSetCookie()){const first=line.split(';')[0],at=first.indexOf('=');if(/Max-Age=0/i.test(line))jar.delete(first.slice(0,at));else jar.set(first.slice(0,at),first.slice(at+1));}};
  r=await send('/authorize?'+new URLSearchParams(query));assert.equal(r.status,200,await r.clone().text());remember(r);const text=await r.text(),handle=text.match(/name="handle" value="([^"]+)"/)[1];
  r=await send('/authorize',{method:'POST',headers:{Cookie:cookies(),Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams([['handle',handle],['decision','approve'],['scope','mcp:read'],['scope','mcp:write'],['scope','offline_access']]).toString()});assert.equal(r.status,302,await r.clone().text());remember(r);const google=new URL(r.headers.get('Location'));assert.equal(google.origin,'https://accounts.google.com');
  const callback='/oauth/google/callback?'+new URLSearchParams({code:'google-fixture-code',state:google.searchParams.get('state')});
  r=await send(callback);assert.equal(r.status,400);assert.equal(reads,0);
  r=await send(callback,{headers:{Cookie:cookies()}});assert.equal(r.status,302,await r.clone().text());const receipt=new URL(r.headers.get('Location'));assert.equal(receipt.searchParams.get('state'),'client-state');
  const exchange={client_id:client.client_id,grant_type:'authorization_code',code:receipt.searchParams.get('code'),redirect_uri:base+'/client-callback',code_verifier:verifier,resource:base+'/mcp'};
  r=await send('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(exchange).toString()});assert.equal(r.status,200,await r.clone().text());const token=await r.json();assert(token.access_token);assert(token.refresh_token);assert(!token.access_token.includes('google-token'));
  const list=async value=>{const response=await send('/mcp',{method:'POST',headers:{Authorization:'Bearer '+value,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:10,method:'tools/call',params:{name:'list_labels',arguments:{}}})});assert.equal(response.status,200,await response.clone().text());assert.equal(JSON.parse((await response.json()).result.content[0].text).labels[0].id,'INBOX');};
  await list(token.access_token);
  r=await send('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client.client_id,grant_type:'refresh_token',refresh_token:token.refresh_token,resource:base+'/mcp'}).toString()});assert.equal(r.status,200,await r.clone().text());const next=await r.json();assert.equal(renewals,1);await list(next.access_token);assert.equal(reads,2);
  for(const [failure,status,marker] of [['invalid_client',502,'GMAIL_CLIENT_CONFIG'],['invalid_grant',400,'GMAIL_CODE_REJECTED'],['server_error',503,'GMAIL_TOKEN_UNAVAILABLE']]){
   tokenFailure=failure;r=await send('/authorize?'+new URLSearchParams(query));remember(r);
   const newHandle=(await r.text()).match(/name="handle" value="([^"]+)"/)[1];
   r=await send('/authorize',{method:'POST',headers:{Cookie:cookies(),Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams([['handle',newHandle],['decision','approve'],['scope','mcp:read']]).toString()});assert.equal(r.status,302);remember(r);
   const state=new URL(r.headers.get('Location')).searchParams.get('state');
   r=await send('/oauth/google/callback?'+new URLSearchParams({code:'google-fixture-code',state}),{headers:{Cookie:cookies()}});
   assert.equal(r.status,status);const errorPage=await r.text();assert(errorPage.includes(marker));assert(!errorPage.includes('fixture-secret'));assert(!errorPage.includes('google-fixture-code'));assert.equal(reads,2);
  }
 }finally{await mf.dispose();}
});

test('Gmail REST: existing OAuth grant lists labels without preview MCP',async()=>{
 let n=0;const r=await gmailProxy(rpc('tools/call',{params:{name:'list_labels',arguments:{}}}),env(),context(),async(url,init)=>{n++;assert.equal(String(url),'https://gmail.googleapis.com/gmail/v1/users/me/labels');assert.equal(new Headers(init.headers).get('Authorization'),'Bearer fixture-google-token');assert(!new Headers(init.headers).has('Cookie'));return json({labels:[{id:'INBOX',name:'INBOX'}]});});
 assert.equal(r.status,200);assert.equal(n,1);assert.deepEqual(JSON.parse((await r.json()).result.content[0].text).labels,[{id:'INBOX',name:'INBOX'}]);
});
test('Gmail REST: a draft writes once and never uses a send endpoint',async()=>{
 let n=0;const r=await gmailProxy(rpc('tools/call',{params:{name:'create_draft',arguments:{to:['friend@fixture.invalid'],subject:'中文主题',body:'草稿正文'}}}),env(),context(),async(url,init)=>{n++;assert.equal(String(url),'https://gmail.googleapis.com/gmail/v1/users/me/drafts');assert.equal(init.method,'POST');const raw=JSON.parse(init.body).message.raw;assert(Buffer.from(raw,'base64url').toString('utf8').includes('MIME-Version: 1.0'));return json({id:'draft1',message:{id:'msg1'}});});
 assert.equal(r.status,200);assert.equal(n,1);assert.equal(JSON.parse((await r.json()).result.content[0].text).id,'draft1');
});

test('Gmail REST: search and draft listing preserve pagination without reading message bodies',async()=>{
 for(const name of ['search_threads','list_drafts']){
  const seen=[];const response=await gmailProxy(rpc('tools/call',{params:{name,arguments:{query:'subject:中文',pageSize:3,pageToken:'next+/='}}}),env(),context(),async(url,init)=>{seen.push(new URL(url));assert.equal(init.method,'GET');return json(name==='search_threads'?{threads:[{id:'thread1',snippet:'summary'}],nextPageToken:'later',resultSizeEstimate:1}:{drafts:[{id:'draft1',message:{id:'m1',threadId:'t1'}}],nextPageToken:'later'});});
  assert.equal(response.status,200);assert.equal(seen.length,1);assert.equal(seen[0].searchParams.get('maxResults'),'3');assert.equal(seen[0].searchParams.get('pageToken'),'next+/=');assert(seen[0].searchParams.get('q').includes('subject:中文'));assert.equal(JSON.parse((await response.json()).result.content[0].text).nextPageToken,'later');
 }
});
test('Gmail REST: full thread decodes Unicode plain text and keeps attachments as references',async()=>{
 let n=0;const payload={mimeType:'multipart/mixed',parts:[{mimeType:'text/plain',body:{data:Buffer.from('原文😀').toString('base64url')}},{mimeType:'text/html',body:{data:Buffer.from('<b>HTML</b>').toString('base64url')}},{mimeType:'image/png',body:{attachmentId:'attachment1',size:99}}]};
 const response=await gmailProxy(rpc('tools/call',{params:{name:'get_thread',arguments:{threadId:'t1',messageFormat:'PLAIN_TEXT'}}}),env(),context(),async url=>{n++;assert.equal(new URL(url).pathname,'/gmail/v1/users/me/threads/t1');assert.equal(new URL(url).searchParams.get('format'),'full');return json({id:'t1',messages:[{id:'m1',payload}]});});
 const data=JSON.parse((await response.json()).result.content[0].text);assert.equal(n,1);assert.deepEqual(data.messages[0].textParts,[{mimeType:'text/plain',text:'原文😀'}]);assert.equal(data.messages[0].payload.parts[2].body.attachmentId,'attachment1');assert(!JSON.stringify(data).includes('data:'));
});
test('Gmail REST: header injection, fabricated URL IDs and invalid page sizes never reach Google',async()=>{
 let n=0;const network=async()=>{n++;throw Error('not permitted');};
 for(const params of [{name:'create_draft',arguments:{subject:'subject\r\nBcc: other@fixture.invalid'}},{name:'create_draft',arguments:{to:['a@fixture.invalid\r\nBcc:b@fixture.invalid']}},{name:'get_thread',arguments:{threadId:'https://evil.invalid/token'}},{name:'search_threads',arguments:{pageSize:500}},{name:'create_draft',arguments:{includeSignature:true}}]){
  const response=await gmailProxy(rpc('tools/call',{params}),env(),context(),network);assert.equal(response.status,400);assert.equal((await response.json()).error.code,-32602);
 }
 assert.equal(n,0);
});
test('Gmail REST: notifications cannot create a draft without a request ID',async()=>{
 let n=0;const request=new Request(base+'/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',method:'tools/call',params:{name:'create_draft',arguments:{body:'draft'}}})});
 assert.equal((await gmailProxy(request,env(),context(),async()=>{n++;})).status,400);assert.equal(n,0);
});
test('Gmail REST: a reply draft uses real message identity and creates only one draft with attachments',async()=>{
 const seen=[];const response=await gmailProxy(rpc('tools/call',{params:{name:'create_draft',arguments:{replyToMessageId:'m1',to:['friend@fixture.invalid'],body:'正文😀',htmlBody:'<p>正文😀</p>',attachments:[{filename:'附件.txt',mimeType:'text/plain',content:Buffer.from('附件原文').toString('base64'),inline:true}]}}}),env(),context(),async(url,init)=>{
  seen.push({url,method:init.method});if(init.method==='GET')return json({id:'m1',threadId:'t1',payload:{headers:[{name:'Message-ID',value:'<m1@fixture.invalid>'},{name:'Subject',value:'原主题'}]}});
  const message=JSON.parse(init.body).message,raw=Buffer.from(message.raw,'base64url').toString('utf8');assert.equal(message.threadId,'t1');assert(raw.includes('In-Reply-To: <m1@fixture.invalid>'));assert(raw.includes('multipart/alternative'));assert(raw.includes('Content-ID: <att0>'));assert(raw.includes("filename*=UTF-8''"));return json({id:'draft1',message:{id:'m2',threadId:'t1'}});
 });
 assert.equal(response.status,200);assert.deepEqual(seen.map(x=>x.method),['GET','POST']);assert(seen.every(x=>!x.url.includes('/send')));
});
test('Gmail REST: disabled API is distinguished from lost login without leaking Google details',async()=>{
 const response=await gmailProxy(rpc('tools/call',{params:{name:'list_labels',arguments:{}}}),env(),context(),async()=>new Response(JSON.stringify({error:{details:[{reason:'SERVICE_DISABLED'}],message:'fixture-google-token private-data'}}),{status:403}));
 const text=await response.text();assert.equal(response.status,403);assert(text.includes('尚未启用正式 Gmail API'));assert(!text.includes('fixture-google-token'));assert(!text.includes('private-data'));assert(!text.includes('重新登录'));
});

// MCP_GMAIL_SEND_V1: real send is separate from draft creation and never retries.
test('Gmail send_email: exact recipient and UTF-8 content go to one messages/send request',async()=>{
 let calls=0;const response=await gmailProxy(rpc('tools/call',{params:{name:'send_email',arguments:{to:['receiver@fixture.invalid'],subject:'角色真实发信测试',body:'这是测试正文。'}}}),env(),context(),async(url,init)=>{
  calls++;assert.equal(url,UPSTREAM+'/messages/send');assert.equal(init.method,'POST');const payload=JSON.parse(init.body);assert(!payload.message);const raw=Buffer.from(payload.raw,'base64url').toString('utf8');assert(raw.includes('to: receiver@fixture.invalid\r\n'));assert(raw.includes(Buffer.from('角色真实发信测试').toString('base64')));assert(raw.includes(Buffer.from('这是测试正文。').toString('base64')));return json({id:'sent-message-1',threadId:'sent-thread-1',labelIds:['SENT']});
 });assert.equal(response.status,200);assert.equal(calls,1);const result=JSON.parse((await response.json()).result.content[0].text);assert.equal(result.id,'sent-message-1');assert.deepEqual(result.labelIds,['SENT']);
});
test('Gmail send_email: no write grant, empty target and injected headers never submit; uncertain send is not retried',async()=>{
 let calls=0;const fetchFn=async()=>{calls++;throw Error('private-token private-body');};
 const c=context();c.auth.scope=['mcp:read'];assert.equal((await gmailProxy(rpc('tools/call',{params:{name:'send_email',arguments:{to:['receiver@fixture.invalid'],subject:'test',body:'test'}}}),env(),c,fetchFn)).status,403);
 for(const args of [{to:[],subject:'test',body:'test'},{to:['receiver@fixture.invalid'],subject:'x\r\nBcc:evil@fixture.invalid',body:'test'},{to:['receiver@fixture.invalid'],subject:'test',body:''},{to:['receiver@fixture.invalid'],subject:'test',body:'test',url:'https://evil.invalid'}])assert.equal((await gmailProxy(rpc('tools/call',{params:{name:'send_email',arguments:args}}),env(),context(),fetchFn)).status,400);
 assert.equal(calls,0);const r=await gmailProxy(rpc('tools/call',{params:{name:'send_email',arguments:{to:['receiver@fixture.invalid'],subject:'test',body:'test'}}}),env(),context(),fetchFn);assert.equal(r.status,502);assert.equal(calls,1);assert(!(await r.text()).includes('private-token'));
});

// MCP_SPOTIFY_PUBLIC_SEARCH_V1: public metadata only; no account/playback tools.
test('Spotify catalog is isolated, authenticated and exposes only track search',async()=>{
 const {spotifyCatalog}=await import('./handlers.mjs');let calls=0;
 const e={SPOTIFY_CATALOG_TOKEN_SHA256:'0e740afe07f722eea955522452638430cc932c6a445cc763d22bbef6462b9441'}, network=async()=>{calls++;throw Error('unexpected');};
 assert.equal((await spotifyCatalog(rpc('tools/list'),e,network)).status,401);
 const request=method=>new Request(base+'/spotify/mcp',{method:'POST',headers:{Authorization:'Bearer catalog-fixture-token'},body:JSON.stringify({jsonrpc:'2.0',id:4,method})});
 const result=await (await spotifyCatalog(request('tools/list'),e,network)).json();
 assert.deepEqual(result.result.tools.map(t=>t.name),['spotify_search']);assert.equal(result.result.tools[0].annotations.readOnlyHint,true);assert.equal(calls,0);
 const init=await (await spotifyCatalog(request('initialize'),e,network)).json();assert(init.result.serverInfo.name.includes('公开曲库'));assert(!JSON.stringify(init).includes('pipeworx'));
});
test('Spotify search performs one bounded fixed-host handshake and search; credentials never forwarded',async()=>{
 const {spotifyCatalog}=await import('./handlers.mjs');const seen=[];
 const request=new Request(base+'/spotify/mcp',{method:'POST',headers:{Authorization:'Bearer catalog-fixture-token',Cookie:'private-cookie','Mcp-Session-Id':'caller-session'},body:JSON.stringify({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'spotify_search',arguments:{query:'Adele Hello',limit:3}}})});
 const response=await spotifyCatalog(request,{SPOTIFY_CATALOG_TOKEN_SHA256:'0e740afe07f722eea955522452638430cc932c6a445cc763d22bbef6462b9441'},async(url,init)=>{
  assert.equal(url,'https://gateway.pipeworx.io/spotify/mcp');assert.equal(init.redirect,'manual');assert(init.signal);const headers=new Headers(init.headers);assert(!headers.has('Authorization'));assert(!headers.has('Cookie'));assert.notEqual(headers.get('Mcp-Session-Id'),'caller-session');
  const body=JSON.parse(init.body);seen.push(body.method);
  if(body.method==='initialize')return Response.json({jsonrpc:'2.0',id:body.id,result:{protocolVersion:'2025-11-25',serverInfo:{name:'upstream'},instructions:'MUST NOT RETURN OR FOLLOW'}},{headers:{'Mcp-Session-Id':'upstream-session'}});
  assert.equal(headers.get('Mcp-Session-Id'),'upstream-session');
  if(body.method==='notifications/initialized')return new Response(null,{status:202});
  assert.equal(body.params.name,'spotify_search');assert.deepEqual(body.params.arguments,{query:'Adele Hello',type:'track',market:'US',limit:3,offset:0});
  return Response.json({jsonrpc:'2.0',id:body.id,result:{content:[{type:'text',text:JSON.stringify({tracks:{items:[{id:'62PaSfnXSMyLshYJrlTuL3',name:'Hello',artists:[{name:'Adele'}],external_urls:{spotify:'https://open.spotify.com/track/62PaSfnXSMyLshYJrlTuL3'}}],total:4}})}]}});
 });
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.id,4);assert((result.result.content[0].text).includes('62PaSfnXSMyLshYJrlTuL3'));assert.deepEqual(seen,['initialize','notifications/initialized','tools/call']);
});
test('Spotify catalog rejects unrelated tools, extra fields, notifications and unsafe parameters before network',async()=>{
 const {spotifyCatalog}=await import('./handlers.mjs');let calls=0;
 for(const change of [{params:{name:'ask_pipeworx',arguments:{query:'x'}}},{params:{name:'spotify_search',arguments:{query:'x',url:'https://evil.invalid'}}},{params:{name:'spotify_search',arguments:{query:'x',type:'playlist'}}},{params:{name:'spotify_search',arguments:{query:'x',limit:100}}},{params:{name:'spotify_search',arguments:{query:'x',market:'../'}}},{params:{name:'spotify_search',arguments:{query:''}}},{id:undefined}]){
  const body={jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'spotify_search',arguments:{query:'Adele Hello'}},...change};
  const r=await spotifyCatalog(new Request(base+'/spotify/mcp',{method:'POST',headers:{Authorization:'Bearer catalog-fixture-token'},body:JSON.stringify(body)}),{SPOTIFY_CATALOG_TOKEN_SHA256:'0e740afe07f722eea955522452638430cc932c6a445cc763d22bbef6462b9441'},async()=>{calls++;throw Error('unexpected');});assert.equal(r.status,400);
 }assert.equal(calls,0);
});
test('Spotify failed calls, redirects and mismatched responses never replay or leak upstream errors',async()=>{
 const {spotifyCatalog}=await import('./handlers.mjs');
 for(const kind of ['redirect','mismatch','error','network']){let searches=0;
  const r=await spotifyCatalog(new Request(base+'/spotify/mcp',{method:'POST',headers:{Authorization:'Bearer catalog-fixture-token'},body:JSON.stringify({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'spotify_search',arguments:{query:'Adele Hello'}}})}),{SPOTIFY_CATALOG_TOKEN_SHA256:'0e740afe07f722eea955522452638430cc932c6a445cc763d22bbef6462b9441'},async(url,init)=>{
   const body=JSON.parse(init.body);if(body.method==='initialize')return Response.json({jsonrpc:'2.0',id:body.id,result:{protocolVersion:'2025-11-25'}});if(body.method==='notifications/initialized')return new Response(null,{status:202});searches++;
   if(kind==='network')throw Error('private upstream token');if(kind==='redirect')return new Response('private upstream token',{status:302,headers:{Location:'https://evil.invalid'}});
   return Response.json(kind==='mismatch'?{jsonrpc:'2.0',id:'wrong',result:{}}:{jsonrpc:'2.0',id:body.id,result:{isError:true,content:[{type:'text',text:'private upstream token'}]}});
  });assert.equal(r.status,502);assert.equal(searches,1);assert(!(await r.text()).includes('private upstream token'));assert(!r.headers.has('Location'));
 }
});

test('actual Worker routes Spotify separately from Gmail OAuth and retains Origin and auth protections',async()=>{
 const {build}=await import('esbuild'),{Miniflare,convertV4MiniflareOptions}=await import('miniflare'),{fileURLToPath}=await import('node:url'),{readFile}=await import('node:fs/promises');
 const output=await build({absWorkingDir:fileURLToPath(new URL('.',import.meta.url)),entryPoints:['worker.mjs'],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',external:['cloudflare:workers']});
 const config=await readFile(new URL('./wrangler.toml',import.meta.url),'utf8'),date=config.match(/^compatibility_date = "([^"]+)"/m)[1],flags=JSON.parse(config.match(/^compatibility_flags = (.+)$/m)[1]);
 let reads=0;const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:output.outputFiles[0].text,compatibilityDate:date,compatibilityFlags:flags,kvNamespaces:['OAUTH_KV'],bindings:{...env(),SPOTIFY_CATALOG_TOKEN_SHA256:'0e740afe07f722eea955522452638430cc932c6a445cc763d22bbef6462b9441'},outboundService:async request=>{
  assert.equal(request.url,'https://gateway.pipeworx.io/spotify/mcp');assert(!request.headers.has('Authorization'));const body=await request.json();
  if(body.method==='initialize')return Response.json({jsonrpc:'2.0',id:body.id,result:{protocolVersion:'2025-11-25'}});
  if(body.method==='notifications/initialized')return new Response(null,{status:202});reads++;return Response.json({jsonrpc:'2.0',id:body.id,result:{content:[{type:'text',text:JSON.stringify({tracks:{items:[],total:0}})}]}});
 }}));
 try{
  const send=(headers={},body={jsonrpc:'2.0',id:4,method:'tools/list'})=>mf.dispatchFetch(base+'/spotify/mcp',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  assert.equal((await send()).status,401);assert.equal((await send({Authorization:'Bearer catalog-fixture-token',Origin:'https://evil.invalid'})).status,403);
  const response=await send({Authorization:'Bearer catalog-fixture-token',Origin:'null'});assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('Access-Control-Allow-Origin'),'null');assert.equal((await response.json()).result.tools.length,1);
  assert.equal((await mf.dispatchFetch(base+'/mcp',{method:'POST',headers:{Authorization:'Bearer catalog-fixture-token'},body:'{}'})).status,401);
  const result=await send({Authorization:'Bearer catalog-fixture-token'},{jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'spotify_search',arguments:{query:'test song'}}});assert.equal(result.status,200);assert.equal(reads,1);assert.equal(JSON.parse((await result.json()).result.content[0].text).personalAccount,false);
 }finally{await mf.dispose();}
});
