// BATTERY_REMIND_ONCE_V1 与 HIS_WX_SETTINGS_GAP_V1 的回归测试。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import cp from 'node:child_process';

const PRIV = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read = (file) => process.env.FIX_TEST_OLD
  ? cp.execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8', maxBuffer: 64e6 })
  : fs.readFileSync(file, 'utf8');

function fnSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0, opened = false;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') { depth += 1; opened = true; }
    if (src[i] === '}') { depth -= 1; if (opened && depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unterminated ${name}`);
}

function batteryBlock(src) {
  const start = src.indexOf('/* BATTERY_REMIND_ONCE_V1');
  assert.notEqual(start, -1, '缺少 BATTERY_REMIND_ONCE_V1');
  const end = src.indexOf('\n', src.indexOf('companionAutomationCandidate=function', start));
  return src.slice(start, end);
}

function batteryContext(src, messages, state) {
  const ctx = vm.createContext({
    S: { me: { name: '用户' }, couple: { cid: 'r1' } },
    msgs: () => messages, msgToText: (m) => m.content || '', lastMsg: () => messages.at(-1) || null,
    fmtDT: String, initiativeQueueNote: (_c, _p, note) => note, companionState: () => state,
    companionUsageSnapshotFresh: () => true,
  });
  vm.runInContext(['companionDuration', 'companionAutomationDay', 'companionAutomationClock', 'companionAutomationMinute',
    'companionAutomationWindow', 'companionAutomationGoodMorning', 'companionAutomationFresh', 'companionAutomationRecentUser',
    'companionAutomationNote', 'companionBatteryIsCharging', 'companionMorningSleepCandidate', 'companionRequiredDailyCandidate',
    'companionAutomationCandidate'].map((n) => fnSource(src, n)).join('\n') + '\n' + batteryBlock(src)
    + ';this.candidate=companionAutomationCandidate;', ctx);
  return ctx;
}

function lowState(now, runs = {}) {
  return {
    permissions: { battery: true }, automations: { criticalBattery: true }, automationRuns: runs, automationEvents: [],
    automationWindows: {}, battery: { level: 0.05, state: '使用电池', ts: now - 60000 },
  };
}

for (const [label, file] of [['web', 'app.js'], ['private', PRIV + 'app.js']]) {
  const src = read(file);

  test(label + ' battery: a server low-battery reminder already in chat stops the phone from sending a second one', () => {
    const now = Date.now(), messages = [], st = lowState(now, { criticalBatteryOkAt: now - 3600000 });
    const ctx = batteryContext(src, messages, st);
    assert.equal(ctx.candidate({ id: 'r1' }, st, now)?.kind, 'criticalBattery', '还没提醒过时照常提醒');
    messages.push({ role: 'assistant', type: 'text', content: '宝宝，5%了。', time: now - 20 * 60000, _rolePushTrigger: 'automation:criticalBattery' });
    assert.equal(ctx.candidate({ id: 'r1' }, st, now), null, '服务器 20 分钟前已提醒，同一次没电不再提醒');
    st.automationRuns.criticalBatteryOkAt = now - 5 * 60000;
    assert.equal(ctx.candidate({ id: 'r1' }, st, now)?.kind, 'criticalBattery', '充过电以后又没电，会重新提醒');
  });

  test(label + ' battery: a late server reminder is dropped when the phone already reminded, otherwise it is counted', () => {
    const now = Date.now(), st = lowState(now, { criticalBatteryOkAt: now - 3600000 });
    const ctx = batteryContext(src, [], st);
    assert.equal(ctx.companionBatteryServerReminder(now - 60000), 'counted');
    assert.equal(st.automationRuns.criticalBatteryLow, true, '记下服务器已提醒，手机这边不再发');
    assert.equal(ctx.companionBatteryServerReminder(now), 'duplicate', '同一次没电的第二条丢掉');
    assert.equal(ctx.companionBatteryServerReminder(now - 2 * 3600000), '', '上一次没电期间的旧消息不影响');
  });

  test(label + ' battery: device reminders go through the no-verbatim-repeat check and a dropped repeat still counts as handled', () => {
    const now = Date.now(), st = lowState(now);
    const ctx = batteryContext(src, [], st);
    const note = ctx.companionAutomationNote('criticalBattery', '电量只剩 5%', { id: 'r1' });
    assert.equal(ctx.companionAutomationNoteActive(note), true);
    assert.equal(ctx.companionAutomationNoteActive('这是一次【主动消息】'), false);
    assert.match(src, /\(initiativeNoteActive\(note\)\|\|companionAutomationNoteActive\(note\)\)&&initiativeRecentlyRepeated\(id,content\)&&!_manualUnlockNote\)\{if\(companionAutomationNoteActive\(note\)\)c\._companionRepeatDropAt=Date\.now\(\);/);

    // 照抄被拦下时，回调拿到 false，但这次提醒要算已处理，不能每轮重新调用模型
    const send = fnSource(src, 'companionAutomationMaybeSend');
    const role = { id: 'r1' }, recorded = [];
    const mctx = vm.createContext({
      _companionAutomationBusy: false, document: { visibilityState: 'visible' }, S: { couple: { cid: 'r1' }, me: {} },
      getC: () => role, companionState: () => ({ ...st, linked: true, roleAccess: true }), roleServerPushDeliveryBlocked: () => false,
      cinemaRoleOccupied: () => false, roleBackgroundAvailable: () => false, replyGenerationBusy: () => false, _replyTimers: {},
      replyStateKey: (id) => id, lastMsg: () => null, companionAutomationRecord: (c) => recorded.push(c.kind),
      companionAutomationCandidate: () => ({ kind: 'criticalBattery', note: '[设备真实快照｜x]' }),
      scheduleReply: (_id, _note, cb) => { role._companionRepeatDropAt = Date.now() + 1; cb(false); return true; },
    });
    vm.runInContext(send + ';this.send=companionAutomationMaybeSend;', mctx);
    mctx.send();
    assert.deepEqual(recorded, ['criticalBattery']);
  });

  test(label + ' battery: snapshot remembers when battery was last fine, and imported server messages keep their trigger', () => {
    assert.match(src, /st\.automationRuns\.criticalBatteryLow=false;st\.automationRuns\.criticalBatteryOkAt=Math\.max\(/);
    assert.match(src, /if\(row\.triggerKind\)msg\._rolePushTrigger=String\(row\.triggerKind\);/);
    assert.match(src, /String\(row\.triggerKind\|\|''\)==='automation:criticalBattery'&&typeof companionBatteryServerReminder==='function'&&companionBatteryServerReminder\(rowAt\)==='duplicate'\)\{queueAck\(row,true\);continue;\}/);
  });

  test(label + ' role WeChat settings dialog spaces its three buttons apart', () => {
    let html = '';
    const ctx = vm.createContext({ _hisLogin: { cid: 'r1' }, openModal: (h) => { html = h; } });
    vm.runInContext(fnSource(src, 'hisWxSettings') + ';this.open=hisWxSettings;', ctx);
    ctx.open('r1');
    const wrap = html.match(/<div class="btns[^"]*" style="([^"]*)">([\s\S]*)<\/div>/);
    assert.ok(wrap, '三个按钮要放进带间距的按钮组');
    assert.match(wrap[1], /flex-direction:column/);
    assert.match(wrap[1], /gap:8px/);
    assert.equal((wrap[2].match(/<button class="btn g"/g) || []).length, 3);
  });
}
