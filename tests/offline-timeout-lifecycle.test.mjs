import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sources=['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'];
function harness(file,{aux=true,relay=false}={}){
  const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  let now=0,sequence=0;const timers=new Map(),queue=[],calls=[],events=[];
  const route={base:'https://fixture.invalid/v1',key:'fixture',model:'main',temp:.7,aux:{model:'aux'}};
  const context=vm.createContext({Date:{now:()=>now},document:{hidden:false},Set,Map,Promise,Error,Math,String,Object,Array,Number,
    setTimeout:(fn,ms=0)=>{const id=++sequence;timers.set(id,{at:now+ms,fn});return id;},clearTimeout:id=>timers.delete(id),
    S:{settings:{chat:route,aux:route.aux}},gameModelSessionPage:()=>false,chatRouteSessionPage:()=>false,
    chatRequestRoute:()=>route,chatMainCopy:r=>({...r}),chatModelAssertText:()=>{},aiCoreOn:()=>relay,
    chatRequestDiagnostic:(stage,row,value)=>{events.push({stage,value});return row;},
    roleReplyAssertLanguage:()=>{},roleInterceptDiagnosticTurnCandidate:()=>{},annotateChatRequestError:e=>e,
    apiCaughtCN:e=>e.message,apiErrorCN:(status,raw)=>'HTTP '+status+': '+raw,
    cohabData:()=>({}),cohabReplyAux:()=>false,cohabReplyRouteIndex:()=>0,wechatAuxConfigured:()=>aux,
    cohabModelRouteNotice:()=>{},roleVisibleEnvelopeText:x=>x,offlineRoleDrift:()=>false,offReplyItems:x=>x?[x]:[]
  });
  function nextRequest(model){
    const item=queue.shift();assert.ok(item,'unexpected extra request');calls.push(model);
    return new Promise((resolve,reject)=>context.setTimeout(()=>item.error?reject(item.error):resolve(item),item.delay||0));
  }
  const data=item=>({choices:[{message:{content:item.text||'正常回复'},finish_reason:item.reason||'stop'}]});
  context.fetchT=async(url,opt)=>{const item=await nextRequest(JSON.parse(opt.body).model);return {ok:true,json:()=>item.bodyPending?new Promise(()=>{}):Promise.resolve(data(item))};};
  context.aiRelay=async()=>({data:data(await nextRequest('relay'))});
  const names=['offlineRequestError','offlineRequestTimeoutError','offlineForegroundRequest','offlineRequestVisibility','offlineReplyTransportRetryable','offlineReplyChatRequest','offlineReplyFailureReason','offlineKeepValidReplyOnRepairFailure','cohabRoleChat','joinAIContinuation','chatResultText','chatReadDiagnosticResponse'];
  vm.runInContext('const _offlineRequests=new Set(),_cohabActualModelRoute=new Map();'+names.map(name=>source.split('\n').find(l=>l.startsWith('function '+name+'(')||l.startsWith('async function '+name+'('))||'').join('\n'),context);
  const start=source.indexOf('async function chatAPI('),end=source.indexOf('\nfunction uniq(',start);
  vm.runInContext(source.slice(start,end),context);
  async function flush(){for(let i=0;i<80;i++)await Promise.resolve();}
  async function advance(ms){await flush();const end=now+ms;while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();}now=end;await flush();}
  return{context,queue,calls,events,advance,flush,request:(opt={})=>context.cohabRoleChat({id:'role'},[{role:'user',content:'当前输入'}],{max:600,...opt})};
}

for(const file of sources){
  test(file+': foreground deadline permits exactly one configured auxiliary fallback',async()=>{
    const h=harness(file);h.queue.push({delay:200000,text:'旧主模型回复'},{delay:10,text:'副模型有效回复'});
    const result=h.request().then(value=>({value}),error=>({error}));await h.advance(190020);
    const out=await result;assert.equal(out.value,'副模型有效回复',out.error?.message);assert.deepEqual(h.calls,['main','aux']);
    await h.advance(10000);assert.equal((await result).value,'副模型有效回复');
  });
  test(file+': initial response and continuation each have their own bounded wait',async()=>{
    const h=harness(file,{aux:false});h.queue.push({delay:150000,text:'前半',reason:'length'},{delay:90000,text:'后半'});
    const result=h.request({complete:true}).then(value=>({value}),error=>({error}));await h.advance(240010);
    const out=await result;assert.equal(out.value,'前半后半',out.error?.message);assert.equal(h.calls.length,2);
  });
  test(file+': foreground timeout without fallback reports timeout, never bad credentials',async()=>{
    const h=harness(file,{aux:false});h.queue.push({delay:200000});const result=h.request().catch(e=>e);await h.advance(190010);
    const error=await result;assert.equal(error.code,'OFFLINE_REPLY_TIMEOUT');
    assert.match(h.context.offlineReplyFailureReason(error),/190.*秒.*超时/);
    assert.doesNotMatch(h.context.offlineReplyFailureReason(error),/密钥|模型名|上游原始/);assert.equal(h.calls.length,1);
  });
  test(file+': stalled response body is bounded and its late data never becomes a reply',async()=>{
    const h=harness(file,{aux:false});h.queue.push({bodyPending:true});const result=h.request().catch(e=>e);await h.advance(190010);
    assert.equal((await result).code,'OFFLINE_REPLY_TIMEOUT');assert.equal(h.calls.length,1);
  });
  test(file+': background resume still cancels without fallback or stale delivery',async()=>{
    const h=harness(file);h.queue.push({delay:200000,text:'旧回复'});const result=h.request().catch(e=>e);await h.flush();
    h.context.document.hidden=true;h.context.offlineRequestVisibility();h.context.document.hidden=false;h.context.offlineRequestVisibility();
    assert.equal((await result).code,'OFFLINE_RESUME_CANCELLED');await h.advance(210000);assert.equal(h.calls.length,1);
  });
  test(file+': internal relay continuation gets a separate request deadline',async()=>{
    const h=harness(file,{aux:false,relay:true});h.queue.push({delay:150000,text:'前半',reason:'length'},{delay:90000,text:'后半'});
    const result=h.request({complete:true}).then(value=>({value}),error=>({error}));await h.advance(240010);
    assert.equal((await result).value,'前半后半');assert.equal(h.calls.length,2);
  });
  test(file+': deadline while hidden must not start a fallback in the background',async()=>{
    const h=harness(file);h.queue.push({delay:200000});const result=h.request().catch(e=>e);await h.flush();
    h.context.document.hidden=true;h.context.offlineRequestVisibility();await h.advance(190010);
    assert.equal((await result).code,'OFFLINE_RESUME_CANCELLED');assert.equal(h.calls.length,1);
  });
  test(file+': both configured models timing out stops after two calls',async()=>{
    const h=harness(file);h.queue.push({delay:200000},{delay:200000});const result=h.request().catch(e=>e);await h.advance(380010);
    assert.equal((await result).code,'OFFLINE_REPLY_TIMEOUT');assert.deepEqual(h.calls,['main','aux']);
  });
  test(file+': ordinary WeChat requests do not enter offline visibility cancellation',async()=>{
    const h=harness(file);h.queue.push({delay:20,text:'微信正常回复'});const result=h.context.chatAPI([],{max:600});await h.flush();
    h.context.document.hidden=true;h.context.offlineRequestVisibility();h.context.document.hidden=false;h.context.offlineRequestVisibility();
    await h.advance(30);assert.equal(await result,'微信正常回复');
  });
}
