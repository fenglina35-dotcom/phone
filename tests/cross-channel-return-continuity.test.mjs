import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

function runtime(sync=true){
  const now=Date.now(),online=[
    {id:'w-old',role:'assistant',type:'text',content:'十四小时前的微信',time:now-14*3600000},
    {id:'w-now',role:'user',type:'text',content:'我回微信了',time:now}
  ];
  const S={settings:{timeAware:true},me:{name:'用户'},cohabitation:{homes:{role:{msgs:[
    {id:'c-user',who:'me',text:'刚才在线下说过的重要事情',time:now-3*60000},
    {id:'c-role',who:'ta',text:'我在线下已经回应了',time:now-2*60000}
  ]}}}};
  const sandbox={S,Date,String,Math,Number,offlineWechatLiveOn:()=>sync,msgs:()=>online,msgToText:m=>m&&m.content||'',previewOf:m=>m&&m.content||'',msgClearTime:m=>+m.time||0,fmtDT:t=>`T${t}`,roleTimeParts:()=>({hour:12,minute:0}),conversationGapQuestion:()=>false,conversationGapFact:()=>null,conversationClaimGapFact:()=>null,conversationComplaintGapFact:()=>null};
  const names=['conversationGapExact','clockNumberValue','clockMinuteDistance','roleClockClaimDistance','conversationVisibleRows','roleInteractionRows','roleReplyTimelineRows','roleReplyGapFact','roleReplyTimelinePin','roleTimeClaimIssue'];
  vm.runInNewContext(`const ROLE_TIME_TOLERANCE_MINUTES=2;${names.map(functionSource).join('\n')};globalThis.api={rows:roleReplyTimelineRows,gap:roleReplyGapFact,pin:roleReplyTimelinePin,issue:roleTimeClaimIssue};`,sandbox);
  return {api:sandbox.api,now};
}

test('returning to WeChat uses the latest cohabitation turn instead of the old WeChat bubble gap',()=>{
  const {api,now}=runtime(true),rows=Array.from(api.rows({id:'role',name:'角色'},10));
  assert.deepEqual(rows.map(x=>x.channel),['online','cohab','cohab','online']);
  assert.match(api.pin({id:'role',name:'角色'}),/刚才在线下说过的重要事情/);
  assert.match(api.pin({id:'role',name:'角色'}),/微信气泡之间即使隔了很多小时/);
  assert.equal(api.gap({id:'role'},now).gap,2*60000);
  assert.match(api.issue('你失联十四个小时了。',{id:'role'},now),/跨渠道互动未满一小时/);
});

test('turning off online-offline sync keeps the original channel isolation',()=>{
  const {api}=runtime(false),rows=Array.from(api.rows({id:'role',name:'角色'},10));
  assert.deepEqual(rows.map(x=>x.channel),['online','online']);
  assert.doesNotMatch(api.pin({id:'role',name:'角色'}),/刚才在线下说过的重要事情/);
});
