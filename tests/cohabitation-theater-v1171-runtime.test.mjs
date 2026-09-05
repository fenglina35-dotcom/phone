import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../cohab-theater.js',import.meta.url),'utf8');

function harness(){
  let serial=0;
  const host={id:'host',name:'先生',remark:'先生',relation:'恋人',gender:'男',summaries:[]};
  const guest={id:'guest',name:'小雨',remark:'小雨',persona:'安静的朋友',summaries:[]};
  const home={msgs:[],notices:[],summaries:[],msgSeq:0,startedAt:1,phaseAt:1,phase:'home'};
  const wechat={guest:[]};
  const inputs={
    ct_host_rel:{value:'恋人'},ct_guest_id:{value:'guest'},ct_guest_me:{value:'宝贝的妈妈'},ct_guest_host:{value:'主角的丈母娘'},
    ct_support_bubbles:{value:'2'},
    ct_me_color:{value:'#224466'},ct_host_color:{value:'#332211'},ct_guest_color:{value:'#55386f'},
    ct_extra_name:{value:''},ct_extra_persona:{value:''},ct_extra_me:{value:''},ct_extra_host:{value:''},ct_extra_color:{value:'#6b4f2e'},
  };
  const S={me:{name:'我'},contacts:[host,guest],cohabitation:{cid:'host',homes:{host:home}},settings:{timeAware:true}};
  const baseData=()=>home;
  const basePush=(d,m)=>{m.cohabSeq=++d.msgSeq;d.msgs.push(m);return m;};
  const noop=()=>{};
  const actorCalls=[],hostCalls=[];
  const toasts=[];
  let context;
  context={
    console,Set,Map,Date,Math,JSON,String,Array,Object,Number,RegExp,Promise,setTimeout,clearTimeout,S,
    document:{getElementById:id=>inputs[id]||null,createElement:()=>({}),head:{appendChild:noop}},
    cohabRepairRows:rows=>rows||[],cohabData:baseData,cohabPushMessage:basePush,cohabSystem:()=>'',cohabCurrentTurnPrompt:()=>'',
    cohabReplyCore:async()=>({items:[{id:'host-reply',who:'ta',source:'ta',text:'主角先认真回答这一句话'}],inspection:'',trips:[],travelErrors:[]}),
    offAI:async()=>{hostCalls.push({before:home.msgs.map(x=>x.who),system:context.cohabSystem(host,home,'')});if(context.emitHost!==false)context.cohabPushMessage(home,{id:`host-${serial+1}`,who:'ta',source:'ta',text:'主角先认真回答这一句话',time:Date.now()});},offSay:noop,offReply:noop,renderCohab:()=>'<div class="offstage"><div class="cohab-meta"></div></div>',offlineMsgContent:m=>m.text,
    offlineSceneTimelineRows:()=>[],roleInteractionRows:()=>[],roleReplyGapFact:()=>null,roleReplyTimelinePin:()=>'',roleReplyContinuityPin:()=>'',
    roleReplyCrossChannelHandoffPrompt:()=>'',roleServerPushRecentContext:()=>'',roleDiaryRecentFacts:()=>'',
    getC:id=>id==='host'?host:id==='guest'?guest:null,uid:()=>`id${++serial}`,save:noop,saveNowAsync:async()=>true,
    cohabPushNotice:(d,text,opt)=>d.notices.push({text,...opt}),cohabSceneActive:()=>false,render:noop,openOfflineMenu:noop,toast:text=>toasts.push(String(text)),closeModal:noop,
    summaryList:c=>c.summaries,pruneSummaries:noop,ymd:()=> '2026-09-04',perspRule:()=>'',roleChatRouteIndex:()=>0,
    msgs:id=>wechat[id]||(wechat[id]=[]),msgToText:m=>m&&m.content||'',persistWechatMessagesNow:async()=>true,notifyIncoming:noop,refreshChatMessages:noop,
    chatAPI:async messages=>{actorCalls.push(messages);const system=String(messages&&messages[0]&&messages[0].content||'');if(system.includes('只输出一个JSON对象'))return'{"speak":"配角简短回答","action":"","leave":false}';if(system.includes('主动发一条自然的普通文字消息'))return'我回到微信了，刚才在你们那里发生的事我都记得，之后再慢慢和你聊。';return'我记得自己作为小雨来到共同生活现场，听见宝贝和女婿分别说清彼此的想法，也亲自简短回应了他们；这些是我在场期间真正看到和听到的内容，人物归属没有混淆。';},
    roleVisibleEnvelopeText:x=>x,cleanReply:x=>x,trimSentence:x=>x,
  };
  for(const name of ['offSummaryUserCall','offlinePendingStart','fmtDT','conversationGapExact','roleReplyTimelineRows','roleCrossChannelOn','roleRecentChannelRounds','roleOnlineLiveStateText','initiativeAwayPrompt','recentMealProgressPrompt','rolePhoneAuthoritativeUsageContext','rolePhotoFrequencyContext','roleLatestUserChannel','roleServerPushConversationBoundary','msgs','msgToText','msgClearTime','topSummaries','summaryCleanText','traitDesc','offCurrentInput','offRender','cohabTogetherScene','cohabPhaseLabel','manualReplySceneOn','offNarrationMode','cohabAdvance','cohabSettingsPanel','offRevealText','offElapsed','cohabClockText','cohabStatusLabel','cohabSeen','cohabGoWechat','cohabActionTap','openModal','esc','offNarrationDecorate']){
    if(!(name in context))context[name]=noop;
  }
  context.offlinePendingStart=rows=>{let first=-1;for(let i=rows.length-1;i>=0;i--){const m=rows[i]||{},kind=m.who==='me'||m.actorType==='me'?'me':m.who==='ta'||m.actorType==='host'||m.who==='guest'||m.who==='extra'||/^(guest|extra)$/.test(m.actorType||'')?'assistant':'';if(kind==='assistant')return first;if(kind==='me')first=i;}return first;};
  context._off={id:'host',mode:'cohab',busy:false};context._offSel=null;context.emitHost=true;context.offCurrentInput=()=> '用户本轮';context.offRevealTiming=()=>({step:0,total:0});context.cohabAdvance=()=>home;context.cohabTogetherScene=()=>true;
  context.offSummaryUserCall=()=> '用户';context.esc=x=>String(x??'');context.offRevealText=m=>String(m&&m.text||'');context.cohabSettingsPanel=()=>'<div class="cohab-settings-wrap"><details class="cohab-settings"><summary>共同生活设置</summary></details><button type="button" class="cohab-debug-reply">让TA回</button></div>';context.window=context;
  context.topSummaries=()=>[];
  vm.runInNewContext(source,context,{filename:'cohab-theater.js'});
  return{context,home,host,guest,wechat,inputs,actorCalls,hostCalls,toasts};
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

test('active guest exit writes one attributed summary and one genuine WeChat follow-up without duplicates',async()=>{
  const {context,home,guest,wechat}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  context.cohabPushMessage(home,{id:'u',who:'me',text:'欢迎你',time:10});
  context.cohabPushMessage(home,{id:'h',who:'ta',text:'坐吧',time:11});
  context.cohabPushMessage(home,{id:'g',who:'guest',actorType:'guest',displayNameSnapshot:'小雨',text:'谢谢',time:12});
  await context.cohabTheaterDismissGuest('host','手动请离');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(guest.summaries.length,1);
  assert.match(guest.summaries[0].text,/共同生活来客·女婿/);
  assert.match(guest.summaries[0].text,/宝贝和女婿/);
  assert.ok(guest.summaries[0].cohabGuestEpisodeId);
  assert.equal(wechat.guest.length,1);
  assert.match(wechat.guest[0].content,/回到微信/);
  assert.equal(wechat.guest[0]._cohabGuestExitEpisodeId,guest.summaries[0].cohabGuestEpisodeId);
  await context.cohabTheaterRetrySummaries('host');
  assert.equal(guest.summaries.length,1);
  assert.equal(wechat.guest.length,1);
});

test('selected addressee controls queue order and support remains shorter than host',async()=>{
  const {context,home,hostCalls}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  home.theater.addressTo='guest';
  await context.offAI();
  assert.deepEqual(Array.from(home.msgs,x=>x.who),['guest','ta']);
  assert.deepEqual(hostCalls[0].before,['guest']);
  assert.match(hostCalls[0].system,/这次请求只生成主角/);
  assert.match(hostCalls[0].system,/本轮已经先发生的配角反应[\s\S]*配角简短回答/);
  home.theater.addressTo='host';
  const before=home.msgs.length;
  await context.offAI();
  assert.deepEqual(Array.from(home.msgs.slice(before),x=>x.who),['ta','guest']);
});

test('a pending user message keeps its own addressee even if the selector changes before reply',async()=>{
  const {context,home,hostCalls}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  context.cohabPushMessage(home,{id:'pending-to-guest',who:'me',actorType:'me',displayNameSnapshot:'我',addressTo:'guest',addressNameSnapshot:'小雨',text:'这句话只先问小雨',time:10});
  home.theater.addressTo='host';
  await context.offAI();
  assert.deepEqual(Array.from(home.msgs.slice(1),x=>x.who),['guest','ta']);
  assert.deepEqual(hostCalls[0].before,['me','guest']);
  assert.match(hostCalls[0].system,/当前用户主要在对【小雨】说话/);
});

test('a departed pending addressee never silently falls back to the host',async()=>{
  const {context,home,hostCalls,toasts}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  context.cohabPushMessage(home,{id:'pending-to-guest',who:'me',actorType:'me',displayNameSnapshot:'我',addressTo:'guest',addressNameSnapshot:'小雨',text:'这句话只问小雨',time:10});
  home.theater.guest=null;
  await context.offAI();
  assert.equal(hostCalls.length,0);
  assert.deepEqual(Array.from(home.msgs,x=>x.who),['me']);
  assert.match(toasts.at(-1),/小雨 已不在场/);
});

test('manual support bubble limit counts actions and speech together',async()=>{
  const {context,home,inputs}=harness();
  inputs.ct_support_bubbles.value='4';
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  home.theater.addressTo='guest';
  context.chatAPI=async()=>JSON.stringify({bubbles:[
    {type:'action',text:'抬眼看向两人'},
    {type:'speak',text:'第一句'},
    {type:'action',text:'轻轻敲了敲桌面'},
    {type:'speak',text:'第二句'},
    {type:'speak',text:'不得出现的第五条'},
  ],leave:false});
  await context.offAI();
  assert.equal(home.theater.supportBubbleLimit,4);
  assert.deepEqual(Array.from(home.msgs.slice(0,4),x=>x.who),['旁白','guest','旁白','guest']);
  assert.equal(home.msgs.length,5);
  assert.doesNotMatch(home.msgs.map(x=>x.text).join('\n'),/第五条/);
});

test('all and host addressed turns independently generate host then one support actor every turn',async()=>{
  const {context,home,actorCalls}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  home.theater.addressTo='all';
  await context.offAI();
  assert.deepEqual(Array.from(home.msgs,x=>x.who),['ta','guest']);
  assert.match(actorCalls.at(-1).map(x=>x.content).join('\n'),/主角先认真回答这一句话/);
  home.theater.addressTo='host';
  const before=home.msgs.length;
  await context.offAI();
  assert.deepEqual(Array.from(home.msgs.slice(before),x=>x.who),['ta','guest']);
});

test('a failed host generation is never masked by a support-only reply',async()=>{
  const {context,home,actorCalls}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  home.theater.addressTo='host';
  context.emitHost=false;
  await context.offAI();
  assert.equal(home.msgs.length,0);
  assert.equal(actorCalls.length,0);
});

test('target pill lives beside manual reply only while enabled and off restores base rendering',async()=>{
  const {context,home}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  const panel=context.cohabSettingsPanel('host',home);
  assert.ok(panel.indexOf('cohab-theater-settings')<panel.indexOf('</details>'));
  assert.ok(panel.indexOf('cohab-debug-reply')<panel.indexOf('cohab-theater-target'));
  assert.doesNotMatch(panel,/>对谁说<\/span>/);
  await context.cohabTheaterToggle('host');
  assert.doesNotMatch(context.cohabSettingsPanel('host',home),/cohab-theater-target/);
  assert.equal(context.renderCohab('host'),'<div class="offstage"><div class="cohab-meta"></div></div>');
});

test('speech, actor actions and typing bubbles expose remarks without role suffixes',async()=>{
  const {context,home}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  context.cohabPushMessage(home,{id:'me-line',who:'me',actorType:'me',displayNameSnapshot:'我',text:'我说的话',time:10});
  context.cohabPushMessage(home,{id:'host-line',who:'ta',actorType:'host',displayNameSnapshot:'先生',text:'主角说的话',time:11});
  context.cohabPushMessage(home,{id:'guest-line',who:'guest',actorType:'guest',displayNameSnapshot:'小雨',text:'来客说的话',time:12});
  context.cohabPushMessage(home,{id:'guest-action',who:'旁白',actorType:'guest',displayNameSnapshot:'小雨',text:'抬起手',time:13});
  context.cohabPushMessage(home,{id:'me-action',who:'旁白',actorType:'me',displayNameSnapshot:'我',text:'点点头',time:14});
  home.theater.activeActor='guest';
  context._off.busy=true;
  const html=context.renderCohab('host');
  const labels=Array.from(html.matchAll(/class="(?:cohab-speaker|cohab-narrator-name)">([^<]*)<\/small>/g),m=>m[1]);
  assert.deepEqual(labels,['我','先生','小雨','小雨','我','小雨']);
  assert.doesNotMatch(labels.join('\n'),/主角|微信来客|临时路人|动作/);
});

test('closing theater keeps historical support names but restores unlabeled host and user bubbles',async()=>{
  const {context,home}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  context.cohabPushMessage(home,{id:'me-line',who:'me',text:'我说的话',time:10});
  context.cohabPushMessage(home,{id:'host-line',who:'ta',text:'主角说的话',time:11});
  context.cohabPushMessage(home,{id:'guest-line',who:'guest',text:'来客说的话',time:12});
  context.cohabPushMessage(home,{id:'guest-action',who:'旁白',actorType:'guest',text:'抬起手',time:13});
  await context.cohabTheaterToggle('host');
  const html=context.renderCohab('host');
  const labels=Array.from(html.matchAll(/class="(?:cohab-speaker|cohab-narrator-name)">([^<]*)<\/small>/g),m=>m[1]);
  assert.deepEqual(labels,['小雨','小雨']);
  assert.doesNotMatch(html,/cohab-theater-target/);
  assert.match(html,/我说的话/);
  assert.match(html,/主角说的话/);
});

test('temporary leave keeps the configured guest and never creates an exit summary or WeChat follow-up',async()=>{
  const {context,home,guest,wechat}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  assert.equal(context.cohabTheaterPresence('host','guest',false,'去做饭'),true);
  assert.equal(home.theater.guest.contactId,'guest');
  assert.equal(home.theater.presence.guest,false);
  assert.equal(home.theater.guestHistory.length,0);
  assert.equal(guest.summaries.length,0);
  assert.equal(wechat.guest.length,0);
  assert.doesNotMatch(context.cohabSettingsPanel('host',home),/对小雨说/);
  context.cohabTheaterPresence('host','guest',true);
  assert.equal(home.theater.presence.guest,true);
});

test('a support actor natural leave is temporary rather than a permanent guest dismissal',async()=>{
  const {context,home,guest,wechat}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  home.theater.addressTo='guest';
  context.chatAPI=async messages=>String(messages[0].content).includes('只输出一个JSON对象')?'{"bubbles":[{"type":"speak","text":"我先去做饭，你们等我，我一会儿回来"}],"leave":false}':'记忆文本';
  await context.offAI();
  assert.equal(home.theater.guest.contactId,'guest');
  assert.equal(home.theater.presence.guest,false);
  assert.equal(home.theater.guestHistory.length,0);
  assert.equal(guest.summaries.length,0);
  assert.equal(wechat.guest.length,0);
});

test('when the host is temporarily away an addressed support replies alone',async()=>{
  const {context,home,hostCalls}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  context.cohabTheaterPresence('host','host',false);
  home.theater.addressTo='guest';
  await context.offAI();
  assert.deepEqual(Array.from(home.msgs,x=>x.who),['guest']);
  assert.equal(hostCalls.length,0);
});

test('the existing manual reply button runs exactly one support-host round while the user is away',async()=>{
  const {context,home,actorCalls,hostCalls}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  context.cohabTheaterPresence('host','me',false);
  const panel=context.cohabSettingsPanel('host',home);
  assert.match(panel,/>让TA回<\/button>/);
  assert.doesNotMatch(panel,/cohab-theater-target/);
  const html=context.renderCohab('host');
  assert.match(html,/我回到现场/);
  assert.match(html,/点上方原有“让TA回”/);
  assert.doesNotMatch(html,/onclick="cohabTheaterContinue\('/);
  assert.doesNotMatch(html,/class="inputbar offinput"/);
  await context.offReply();
  assert.deepEqual(Array.from(home.msgs,x=>x.who),['guest','ta']);
  assert.equal(actorCalls.length,1);
  assert.equal(hostCalls.length,1);
  assert.match(hostCalls[0].system,/用户现在暂时离场/);
  await context.offReply();
  assert.deepEqual(Array.from(home.msgs,x=>x.who),['guest','ta','guest','ta']);
  assert.equal(actorCalls.length,2);
  assert.equal(hostCalls.length,2);
});

test('one manual away click gives every present support one turn and the host exactly one final turn',async()=>{
  const {context,home,actorCalls,hostCalls}=harness();
  context.cohabTheaterSave('host');
  await context.cohabTheaterToggle('host');
  home.theater.extra={episodeId:'extra-1',name:'周医生',persona:'冷静',relationToUser:'医生',relationToHost:'同事',joinedSeq:1,joinedAt:1,_announced:true};
  context.cohabTheaterPresence('host','me',false);
  await context.offReply();
  assert.deepEqual(Array.from(home.msgs,x=>x.who),['guest','extra','ta']);
  assert.equal(actorCalls.length,2);
  assert.equal(hostCalls.length,1);
  assert.match(hostCalls[0].system,/本轮已经先发生的配角反应[\s\S]*小雨[\s\S]*周医生/);
});
