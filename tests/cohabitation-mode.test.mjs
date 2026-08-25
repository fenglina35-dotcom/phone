import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const preview=fs.readFileSync(new URL('../cohabitation-preview.html',import.meta.url),'utf8');

function functionSourceFrom(input,name){
  const start=input.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const next=input.indexOf('\nfunction ',start+10);
  return input.slice(start,next<0?input.length:next).trim();
}
function functionSource(name){return functionSourceFrom(source,name);}

test('co-living stays separate from one-time dates and is opt-in',()=>{
  assert.match(source,/function cohabRoot\(\)/);
  assert.match(source,/S\.cohabitation/);
  assert.match(source,/function offData\(id\).*S\.offline/s);
  assert.match(source,/共同生活 · 测试版/);
  assert.match(source,/关闭只会暂停/);
  assert.match(source,/else if\(c\.p==='off'\)html=renderOff\(c\.id,c\.mode\)/);
  assert.match(source,/function renderOff\(id,mode\).*mode==='cohab'.*renderCohab/s);
  assert.match(source,/if\(!_off\|\|_off\.id!==id\|\|_off\.mode!=='cohab'\)_off=\{id,busy:false,mode:'cohab'\}/);
  assert.match(source,/function cohabClear\(id\)/);
});

test('co-living state pauses without deleting and advances work to return home',()=>{
  const start=source.indexOf('function cohabRoot()');
  const end=source.indexOf('function offlineFocusStart',start);
  assert.ok(start>=0&&end>start);
  const sandbox={
    S:{contacts:[{id:'c1',name:'角色'}],couple:{cid:'c1'}},
    Date,console,
    getC:id=>id==='c1'?sandbox.S.contacts[0]:null,
    uid:(()=>{let n=0;return()=>`u${++n}`;})(),
    save:()=>{},saveNow:()=>{sandbox.saveNowCalls++;return true;},saveNowCalls:0,render:()=>{},toast:()=>{},openOfflineMenu:()=>{},closeModal:()=>{},
    routes:[],homeCalls:0,controlCalls:0,
    go:(p,params)=>sandbox.routes.push({p,...params}),home:()=>{sandbox.homeCalls++;},openChat:()=>{},cur:()=>({p:'home'}),initiativeArm:()=>{},cohabScheduleArrival:()=>{},
    offDateTime:()=> '2026年8月9日 12:00',offElapsed:()=> '1天',esc:String,
    uiConfirm:async()=>true,_off:null,_offSel:null
  };
  vm.runInNewContext(source.slice(start,end)+`
    globalThis.root=cohabRoot();
    cohabToggle();
    globalThis.enabled={enabled:root.enabled,paused:root.paused,msgs:cohabData('c1').msgs.length,startedAt:cohabData('c1').startedAt};
    cohabToggle();
    globalThis.paused={enabled:root.enabled,paused:root.paused,msgs:cohabData('c1').msgs.length,startedAt:cohabData('c1').startedAt};
    root.enabled=true;root.paused=false;
    cohabSetPhase('c1','work',60,{silent:true});
    const d=cohabData('c1');
    globalThis.work={phase:d.phase,nextPhase:d.nextPhase,nextAt:d.nextAt};
    cohabAdvance('c1',d.nextAt);
    globalThis.returning={phase:d.phase,nextPhase:d.nextPhase,nextAt:d.nextAt};
    cohabAdvance('c1',d.nextAt);
    globalThis.homeState={phase:d.phase,unreadReturn:d.unreadReturn};
    cohabSetPhase('c1','away',0,{silent:true,activity:'买晚饭'});
    const applied=cohabApplyStateTags('开门。\\n[共同生活状态|到家|在玄关]','c1',{source:'wechat'});
    globalThis.roleState={phase:d.phase,activity:d.activity,text:applied.text,matched:applied.matched,source:d.stateSource};
    cohabSetPhase('c1','away',0,{silent:true,activity:'买晚饭'});
    const thoughtOnly=cohabInferOnlineState('[内心|她开门了，终于见到我的小狗了。]\\n你先等等。','c1',d);
    globalThis.thoughtState={phase:d.phase,changed:thoughtOnly};
    const atDoor=cohabInferOnlineState('开门。','c1',d);
    globalThis.doorState={phase:d.phase,activity:d.activity,changed:atDoor};
    const entered=cohabInferOnlineState('进来了。\\n过来，让我看看你。','c1',d);
    globalThis.enteredState={phase:d.phase,activity:d.activity,changed:entered,source:d.stateSource,unreadReturn:d.unreadReturn};
    cohabSetPhase('c1','work',60,{silent:true,source:'manual'});
    const beforeRoutes=globalThis.routes.length;
    const enteredWork=cohabEnter('c1');
    const directRoutes=globalThis.routes.length;
    cohabActionTap(null,'enter','c1');
    const firstRoutes=globalThis.routes.length;
    cohabActionTap(null,'enter','c1');
    const secondRoutes=globalThis.routes.length;
    cohabControls=()=>{globalThis.controlCalls++;};
    offQuit=()=>{globalThis.homeCalls++;return true;};
    cohabActionTap(null,'controls','c1');
    cohabActionTap(null,'quit','c1');
    globalThis.workEntry={enteredWork,beforeRoutes,directRoutes,firstRoutes,secondRoutes,route:globalThis.routes.at(-1),phase:d.phase,saveNowCalls:globalThis.saveNowCalls,controlCalls:globalThis.controlCalls,homeCalls:globalThis.homeCalls};
  `,sandbox);
  assert.deepEqual({...sandbox.enabled},{enabled:true,paused:false,msgs:1,startedAt:sandbox.enabled.startedAt});
  assert.equal(sandbox.paused.enabled,false);
  assert.equal(sandbox.paused.paused,true);
  assert.equal(sandbox.paused.msgs,1);
  assert.equal(sandbox.paused.startedAt,sandbox.enabled.startedAt);
  assert.equal(sandbox.work.phase,'work');
  assert.equal(sandbox.work.nextPhase,'returning');
  assert.equal(sandbox.returning.phase,'returning');
  assert.equal(sandbox.returning.nextPhase,'home');
  assert.deepEqual({...sandbox.homeState},{phase:'home',unreadReturn:true});
  assert.deepEqual({...sandbox.roleState},{phase:'home',activity:'在玄关',text:'开门。',matched:true,source:'wechat'});
  assert.deepEqual({...sandbox.thoughtState},{phase:'away',changed:false});
  assert.deepEqual({...sandbox.doorState},{phase:'returning',activity:'在门口',changed:true});
  assert.deepEqual({...sandbox.enteredState},{phase:'home',activity:'在家',changed:true,source:'wechat-natural-arrival',unreadReturn:true});
  assert.equal(sandbox.workEntry.enteredWork,true);
  assert.equal(sandbox.workEntry.directRoutes,sandbox.workEntry.beforeRoutes+1,'work state must still enter immediately');
  assert.equal(sandbox.workEntry.firstRoutes,sandbox.workEntry.directRoutes+1,'the first guarded entry tap must route synchronously');
  assert.equal(sandbox.workEntry.secondRoutes,sandbox.workEntry.firstRoutes,'duplicate entry tap must be idempotently ignored');
  assert.deepEqual({...sandbox.workEntry.route},{p:'off',id:'c1',mode:'cohab'});
  assert.equal(sandbox.workEntry.phase,'work');
  assert.ok(sandbox.workEntry.saveNowCalls>=3,'toggle and entry must persist immediately');
  assert.equal(sandbox.workEntry.controlCalls,1,'a different control must not be swallowed by the entry guard');
  assert.equal(sandbox.workEntry.homeCalls,1,'back action must remain available in work state');
});

