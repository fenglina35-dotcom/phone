import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const privateSource=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'),'utf8');

function functionSourceFrom(text,name){
  const start=text.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`${name} must exist`);
  const brace=text.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(escaped)escaped=false;
      else if(ch==='\\')escaped=true;
      else if(ch===quote)quote='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return text.slice(start,i+1);
  }
  throw new Error(`${name} is incomplete`);
}
const functionSource=name=>functionSourceFrom(source,name);

test('online recall settings are explicit, bounded and described by effect',()=>{
  const ctx=vm.createContext({S:{settings:{}}});
  vm.runInContext(functionSource('onlineMemoryRecallLimits'),ctx);
  assert.deepEqual({...ctx.onlineMemoryRecallLimits()},{memory:4,summary:4,total:6});
  ctx.S.settings={onlineMemoryRecall:99,onlineSummaryRecall:-4,onlineRecallTotal:99};
  assert.deepEqual({...ctx.onlineMemoryRecallLimits()},{memory:8,summary:0,total:12});
  for(const text of ['线上微信 · 每轮记忆引用','长期记忆引用上限','对话总结引用上限','每轮记忆合计上限','不会删除已经保存的内容','称呼、禁忌与关系底线始终保留'])assert.match(source,new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('normal online retrieval enforces separate memory and summary quotas under one total',()=>{
  const memories=[10,9,8,7].map(n=>({text:`${n}:memory`}));
  const summaries=[12,11,6].map(n=>({text:`${n}:summary`,imp:3,ts:n}));
  const c={id:'role'};
  const ctx=vm.createContext({
    Date,
    S:{settings:{},me:{name:'me'},couple:null},
    memoryScopeKey:()=> 'main',
    memoryMetaStore:()=> ({}),
    memoryList:()=> memories,
    memoryText:v=>String(v.text||v),
    memoryNorm:v=>String(v.text||v),
    summaryList:()=> summaries,
    summaryCleanText:(_c,text)=>text,
    aiMemoryExternalItems:()=> [],
    memoryItemScore:item=>Number(String(item.text).split(':')[0]),
    isLover:()=>false,
    lifeNotes:undefined,
    behaviorStore:()=>null,
    behaviorOn:()=>false,
  });
  vm.runInContext(functionSource('selectRelevantMemory'),ctx);
  let picked=ctx.selectRelevantMemory(c,'topic',3,{memory:2,summary:1,total:3}).items;
  assert.deepEqual(Array.from(picked,x=>x.text),['12:summary','10:memory','9:memory']);
  picked=ctx.selectRelevantMemory(c,'topic',4,{memory:4,summary:0,total:4}).items;
  assert.deepEqual(Array.from(picked,x=>x.text),['10:memory','9:memory','8:memory','7:memory']);
  picked=ctx.selectRelevantMemory(c,'topic',0,{memory:8,summary:8,total:0}).items;
  assert.equal(picked.length,0);
});

test('deleting one offline memory restores the modal scroll position',async()=>{
  const sheet={scrollTop:438,scrollHeight:1500,clientHeight:500};
  const ctx=vm.createContext({
    document:{getElementById:id=>id==='modalSheet'?sheet:null},
    requestAnimationFrame:fn=>fn(),
    Number,
    offData:()=>({memory:[{id:'m1'}]}),
    uiConfirm:async()=>true,
    offMemoryRemoveAt:()=>true,
    save:()=>{},
    toast:()=>{},
    restored:null,
  });
  vm.runInContext(functionSource('offMemoryScrollTop'),ctx);
  vm.runInContext(functionSource('offMemoryRestoreScroll'),ctx);
  ctx.offMemory=(_id,opt)=>{ctx.restored=opt;};
  vm.runInContext('async '+functionSource('offDelMemory'),ctx);
  await ctx.offDelMemory('role',0);
  assert.deepEqual({...ctx.restored},{top:438});
  sheet.scrollTop=0;
  ctx.offMemoryRestoreScroll(1200);
  assert.equal(sheet.scrollTop,1000,'restoration clamps to the new shorter list');
});

test('private v1319 inherits the complete web v1274 memory controls and scroll repair',()=>{
  for(const name of ['onlineMemoryRecallLimits','onlineMemoryRecallSet','selectRelevantMemory','offMemoryScrollTop','offMemoryRestoreScroll','offDelMemory']){
    assert.equal(functionSourceFrom(privateSource,name).replace(/\r\n/g,'\n'),functionSource(name).replace(/\r\n/g,'\n'),`${name} must stay identical in web and private bundles`);
  }
  for(const text of ['线上微信 · 每轮记忆引用','长期记忆引用上限','对话总结引用上限','每轮记忆合计上限']){
    assert.ok(privateSource.includes(text),`private settings are missing ${text}`);
  }
  assert.match(privateSource,/_memLimits=onlineMemoryRecallLimits\(\),_memCtx=selectRelevantMemory\(c,_memQuery,_memLimits\.total,_memLimits\)/);
});
