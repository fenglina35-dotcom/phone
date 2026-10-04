import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import cp from 'node:child_process';
const bundle='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const baseline=process.env.CALL_EVIDENCE_BASELINE;
const read=p=>baseline?cp.execFileSync('git',['show',baseline+':'+p],{encoding:'utf8',maxBuffer:24*1024*1024}):fs.readFileSync(p,'utf8');
function fn(source,name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);let end=source.indexOf('\nfunction ',start+1),asyncEnd=source.indexOf('\nasync function ',start+1);if(asyncEnd>=0&&(end<0||asyncEnd<end))end=asyncEnd;return (source.slice(Math.max(0,start-6),start)==='async '?'async ':'')+source.slice(start,end<0?undefined:end);}
for(const prefix of ['',bundle]){
 test(prefix+'failed calls expose raw evidence, route identity, duration and attempts without secrets',()=>{
  const ctx={URL,Date,Map,console,APP_VER:'fixture',S:{settings:{chat:{key:'PRIVATE_KEY'}}},actId:()=> 'main',localStorage:{getItem:()=>null,setItem(){}},openModal:html=>ctx.html=html};vm.createContext(ctx);vm.runInContext(read(prefix+'request-diagnostics.js'),ctx);
  const d=ctx.NorthRequestDiagnostics,row=d.begin([{role:'user',content:'PRIVATE_BODY'}],{diagnosticChannel:'call',diagnosticRoleId:'r',diagnosticOperationId:'op',diagnosticAttempt:2,routeIndex:1});
  d.configured(row,{routeIndex:1},{base:'https://fixture.invalid/v1?key=PRIVATE_KEY',model:'model'},false);
  d.error(row,Object.assign(new Error('连接解释'),{transportRaw:'Load failed PRIVATE_KEY',transportName:'TypeError',transportTimedOut:false,transportTimeoutMs:190000}));
  d.error(row,new Error('second observer'));
  const report=JSON.parse(d.report('r')),r=report.records[0];assert.equal(report.records.length,1);assert.equal(r.rawError,'Load failed [已隐藏]');assert.equal(r.errorName,'TypeError');assert.equal(r.failureStage,'waiting-headers');assert.equal(r.operationId,'op');assert.equal(r.attempt,2);assert.equal(r.endpointOrigin,'https://fixture.invalid');assert.equal(r.timeoutMs,190000);assert(r.duration>=0);assert(!JSON.stringify(report).includes('PRIVATE_KEY'));assert(!JSON.stringify(report).includes('PRIVATE_BODY'));d.open('r');assert.match(ctx.html,/电话/);assert.match(ctx.html,/耗时/);assert.match(ctx.html,/第2次/);
 });
 test(prefix+'network explanation makes no unsupported image, payment or upstream claim',()=>{
  const ctx={};vm.createContext(ctx);const s=read(prefix+'app.js');vm.runInContext(fn(s,'apiRawErrorDetail')+'\n'+fn(s,'apiErrorCN'),ctx);const text=ctx.apiErrorCN(0,'Load failed');assert(!/多半|不是付款|生成图片/.test(text));assert.match(text,/无法|不能|尚不能/);
 });
 test(prefix+'hangup during retry delay prevents another request and auxiliary fallback',async()=>{
  let requests=0;const ctx={_call:{session:'old'},wechatAuxConfigured:()=>true,chatAPI:async()=>{requests++;throw Object.assign(new Error('network'),{transportRaw:'Load failed'});},sleep:async()=>{ctx._call=null;},wechatModelRouteNotice(){},Date};vm.createContext(ctx);const s=read(prefix+'app.js');vm.runInContext(fn(s,'callRetryableFailure')+'\n'+fn(s,'callChatWithRetry'),ctx);await assert.rejects(ctx.callChatWithRetry([],{diagnosticRoleId:'r'},{}));assert.equal(requests,1);
 });
 test(prefix+'timer timeout differs from ordinary transport abort and performs no retry itself',async()=>{
  let abort;const ctx={AbortController,setTimeout:f=>{abort=f;return 1;},clearTimeout(){},fetch:(_url,opt)=>new Promise((_r,reject)=>{opt.signal.addEventListener('abort',()=>reject(Object.assign(new Error('operation aborted'),{name:'AbortError'})));}),Date};vm.createContext(ctx);vm.runInContext(fn(read(prefix+'app.js'),'fetchT'),ctx);const p=ctx.fetchT('https://fixture.invalid',{},30);abort();await assert.rejects(p,e=>e.transportTimedOut===true&&e.transportTimeoutMs===30&&e.transportName==='AbortError');
 });
}

for(const prefix of ['',bundle]) {
 test(prefix+'empty call content uses the existing attempt budget',async()=>{
  let n=0;const ctx={Date,_call:{session:'live'},wechatAuxConfigured:()=>false,sleep:async()=>{},chatAPI:async()=>++n===1?'   ':'我在。'};vm.createContext(ctx);const s=read(prefix+'app.js');vm.runInContext(fn(s,'callRetryableFailure')+'\n'+fn(s,'callChatWithRetry'),ctx);assert.equal(await ctx.callChatWithRetry([],{},{}),'我在。');assert.equal(n,2);
 });
 test(prefix+'all empty responses fail without extra attempts',async()=>{
  let n=0;const ctx={Date,_call:{session:'live'},wechatAuxConfigured:()=>true,sleep:async()=>{},wechatModelRouteNotice(){},chatAPI:async()=>{n++;return '';}};vm.createContext(ctx);const s=read(prefix+'app.js');vm.runInContext(fn(s,'callRetryableFailure')+'\n'+fn(s,'callChatWithRetry'),ctx);await assert.rejects(ctx.callChatWithRetry([],{},{}),e=>e.code==='call-empty-response');assert.equal(n,3);
 });
 test(prefix+'transport and background hints do not claim an unproven cause',()=>{
  const ctx={Date,document:{hidden:true},_pageHiddenMark:1};vm.createContext(ctx);const s=read(prefix+'app.js');vm.runInContext(fn(s,'callBackgroundInterrupted')+'\n'+fn(s,'callFailureText')+'\n'+fn(s,'callRetryableFailure'),ctx);const text=ctx.callFailureText({transportRaw:'Load failed',message:'网络连接失败',elapsedMs:100},1);assert.doesNotMatch(text,/没送出去|刚才小手机切到后台了/);assert.match(text,/尚不能确定/);assert.match(ctx.callFailureText({transportTimedOut:true,transportRaw:'Load failed'}),/等待超时/);assert.equal(ctx.callRetryableFailure({transportTimedOut:true,transportRaw:'Load failed',elapsedMs:190000}),false);assert.match(ctx.callFailureText({code:'call-empty-response'}),/正文/);
 });
}
