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
  const S={settings:{timeAware:true},me:{name:'用户'},cohabitation:{enabled:true,paused:false,cid:'role',homes:{role:{msgs:[
    {id:'c-user',who:'me',text:'刚才在线下说过的重要事情',time:now-3*60000},
    {id:'c-role',who:'ta',text:'我在线下已经回应了',time:now-2*60000}
  ]}}}};
  const sandbox={S,Date,String,Math,Number,offlineWechatLiveOn:()=>sync,msgs:()=>online,msgToText:m=>m&&m.content||'',previewOf:m=>m&&m.content||'',msgClearTime:m=>+m.time||0,fmtDT:t=>`T${t}`,roleTimeParts:()=>({hour:12,minute:0}),conversationGapQuestion:()=>false,conversationGapFact:()=>null,conversationClaimGapFact:()=>null,conversationComplaintGapFact:()=>null,personaPin:()=>'<persona>',roleReplyClockPin:()=>'<clock>',roleReplyContinuityPin:()=>'<continuity>'};
  const names=['conversationGapExact','clockNumberValue','clockMinuteDistance','roleClockClaimDistance','conversationVisibleRows','cohabCrossChannelOn','roleCrossChannelOn','roleRecentChannelRounds','roleInteractionRows','roleReplyTimelineRows','roleReplyGapFact','roleReplyTimelinePin','roleReplyContinuityPin','roleReplyCrossChannelHandoff','roleReplyOnlineHistorySource','roleReplyCrossChannelHandoffPrompt','roleReplyRequestPin','roleTimeClaimIssue'];
  vm.runInNewContext(`const ROLE_TIME_TOLERANCE_MINUTES=2;${names.map(functionSource).join('\n')};globalThis.api={rows:roleReplyTimelineRows,gap:roleReplyGapFact,pin:roleReplyTimelinePin,handoff:roleReplyCrossChannelHandoff,history:roleReplyOnlineHistorySource,handoffPrompt:roleReplyCrossChannelHandoffPrompt,requestPin:roleReplyRequestPin,issue:roleTimeClaimIssue};`,sandbox);
  return {api:sandbox.api,now,online,S};
}

test('returning to WeChat uses the latest cohabitation turn instead of the old WeChat bubble gap',()=>{
  const {api,now,online}=runtime(true),rows=Array.from(api.rows({id:'role',name:'角色'},10));
  assert.deepEqual(rows.map(x=>x.channel),['online','cohab','cohab','online']);
  assert.match(api.pin({id:'role',name:'角色'}),/刚才在线下说过的重要事情/);
  assert.match(api.pin({id:'role',name:'角色'}),/微信气泡之间即使隔了很多小时/);
  assert.match(api.handoffPrompt({id:'role',name:'角色'},now),/本轮是从线下回到微信后的第一条/);
  assert.match(api.handoffPrompt({id:'role',name:'角色'},now),/我在线下已经回应了/);
  assert.deepEqual(Array.from(api.history({id:'role',name:'角色'},online,now),x=>x.content),['我回微信了'],'the stale online thread must not compete with the completed common-life turn during the handoff request');
  assert.match(api.requestPin({id:'role',name:'角色'},now).content,/禁止第三人称小说旁白/);
  assert.equal(api.gap({id:'role'},now).gap,2*60000);
  assert.match(api.issue('你失联十四个小时了。',{id:'role'},now),/跨渠道互动未满一小时/);
});

test('turning off one-time date sync does not split active common life from WeChat',()=>{
  const {api}=runtime(false),rows=Array.from(api.rows({id:'role',name:'角色'},10));
  assert.deepEqual(rows.map(x=>x.channel),['online','cohab','cohab','online']);
  assert.match(api.pin({id:'role',name:'角色'}),/刚才在线下说过的重要事情/);
  assert.ok(api.handoff({id:'role',name:'角色'}));
});

test('cross-channel handoff applies only to the first online return turn',()=>{
  const {api,now,online}=runtime(true),c={id:'role',name:'角色'};
  assert.ok(api.handoff(c,now));
  online.push({id:'w-answer',role:'assistant',type:'text',content:'已经承接线下',time:now+1000});
  online.push({id:'w-next',role:'user',type:'text',content:'继续说',time:now+2000});
  assert.equal(api.handoff(c,now+2000),null);
  assert.deepEqual(Array.from(api.history(c,online,now+2000),x=>x.content),online.map(x=>x.content),'ordinary online history resumes immediately after the first handoff reply');
  assert.doesNotMatch(api.requestPin(c,now+2000).content,/本轮是从线下回到微信后的第一条/);
});

