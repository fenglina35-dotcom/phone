import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../cohab-theater.js',import.meta.url),'utf8');

function harness(){
  let serial=0;
  const host={id:'host',name:'先生',remark:'先生',relation:'恋人',summaries:[]};
  const guest={id:'guest',name:'小雨',remark:'小雨',persona:'安静的朋友',summaries:[]};
  const home={msgs:[],notices:[],summaries:[],msgSeq:0,startedAt:1,phaseAt:1,phase:'home'};
  const inputs={
    ct_host_rel:{value:'恋人'},ct_guest_id:{value:'guest'},ct_guest_me:{value:'朋友'},ct_guest_host:{value:'初次见面'},
    ct_me_color:{value:'#224466'},ct_host_color:{value:'#332211'},ct_guest_color:{value:'#55386f'},
    ct_extra_name:{value:''},ct_extra_persona:{value:''},ct_extra_me:{value:''},ct_extra_host:{value:''},ct_extra_color:{value:'#6b4f2e'},
  };
  const S={me:{name:'我'},contacts:[host,guest],cohabitation:{cid:'host',homes:{host:home}},settings:{timeAware:true}};
  const baseData=()=>home;
  const basePush=(d,m)=>{m.cohabSeq=++d.msgSeq;d.msgs.push(m);return m;};
  const noop=()=>{};
  const context={
    console,Set,Map,Date,Math,JSON,String,Array,Object,Number,RegExp,Promise,setTimeout,clearTimeout,S,
    document:{getElementById:id=>inputs[id]||null,createElement:()=>({}),head:{appendChild:noop}},
    cohabRepairRows:rows=>rows||[],cohabData:baseData,cohabPushMessage:basePush,cohabSystem:()=>'',cohabCurrentTurnPrompt:()=>'',
    offAI:async()=>{},offSay:noop,renderCohab:()=>'<div class="cohab-meta"></div>',offlineMsgContent:m=>m.text,
    offlineSceneTimelineRows:()=>[],roleInteractionRows:()=>[],roleReplyGapFact:()=>null,roleReplyTimelinePin:()=>'',roleReplyContinuityPin:()=>'',
    roleReplyCrossChannelHandoffPrompt:()=>'',roleServerPushRecentContext:()=>'',roleDiaryRecentFacts:()=>'',
    getC:id=>id==='host'?host:id==='guest'?guest:null,uid:()=>`id${++serial}`,save:noop,saveNowAsync:async()=>true,
    cohabPushNotice:(d,text,opt)=>d.notices.push({text,...opt}),cohabSceneActive:()=>false,render:noop,openOfflineMenu:noop,toast:noop,closeModal:noop,
    summaryList:c=>c.summaries,pruneSummaries:noop,ymd:()=> '2026-09-04',perspRule:()=>'',roleChatRouteIndex:()=>0,
    chatAPI:async()=> '我记得自己作为小雨来到共同生活现场，听见用户和先生分别说清彼此的想法，也亲自简短回应了他们；这些是我在场期间真正看到和听到的内容，人物归属没有混淆。',
    roleVisibleEnvelopeText:x=>x,cleanReply:x=>x,trimSentence:x=>x,
  };
  for(const name of ['offSummaryUserCall','offlinePendingStart','fmtDT','conversationGapExact','roleReplyTimelineRows','roleCrossChannelOn','roleRecentChannelRounds','roleOnlineLiveStateText','initiativeAwayPrompt','recentMealProgressPrompt','rolePhoneAuthoritativeUsageContext','rolePhotoFrequencyContext','roleLatestUserChannel','roleServerPushConversationBoundary','msgs','msgToText','msgClearTime','topSummaries','summaryCleanText','traitDesc','offCurrentInput','offRender','cohabTogetherScene','cohabPhaseLabel','manualReplySceneOn','offNarrationMode','cohabAdvance','cohabSettingsPanel','offRevealText','offElapsed','cohabClockText','cohabStatusLabel','cohabSeen','cohabGoWechat','cohabActionTap','openModal','esc','offNarrationDecorate']){
    if(!(name in context))context[name]=noop;
  }
  context.offSummaryUserCall=()=> '用户';context.esc=x=>String(x??'');context.window=context;
  vm.runInNewContext(source,context,{filename:'cohab-theater.js'});
  return{context,home,host,guest,inputs};
}

test('pending cast starts observing only when theater is enabled',async()=>{
  const {context,home,guest}=harness();
  context.cohabTheaterSave('host');
  assert.equal(home.theater.enabled,false);
  assert.equal(home.theater.guest.joinedSeq,0);
  assert.equal(home.notices.length,0);
  await context.cohabTheaterDismissGuest('host','移出名单');
  assert.equal(guest.summaries.length,0);

  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  assert.equal(home.theater.enabled,true);
  assert.equal(home.theater.guest.joinedSeq,1);
  assert.equal(home.notices.length,1);
});

test('active guest exit writes one attributed summary and a retry cannot duplicate it',async()=>{
  const {context,home,guest}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  context.cohabPushMessage(home,{id:'u',who:'me',text:'欢迎你',time:10});
  context.cohabPushMessage(home,{id:'h',who:'ta',text:'坐吧',time:11});
  context.cohabPushMessage(home,{id:'g',who:'guest',actorType:'guest',displayNameSnapshot:'小雨',text:'谢谢',time:12});
  await context.cohabTheaterDismissGuest('host','手动请离');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(guest.summaries.length,1);
  assert.match(guest.summaries[0].text,/共同生活来客·先生/);
  assert.ok(guest.summaries[0].cohabGuestEpisodeId);
  await context.cohabTheaterRetrySummaries('host');
  assert.equal(guest.summaries.length,1);
});
