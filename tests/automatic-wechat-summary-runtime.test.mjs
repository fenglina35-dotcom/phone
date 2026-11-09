import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {read, fnSource, BUNDLES} from './_helpers.mjs';

for(const [label,file] of BUNDLES)test(label+': automatic summary makes no model request when the covered message range cannot be recovered',async()=>{
 const role={id:'r',name:'角色',summaries:[],_accountSummaryState:{main:{count:3,cursorV2:true,lastMessageId:'gone'}}},rows=[{id:'a',role:'user',type:'text',content:'原来已经总结过'},{id:'b',role:'assistant',type:'text',content:'旧回复'}];let api=0;
 const x=vm.createContext({Set,Array,String,Number,Date,Math,S:{settings:{summaryRounds:1}},memoryScopeKey:v=>v||'main',getC:()=>role,msgsForAccount:()=>rows,summaryList:()=>role.summaries,save(){},summaryCompletedRounds:()=>1,msgToText:m=>m.content,summaryUserLabel:()=> '我',wechatSummarySystem:()=>'',IMP_INSTR:'',perspRule:()=>'',chatAPI:async()=>{api++;return '';}});
 for(const n of ['summaryState','summaryStateSave','summaryStateDone','maybeSummarize'])vm.runInContext(fnSource(read(file),n),x);
 assert.equal(await x.maybeSummarize('r','main'),false);assert.equal(api,0);assert.equal(role._accountSummaryState.main.cursorUncertain,true);
});

const source=read('app.js');

function functionSource(name){
  const fnStart=source.indexOf('function '+name+'(');
  assert.ok(fnStart>=0,'missing '+name);
  const start=source.slice(Math.max(0,fnStart-6),fnStart)==='async '?fnStart-6:fnStart;
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

test('automatic summary fires at the configured number of user rounds, saves its cursor, and cannot duplicate in flight',async()=>{
  const contact={id:'c1',name:'角色',summaries:[],_accountSummaryState:{main:{count:0,cursorV2:true}}};
  const rows=[
    {role:'user',type:'text',content:'我喜欢草莓蛋糕'},
    {role:'assistant',type:'text',content:'我记住了'},
    {role:'user',type:'text',content:'周六一起去公园'},
    {role:'assistant',type:'text',content:'好，周六见'},
  ];
  let apiCalls=0,saves=0;
  const sandbox=vm.createContext({
    Set,Math,Number,String,Array,Date,Promise,
    S:{settings:{summaryRounds:2,summaryModel:'main'}},
    getC:()=>contact,memoryScopeKey:a=>a||'main',msgsForAccount:()=>rows,
    summaryList:c=>c.summaries,summaryState:c=>c._accountSummaryState.main,
    summaryStateDone:(c,aid,all)=>Math.max(0,Math.min(all.length,+c._accountSummaryState.main.count||0)),
    summaryStateSave:(c,aid,upto)=>(c._accountSummaryState.main={count:upto,cursorV2:true}),
    pruneSummaries:()=>{},save:()=>{saves++;},msgToText:m=>m.content||'',summaryUserLabel:()=> '用户',
    summaryCleanText:(c,t)=>t,perspRule:()=>'',IMP_INSTR:'',cleanReply:x=>x,
    rateAndText:x=>({text:x,imp:4}),trimSentence:x=>x,
    summaryPerspectiveValid:()=>true,wechatSummarySystem:()=>'',
    summaryStoreResult:(c,text,imp)=>{c.summaries.push({text,imp});return'added';},
    chatAPI:async()=>{apiCalls++;await new Promise(r=>setTimeout(r,15));return '我记得用户很喜欢草莓蛋糕，这是一项值得长期记住的口味偏好；用户还和我认真约好周六一起去公园，这是我们刚刚共同确认的安排。我会按约定赴约，也会在以后选择甜点时优先想到草莓蛋糕。';},
  });
  vm.runInContext('this.summaryCompletedRounds='+functionSource('summaryCompletedRounds'),sandbox);
  vm.runInContext('this.maybeSummarize='+functionSource('maybeSummarize'),sandbox);
  const first=sandbox.maybeSummarize('c1','main');
  const duplicate=await sandbox.maybeSummarize('c1','main');
  assert.equal(duplicate,false);
  rows.push({role:'user',type:'text',content:'请求期间新发的话'},{role:'assistant',type:'text',content:'这轮还没有整理'});
  assert.equal(await first,true);
  assert.equal(apiCalls,1);
  assert.equal(contact._accountSummaryState.main.count,4);
  assert.equal(contact.summaries.length,1);
  assert.ok(saves>0);
  assert.equal(await sandbox.maybeSummarize('c1','main'),false,'one new user round is below the configured two-round threshold');
  assert.equal(apiCalls,1);
  rows.push({role:'user',type:'text',content:'今天有点累'},{role:'assistant',type:'text',content:'早点休息'});
  assert.equal(await sandbox.maybeSummarize('c1','main'),true);assert.equal(apiCalls,2);assert.equal(contact._accountSummaryState.main.count,8);
});

for(const [label,file] of BUNDLES)test(label+': manual and automatic summaries share the occupied role/account range',async()=>{
 const code=read(file),key='r#main';let reads=0;
 const x=vm.createContext({Set,Math,Number,String,Array,Date,S:{settings:{summaryRounds:1}},memoryScopeKey:v=>v||'main',getC:()=>({id:'r'}),_manualWechatSummaryBusy:new Set([key]),msgsForAccount:()=>{reads++;return[];},manualWechatSummarySource:()=>{reads++;return null;},toast(){}});
 vm.runInContext(fnSource(code,'maybeSummarize'),x);assert.equal(await x.maybeSummarize('r','main'),false);assert.equal(reads,0,'automatic must not reread a range occupied by manual summary');
 x._manualWechatSummaryBusy.clear();x.maybeSummarize._busy=new Set([key]);vm.runInContext(fnSource(code,'manualWechatSummary'),x);assert.equal(await x.manualWechatSummary('r'),false);assert.equal(reads,0,'manual must not reread a range occupied by automatic summary');
});

test('summary interval counts completed exchanges rather than each consecutive user bubble',()=>{
  const sandbox=vm.createContext({});
  vm.runInContext('this.summaryCompletedRounds='+functionSource('summaryCompletedRounds'),sandbox);
  const rows=[
    {role:'user',type:'text',content:'第一条'},
    {role:'user',type:'text',content:'补充一句'},
    {role:'assistant',type:'text',content:'一起回复'},
    {role:'user',type:'text',content:'下一轮'},
  ];
  sandbox.msgToText=m=>m.content||'';
  assert.equal(sandbox.summaryCompletedRounds(rows),1);
  rows.push({role:'assistant',type:'text',content:'第二轮回复'});
  assert.equal(sandbox.summaryCompletedRounds(rows),2);
});