test('an online proactive role message cannot erase the users latest common-life channel',()=>{
  const {api,now,online,S}=runtime(true),c={id:'role',name:'角色'};
  online.splice(1,0,{id:'w-proactive',role:'assistant',type:'text',content:'共同生活期间到达的后台消息',time:now-30000});
  const handoff=api.handoff(c,now);
  assert.ok(handoff,'the handoff follows the latest user channel instead of the latest role bubble channel');
  assert.equal(handoff.previousUser.channel,'cohab');
  assert.match(api.handoffPrompt(c,now),/刚才在线下说过的重要事情/);
  assert.deepEqual(Array.from(api.history(c,online,now),x=>x.content),['我回微信了'],'the unrelated proactive bubble is removed from the first return request');
  assert.ok(S.cohabitation.homes.role.msgs.length);
});

test('a long common-life reply cannot push the user action out of the online handoff',()=>{
  const now=Date.now(),online=[
    {id:'w-old',role:'assistant',type:'text',content:'旧微信话题',time:now-3600000},
    {id:'w-now',role:'user',type:'text',content:'我回线上了',time:now}
  ],cohab=[{id:'c-user',who:'me',text:'我们刚刚已经一起把晚饭吃完了',time:now-120000}];
  for(let i=0;i<20;i++)cohab.push({id:`c-role-${i}`,who:i%2?'ta':'旁白',source:'ta',text:`线下承接第${i+1}段`,time:now-119000+i});
  const S={settings:{timeAware:true},me:{name:'用户'},cohabitation:{homes:{role:{msgs:cohab}}}},sandbox={
    S,Date,String,Math,Number,Set,offlineWechatLiveOn:()=>true,roleCrossChannelOn:()=>true,msgs:()=>online,msgToText:m=>m&&m.content||'',msgClearTime:m=>+m.time||0,fmtDT:t=>`T${t}`,
    personaPin:()=>'',roleReplyClockPin:()=>'',roleReplyTimelinePin:()=>''
  };
  const names=['roleRecentChannelRounds','roleInteractionRows','roleReplyContinuityPin','roleReplyCrossChannelHandoff','roleReplyCrossChannelHandoffPrompt','roleReplyRequestPin'];
  vm.runInNewContext(`${names.map(functionSource).join('\n')};globalThis.api={handoff:roleReplyCrossChannelHandoff,prompt:roleReplyCrossChannelHandoffPrompt,pin:roleReplyRequestPin};`,sandbox);
  const handoff=sandbox.api.handoff({id:'role',name:'角色'},now);
  assert.equal(handoff.between[0].text,'我们刚刚已经一起把晚饭吃完了','the first user fact of the completed scene round must survive even when the role emitted many bubbles');
  assert.match(sandbox.api.prompt({id:'role',name:'角色'},now),/我们刚刚已经一起把晚饭吃完了/);
  assert.match(sandbox.api.pin({id:'role',name:'角色'},now).content,/我们刚刚已经一起把晚饭吃完了/);
});

test('legacy common-life rows without timestamps still enter the online handoff in stored order',()=>{
  const {api,now,S}=runtime(false),c={id:'role',name:'角色'};
  delete S.cohabitation.homes.role.msgs[0].time;
  delete S.cohabitation.homes.role.msgs[1].time;
  S.cohabitation.homes.role.startedAt=now-5*60000;
  const handoff=api.handoff(c,now);
  assert.ok(handoff);
  assert.deepEqual(Array.from(handoff.between,x=>x.text),['刚才在线下说过的重要事情','我在线下已经回应了']);
});

test('a slightly later common-life clock sample does not hide the current online return turn',()=>{
  const {api,now,S}=runtime(false),c={id:'role',name:'角色'};
  S.cohabitation.homes.role.msgs.push({id:'c-late',who:'ta',text:'线下收尾句',time:now+500});
  const handoff=api.handoff(c,now+1000);
  assert.ok(handoff);
  assert.match(api.handoffPrompt(c,now+1000),/刚才在线下说过的重要事情/);
});

test('the latest complete common-life round remains an internal fact after the first online reply',()=>{
  const {api,now,online}=runtime(true),c={id:'role',name:'角色'};
  online.push({id:'w-answer',role:'assistant',type:'text',content:'已经接住线下',time:now+1000});
  online.push({id:'w-next',role:'user',type:'text',content:'那继续说',time:now+2000});
  const pin=api.requestPin(c,now+2000).content;
  assert.doesNotMatch(pin,/本轮是从线下回到微信后的第一条/);
  assert.match(pin,/刚才在线下说过的重要事情/,'later online turns must retain the latest full scene round instead of falling back to the old online thread');
  assert.match(pin,/我在线下已经回应了/);
});

