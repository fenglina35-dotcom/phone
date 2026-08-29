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
  const sandbox={S,Date,String,Math,Number,offlineWechatLiveOn:()=>sync,msgs:()=>online,msgToText:m=>m&&m.content||'',previewOf:m=>m&&m.content||'',msgClearTime:m=>+m.time||0,fmtDT:t=>`T${t}`,roleTimeParts:()=>({hour:12,minute:0}),conversationGapQuestion:()=>false,conversationGapFact:()=>null,conversationClaimGapFact:()=>null,conversationComplaintGapFact:()=>null,personaPin:()=>'<persona>',roleReplyClockPin:()=>'<clock>',roleReplyContinuityPin:()=>'<continuity>'};
  const names=['conversationGapExact','clockNumberValue','clockMinuteDistance','roleClockClaimDistance','conversationVisibleRows','roleInteractionRows','roleReplyTimelineRows','roleReplyGapFact','roleReplyTimelinePin','roleReplyCrossChannelHandoff','roleReplyCrossChannelHandoffPrompt','roleReplyRequestPin','roleTimeClaimIssue'];
  vm.runInNewContext(`const ROLE_TIME_TOLERANCE_MINUTES=2;${names.map(functionSource).join('\n')};globalThis.api={rows:roleReplyTimelineRows,gap:roleReplyGapFact,pin:roleReplyTimelinePin,handoff:roleReplyCrossChannelHandoff,handoffPrompt:roleReplyCrossChannelHandoffPrompt,requestPin:roleReplyRequestPin,issue:roleTimeClaimIssue};`,sandbox);
  return {api:sandbox.api,now,online,S};
}

test('returning to WeChat uses the latest cohabitation turn instead of the old WeChat bubble gap',()=>{
  const {api,now}=runtime(true),rows=Array.from(api.rows({id:'role',name:'角色'},10));
  assert.deepEqual(rows.map(x=>x.channel),['online','cohab','cohab','online']);
  assert.match(api.pin({id:'role',name:'角色'}),/刚才在线下说过的重要事情/);
  assert.match(api.pin({id:'role',name:'角色'}),/微信气泡之间即使隔了很多小时/);
  assert.match(api.handoffPrompt({id:'role',name:'角色'},now),/本轮是从线下回到微信后的第一条/);
  assert.match(api.handoffPrompt({id:'role',name:'角色'},now),/我在线下已经回应了/);
  assert.match(api.requestPin({id:'role',name:'角色'},now).content,/禁止第三人称小说旁白/);
  assert.equal(api.gap({id:'role'},now).gap,2*60000);
  assert.match(api.issue('你失联十四个小时了。',{id:'role'},now),/跨渠道互动未满一小时/);
});

test('turning off online-offline sync keeps the original channel isolation',()=>{
  const {api}=runtime(false),rows=Array.from(api.rows({id:'role',name:'角色'},10));
  assert.deepEqual(rows.map(x=>x.channel),['online','online']);
  assert.doesNotMatch(api.pin({id:'role',name:'角色'}),/刚才在线下说过的重要事情/);
  assert.equal(api.handoff({id:'role',name:'角色'}),null);
});

test('cross-channel handoff applies only to the first online return turn',()=>{
  const {api,now,online}=runtime(true),c={id:'role',name:'角色'};
  assert.ok(api.handoff(c,now));
  online.push({id:'w-answer',role:'assistant',type:'text',content:'已经承接线下',time:now+1000});
  online.push({id:'w-next',role:'user',type:'text',content:'继续说',time:now+2000});
  assert.equal(api.handoff(c,now+2000),null);
  assert.doesNotMatch(api.requestPin(c,now+2000).content,/本轮是从线下回到微信后的第一条/);
});

test('newest active live scene wins instead of always preferring a stale one-time date',()=>{
  const now=Date.now(),S={settings:{offlineWechatLive:true},offline:{role:{started:true,startedAt:now-3600000,msgs:[{time:now-3000000}]}},cohabitation:{enabled:true,paused:false,cid:'role',homes:{role:{startedAt:now-7200000,phaseAt:now-120000,msgs:[{time:now-60000}]}}}};
  const sandbox={S,Date,Math};
  const names=['offlineWechatLiveOn','offlineWechatLiveState','cohabWechatState','wechatLiveSceneLastAt','wechatLiveScene'];
  vm.runInNewContext(`${names.map(functionSource).join('\n')};globalThis.api={scene:wechatLiveScene};`,sandbox);
  assert.equal(sandbox.api.scene({id:'role'}).kind,'cohab');
  S.offline.role.msgs.push({time:now+1000});
  assert.equal(sandbox.api.scene({id:'role'}).kind,'offline');
});
