import {createAccountCipher} from '../phone-device-sync/core.mjs';

// PRIVATE_MCP_ACCOUNT_V1: fixed official destinations; no arbitrary server-side proxy.
const utf8=new TextEncoder(),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hosts=new Set(['mcp.cloudflare.com','docs.mcp.cloudflare.com','mcp.notion.com','mcp.linear.app','api.githubcopilot.com','api.github.com','github.com','mcp.supabase.com','api.supabase.com','accounts.supabase.com','smallphone-gmail-mcp.fenglina35.workers.dev']);
const tokenHosts={
 'mcp.cloudflare.com':['mcp.cloudflare.com'],'mcp.notion.com':['mcp.notion.com'],'mcp.linear.app':['mcp.linear.app'],
 'mcp.supabase.com':['mcp.supabase.com','api.supabase.com','accounts.supabase.com'],
 'api.githubcopilot.com':['github.com','api.github.com'],'api.github.com':['github.com','api.github.com'],'github.com':['github.com','api.github.com'],
 'smallphone-gmail-mcp.fenglina35.workers.dev':['smallphone-gmail-mcp.fenglina35.workers.dev']
};
const protocols=new Set(['2025-03-26','2025-06-18','2025-11-25','2026-07-28']);
const methods=new Set(['initialize','server/discover','notifications/initialized','tools/list','tools/call','resources/read']);
// A valid 1 MiB JSON/SSE reply can double when embedded as outcome.text, then
// expands by another 4/3 under AES-GCM/base64. Connection limits stay separate.
const outcomeEnvelopeLimit=4000000;
const errors=new Set(['device_revoked','device_revoked_or_unknown','connection_changed','connection_missing','connection_busy','migration_changed','mutation_payload_changed','credential_changed','refresh_result_unknown','operation_lease_expired']);
class VaultError extends Error {constructor(code,status=400){super(code);this.status=status;}}
function check(ok,code='invalid_request',status=400){if(!ok)throw new VaultError(code,status);}
function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
function b64(v){let s='';for(let at=0;at<v.length;at+=8192)s+=String.fromCharCode(...v.subarray(at,at+8192));return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function unb64(v){check(typeof v==='string'&&/^[A-Za-z0-9_-]+$/.test(v),'invalid_approval');try{return Uint8Array.from(atob(v.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-v.length%4)%4)),x=>x.charCodeAt(0));}catch{throw new VaultError('invalid_approval');}}
function destination(raw){let u;try{u=new URL(raw);}catch{throw new VaultError('unsupported_destination');}check(u.protocol==='https:'&&hosts.has(u.hostname)&&(!u.port||u.port==='443')&&!u.username&&!u.password&&!u.hash&&!Array.from(u.searchParams.keys()).some(k=>/token|key|secret|password|authorization/i.test(k)),'unsupported_destination');return u.href;}
function publicConnection(c,row){
 const out=JSON.parse(JSON.stringify(c));for(const k of ['token','refresh','clientSecret','pending','accountMigration','_vaultSession'])delete out[k];
 return {...out,token:'',refresh:'',clientSecret:'',accountManaged:true,cloudRevision:row.revision,accountMigrating:false};
}
function sanitizeConnection(input,previous){
 check(object(input)&&typeof input.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(input.id),'invalid_connection');
 const c=JSON.parse(JSON.stringify(input));destination(c.url);
 check(['oauth','bearer','none'].includes(c.auth)&&typeof c.name==='string'&&c.name.length<=64,'invalid_connection');
 check(Array.isArray(c.roles)&&c.roles.length<=1000&&c.roles.every(x=>typeof x==='string'&&x.length<=160),'invalid_roles');
 check(Array.isArray(c.disabledTools)&&c.disabledTools.length<=300&&c.disabledTools.every(x=>typeof x==='string'),'invalid_tools');
 check(Array.isArray(c.tools)&&c.tools.length<=300&&c.tools.every(t=>object(t)&&typeof t.name==='string'&&t.name.length<=200&&object(t.inputSchema)&&object(t.annotations)),'invalid_tools');
 check(['ask','auto'].includes(c.mode)&&typeof c.enabled==='boolean','invalid_connection');
 for(const key of ['token','refresh','clientSecret']){
  if(c.accountManaged&&previous&&!c[key]){
   check(c.url===previous.url&&c.provider===previous.provider&&c.auth===previous.auth&&c.oauth?.token_endpoint===previous.oauth?.token_endpoint,'credential_destination_changed',409);
   c[key]=previous[key]||'';
  }
  check(typeof(c[key]||'')==='string'&&String(c[key]||'').length<=16000&&!/[\r\n]/.test(String(c[key]||'')),'invalid_credential');
 }
 if(c.accountManaged&&previous&&!input.token)c.exp=previous.exp;
 if(c.oauth?.token_endpoint){destination(c.oauth.token_endpoint);check((tokenHosts[new URL(c.url).hostname]||[]).includes(new URL(c.oauth.token_endpoint).hostname),'unsupported_oauth_destination');}
 if(c.oauthResource){destination(c.oauthResource);check(new URL(c.oauthResource).origin===new URL(c.url).origin,'unsupported_oauth_resource');}
 if(c.auth==='oauth'&&c.refresh)check(c.oauth?.token_endpoint&&typeof c.clientId==='string'&&['none','client_secret_basic','client_secret_post'].includes(c.clientAuth||'none'),'invalid_oauth');
 delete c.pending;delete c.accountMigration;delete c.accountManaged;delete c.accountPreparing;delete c.accountMigrating;delete c.cloudRevision;delete c.accountConflict;delete c.vaultDirty;delete c.vaultNewCredential;
 check(utf8.encode(canonical(c)).length<=1100000,'connection_too_large',413);return c;
}
function allowedTool(c,role,name){check(c.enabled&&Array.isArray(c.roles)&&c.roles.includes(role),'role_not_allowed',403);const t=c.tools.find(x=>x.name===name);check(t&&!c.disabledTools.includes(name),'tool_not_allowed',403);return t;}
function parameterIssues(schema,args,depth=0){
 if(!object(schema)||depth>12)return false;
 const kinds=Array.isArray(schema.type)?schema.type:schema.type?[schema.type]:[],match=t=>t==='object'?object(args):t==='array'?Array.isArray(args):t==='null'?args===null:t==='integer'?Number.isInteger(args):t==='number'?typeof args==='number'&&Number.isFinite(args):typeof args===t;
 if(kinds.length&&!kinds.some(match))return true;
 if(Array.isArray(schema.enum)&&!object(args)&&!Array.isArray(args)&&!schema.enum.includes(args))return true;
 if(object(args)){if((Array.isArray(schema.required)?schema.required:[]).some(k=>!Object.hasOwn(args,k)))return true;for(const [key,v]of Object.entries(args)){if(Object.hasOwn(schema.properties||{},key)){if(parameterIssues(schema.properties[key],v,depth+1))return true;}else if(schema.additionalProperties===false&&!schema.patternProperties)return true;}}
 if(Array.isArray(args)&&object(schema.items))return args.some(x=>parameterIssues(schema.items,x,depth+1));return false;
}
async function readJSON(request){check(request.headers.get('content-type')?.split(';')[0].trim()==='application/json','json_required',415);const reader=request.body?.getReader();check(reader);const chunks=[];let n=0;try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>1600000){await reader.cancel();throw new VaultError('request_too_large',413);}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(n);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new VaultError('invalid_json');}}
async function responseText(response,rpcId){
 const reader=response.body?.getReader();if(!reader)return '';const decoder=new TextDecoder();let text='',bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;check(bytes<=1048576,'provider_response_too_large',502);text+=decoder.decode(value,{stream:true});
   if(response.headers.get('content-type')?.includes('text/event-stream')&&rpcId!=null){let final=false;for(const event of text.split(/\r?\n\r?\n/).slice(0,-1)){const raw=event.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');try{const v=JSON.parse(raw);if(v.id===rpcId&&('result'in v||'error'in v))final=true;}catch{}}if(final){await reader.cancel();break;}}
  }return text+decoder.decode();
 }finally{reader.releaseLock();}
}
export function createVaultHandler({store,authenticate,masterKey,fetchAPI=globalThis.fetch,cryptoAPI=globalThis.crypto,now=()=>Date.now(),pause=ms=>new Promise(r=>setTimeout(r,ms))}){
 const {accountKeys,seal,open}=createAccountCipher({store,masterKey,cryptoAPI});
 const sign=async(key,v)=>b64(new Uint8Array(await cryptoAPI.subtle.sign('HMAC',key,utf8.encode(canonical(v)))));
 const digest=async v=>Array.from(new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',utf8.encode(canonical(v)))),b=>b.toString(16).padStart(2,'0')).join('');
 return async request=>{
  let scope,lease,operation,connId,keys,submitted=false,refreshSubmitted=false;
  try{
   check(request.method==='POST','method_not_allowed',405);check(!request.headers.has('origin'),'native_client_required',403);
   const bearer=request.headers.get('authorization')||'';check(/^Bearer [A-Za-z0-9_.-]{1,8192}$/.test(bearer),'authentication_required',401);
   const identity=await authenticate(bearer.slice(7));check(identity&&uuid.test(identity.userID)&&uuid.test(identity.sessionID),'authentication_required',401);
   const body=await readJSON(request);check(object(body)&&uuid.test(body.deviceId||'')&&typeof body.accountId==='string'&&body.accountId.length>0&&body.accountId.length<=160);
   scope={p_user:identity.userID,p_session:identity.sessionID,p_device:body.deviceId,p_account:body.accountId};
   await store.rpc('private_phone_sync_assert_device',{p_user:scope.p_user,p_session:scope.p_session,p_device:scope.p_device});
   keys=await accountKeys(scope.p_user);
   const aad=id=>'private-phone-mcp/connection/'+scope.p_user+'/'+scope.p_account+'/'+id;
   const decrypt=async row=>row?.ciphertext?JSON.parse(await open(keys.aes,row.ciphertext,aad(row.id),1800000)):null;
   async function read(id){return(await store.rpc('private_phone_mcp_read',{...scope,p_id:id,p_after:''})).connection;}
   if(body.action==='list'){
    if(body.connectionId){check(/^[A-Za-z0-9_-]{1,100}$/.test(body.connectionId));const row=await read(body.connectionId);return reply({ok:true,connection:row?{id:row.id,active:row.active,deleted:row.deleted,revision:row.revision,stagingNonce:row.stagingNonce,activatedNonce:row.activatedNonce,...(row.active&&!row.deleted?{value:publicConnection(await decrypt(row),row)}:{})}:null});}
    check(body.cursor===undefined||typeof body.cursor==='string'&&body.cursor.length<=100);
    const page=await store.rpc('private_phone_mcp_read',{...scope,p_id:null,p_after:body.cursor||''}),connections=[];
    for(const row of page.connections)connections.push(row.deleted?{id:row.id,deleted:true,cloudRevision:row.revision}:publicConnection(await decrypt(row),row));
    return reply({ok:true,connections,nextCursor:page.nextCursor});
   }
   connId=body.connectionId||body.connection?.id;check(typeof connId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(connId),'invalid_connection');
   if(body.action==='put'){
    check(uuid.test(body.migrationId||'')&&typeof body.baseRevision==='string'&&/^\d+$/.test(body.baseRevision),'invalid_migration');
    check(['prepare','activate'].includes(body.phase),'invalid_migration');
    if(body.phase==='activate'){
     check(typeof body.digest==='string'&&body.digest.length>=40,'invalid_migration');
     return reply(await store.rpc('private_phone_mcp_put',{...scope,p_id:connId,p_revision:body.baseRevision,p_nonce:body.migrationId,p_digest:body.digest,p_ciphertext:null,p_activate:true}));
    }
    const old=await read(connId),previous=old?.active&&!old.deleted?await decrypt(old):null,c=sanitizeConnection(body.connection,previous),fingerprint=await sign(keys.mac,{account:scope.p_account,id:connId,revision:body.baseRevision,nonce:body.migrationId,connection:c});
    await store.rpc('private_phone_mcp_put',{...scope,p_id:connId,p_revision:body.baseRevision,p_nonce:body.migrationId,p_digest:fingerprint,p_ciphertext:await seal(keys.aes,canonical(c),aad(connId)),p_activate:false,p_reset_credentials:body.connection.accountManaged!==true||!!body.connection.token});
    return reply({ok:true,migrationId:body.migrationId,digest:fingerprint,revision:body.baseRevision});
   }
   if(body.action==='remove'){
    check(typeof body.baseRevision==='string'&&/^\d+$/.test(body.baseRevision),'invalid_revision');let kept=null;
    if(body.keep===true){const row=await read(connId);check(row?.active&&!row.deleted,'connection_missing',409);const c=await decrypt(row);c.token='';c.refresh='';c.clientSecret='';c.clientAuth='none';if(c.managedOAuthClient)c.clientId='';c.managedOAuthClient=false;c.enabled=false;c.state='disconnected';c.rev=(+c.rev||0)+1;kept=await seal(keys.aes,canonical(c),aad(connId));}
    return reply(await store.rpc('private_phone_mcp_remove',{...scope,p_id:connId,p_revision:body.baseRevision,p_keep_ciphertext:kept}));
   }
   check(body.action==='rpc'&&methods.has(body.method),'unsupported_action');
   check(uuid.test(body.operationId||'')&&typeof body.connectionRevision==='string'&&/^\d+$/.test(body.connectionRevision),'invalid_operation');
   const row=await read(connId);check(row?.active&&!row.deleted,'connection_missing',409);check(row.revision===body.connectionRevision,'connection_changed',409);
   let c=await decrypt(row);check(object(body.params)&&utf8.encode(canonical(body.params)).length<=131072,'invalid_parameters');
   const argumentHash=await digest(body.params.arguments||{});
   const approvalData={owner:scope.p_user,account:scope.p_account,device:scope.p_device,connection:connId,revision:row.revision,operation:body.operationId,role:body.roleId||'',tool:body.params.name||'',arguments:argumentHash};
   if(body.method==='tools/call'){
    const t=allowedTool(c,body.roleId,body.params.name);check(object(body.params.arguments)&&!parameterIssues(t.inputSchema,body.params.arguments),'invalid_parameters');
    if(body.phase==='approval'){
     const approval={...approvalData,expires:now()+120000},payload=b64(utf8.encode(canonical(approval)));
     return reply({ok:true,approvalToken:payload+'.'+await sign(keys.mac,approval)});
    }
    if(c.mode!=='auto'&&t.annotations.readOnlyHint!==true){
     const parts=String(body.approvalToken||'').split('.');check(parts.length===2,'approval_required',403);let approval;try{approval=JSON.parse(new TextDecoder().decode(unb64(parts[0])));}catch{throw new VaultError('invalid_approval',403);}
     check(Number.isSafeInteger(approval.expires)&&approval.expires>=now()&&approval.expires<=now()+120000,'approval_expired',403);
     const expected={...approvalData,expires:approval.expires};check(canonical(approval)===canonical(expected)&&await cryptoAPI.subtle.verify('HMAC',keys.mac,unb64(parts[1]),utf8.encode(canonical(expected))),'invalid_approval',403);
    }
   }else if(body.method==='resources/read'){
    check(c.enabled&&c.roles.includes(body.roleId)&&c.tools.some(t=>t._meta?.ui?.resourceUri===body.params.uri),'resource_not_allowed',403);
   }
   operation=body.operationId;lease=cryptoAPI.randomUUID();
   const fingerprint=await sign(keys.mac,{account:scope.p_account,connection:connId,revision:row.revision,method:body.method,params:body.params,role:body.roleId||'',rpcId:body.rpcId??null});
   let claim;
   for(let n=0;n<20;n++){claim=await store.rpc('private_phone_mcp_claim',{...scope,p_id:connId,p_revision:row.revision,p_operation:operation,p_digest:fingerprint,p_lease:lease});if(claim.state!=='busy')break;await pause(250);}
   check(claim?.state!=='busy','connection_busy',409);
   const outcomeAAD='private-phone-mcp/outcome/'+scope.p_user+'/'+scope.p_account+'/'+connId+'/'+operation;
   if(claim.state==='complete')return reply(JSON.parse(await open(keys.aes,claim.ciphertext,outcomeAAD,outcomeEnvelopeLimit)));
   check(claim.state==='claimed','operation_result_unknown',409);
   c=JSON.parse(await open(keys.aes,claim.ciphertext,aad(connId),1800000));
   const progress=(phase,ciphertext=null)=>store.rpc('private_phone_mcp_progress',{...scope,p_id:connId,p_operation:operation,p_lease:lease,p_phase:phase,p_ciphertext:ciphertext});
   if(c.auth==='oauth'&&c.token&&c.exp&&now()>=c.exp){
    check(c.refresh&&c.oauth?.token_endpoint,'reauthorization_required',401);
    const form=new URLSearchParams({grant_type:'refresh_token',refresh_token:c.refresh,resource:c.oauthResource||c.url,client_id:c.clientId}),headers={'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'};
    if((c.clientAuth||'none')!=='none'){check(c.clientSecret,'reauthorization_required',401);if(c.clientAuth==='client_secret_basic'){headers.Authorization='Basic '+btoa(encodeURIComponent(c.clientId)+':'+encodeURIComponent(c.clientSecret));form.delete('client_id');}else if(c.clientAuth==='client_secret_post')form.set('client_secret',c.clientSecret);else throw new VaultError('unsupported_oauth');}
    await progress('refresh-start');refreshSubmitted=true;
    const response=await fetchAPI(destination(c.oauth.token_endpoint),{method:'POST',headers,body:form.toString(),redirect:'error',signal:AbortSignal.timeout(18000)});
    const text=await responseText(response,null);let token;try{token=JSON.parse(text);}catch{throw new VaultError('refresh_result_unknown',409);}
    check(response.ok&&typeof token.access_token==='string','refresh_result_unknown',409);
    c.token=token.access_token;c.refresh=token.refresh_token||c.refresh;c.exp=now()+Math.max(0,(+token.expires_in||3600)-60)*1000;
    await progress('refresh-complete',await seal(keys.aes,canonical(c),aad(connId)));refreshSubmitted=false;
   }
   check(protocols.has(body.protocolVersion),'unsupported_protocol');
   const headers={'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':body.protocolVersion};
   if(c.token)headers.Authorization='Bearer '+c.token;
   if(body.sessionId){check(typeof body.sessionId==='string'&&body.sessionId.length<=1024&&!/[\r\n]/.test(body.sessionId),'invalid_session');headers['Mcp-Session-Id']=body.sessionId;}
   const rpc={jsonrpc:'2.0',method:body.method,params:body.params};if(body.rpcId!=null){check(typeof body.rpcId==='string'&&body.rpcId.length<=100||Number.isSafeInteger(body.rpcId),'invalid_rpc_id');rpc.id=body.rpcId;}
   await progress('submitted');submitted=true;
   const response=await fetchAPI(destination(c.url),{method:'POST',headers,body:JSON.stringify(rpc),redirect:'error',signal:AbortSignal.timeout(35000)});
   const text=await responseText(response,body.rpcId),safeHeaders={};
   const secrets=[c.token,c.refresh,c.clientSecret].filter(v=>typeof v==='string'&&v.length>=8);if(c.clientSecret)secrets.push(btoa(encodeURIComponent(c.clientId)+':'+encodeURIComponent(c.clientSecret)));
   const redact=value=>{let out=String(value);for(const secret of secrets)for(const variant of [secret,encodeURIComponent(secret),JSON.stringify(secret).slice(1,-1)])out=out.split(variant).join('[凭据已隐藏]');return out;};
   for(const key of ['content-type','mcp-session-id','www-authenticate'])if(response.headers.get(key))safeHeaders[key]=redact(response.headers.get(key));
   const outcome={ok:true,status:response.status,headers:safeHeaders,text:redact(text)};
   await progress('complete',await seal(keys.aes,canonical(outcome),outcomeAAD));
   return reply(outcome);
  }catch(error){
   if(scope&&lease&&operation&&connId)try{await store.rpc('private_phone_mcp_progress',{...scope,p_id:connId,p_operation:operation,p_lease:lease,p_phase:'unknown',p_ciphertext:null});}catch{}
   const safe=error instanceof VaultError?error:new VaultError(refreshSubmitted?'refresh_result_unknown':errors.has(error?.message)?error.message:'vault_service_unavailable',503);
   return reply({ok:false,error:safe.message,unknown:submitted||refreshSubmitted||['operation_result_unknown','refresh_result_unknown'].includes(safe.message)},safe.status);
  }
 };
}
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}