test('newest active live scene wins instead of always preferring a stale one-time date',()=>{
  const now=Date.now(),S={settings:{offlineWechatLive:true},offline:{role:{started:true,startedAt:now-3600000,msgs:[{time:now-3000000}]}},cohabitation:{enabled:true,paused:false,cid:'role',homes:{role:{startedAt:now-7200000,phaseAt:now-120000,msgs:[{time:now-60000}]}}}};
  const sandbox={S,Date,Math};
  const names=['offlineWechatLiveOn','offlineWechatLiveState','cohabWechatState','wechatLiveSceneLastAt','wechatLiveScene'];
  vm.runInNewContext(`${names.map(functionSource).join('\n')};globalThis.api={scene:wechatLiveScene};`,sandbox);
  assert.equal(sandbox.api.scene({id:'role'}).kind,'cohab');
  S.offline.role.msgs.push({time:now+1000});
  assert.equal(sandbox.api.scene({id:'role'}).kind,'offline');
  S.settings.offlineWechatLive=false;
  assert.equal(sandbox.api.scene({id:'role'}).kind,'cohab','disabling one-time date sync must never hide active common life from WeChat');
});

test('the final online model request carries the complete latest common-life round after the current user bubble',()=>{
  const now=Date.now(),c={id:'role',name:'先生'},online=[
    {id:'w-old',role:'assistant',type:'text',content:'旧微信话题',time:now-3600000},
    {id:'w-now',role:'user',type:'text',content:'我回到微信了，刚才那件事呢？',time:now}
  ],home={startedAt:now-7200000,phaseAt:now-600000,msgs:[
    {id:'c-user',who:'me',text:'我当面说我们把旅行行李收好了',time:now-120000},
    {id:'c-nar',who:'旁白',source:'ta',text:'他把最后一件外套放进行李箱。',time:now-119000},
    {id:'c-role',who:'ta',text:'那明天就直接出发。',time:now-118000}
  ]},S={settings:{offlineWechatLive:false,timeAware:true},me:{name:'用户'},cohabitation:{enabled:true,paused:false,cid:'role',homes:{role:home}},offline:{}},sandbox={
    S,Date,String,Math,Number,Set,msgs:()=>online,msgToText:m=>m&&m.content||'',msgClearTime:m=>+m.time||0,fmtDT:t=>`T${t}`,
    roleReplyClockPin:()=>'<clock>',roleReplyTimelinePin:()=>'<timeline>',roleReplyContinuityPin:()=>'<continuity>',personaPin:()=>'<persona>',
    roleSchedulePrompt:()=>'',cohabMemoryPrompt:()=>'',cohabTripContext:()=>'',cohabStatusLabel:()=>'在家',cohabPhaseFact:()=>'',cohabTimeContext:()=>'',cohabContextLimit:()=>30
  };
  const names=['offlineWechatLiveOn','cohabCrossChannelOn','roleCrossChannelOn','offlineWechatLiveState','cohabWechatState','wechatLiveSceneLastAt','wechatLiveScene','cohabRecentContext','cohabWechatPrompt','roleRecentChannelRounds','roleInteractionRows','roleReplyCrossChannelHandoff','roleReplyCrossChannelHandoffPrompt','roleReplyRequestPin'];
  vm.runInNewContext(`${names.map(functionSource).join('\n')};globalThis.make=(c,now)=>{const live=wechatLiveScene(c),sys=cohabWechatPrompt(c,live.data),hist=[{role:'user',content:msgs(c.id).at(-1).content}],pin=roleReplyRequestPin(c,now);return[{role:'system',content:sys},...hist,pin]};`,sandbox);
  const request=Array.from(sandbox.make(c,now)),joined=request.map(x=>x.content).join('\n');
  assert.equal(request.at(-2).content,'我回到微信了，刚才那件事呢？');
  assert.match(joined,/我当面说我们把旅行行李收好了/);
  assert.match(joined,/他把最后一件外套放进行李箱/);
  assert.match(joined,/那明天就直接出发/);
  assert.match(request.at(-1).content,/本轮是从线下回到微信后的第一条/);
  assert.match(request[0].content,/请保持普通微信文字格式/);
});
