import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const privatePath='../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js';
const privateApp=fs.readFileSync(new URL(privatePath,import.meta.url),'utf8');
const web=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/phone-role-push/index.ts',import.meta.url),'utf8');
const edgeJS=stripTypeScriptTypes(edge.slice(edge.indexOf('\n')+1,edge.indexOf('Deno.serve(')),{mode:'strip'});
const screenshot='I cannot fulfill this request. I am programmed to be a helpful and harmless AI assistant. My safety guidelines strictly prohibit the generation of sexually explicit content, non-consensual sexual themes, or material that involves graphic sexual violence and BDSM roleplay. Therefore, I cannot adopt this persona or generate the requested dialogue.';
function worker(raw,on,privateGuard,metadata={}){
 let calls=0;
 const ctx={console,URL,Date,Intl,AbortController,setTimeout,clearTimeout,Deno:{env:{get:()=>''}},fetch:async()=>{calls++;return{ok:true,json:async()=>({choices:[{message:{content:raw,...metadata.message},finish_reason:metadata.finishReason}]})};}};
 vm.createContext(ctx);vm.runInContext(edgeJS,ctx);
 return {ctx,calls:()=>calls,profile:{role_name:'A',user_name:'用户',message_min:1,message_max:4,automation_config:{privateBackgroundModelErrorGuard:privateGuard,modelOutputUnfiltered:on,modelRoute:{base:'https://model.example.test/v1',key:'fixture',model:'fixture'},conversationBoundary:{hasUser:true,answered:true,userText:'吃好了',assistantMessages:['好。']}}}};
}
function client(on,app=privateApp){
 const names=['privateBackgroundModelRefusal','roleServerPushUnsafeBody','roleServerPushCallKind','roleServerPushVisibleBody','roleServerPushParts'];
 const ctx={modelOutputUnfiltered:()=>on,wechatReasoningLeak:()=>false,modelUnfilteredLines:t=>t.split('\n'),roleServerPushActionTag:()=>false,modelUnfilteredThoughtTags:x=>x,modelUnfilteredMessages:t=>[{type:'text',content:t}]};
 vm.createContext(ctx);
 for(const name of names){const line=app.split(/\r?\n/).find(x=>x.startsWith('function '+name+'('));if(line)vm.runInContext(line,ctx);}
 return ctx;
}
for(const on of [false,true]){
 test(`private background rejects screenshot as model error without retry, raw=${on}`,async()=>{
  const w=worker(screenshot,on,true);const out=await w.ctx.roleMessage(w.profile,[],'','',true,true);
  assert.equal(out.kind,'unavailable');assert.equal(out.reason,'private-model-refusal');assert.equal(out.body,'');assert.equal(w.calls(),1);
 });
 test(`private receipt rejects screenshot before body, call or action parsing, raw=${on}`,()=>{
  const ctx=client(on);assert.equal(ctx.roleServerPushUnsafeBody(screenshot),true);
  assert.equal(ctx.roleServerPushVisibleBody(screenshot),'');
  assert.equal(ctx.roleServerPushCallKind(screenshot+'\n[来电|语音]'),'');
  assert.deepEqual(Array.from(ctx.roleServerPushParts({msgMax:4},screenshot)),[]);
 });
}
test('web raw behavior is unchanged and does not enable the private server flag',async()=>{
 assert(!web.includes('privateBackgroundModelErrorGuard'));assert(!web.includes('privateBackgroundModelRefusal'));
 const w=worker(screenshot,true,false);const out=await w.ctx.roleMessage(w.profile,[],'','',true,true);
 assert.equal(out.kind,'message');assert.equal(out.body,screenshot);assert.equal(w.calls(),1);
 assert.equal(client(true,web).roleServerPushVisibleBody(screenshot),screenshot);
});
test('private guard preserves role boundaries, ordinary AI discussion, quotes and valid actions',async()=>{
 const w=worker('',true,true),detect=w.ctx.privateBackgroundModelRefusal;
 for(const text of ['我不同意。','我不愿意继续，我们换个话题。','I cannot adopt that dog.','I am an AI engineer.','今天看到一个 AI 助手，它会说“安全准则”。','他说：“作为 AI 助手，我不能满足请求。”','[图片|窗边一杯茶]','[来电|语音]','[送礼|热茶|10|暖暖手]'])assert.equal(detect(text),false,text);
 for(const text of [screenshot,'As an AI assistant, I cannot fulfill this request.','抱歉，作为一个AI助手，我无法满足这个请求。','我是一名人工智能助手，安全准则不允许我扮演这个角色。'])assert.equal(detect(text),true,text);
 const normal=worker('我不愿意继续，我们换个话题。',true,true);
 assert.equal((await normal.ctx.roleMessage(normal.profile,[],'','',true,true)).body,'我不愿意继续，我们换个话题。');
});
test('private backend honors explicit provider refusal metadata even without refusal prose',async()=>{
 for(const metadata of [{finishReason:'content_filter'},{message:{refusal:'Declined'}}]){
  const w=worker('partial content',true,true,metadata),out=await w.ctx.roleMessage(w.profile,[],'','',true,true);
  assert.equal(out.kind,'unavailable');assert.equal(out.reason,'private-model-refusal');assert.equal(w.calls(),1);
 }
});
