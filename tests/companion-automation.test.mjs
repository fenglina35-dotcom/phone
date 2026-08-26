import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const phoneRolePush = readFileSync(join(root, 'supabase', 'functions', 'phone-role-push', 'index.ts'), 'utf8');

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < app.length; i += 1) {
    if (app[i] === '{') { depth += 1; opened = true; }
    if (app[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return app.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

function candidateContext(messages = []) {
  const context = vm.createContext({
    S: { me: { name: '用户' } },
    msgs: () => messages,
    msgToText: (m) => m.content || '',
    lastMsg: () => messages.at(-1) || null,
    fmtDT: (value) => String(value),
    initiativeQueueNote: (_c, _plan, note) => note,
  });
  vm.runInContext(`
    ${functionSource('companionDuration')}
    ${functionSource('companionAutomationDay')}
    ${functionSource('companionAutomationClock')}
    ${functionSource('companionAutomationMinute')}
    ${functionSource('companionAutomationWindow')}
    ${functionSource('companionAutomationGoodMorning')}
    ${functionSource('companionAutomationFresh')}
    ${functionSource('companionAutomationRecentUser')}
    ${functionSource('companionAutomationNote')}
    ${functionSource('companionBatteryIsCharging')}
    ${functionSource('companionMorningSleepCandidate')}
    ${functionSource('companionRequiredDailyCandidate')}
    ${functionSource('companionAutomationCandidate')}
  `, context);
  return context;
}

function baseState(now) {
  return {
    permissions: { screenTime: true, battery: true, health: true, location: true },
    automations: { eveningScreen: false, morningSleep: false, absenceBattery: false, criticalBattery: false, emotionCare: false, manualUnlockAlert: false },
    automationRuns: {},
    automationWindows: { sleepStart: '07:00', sleepEnd: '12:00', usageStart: '21:30', usageEnd: '23:59' },
    lastSync: now,
    screenTimeAvailable: true,
    screenTimeMode: 'per_app',
    screenTimeSec: 7200,
    apps: [{ name: 'QQ', usedSec: 1800 }, { name: '音乐', usedSec: 600 }],
    battery: { level: 0.42, state: '使用电池', lowPower: false, ts: now },
    health: { ts: now, sleepSeconds: 8 * 3600, steps: 4321, heartRateBpm: 76, heartRateAt: now },
    location: { place: '家', accuracy: 12, ts: now },
  };
}

test('daily sleep, steps, usage and explicit manual unlock checks are mandatory while the other proactive checks remain opt-in', () => {
  assert.match(app, /eveningScreen:true,morningSleep:true,absenceBattery:false,criticalBattery:false,emotionCare:false,manualUnlockAlert:true/);
  assert.match(app, /id="cou_companion_automations"/);
  assert.match(app, /每日总时长与全部 App 记录必查/);
  assert.match(app, /每日睡眠与步数必查/);
  assert.match(app, /保存每日必查时段/);
  assert.match(app, /失联时查看 iPhone 电量/);
  assert.match(app, /电量 5% 及以下提醒充电/);
  assert.match(app, /难过时参考最新心率/);
  assert.match(app, /手动解锁立即告诉角色/);
});

test('critical battery reminder is fresh, persona-led and once per discharge episode', () => {
  const now = new Date(2026, 7, 6, 18, 0, 0).getTime();
  const context = candidateContext([{ role: 'assistant', type: 'text', content: '好', time: now - 60000, id: 'a1' }]);
  const st = baseState(now);
  st.automations.criticalBattery = true;
  st.battery = { level: 0.05, state: '使用电池', lowPower: true, ts: now };
  context.st = st; context.now = now; context.c = { id: 'role' };
  vm.runInContext('this.pick=companionAutomationCandidate(c,st,now)', context);
  assert.equal(context.pick.kind, 'criticalBattery');
  assert.match(context.pick.note, /按你自己的关系和人设立刻提醒ta充电/);

  st.automationRuns.criticalBatteryLow = true;
  vm.runInContext('this.repeat=companionAutomationCandidate(c,st,now)', context);
  assert.equal(context.repeat, null);

  st.automationRuns.criticalBatteryLow = false;
  st.battery.state = '充电中';
  vm.runInContext('this.charging=companionAutomationCandidate(c,st,now)', context);
  assert.equal(context.charging, null);
  assert.match(app, /battery\.level>=\.1\|\|companionBatteryIsCharging\(st\.battery\)/);
  assert.match(app, /candidate\.kind==='criticalBattery'/);
});

test('daily morning and evening checks require real fresh snapshots', () => {
  const morning = new Date(2026, 7, 6, 8, 0, 0).getTime();
  const mc = candidateContext([{ role: 'user', type: 'text', content: '早', time: morning - 3600000, id: 'u1' }]);
  const ms = baseState(morning);
  ms.automations.morningSleep = true;
  mc.st = ms; mc.now = morning; mc.c = { id: 'role' };
  vm.runInContext('this.pick=companionAutomationCandidate(c,st,now)', mc);
  assert.equal(mc.pick.kind, 'morningSleep');

  const evening = new Date(2026, 7, 6, 22, 0, 0).getTime();
  const ec = candidateContext([{ role: 'user', type: 'text', content: '我去忙了', time: evening - 3600000, id: 'u2' }]);
  const es = baseState(evening);
  es.automations.eveningScreen = true;
  ec.st = es; ec.now = evening; ec.c = { id: 'role' };
  vm.runInContext('this.pick=companionAutomationCandidate(c,st,now)', ec);
  assert.equal(ec.pick.kind, 'eveningScreen');
  assert.match(ec.pick.note, /QQ 30分钟/);
  assert.match(ec.pick.note, /音乐 10分钟/);
  es.automationRuns.eveningScreen = ec.pick.runValue;
  vm.runInContext('this.repeat=companionAutomationCandidate(c,st,now)', ec);
  assert.equal(ec.repeat, null);
});

test('custom windows support overnight ranges and stay once per logical day', () => {
  const now = new Date(2026, 7, 7, 1, 0, 0).getTime();
  const context = candidateContext([{ role: 'assistant', type: 'text', content: '晚安', time: now - 60000, id: 'a1' }]);
  const st = baseState(now);
  st.automations.eveningScreen = true;
  st.automationWindows.usageStart = '22:30';
  st.automationWindows.usageEnd = '02:00';
  context.st = st; context.now = now; context.c = { id: 'role' };
  vm.runInContext('this.pick=companionAutomationCandidate(c,st,now)', context);
  assert.equal(context.pick.kind, 'eveningScreen');
  assert.equal(context.pick.runValue, '2026-08-06');
});

test('good morning triggers the daily sleep check immediately with authorized live context', () => {
  const now = new Date(2026, 7, 6, 6, 20, 0).getTime();
  const context = candidateContext([{ role: 'user', type: 'text', content: '早安老公', time: now, id: 'u-morning' }]);
  const st = baseState(now);
  st.automations.morningSleep = true;
  st.automationWindows.sleepStart = '09:00';
  st.automationWindows.sleepEnd = '11:00';
  context.st = st; context.now = now; context.c = { id: 'role' };
  vm.runInContext('this.pick=companionMorningSleepCandidate(c,st,now)', context);
  assert.equal(context.pick.kind, 'morningSleep');
  assert.equal(context.pick.replyingToGoodMorning, true);
  assert.match(context.pick.note, /正常承接这句早安/);
  assert.match(context.pick.note, /今日步数 4321 步/);
  assert.doesNotMatch(context.pick.note, /最新心率|iPhone 电量|最近位置/);
  assert.match(context.pick.note, /本次必查不包含心率、电量或位置/);
});

test('emotion care always requests a fresh heart-rate read and never treats it as proof', () => {
  const now = new Date(2026, 7, 6, 18, 0, 0).getTime();
  const context = candidateContext([{ role: 'user', type: 'text', content: '我有点难过，想哭', time: now - 25 * 60000, id: 'sad-1' }]);
  const st = baseState(now);
  st.automations.emotionCare = true;
  context.st = st; context.now = now; context.c = { id: 'role' };
  vm.runInContext('this.pick=companionAutomationCandidate(c,st,now)', context);
  assert.equal(context.pick.kind, 'emotionCare');
  assert.match(context.pick.note, /心率不能证明ta撒谎、哭泣/);
  assert.match(app, /心率升高或降低不能证明撒谎、哭泣、背叛或任何具体情绪/);
  assert.match(functionSource('sendText'), /companionEmotionCareSchedule\(c,t\)/);
  const care = functionSource('companionEmotionCareSchedule');
  const signal = functionSource('companionHeartCareSignal');
  assert.match(care, /queueNativeInspection\(c\.id,lastUser,'iPhone心率'/);
  assert.doesNotMatch(care, /companionAutomationFresh\(health\.ts/);
  assert.match(care, /绝不能证明ta撒谎、哭泣/);
  assert.match(signal, /我没骗你/);
  assert.match(signal, /你上一轮已经明确怀疑ta可能在欺骗或隐瞒/);
  assert.match(signal, /别\|不要\|不许\|不用/);
  assert.match(app, /难过或怀疑时尝试查看心率/);
  assert.match(app, /每次重新读取；只作关心线索/);
});

test('a charging confirmation checks the fresh real battery state before the role replies', () => {
  const messages = [
    { role: 'assistant', type: 'text', content: '电量这么低，先去充电。充上了告诉我。', time: 1000, id: 'a-charge' },
    { role: 'user', type: 'text', content: '充了，正在充电', time: 2000, id: 'u-charge' },
  ];
  const context = vm.createContext({
    msgs: () => messages,
    msgToText: (m) => m.content || '',
    Date,
  });
  vm.runInContext(functionSource('companionChargingConfirmationSignal'), context);
  context.c = { id: 'role' };
  context.lu = messages[1];
  vm.runInContext('this.positive=companionChargingConfirmationSignal(c,lu)', context);
  assert.equal(context.positive.answer, '充了，正在充电');

  messages[1].content = '还没充，等一下';
  vm.runInContext('this.negative=companionChargingConfirmationSignal(c,lu)', context);
  assert.equal(context.negative, null);

  messages[0].content = '我今天看到一个充电器';
  messages[1].content = '我充了';
  vm.runInContext('this.incidental=companionChargingConfirmationSignal(c,lu)', context);
  assert.equal(context.incidental, null);

  const schedule = functionSource('companionChargingConfirmationSchedule');
  assert.match(schedule, /queueNativeInspection\(c\.id,lu,'iPhone电量'/);
  assert.match(schedule, /immediate:true,forceResult:true,suppressInitial:true/);
  assert.match(schedule, /显示充电中或已充满才可以确认/);
  assert.match(schedule, /不能拿旧快照冒充本次结果/);
  assert.match(functionSource('aiReply'), /companionChargingConfirmationSchedule\(c,_lu\)/);
});

test('absence battery check is rate limited and cannot invent a shutdown', () => {
  assert.match(app, /now-last>=6\*3600000&&count<2/);
  assert.match(app, /只有电量为0且状态明确时才能怀疑关机/);
  assert.match(app, /runs\.absenceBatteryCount=\(\+runs\.absenceBatteryCount\|\|0\)\+1/);
});

test('snapshots cannot manufacture manual unlock authority and explicit events stay single-delivery', () => {
  assert.doesNotMatch(functionSource('companionApplyServerPayloadV7'), /manual-unlock\|/);
  assert.match(functionSource('companionApplyServerPayloadV7'), /companionMergeAutomationEvents/);
  assert.match(functionSource('companionMergeAutomationEvents'), /x\.explicit===true/);
  assert.match(app, /companionSetLockIntent\(st,app,false/);
  assert.match(functionSource('companionRecordExplicitManualUnlock'), /explicit:true/);
  assert.match(app, /真实 iPhone 的明确执行记录/);
  assert.doesNotMatch(functionSource('companionAutomationMaybeSend'), /c\.proactive/);
  assert.match(app, /now-\(\+x\.ts\|\|0\)<24\*3600000/);
  assert.match(functionSource('companionAutomationMaybeSend'), /if\(!manual&&/);
  assert.match(app, /event\.delivered=true/);
});

test('a private-app manual unlock is handed to the server instead of being stranded locally', () => {
  assert.match(functionSource('roleServerAutomationConfig'), /automationEvents/);
  assert.match(functionSource('companionSendCommand'), /roleServerPushSync\(c,true\)/);
  assert.match(functionSource('companionSendCommand'), /roleBackgroundDispatchNow\(false\)/);
  assert.match(phoneRolePush, /configUnlockEvents/);
  assert.match(phoneRolePush, /snapshotUnlockEvents/);
});

test('companion automation reuses the existing initiative queue and its wake checks', () => {
  assert.match(app, /function checkInitiative\(\).*companionAutomationMaybeSend\(\)/);
  assert.match(app, /scheduleReply\(c\.id,candidate\.note/);
  assert.match(app, /initiativeQueueNote\(c,\{kind:'companion-'/);
  assert.match(app, /document\.visibilityState==='hidden'/);
  assert.match(functionSource('sendText'), /companionGoodMorningSchedule\(c,t\)/);
  assert.match(functionSource('companionAutomationMaybeSend'), /required=!!\(candidate&&candidate\.requiredDaily\)/);
  assert.match(functionSource('offlineReplyIntent'), /设备真实快照.*return'companion'/);
  assert.match(functionSource('offlineReplyBlocked'), /intent==='companion'.*roleServerPushDeliveryBlocked\(id\)/);
});
