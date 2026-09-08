import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import cp from 'node:child_process';
const moduleCode=fs.readFileSync('request-diagnostics.js','utf8');
const entries=['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'];
function load(file,store=new Map()){
 const source=process.env.DIAGNOSTICS_BASELINE==='1'?cp.execFileSync('git',['show','9defbd8b:'+file],{encoding:'utf8',maxBuffer:20*1024*1024}):fs.readFileSync(file,'utf8');
 const start=source.indexOf('async function chatAPI('),end=source.indexOf('\nfunction uniq(',start),names=['chatRequestDiagnostic','chatReadDiagnosticResponse','chatResultText'];
 const lines=source.split('\n').filter(l=>names.some(n=>l.startsWith('function '+n+'(')||l.startsWith('async function '+n+'('))).join('\n');
 let calls=0,body=JSON.stringify({choices:[{message:{content:'正常中文'}}]}),status=200,type='application/json',fail=false;
 const ctx={Response,Date,Map,Set,console,S:{settings:{chat:{base:'https://fixture.invalid/v1',key:'DO_NOT_SHARE_SECRET',model:'test-main'},aux:{model:'test-aux'}}},actId:()=>ctx.account||'main',gameModelSessionPage:()=>false,chatRouteSessionPage:()=>false,chatRequestRoute:()=>null,chatModelAssertText(){},aiCoreOn:()=>false,annotateChatRequestError:e=>e,apiCaughtCN:e=>e.message,apiErrorCN:()=> '上游失败',roleInterceptDiagnosticTurnCandidate(){},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},fetchT:async()=>{calls++;if(fail)throw new Error('network DO_NOT_SHARE_SECRET');return new Response(body,{status,headers:{'content-type':type,'x-request-id':'fixture-123'}});}};
 vm.createContext(ctx);vm.runInContext(moduleCode+'\n'+lines+'\n'+source.slice(start,end),ctx);
 return{ctx,store,calls:()=>calls,set:(value,code=200,contentType='application/json',network=false)=>{body=value;status=code;type=contentType;fail=network;}};
}
for(const file of entries){
 test(file+' records pending and failed request without additional calls',async()=>{
  const w=load(file),audit={c:{id:'role-a'},account:'main',channel:'online'};
  w.ctx.NorthRequestDiagnostics.turn(audit);w.set('');assert.equal(await w.ctx.chatAPI([],{roleInterceptAudit:audit,unfilteredOutput:true}),'');
  const rows=w.ctx.NorthRequestDiagnostics.list('role-a');assert.equal(rows.length,2);assert.equal(rows[0].format,'empty-body');assert.equal(rows[0].state,'empty');assert.equal(rows[0].requestId,'fixture-123');assert.equal(w.calls(),1);
  w.ctx.NorthRequestDiagnostics.finishTurn(audit,'',{delivered:false});assert.equal(rows[1].state,'not-visible');
 });
 test(file+' preserves returns while identifying JSON, SSE and missing fields',async()=>{
  const w=load(file);for(const raw of [true,false])for(const [body,format,expected] of [
   ['data: {"choices":[]}\n\ndata: [DONE]','sse',''],['<html>error</html>','invalid-json',''],[JSON.stringify({output_text:'真实正文'}),'alternate-format',''],[JSON.stringify({choices:[{message:{content:''}}]}),'empty-content',''],[JSON.stringify({choices:[{message:{content:'中文回复'}}]}),'text','中文回复']]){
   w.set(body);assert.equal(await w.ctx.chatAPI([],{diagnosticRoleId:'a',unfilteredOutput:raw}),expected);assert.equal(w.ctx.NorthRequestDiagnostics.list('a')[0].format,format);
  }assert.equal(w.calls(),10);
 });
 test(file+' network, HTTP, storage failure and role/account isolation',async()=>{
  const w=load(file);w.set('',200,'',true);await assert.rejects(w.ctx.chatAPI([],{diagnosticRoleId:'a'}));assert.equal(w.ctx.NorthRequestDiagnostics.list('a')[0].state,'failed');assert(!w.ctx.NorthRequestDiagnostics.report('a').includes('DO_NOT_SHARE_SECRET'));
  w.set('{"error":{"message":"no"}}',429);await assert.rejects(w.ctx.chatAPI([],{diagnosticRoleId:'b'}));assert.equal(w.ctx.NorthRequestDiagnostics.list('b')[0].status,429);assert.equal(w.ctx.NorthRequestDiagnostics.list('a').length,1);
  w.ctx.account='other';assert.equal(w.ctx.NorthRequestDiagnostics.list('a').length,0);w.ctx.account='main';
  const restored=load(file,w.store);assert.equal(restored.ctx.NorthRequestDiagnostics.list('a').length,1);
  w.ctx.localStorage.setItem=()=>{throw Error('quota');};w.set('{"choices":[{"message":{"content":"正常"}}]}');assert.equal(await w.ctx.chatAPI([],{diagnosticRoleId:'a'}),'正常');
 });
 test(file+' stores a start record before network settles and copies no bodies',async()=>{
  const w=load(file);let release;w.ctx.fetchT=()=>new Promise(r=>{release=r;});const p=w.ctx.chatAPI([{role:'user',content:'PRIVATE_PROMPT'}],{diagnosticRoleId:'a'});
  assert.equal(w.ctx.NorthRequestDiagnostics.list('a')[0].state,'sent');release(new Response('{"choices":[{"message":{"content":"私密正文 DO_NOT_SHARE_SECRET"}}]}'));await p;
  const report=w.ctx.NorthRequestDiagnostics.report('a');assert(!report.includes('PRIVATE_PROMPT'));assert(!report.includes('私密正文'));assert(!report.includes('DO_NOT_SHARE_SECRET'));assert.equal(w.ctx.NorthRequestDiagnostics.list('a')[0].state,'returned');
 });
}
test('private diagnostic module is identical and script is loaded before both cores',()=>{
 const p='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';assert.equal(fs.readFileSync(p+'request-diagnostics.js','utf8'),moduleCode);
 for(const f of ['小手机.html',p+'index.html',p+'小手机.html']){const html=fs.readFileSync(f,'utf8');assert(html.indexOf('request-diagnostics.js?')>=0);assert(html.indexOf('request-diagnostics.js?')<html.indexOf('<script src="app.js?'));}
});
