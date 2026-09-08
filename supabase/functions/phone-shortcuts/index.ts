import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {validId,validateConfig,modelURL,modelMessages,visibleReply,publicIPv4} from './core.ts';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}});
const enc=new TextEncoder();
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),b=>b.toString(16).padStart(2,'0')).join('');}
async function cipherKey(secret:string){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode('phone-shortcuts:v1:'+secret)),'AES-GCM',false,['encrypt','decrypt']);}
async function seal(value:unknown,secret:string){const iv=crypto.getRandomValues(new Uint8Array(12)),data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await cipherKey(secret),enc.encode(JSON.stringify(value))));let binary='';for(const b of iv)binary+=String.fromCharCode(b);for(const b of data)binary+=String.fromCharCode(b);return btoa(binary);}
async function unseal(value:string,secret:string){const bytes=Uint8Array.from(atob(value),x=>x.charCodeAt(0));return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},await cipherKey(secret),bytes.slice(12))));}
function must<T>(result:{data:T,error:any}):T{if(result.error)throw Error('storage-failed');return result.data;}
async function safeModelURL(base:string){
 const u=modelURL(base);
 // All A records must be public; refuse IPv6-only and redirects. No local-network model endpoints.
 const addresses=/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)?[u.hostname]:await Deno.resolveDns(u.hostname,'A');
 if(!addresses.length||addresses.some(x=>!publicIPv4(x)))throw Error('unsafe-model-host');
 return u;
}
async function work(client:any,url:string,key:string,id?:string){
 const job=must<any>(await client.rpc('phone_shortcut_claim',id?{p_id:id}:{}));if(!job)return;
 let body='',error:string|null=null;
 try{
  const config=await unseal(job.config_cipher,key),endpoint=await safeModelURL(config.route.base);
  const response=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(65000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.route.key},body:JSON.stringify({model:config.route.model,messages:modelMessages(config,job),temperature:config.route.temp,max_tokens:config.route.maxTokens,stream:false})});
  if(!response.ok)throw Error('model-http-'+response.status);
  const data=await response.json();body=visibleReply(data?.choices?.[0]?.message?.content,config.unfiltered);
 }catch(e){const m=String(e?.message||'');error=/^(empty-model-reply|english-only-output|model-refusal|model-http-\d+|unsafe-model-host)$/.test(m)?m:'model-request-failed';}
 must(await client.rpc('phone_shortcut_finish',{p_id:job.id,p_claim:job.claim_token,p_reply:body,p_error:error}));
 // Delivery uses the existing outbox/APNs code, never a second model call.
 if(!error)await fetch(url+'/functions/v1/phone-role-push',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({action:'shortcut_deliver',jobId:job.id}),signal:AbortSignal.timeout(15000)}).catch(()=>{});
}
export async function handle(request:Request){
 if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(request.method!=='POST')return reply({error:'method-not-allowed'},405);
 const url=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const raw=await request.text();if(raw.length>220000)return reply({error:'request-too-large'},413);
  const input=JSON.parse(raw),action=String(input.action||'trigger');
  if(action==='dispatch'){
   if(request.headers.get('authorization')!=='Bearer '+key)return reply({error:'unauthorized'},401);
   EdgeRuntime.waitUntil(work(client,url,key));return reply({ok:true});
  }
  if(action==='trigger'){
   const token=String(input.token||'');if(!/^[a-f0-9]{64}$/.test(token)||!validId(input.eventId))return reply({error:'invalid-trigger'},400);
   const job=must<any>(await client.rpc('phone_shortcut_accept',{p_token_hash:await hash(token),p_event_id:input.eventId,p_event_text:String(input.text||'')}));
   if(job.error)return reply(job,job.error==='unauthorized'?401:429);
   if(!job.duplicate)EdgeRuntime.waitUntil(work(client,url,key,job.jobId));return reply(job,202);
  }
  const target=String(input.target||''),secret=String(input.ownerSecret||''),clientId=String(input.clientId||'');
  if(!validId(clientId)||target.length>120||secret.length<24)return reply({error:'invalid-owner'},400);
  // This existing authenticated RPC is callable only for a real paired owner.
  const auth=must<any>(await client.rpc('phone_role_push_status',{p_target:target,p_owner_secret:secret,p_role_id:String(input.roleId||'shortcuts')}));
  if(auth?.ok!==true)return reply({error:'owner-not-linked'},403);
  if(action==='list')return reply({rules:must(await client.from('phone_shortcut_rules').select('id,role_id,role_name,name,mode,preset,enabled,revision,synced_at,cooldown_seconds,daily_limit').eq('owner_id',target).eq('client_id',clientId).order('created_at',{ascending:false}))});
  if(action==='save'){
   const config=validateConfig(input.config),preset=String(input.preset||'').trim(),name=String(input.name||'').trim(),roleId=String(input.roleId||'');
   if(!['user_message','role_event'].includes(input.mode)||!preset||preset.length>2000||!name||name.length>80||!roleId||roleId.length>120)throw Error('invalid-rule');
   await safeModelURL(config.route.base);
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
   const row={owner_id:target,client_id:clientId,role_id:roleId,role_name:String(input.roleName||'角色').slice(0,100),name,mode:input.mode,preset,allow_event_text:input.allowEventText===true,token_hash:await hash(token),config_cipher:await seal(config,key)};
   const result=must<any>(await client.from('phone_shortcut_rules').insert(row).select('id').single());return reply({ok:true,id:result.id,token,url:url+'/functions/v1/phone-shortcuts'});
  }
  if(action==='revoke'){
   must(await client.from('phone_shortcut_rules').update({enabled:false,config_cipher:'',token_hash:'revoked:'+crypto.randomUUID()}).eq('id',String(input.id)).eq('owner_id',target).eq('client_id',clientId));return reply({ok:true});
  }
  if(action==='pull')return reply({jobs:must(await client.from('phone_shortcut_jobs').select('id,role_id,mode,input_text,status,reply_text,error_code,received_at,completed_at').eq('owner_id',target).eq('client_id',clientId).in('status',['completed','failed','canceled']).is('consumed_at',null).order('received_at').limit(30))});
  if(action==='ack'){
   const ids=(Array.isArray(input.ids)?input.ids:[]).slice(0,30);must(await client.from('phone_shortcut_jobs').update({consumed_at:new Date().toISOString()}).eq('owner_id',target).eq('client_id',clientId).in('id',ids));return reply({ok:true});
  }
  return reply({error:'invalid-action'},400);
 }catch(e){const message=String(e?.message||'');return reply({error:/^(invalid-|model-not-configured|unsafe-model-host)/.test(message)?message:'request-failed'},400);}
}
Deno.serve(handle);
