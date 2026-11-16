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
test('real tool catalog is filtered; read annotations are based on allowed tool semantics',async()=>{
 let calls=0;const response=await gmailProxy(rpc('tools/list'),env(),context(),async(url,init)=>{
  calls++;assert.equal(url,UPSTREAM);assert.equal(init.headers.get('Authorization'),'Bearer fixture-google-token');assert(!init.headers.has('Cookie'));assert.equal(init.redirect,'manual');
  return json({jsonrpc:'2.0',id:7,result:{tools:[{name:'gmail.search_threads',inputSchema:{type:'object'}},{name:'create_draft',annotations:{readOnlyHint:true}},{name:'send_message'},{name:'delete_thread'}]}});
 });
 const data=await response.json();assert.deepEqual(data.result.tools.map(t=>t.name),['gmail.search_threads','create_draft']);assert.equal(data.result.tools[0].annotations.readOnlyHint,true);assert.equal(data.result.tools[1].annotations.readOnlyHint,false);assert.equal(calls,1);
});
test('send/delete tools, missing write scope and oversized input are blocked before dispatch',async()=>{
 let calls=0;const fetchFn=async()=>{calls++;throw Error('unexpected');};
 for(const name of ['send_message','gmail.delete_thread','https://evil.invalid'])assert.equal((await (await gmailProxy(rpc('tools/call',{params:{name,arguments:{}}}),env(),context(),fetchFn)).json()).error.code,-32601);
 const c=context();c.auth.scope=['mcp:read'];assert.equal((await gmailProxy(rpc('tools/call',{params:{name:'create_draft',arguments:{to:'nobody@fixture.invalid'}}}),env(),c,fetchFn)).status,403);
 const large=rpc('tools/call',{params:{name:'create_draft',arguments:{text:'x'.repeat(70000)}}});assert.equal((await gmailProxy(large,env(),context(),fetchFn)).status,400);assert.equal(calls,0);
});
test('a failed write is never retried and upstream errors do not echo credentials',async()=>{
 let calls=0;const response=await gmailProxy(rpc('tools/call',{params:{name:'create_draft',arguments:{text:'private-body'}}}),env(),context(),async()=>{calls++;throw Error('fixture-secret private-body');});
 assert.equal(response.status,502);assert.equal(calls,1);const body=await response.text();assert(!body.includes('fixture-secret'));assert(!body.includes('private-body'));
});
test('upstream redirects never receive forwarded credentials or trigger another request',async()=>{
 let calls=0;const r=await gmailProxy(rpc('tools/list'),env(),context(),async(url,init)=>{calls++;assert.equal(url,UPSTREAM);assert.equal(init.redirect,'manual');return new Response('',{status:302,headers:{Location:'https://evil.invalid/collect'}});});assert.equal(r.status,502);assert.equal(calls,1);assert(!r.headers.has('Location'));
});

test('matching SSE final response closes the upstream stream without waiting for EOF',async()=>{
 let cancelled=false;
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: '+JSON.stringify({jsonrpc:'2.0',id:7,result:{content:[{type:'text',text:'actual-result'}]}})+'\n\n'));},cancel(){cancelled=true;}});
 const response=await gmailProxy(rpc('tools/call',{params:{name:'get_thread',arguments:{}}}),env(),context(),async()=>new Response(stream,{headers:{'Content-Type':'text/event-stream','Mcp-Session-Id':'upstream-session'}}));
 assert.equal((await response.json()).result.content[0].text,'actual-result');assert(cancelled);assert.equal(response.headers.get('Mcp-Session-Id'),'upstream-session');
});
test('response mismatches and upstream 403 do not replay calls',async()=>{
 for(const kind of ['mismatch','403']){let n=0;const response=await gmailProxy(rpc('tools/list'),env(),context(),async()=>{n++;return kind==='403'?new Response('sensitive-upstream-error',{status:403}):json({jsonrpc:'2.0',id:8,result:{}});});assert.equal(n,1);assert.equal(response.status,kind==='403'?403:502);assert(!(await response.text()).includes('sensitive-upstream-error'));}
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
  if(url.href===UPSTREAM){reads++;assert(/^Bearer (?:initial|renewed)-google-token$/.test(request.headers.get('Authorization')));const body=await request.json();return Response.json({jsonrpc:'2.0',id:body.id,result:{tools:[{name:'get_thread',inputSchema:{type:'object'}},{name:'send_message'}]}});}
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
  const list=async value=>{const response=await send('/mcp',{method:'POST',headers:{Authorization:'Bearer '+value,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:10,method:'tools/list'})});assert.equal(response.status,200,await response.clone().text());assert.deepEqual((await response.json()).result.tools.map(t=>t.name),['get_thread']);};
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