test('online and face-to-face activity use a narrow shared status boundary',()=>{
  assert.match(source,/function cohabWechatPrompt\(c,d\)/);
  assert.match(source,/共同生活\/同居状态/);
  assert.match(source,/不能拿来否定同居/);
  assert.match(source,/不许说“最近一次见面是某天”“还在异国恋\/分居”“等你落地\/改签机票”/);
  assert.match(source,/roleOnlineLiveStateText\(c\)/);
  assert.match(source,/仅在“约会中同步到线上”开关开启时生效/);
  assert.match(source,/共同生活页面里的动作与对白不会复制到微信/);
  assert.match(source,/微信消息也不会冒充面对面台词/);
  assert.match(source,/function offlineFocusActive\(\)\{if\(cohabSceneBlocksOnline\(\)\)return true/);
  assert.match(source,/function incomingCall\(id,kind,opt\).*cohabRestricted&&!opt\.requestedByUser.*roleOnlineProactiveBlocked\(id\).*requestedByUser/s);
  assert.match(source,/async function maybeProactive\(id\)\{if\(!isMain\(\)\|\|roleOnlineProactiveBlocked\(id\)/);
  assert.match(source,/function roleOnlineProactiveBlocked\(id\).*offlineWechatLiveState\(c\).*cohabOnlineQuiet\(id\).*offlineFocusActive\(\)/);
  assert.match(source,/面对面在一起，普通后台主动微信与来电必须静默/);
  assert.match(functionSource('cohabToggle'),/c\.proactive\.enabled=true;c\.proactive\.serverPush=true;initiativeArm\(c\)/);
  assert.match(source,/去微信联系TA吧/);
  assert.match(source,/function cohabConsumeOnlineState\(text,c,id\)/);
  assert.match(source,/function cohabInferOnlineState\(text,id,d\)/);
  assert.match(source,/content=cohabConsumeOnlineState\(content,c,id\)/);
  assert.match(source,/只有你确实已经抵达、说“我到家了\/进门了”时才能切到到家/);
  assert.match(source,/你可以自己选择挂什么简短状态/);
});

test('co-living only silences online messages while both people are physically together',()=>{
  const helper=functionSource('cohabSceneBlocksOnline');
  const run=phase=>vm.runInNewContext(`(${helper})()`,{
    privateCompanionAppOn:()=>true,
    cohabSceneActive:()=>true,
    _off:{id:'c1'},
    cohabData:()=>({phase}),
    cohabTogetherScene:d=>d.phase==='home'||d.phase==='together-away'
  });
  assert.equal(run('home'),true,'at home remains face-to-face and quiet');
  assert.equal(run('together-away'),true,'going out together remains face-to-face and quiet');
  for(const phase of ['work','away','returning'])assert.equal(run(phase),false,phase+' must allow background WeChat delivery');
  assert.equal(vm.runInNewContext(`(${helper})()`,{privateCompanionAppOn:()=>false,cohabSceneActive:()=>true}),true,'the web build keeps its existing quiet behavior');
});

test('WeChat, calls and face-to-face scenes share a speaker-safe chronological anchor',()=>{
  const sandbox={
    S:{me:{name:'用户'}},
    Date,Number,
    msgs:()=>[
      {id:'wx1',role:'user',type:'text',content:'你爱我吗？',time:200},
      {id:'wx2',role:'assistant',type:'text',content:'废话。',time:210}
    ],
    msgToText:m=>m.content||'',
    callToCN:x=>x
  };
  const code=['offlineIsUserMsg','offlineIsAssistantMsg','offlinePendingStart','offlineOnlineTimelineRows','offlineSceneTimelineRows','offlineUnifiedTimelineState'].map(functionSource).join('\n');
  vm.runInNewContext(code+`;const c={id:'c1',name:'角色'},o={startedAt:10,msgs:[
    {id:'c1',who:'me',text:'改到哪了。',time:100},
    {id:'c2',who:'ta',text:'你还没回我呢。',time:110},
    {id:'c3',who:'me',text:'我上一句话说的什么？',time:300}
  ]};globalThis.timeline=offlineUnifiedTimelineState(c,o,20);`,sandbox);
  assert.equal(sandbox.timeline.previousUser.text,'你爱我吗？');
  assert.equal(sandbox.timeline.previousUser.who,'用户');
  assert.equal(sandbox.timeline.previousRole.text,'废话。');
  assert.equal(sandbox.timeline.previousRole.who,'角色');
  assert.equal(sandbox.timeline.current.text,'我上一句话说的什么？');
  assert.match(source,/若.*问“我上一句说了什么\/刚才微信说了什么”.*不能拿线下较旧输入、你的上一句或旁白代替/);
  assert.match(source,/function cohabPushMessage\(d,m\).*m\.time=Date\.now\(\)/);
});

test('co-living memory list supports manual deletion without clearing source chat',()=>{
  assert.match(source,/function cohabMemoryOpen\(id\)/);
  assert.match(source,/function cohabMemoryDelete\(id,key\)/);
  assert.match(source,/只删除这条总结，不会删除共同生活原聊天/);
  assert.match(source,/function cohabMemoryClear\(id\)/);
  assert.match(source,/只清空共同生活总结，不会删除原聊天、微信或单次线下约会/);
  assert.match(source,/onclick="cohabMemoryDelete\('\$\{id\}','\$\{key\}'\)"/);
});

test('co-living UI exposes persistent status, return notice and test controls',()=>{
  assert.match(source,/function renderCohab\(id\)/);
  assert.match(source,/回来了/);
  assert.match(source,/去微信找TA/);
  assert.match(source,/测试控制/);
  assert.match(html,/\.cohab-menu-card/);
  assert.match(html,/\.cohab-status-chip/);
  assert.match(html,/\.cohab-return-banner/);
  assert.match(html,/\.cohab-away-panel/);
  assert.match(html,/\.cohab-wx-state/);
  assert.match(source,/function cohabWechatNavBadge\(c\)/);
  assert.match(source,/page\.p==='off'&&stage\.querySelector\('\.cohab-status-chip'\)/);
  assert.match(source,/function cohabActionTap\(e,action,id\).*preventDefault.*stopPropagation.*action==='controls'.*action==='quit'/s,'all mobile co-living controls must share the synchronous guarded route');
  assert.doesNotMatch(functionSource('cohabActionTap'),/setTimeout/,'co-living taps must not wait for a later event-loop turn');
  assert.match(source,/type="button" onclick="return cohabActionTap\(null,'enter','\$\{cid\}'\)"/,'the entry button must use the guarded route without relying on a global event object');
  assert.match(source,/aria-label="返回桌面" onclick="return cohabActionTap\(null,'quit','\$\{id\}'\)"/,'the co-living back control must be a real synchronous button');
  assert.match(functionSource('cohabEnter'),/go\('off',\{id,mode:'cohab'\}\).*return true/s,'co-living entry must preserve its mode in navigation history');
  assert.match(preview,/共同生活 · 测试版/);
  assert.match(preview,/data-phase="work"/);
  assert.match(preview,/先生\^\^回来了/);
});

test('co-living calls require a current explicit user request and remain the real model choice',()=>{
  const explicit=vm.runInNewContext(`(${functionSource('explicitIncomingCallRequest')})`);
  for(const text of ['你现在给我打个电话','给我打过来','打视频电话给我'])assert.equal(explicit(text),true,text);
  for(const text of ['我给你打电话','他刚才给我打电话了','你为什么没给我打电话','今天工作忙吗'])assert.equal(explicit(text),false,text);
  assert.match(source,/_explicitCallTurn=!note&&explicitIncomingCallRequest\(_userText\)/,'only the current ordinary user turn can authorize a call');
  assert.match(source,/incomingCall\(c\.id,k==='\u89c6\u9891'\?'video':'voice',\{requestedByUser:_explicitCallTurn,source:'current-model-turn'\}\)/,'the model call action must carry that current-turn authorization');
  assert.match(source,/共同生活开启期间不得在没有当前命令时自行来电/);
  assert.match(source,/按本人性格、情绪和电话频率决定是否输出来电动作，不打也可以/);
});

test('co-living condenses the user-selected number of completed rounds into isolated role memories',()=>{
  assert.match(source,/function cohabSummaryCompletedRounds\(rows\)/);
  assert.match(source,/roundLimit=cohabSummaryRoundLimit\(d\)/);
  assert.match(source,/!opt\.force&&\(!roundLimit\|\|Date\.now\(\)<d\.summaryRetryAt\|\|rounds<roundLimit\)/);
  assert.match(source,/function cohabMaybeSummarize\(id,d\)/);
  assert.match(source,/d\.summaries\.push\(\{id:uid\(\),batchId,ts:now,fromSeq:/);
  assert.match(source,/function cohabSummarizeNow\(id\)/);
  assert.match(source,/function cohabMemoryPrompt\(d,query\)/);
  assert.match(source,/共同生活已经自动整理的旧记忆/);
  assert.match(source,/if\(life&&!inspection\)cohabMaybeSummarize\(c\.id,o\)/);
  assert.doesNotMatch(source,/c\.summaries\.push\([^\n]*共同生活/);
});

test('co-living summary is durably stored before reporting success',()=>{
  const summarize=functionSource('cohabSummarize');
  assert.match(summarize,/d\.summarySeq=targetSeq;d\.summaryRetryAt=0;await saveNowAsync\(\);return items\.length/);
  assert.doesNotMatch(summarize,/d\.summaryRetryAt=0;save\(\);return items\.length/);
});

test('old dates and co-living summaries share the role-perspective memory rule',()=>{
  assert.match(source,/function offSummaryPerspectiveRule\(c\)/);
  assert.match(source,/禁止写成第三人称旁白、剧本梗概、镜头描述/);
  assert.match(source,/普通走路、坐下、起身、拿东西、姿势、衣着和环境描写全部省略/);
  assert.match(source,/function offSummaryFallback\(ended,c,plan\).*m\.who!=='旁白'/);
  assert.match(source,/function offSummarySavePoints\(o,h,c,ended,points,status,error\).*offSummaryMemoryPerspectiveValid/s);
  assert.match(source,/共同生活总结格式不合格/);
});

test('the established offline narration presentation is preserved',()=>{
  const originalRender=source.slice(source.indexOf('function renderOff(id,mode)'),source.indexOf('/* ===== 信箱 ====='));
  assert.match(originalRender,/if\(m\.who==='旁白'\)return `<div class="offnar[^`]+\$\{offRevealText\(m\)\}<\/div>`/);
  assert.doesNotMatch(preview,/<div class="nar">【/);
  assert.doesNotMatch(preview,/】<\/div>/);
  assert.doesNotMatch(html,/\.offnar[^}]*:before[^}]*【/);
  assert.ok(preview.lastIndexOf('.nar{max-width:88%')>preview.lastIndexOf('border-left:1px solid #61584b'));
  assert.doesNotMatch(preview,/class="avatar"/);
});
