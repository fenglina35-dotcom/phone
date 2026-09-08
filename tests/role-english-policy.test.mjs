import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const paths=['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'];
function extract(src,name){const start=src.search(new RegExp('^(?:async )?function '+name+'\\(','m'));if(start<0)return '';const end=src.slice(start+1).search(/^(?:(?:async )?function |(?:const|let|var) |\/\*)/m);return src.slice(start,end<0?undefined:start+1+end);}
for(const path of paths){
 const src=fs.readFileSync(path,'utf8');
 function harness(){const ctx={Error,String,JSON,Array,Object,chatAPI:async()=>{throw Error('unexpected request');},joinAIContinuation:(a,b)=>a+b};vm.createContext(ctx);vm.runInContext(['roleReplyEnglishOnly','roleReplyAssertLanguage','roleThoughtFormatPrompt','chatResultText'].map(n=>extract(src,n)).join('\n'),ctx);return ctx;}
 test(path+' blocks English-only role replies with raw output on and off',async()=>{const ctx=harness();for(const on of [false,true])for(const body of ['Hello.','[内心|我很想你]\nI miss you.','[心情|开心]\n[语音|Good night.]'])await assert.rejects(ctx.chatResultText([],{roleReplyLanguageGuard:true,unfilteredOutput:on},{choices:[{message:{content:body},finish_reason:'stop'}]}),e=>e.code==='ROLE_ENGLISH_ONLY');});
 test(path+' keeps Chinese translations, empty responses and unrelated model uses unchanged',async()=>{const ctx=harness();for(const on of [false,true])for(const body of ['', '我在。','I miss you.\n我想你。','[语音|Good night.|晚安。]'])assert.equal(await ctx.chatResultText([],{roleReplyLanguageGuard:true,unfilteredOutput:on},{choices:[{message:{content:body}}]}),body);assert.equal(await ctx.chatResultText([],{unfilteredOutput:true},{choices:[{message:{content:'English image prompt'}}]}),'English image prompt');});
 test(path+' detects visible English rather than Chinese metadata or JSON field names',()=>{const ctx=harness();assert.equal(typeof ctx.roleReplyEnglishOnly,'function');for(const value of ['OK','[记住|明天约会]\nGood night.',JSON.stringify({bubbles:[{type:'speak',text:'Good night.'}],leave:false}),JSON.stringify({body:'Hello',mood:'开心'})])assert.equal(ctx.roleReplyEnglishOnly(value),true,value);for(const value of ['[内心|想你]','[发推|Hello]','12345','❤️','こんにちは','Hello，晚上好',JSON.stringify({bubbles:[{type:'speak',text:'Hello.\n你好。'}],leave:false})])assert.equal(ctx.roleReplyEnglishOnly(value),false,value);assert.match(ctx.roleThoughtFormatPrompt(),/半角/);assert.match(ctx.roleThoughtFormatPrompt(),/单独一行/);});
}

const edge=fs.readFileSync('supabase/functions/phone-role-push/index.ts','utf8');
const edgeJS=stripTypeScriptTypes(edge.slice(edge.indexOf('\n')+1,edge.indexOf('Deno.serve(')),{mode:'strip'});
test('background blocks English before delivery in both modes while keeping translations and the time-off boundary',async()=>{
 for(const on of [false,true])for(const raw of ['Good night.','[内心|想你]\n[送礼|热茶|10|暖暖手]\nGood night.','<think>English only.</think>','Good night.\n晚安。']){
  let calls=0,request;
  const ctx={console,URL,Date,Intl,AbortController,setTimeout,clearTimeout,Deno:{env:{get:()=>''}},fetch:async(url,opt)=>{calls++;request=JSON.parse(opt.body);return{ok:true,json:async()=>({choices:[{message:{content:raw},finish_reason:'stop'}]})};}};
  vm.createContext(ctx);vm.runInContext(edgeJS,ctx);
  const p={role_name:'A',user_name:'用户',time_aware:false,message_min:1,message_max:4,automation_config:{modelOutputUnfiltered:on,modelRoute:{base:'https://fixture.invalid/v1',key:'fixture',model:'fixture'},conversationBoundary:{hasUser:true,answered:true,userText:'吃好了',assistantMessages:['好。']}}};
  const out=await ctx.roleMessage(p,[],'','',true,true);
  if(raw.includes('晚安。'))assert.equal(out.kind,'message');else {assert.equal(out.kind,'unavailable');assert.equal(out.reason,'english-only-output');assert.equal(out.body,'');assert.equal(calls,1);}
  assert.match(JSON.stringify(request),/心情标签格式检查/);
  assert.doesNotMatch(JSON.stringify(request),/当地时间：/);
  assert.match(JSON.stringify(request),/用户称呼：用户/);
 }
});
test('hidden Chinese action metadata cannot masquerade as an English reply translation',()=>{
 const ctx={};vm.createContext(ctx);vm.runInContext(extract(fs.readFileSync('app.js','utf8'),'roleReplyEnglishOnly'),ctx);
 for(const text of ['[送礼|热茶|10|暖暖手]\nHello.','[改备注|宝贝]\nHello.','[语音|Hello.]','<think>English only.</think>','<think>中文推理</think>\nHello.'])assert.equal(ctx.roleReplyEnglishOnly(text),true,text);
 assert.equal(ctx.roleReplyEnglishOnly('[语音|Hello.|你好。]'),false);
});
