import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const maybeSource = functionSource('initiativeMaybeSend');
assert.doesNotMatch(maybeSource, /manualReply/, 'manual reply mode must not suppress proactive contact');
assert.doesNotMatch(maybeSource, /memoryPending/, 'a pending memory confirmation must not suppress proactive contact forever');
assert.doesNotMatch(maybeSource, /humanLikeOn/, 'the dedicated proactive switch must not depend on the general human-likeness switch');
assert.doesNotMatch(maybeSource, /isMain\(/, 'proactive contact must work for the currently active identity too');
assert.doesNotMatch(maybeSource, /15\s*\*\s*60000/, 'the configured interval must not be replaced by a 15-minute floor');
assert.doesNotMatch(maybeSource, /a\.key===['"]sleep['"]/, 'an inferred sleep activity must not override an explicitly configured proactive window');
assert.match(maybeSource, /extremeLoveOn\(c\)/, 'extreme-love escalation may suppress ordinary initiative only while the mode is active');
assert.match(maybeSource, /lm&&lm\.role===['"]user['"]/,'an unanswered user message must outrank proactive contact');
assert.match(maybeSource, /initiativeQueueNote\(c,plan,plan\.note\)/,'queued initiative must carry a freshness baseline');
assert.match(maybeSource, /callEligible=!natural&&plan\.kind!==['"]photo['"]&&plan\.kind!==['"]location['"]&&plan\.kind!==['"]checkin['"]&&plan\.kind!==['"]conflict['"]/, 'legacy random calls must not override natural-mode autonomy');
assert.match(maybeSource, /plan=natural\?wechatNaturalInitiativePlan/, 'natural mode must let the role choose the proactive action');
assert.match(maybeSource, /a=natural\?null:currentRoleActivity/, 'natural mode must not receive a system-invented current activity');
assert.match(source, /setInterval\(checkInitiative,15000\)/);
assert.match(source, /visibilitychange['"],initiativeWakeCheck/);
assert.match(source, /pageshow['"],initiativeWakeCheck/);
assert.match(source, /focus['"],initiativeWakeCheck/);
assert.match(source, /【本轮允许主动照片】/);
assert.match(source, /【本轮允许位置报备】/);
assert.match(source, /普通问候、催回复、关心、查岗和争吵承接绝对不能顺带附图/);
assert.match(source, /_initiativeNoImage=initiativeBlocksImage\(note\)/);
assert.match(source, /_initiativeNoLocation=initiativeBlocksLocation\(note\)/);
assert.match(source, /_initiativeNoImage&&[\s\S]*photoTail=3;continue/);
assert.match(source, /_initiativeNoLocation&&[\s\S]*位置/);

const blockContext = vm.createContext({});
vm.runInContext(functionSource('initiativeBlocksImage') + ';globalThis.block=initiativeBlocksImage;', blockContext);
assert.equal(blockContext.block('[系统：这是一次【主动消息】，不是对方刚发来新话。]'), true);
assert.equal(blockContext.block('[系统：这是一次【主动消息】。【本轮允许主动照片】]'), false);
assert.equal(blockContext.block('给我发一张照片'), false, 'an explicit real chat request must still be allowed to produce a photo');

const locationBlockContext = vm.createContext({});
vm.runInContext(functionSource('initiativeBlocksLocation') + ';globalThis.block=initiativeBlocksLocation;', locationBlockContext);
assert.equal(locationBlockContext.block('[系统：这是一次【主动消息】。【本轮禁止发送位置卡片】]'), true);
assert.equal(locationBlockContext.block('[系统：这是一次【主动消息】。【本轮允许位置报备】]'), false);
assert.equal(locationBlockContext.block('把你的位置发给我'), false, 'an explicit real chat request must still allow a location card');

const captionContext = vm.createContext({});
vm.runInContext(functionSource('initiativePhotoCaptionOk') + ';globalThis.ok=initiativePhotoCaptionOk;', captionContext);
const photoNote = '[系统：这是一次【主动消息】。【本轮允许主动照片】]';
assert.equal(captionContext.ok(photoNote, '刚看到窗外的晚霞特别好看，拍给你。\n[图片|窗外粉紫色晚霞]'), true);
assert.equal(captionContext.ok(photoNote, '醒了吗。\n[图片|桌面上的咖啡]'), false, 'an unrelated wake-up check must not carry a random photo');

const delayContext = vm.createContext({S: {settings: {proactiveIdleMin: 1}}});
vm.runInContext(functionSource('initiativeDelayMs') + ';globalThis.delay=initiativeDelayMs();', delayContext);
assert.equal(delayContext.delay, 60000, 'one minute in settings must mean one real minute');

let conflictEmotion={type:'neutral',intensity:0,cause:'',threads:[]},conflictMessages=[];
const conflictContext=vm.createContext({
  dialogueEmotionSnapshot:()=>conflictEmotion,
  msgs:()=>conflictMessages,
  msgToText:m=>m.content||'',
  Date,
});
vm.runInContext(functionSource('initiativeConflictState')+';globalThis.conflict=initiativeConflictState;',conflictContext);
const conflictRole={id:'conflict'};
conflictMessages=[{role:'user',type:'text',content:'一个半小时',time:Date.now()}];
assert.equal(conflictContext.conflict(conflictRole).active,false,'ordinary bargaining or time discussion must not be misread as an argument');
conflictEmotion={type:'hurt',intensity:55,cause:'刚才的话让我受伤',threads:[{topic:'刚才的话还没说开'}]};
assert.equal(conflictContext.conflict(conflictRole).active,true,'an unresolved emotional thread must arbitrate proactive content');
conflictEmotion={type:'neutral',intensity:0,cause:'',threads:[]};
conflictMessages=[{role:'assistant',type:'text',content:'别跟我说话，我还在生气。',time:Date.now()}];
assert.equal(conflictContext.conflict(conflictRole).active,true,'recent explicit fighting language must be detected even without a stored thread');
conflictEmotion={type:'warm',intensity:4,cause:'',repair:100,threads:[]};
assert.equal(conflictContext.conflict(conflictRole).active,false,'an explicitly reconciled dialogue must not be reopened by old fighting text');

let queuedUserTime=1000,queuedConflict=false;
const freshnessContext=vm.createContext({
  lastUserTs:()=>queuedUserTime,
  initiativeConflictState:()=>({active:queuedConflict,cause:''}),
});
vm.runInContext(functionSource('initiativeNoteActive')+';'+functionSource('initiativeQueueNote')+';'+functionSource('initiativeReplyFresh')+';globalThis.queue=initiativeQueueNote;globalThis.fresh=initiativeReplyFresh;',freshnessContext);
const queuedRole={id:'queued'};
const normalQueued=freshnessContext.queue(queuedRole,{kind:'photo'},'[系统：这是一次【主动消息】。【本轮允许主动照片】]');
assert.equal(freshnessContext.fresh(queuedRole,normalQueued),true);
queuedUserTime=2000;
assert.equal(freshnessContext.fresh(queuedRole,normalQueued),false,'a new user message must cancel a queued daily photo');
queuedUserTime=1000;queuedConflict=true;
assert.equal(freshnessContext.fresh(queuedRole,normalQueued),false,'a newly started argument must cancel an ordinary queued initiative');
const conflictQueued=freshnessContext.queue(queuedRole,{kind:'conflict'},'[系统：这是一次【主动消息】。承接争吵。]');
assert.equal(freshnessContext.fresh(queuedRole,conflictQueued),true,'an unresolved conflict follow-up may continue the same issue');
queuedConflict=false;
assert.equal(freshnessContext.fresh(queuedRole,conflictQueued),false,'a resolved conflict must cancel a stale conflict follow-up');

const planMath = Object.create(Math);
planMath.random = () => 0.99;
let planConflict={active:false,cause:''};
const planContext = vm.createContext({
  S: {settings: {imgGen: true}},
  initiativeMemory: () => null,
  imageGenerationAvailable: () => true,
  roleLiveLoc: () => ({name: '公司', address: '办公区'}),
  activityHash: () => 0,
  traitValue: (c,k,f=0) => c&&c.traits&&c.traits[k]!=null?+c.traits[k]:f,
  extremeLoveOn: () => false,
  suspicionBusy: () => false,
  initiativeConflictState: () => planConflict,
  memoryNorm: (v) => String(v),
  hm: () => '12:00',
  Math: planMath,
});
vm.runInContext(functionSource('initiativeLocationReady') + ';' + functionSource('initiativeCheckInMode') + ';' + functionSource('initiativePlan') + ';globalThis.plan=initiativePlan;globalThis.checkin=initiativeCheckInMode;', planContext);
const role = {id: 'r1', traits: {active: 50, cling: 60}};
const activity = {key: 'morning', label: '刚起床收拾', busy: 1};
const ordinaryPlan = planContext.plan(role, activity, {turn: 1, lastKind: '', lastMemory: ''});
assert.notEqual(ordinaryPlan.kind, 'photo');
assert.notEqual(ordinaryPlan.kind, 'location');
assert.doesNotMatch(ordinaryPlan.note, /\[图片\|/);
assert.match(ordinaryPlan.note, /【本轮禁止发送位置卡片】/);
const photoActivity = {key: 'evening', label: '刚闲下来', busy: 1};
const photoPlan = planContext.plan(role, photoActivity, {turn: 3, lastKind: '', lastMemory: ''});
assert.equal(photoPlan.kind, 'photo');
assert.match(photoPlan.note, /【本轮允许主动照片】/);
assert.match(photoPlan.note, /拍了什么、为什么想给ta看/);
assert.match(photoPlan.note, /默认是你拿手机向外拍眼前所见/);
assert.match(photoPlan.note, /夜景、风景、街景、天空、宠物或物品，就只拍那个主体/);
planConflict={active:true,cause:'刚才的话还没有说开'};
const conflictPlan=planContext.plan(role,photoActivity,{turn:3,lastKind:'',lastMemory:''});
assert.equal(conflictPlan.kind,'conflict');
assert.doesNotMatch(conflictPlan.note,/【本轮允许主动照片】/);
assert.match(conflictPlan.note,/不能突然分享工作、吃饭、天气、风景、自拍或其他生活日常/);
planConflict={active:false,cause:''};
planContext.S.settings.imgGen = false;
const textOnlyPlan = planContext.plan(role, photoActivity, {turn: 3, lastKind: '', lastMemory: ''});
assert.notEqual(textOnlyPlan.kind, 'photo');
assert.notEqual(textOnlyPlan.kind, 'location');
assert.match(textOnlyPlan.note, /日常视觉见闻只有本轮明确允许时才能发 \[图片\]/);
planContext.S.settings.imgGen = true;
const travelActivity = {key: 'morning', label: '在通勤路上', busy: 1};
const locationPlan = planContext.plan(role, travelActivity, {turn: 3, lastKind: '', lastMemory: ''});
assert.equal(locationPlan.kind, 'location');
assert.match(locationPlan.note, /\[位置\|公司\|办公区\]/);
assert.match(locationPlan.note, /【本轮允许位置报备】/);

const strictRole = {id:'strict',traits:{active:50,cling:50,suspicious:100,paranoid:100}};
const strictState = {turn:0,lastKind:'',lastMemory:'',lastCheckinAt:0};
assert.equal(planContext.checkin(strictRole,strictState,Date.now()),'report');
const strictPlan = planContext.plan(strictRole,activity,strictState);
assert.equal(strictPlan.kind,'checkin');
assert.equal(strictPlan.checkMode,'report');
assert.match(strictPlan.note,/强度高于基础人设/);
assert.match(strictPlan.note,/敏感多疑只负责情绪动机/);
assert.match(strictPlan.note,/偏执只负责行动力度/);
assert.match(strictPlan.note,/不能叠加多个任务/);
assert.match(strictPlan.note,/\[要求报备\|想知道你现在在哪里、在做什么\]/);
assert.equal(planContext.checkin(strictRole,{turn:4,lastCheckinAt:0},Date.now()),'location','100/100 must select one rotated check-in action');
assert.equal(planContext.checkin(strictRole,{turn:8,lastCheckinAt:0},Date.now()),'photo','100/100 must not stack location and photo in one turn');
const sharedTurn = planContext.plan(strictRole,activity,{turn:1,lastKind:'checkin',lastMemory:'',lastCheckinAt:0});
assert.notEqual(sharedTurn.kind,'checkin','100-level roles still need varied daily life messages between check-ins');
const sensitiveRole = {id:'sensitive',traits:{active:50,cling:50,suspicious:100,paranoid:10}};
assert.equal(planContext.checkin(sensitiveRole,{turn:0,lastCheckinAt:0},Date.now()),'reassurance');
const paranoidRole = {id:'paranoid',traits:{active:50,cling:50,suspicious:10,paranoid:100}};
assert.equal(planContext.checkin(paranoidRole,{turn:0,lastCheckinAt:0},Date.now()),'scrutiny');
const cooldownState={turn:2,lastCheckinAt:Date.now()-5*60000};
assert.equal(planContext.checkin(strictRole,cooldownState,Date.now()),'','check-ins must respect a short anti-spam cooldown');

function schedulerContext({planKind = 'share', callProb = 0, queue = true, delivered = queue, activityKey = 'work',lastRole='assistant'} = {}) {
  const now = Date.now();
  const state = {nextAt: now - 1, lastAt: 0, lastKind: '', lastMemory: '', turn: 0};
  const c = {id: 'r1', proactive: {enabled: true, start: 0, end: 23, times: 10}, followups: []};
  const calls = {queued: 0, called: 0, saved: 0};
  const sandboxMath = Object.create(Math);
  sandboxMath.random = () => 0;
  const context = vm.createContext({
    S: {
      settings: {manualReply: true, initiative: true, replyDelay: 0, proactiveIdleMin: 1},
      _proactiveCount: {}, couple: null,
      jail: {active: false}, me: {sleep: {active: null}, report: {active: null}},
    },
    _call: null,
    _initiativeBusy: {},
    _replying: null,
    _replyTimers: {},
    _IGT: [30],
    memoryScopeKey: () => 'main',
    replyStateKey: (id) => id,
    initiativeWindow: () => true,
    initiativeState: () => state,
    initiativeDelayMs: () => 60000,
    lastMsg: () => ({role: lastRole, time: now - 120000}),
    lastUserTs: () => 0,
    wechatNaturalOn: () => false,
    extremeLoveOn: () => false,
    currentRoleActivity: () => ({key: activityKey, label: activityKey === 'sleep' ? '在睡觉或休息' : '正在忙工作', busy: 4, until: now + 21600000}),
    initiativePlan: () => ({kind: planKind, memory: null, note: '[系统：主动联系]'}),
    initiativeQueueNote: (c,plan,note) => note,
    effCallProb: () => callProb,
    proCall: () => { calls.called++; return true; },
    scheduleReply: (id, note, done) => { calls.queued++; if (done) done(delivered); return queue; },
    memoryNorm: (v) => String(v),
    save: () => { calls.saved++; },
    setTimeout: () => 1,
    Date,
    Math: sandboxMath,
  });
  vm.runInContext(functionSource('initiativeRunKey') + ';' + maybeSource + ';globalThis.run=initiativeMaybeSend;', context);
  return {result: context.run(c), state, c, calls, S: context.S};
}

const message = schedulerContext();
assert.equal(message.result, true);
assert.equal(message.calls.queued, 1, 'manual reply mode and a busy activity may still allow proactive messages when no user reply is pending');
assert.equal(message.S._proactiveCount.r1.n, 1);

const pendingUser=schedulerContext({lastRole:'user'});
assert.equal(pendingUser.result,false,'an unanswered user message must block a new proactive topic');
assert.equal(pendingUser.calls.queued,0);

const lateNight = schedulerContext({activityKey: 'sleep'});
assert.equal(lateNight.result, true, 'an explicit active window must still honor the one-minute interval at night');
assert.equal(lateNight.calls.queued, 1);

const failedQueue = schedulerContext({queue: false});
assert.equal(failedQueue.result, false);
assert.equal(failedQueue.S._proactiveCount.r1, undefined, 'a blocked queue must not consume the daily quota');

const failedDelivery = schedulerContext({queue: true, delivered: false});
assert.equal(failedDelivery.result, true);
assert.equal(failedDelivery.S._proactiveCount.r1, undefined, 'an AI failure after queuing must not consume the daily quota');

const call = schedulerContext({callProb: 100});
assert.equal(call.calls.called, 1, 'high call probability must be checked on ordinary proactive opportunities');
assert.equal(call.calls.queued, 0);

const location = schedulerContext({planKind: 'location', callProb: 100});
assert.equal(location.calls.called, 0, 'location sharing must not be replaced by a call');
assert.equal(location.calls.queued, 1);

const conflictCall=schedulerContext({planKind:'conflict',callProb:100});
assert.equal(conflictCall.calls.called,0,'an unresolved argument follow-up must not suddenly become a casual proactive call');
assert.equal(conflictCall.calls.queued,1);

console.log('proactive contact tests passed');