export function createSupabaseVault({url,serviceKey,masterKey,fetchAPI=globalThis.fetch}){
 const base=new URL(url);check(base.protocol==='https:'&&/^[a-z0-9]+\.supabase\.co$/.test(base.hostname),'vault_not_configured',503);
 return async request=>{
  const signal=AbortSignal.timeout(45000);
  async function json(path,{method='GET',body,bearer=serviceKey,prefer}={}){
   const headers={apikey:serviceKey,Authorization:'Bearer '+bearer,'Content-Type':'application/json'};if(prefer)headers.Prefer=prefer;
   const response=await fetchAPI(new URL(path,base),{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal}),text=await response.text();check(text.length<=4100000,'vault_service_unavailable',503);let data;try{data=text?JSON.parse(text):null;}catch{throw new VaultError('vault_service_unavailable',503);}
   if(!response.ok)throw new VaultError(errors.has(data?.message)?data.message:path.startsWith('/auth/')?'authentication_required':'vault_service_unavailable',path.startsWith('/auth/')?401:409);return data;
  }
  const store={rpc:(name,args)=>json('/rest/v1/rpc/'+name,{method:'POST',body:args}),async key(owner,candidate){
   const path='/rest/v1/private_phone_sync_keys?select=wrapped_key,key_version&user_id=eq.'+owner+'&limit=1';let rows=await json(path);
   if(!rows?.length){await json('/rest/v1/private_phone_sync_keys?on_conflict=user_id',{method:'POST',body:{user_id:owner,wrapped_key:candidate,key_version:1},prefer:'resolution=ignore-duplicates,return=minimal'});rows=await json(path);}
   check(rows?.length===1&&rows[0].key_version===1,'vault_not_configured',503);return rows[0].wrapped_key;
  }};
  async function authenticate(token){const user=await json('/auth/v1/user',{bearer:token});let claims;try{claims=JSON.parse(new TextDecoder().decode(unb64(token.split('.')[1])));}catch{throw new VaultError('authentication_required',401);}check(user?.id===claims.sub&&claims.role==='authenticated'&&claims.exp>Date.now()/1000,'authentication_required',401);return{userID:user.id,sessionID:claims.session_id};}
  return createVaultHandler({store,authenticate,masterKey,fetchAPI})(request);
 };
}
