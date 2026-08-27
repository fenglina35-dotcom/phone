import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

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
    summaryStateSave:(c,aid,upto)=>(c._accountSummaryState.main={count:upto,cursorV2:true}),
    pruneSummaries:()=>{},save:()=>{saves++;},msgToText:m=>m.content||'',summaryUserLabel:()=> '用户',
    summaryCleanText:(c,t)=>t,perspRule:()=>'',IMP_INSTR:'',cleanReply:x=>x,
    rateAndText:x=>({text:x,imp:4}),trimSentence:x=>x,
    addSummary:(c,text,imp)=>{c.summaries.push({text,imp});return true;},
    chatAPI:async()=>{apiCalls++;await new Promise(r=>setTimeout(r,15));return '我记得用户很喜欢草莓蛋糕，这是一项值得长期记住的口味偏好；用户还和我认真约好周六一起去公园，这是我们刚刚共同确认的安排。我会按约定赴约，也会在以后选择甜点时优先想到草莓蛋糕。';},
  });
  vm.runInContext('this.maybeSummarize='+functionSource('maybeSummarize'),sandbox);
  const first=sandbox.maybeSummarize('c1','main');
  const duplicate=await sandbox.maybeSummarize('c1','main');
  assert.equal(duplicate,false);
  assert.equal(await first,true);
  assert.equal(apiCalls,1);
  assert.equal(contact._accountSummaryState.main.count,4);
  assert.equal(contact.summaries.length,1);
  assert.ok(saves>0);
  rows.push({role:'user',type:'text',content:'今天有点累'},{role:'assistant',type:'text',content:'早点休息'});
  assert.equal(await sandbox.maybeSummarize('c1','main'),false,'one new user round is below the configured two-round threshold');
  assert.equal(apiCalls,1);
});
