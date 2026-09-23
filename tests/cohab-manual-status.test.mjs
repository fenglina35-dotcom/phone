import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/* 她说「线下约会的共同生活的状态无法修改了，修改了就是没有反应，没有变化，
   它显示已经改了，但是上面还是那个原来的状态」。里面其实叠了三个毛病：
   ① 作息同步会立刻把手动改的状态盖回去 —— 保存时算档位用的是本机时间，
      后台同步用的是角色时区的时间，角色一旦不在本机时区，两边算出来的档位
      就对不上，手动那一下立刻被判成「换档了」，被作息覆盖；
   ② 上面那行字只在「外出」时才显示「正在做什么」，在家和一起外出这两档
      改了活动一个字都不变，看着就像没保存；
   ③ 把地点清空保存不掉，旧地点一直挂着。 */

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const WEB = 'app.js';
const PRIVATE = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js';

function functionSource(source, name) {
  const match = source.match(new RegExp(`\\n(?:async )?function ${name}\\(`));
  assert.ok(match, `missing ${name}`);
  const start = match.index + 1;
  let depth = 0, quote = '', escaped = false;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quote = char;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const FNS = [
  'activityHash', 'activityPick', 'activitySpec', 'roleWorkday', 'roleLeaveOn',
  'scheduleLeaves', 'scheduleDateKey', 'toMin', 'cohabSchedulePhase',
  'cohabScheduleSync', 'cohabAdvance', 'cohabPhaseLabel', 'cohabPhaseDefaultActivity',
  'cohabActivityClean', 'cohabPlaceClean', 'cohabStatusLabel', 'cohabSetPhase',
  'cohabManualStatusSave', 'cohabTravelAdvance',
];

/* 角色时区比本机早 5 小时 —— 正是她那种「角色在国外」的设定 */
const ROLE_SHIFT = 5 * 3600 * 1000;

function makeBox(source, { inputs, phase = 'home', activity = '在家', place = '客厅', now }) {
  const counts = { render: 0, toast: [] };
  const d = {
    phase, activity, place, placeAt: 0, phaseAt: now - 6e5, startedAt: now - 9e6,
    nextAt: 0, nextPhase: '', scheduleSlotKey: '', stateSource: 'schedule-auto', msgs: [],
  };
  const c = {
    id: 'c1', name: '小宝', remark: '小宝', job: '设计',
    sched: { on: true, work: '公司', home: '家', amS: '08:00', amE: '12:00', pmS: '14:00', pmE: '18:00', leaves: [] },
  };
  const box = {
    Date, Math, String, Number, Array, Object, JSON, Set, Map, isNaN, parseInt, RegExp, Boolean,
    S: { settings: { timeAware: true }, cohabitation: { enabled: true, paused: false, cid: 'c1', homes: { c1: d } }, travel: null },
    getC: () => c,
    cohabRoot: () => box.S.cohabitation,
    cohabData: () => d,
    /* 角色的钟和本机的钟差 5 小时 */
    roleClockDate: t => new Date((+t || Date.now()) + ROLE_SHIFT),
    save: () => {}, saveNow: () => {},
    render: () => { counts.render += 1; },
    closeModal: () => {},
    toast: m => counts.toast.push(String(m)),
    cohabSceneActive: () => false,
    cohabQueueArrival: () => {}, cohabPushNotice: () => {}, tvAddStamp: () => {},
    $: id => ({ value: inputs[id.slice(1)] }),
  };
  vm.runInNewContext(FNS.map(n => functionSource(source, n)).join('\n'), box);
  return { box, d, counts };
}

for (const [label, path] of [['网页版', WEB], ['私人版', PRIVATE]]) {
  const source = read(path);

  test(`${label}：手动改了共同生活状态，作息同步不许马上盖回去`, () => {
    /* 本机周一 09:00；角色那边已经 14:00，落在下午上班那一档 */
    const now = new Date(2026, 8, 14, 9, 0, 0).getTime();
    const { box, d } = makeBox(source, {
      now, phase: 'work', activity: '在上班', place: '公司',
      inputs: { cohab_manual_phase: 'home', cohab_manual_activity: '在做饭', cohab_manual_place: '厨房', cohab_manual_minutes: '0' },
    });
    box.Date.now = () => now;
    vm.runInContext("cohabManualStatusSave('c1')", box);
    assert.equal(d.phase, 'home', '保存那一下要真的改掉');
    assert.equal(d.stateSource, 'owner-manual');
    /* 接下来任何一次 cohabAdvance 都不许把它推回作息里那一档 */
    vm.runInContext(`cohabAdvance('c1',${now + 1000})`, box);
    assert.equal(d.phase, 'home', '手动改完马上被作息盖回去了，她看到的就是「没反应」');
    assert.equal(d.activity, '在做饭');
    assert.equal(d.stateSource, 'owner-manual');
  });

  test(`${label}：在家和一起外出也要显示「正在做什么」`, () => {
    const now = Date.now();
    const { box } = makeBox(source, { now, inputs: {} });
    const label2 = o => vm.runInContext(`cohabStatusLabel(${JSON.stringify(o)})`, box);
    assert.equal(label2({ phase: 'home', place: '厨房', activity: '在做饭' }), '在家 · 在厨房 · 在做饭',
      '在家改了活动，上面那行必须跟着变，不然就像没保存');
    assert.equal(label2({ phase: 'together-away', place: '公园', activity: '在散步' }), '一起外出 · 公园 · 在散步');
    /* 和地点重复的不啰嗦写两遍 */
    assert.equal(label2({ phase: 'home', place: '厨房', activity: '在厨房' }), '在家 · 在厨房');
    /* 没改过活动（还是那档的默认值）就还是原来那样 */
    assert.equal(label2({ phase: 'home', place: '玄关', activity: '在家' }), '在家 · 在玄关');
    assert.equal(label2({ phase: 'work', activity: '在上班' }), '上班中 · 在上班');
  });

  test(`${label}：把地点清空要真的清掉，不能留着旧的`, () => {
    const now = new Date(2026, 8, 14, 9, 0, 0).getTime();
    const { box, d } = makeBox(source, {
      now, phase: 'home', place: '厨房', activity: '在做饭',
      inputs: { cohab_manual_phase: 'home', cohab_manual_activity: '在发呆', cohab_manual_place: '', cohab_manual_minutes: '0' },
    });
    box.Date.now = () => now;
    vm.runInContext("cohabManualStatusSave('c1')", box);
    assert.equal(d.place, '', '她特地清空了地点，就不该再挂着「厨房」');
    assert.equal(d.activity, '在发呆');
  });

  test(`${label}：保存完一定重绘，不是只有在共同生活页里才重绘`, () => {
    const now = new Date(2026, 8, 14, 9, 0, 0).getTime();
    const { box, counts } = makeBox(source, {
      now, inputs: { cohab_manual_phase: 'away', cohab_manual_activity: '在逛街', cohab_manual_place: '商场', cohab_manual_minutes: '0' },
    });
    box.Date.now = () => now;
    /* cohabSceneActive() 是 false —— 她可能是从微信那边的状态条点进来改的 */
    vm.runInContext("cohabManualStatusSave('c1')", box);
    assert.ok(counts.render >= 1, '保存完没重绘，上面那行当然还是原来的状态');
    assert.ok(counts.toast.some(t => t.includes('在逛街')), 'toast 要报改完之后的状态');
  });
}
