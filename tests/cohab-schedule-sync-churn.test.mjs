import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
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

const SCHEDULE_FUNCTIONS = [
  'activityHash', 'activityPick', 'activitySpec', 'roleWorkday', 'roleLeaveOn',
  'scheduleLeaves', 'scheduleDateKey', 'toMin', 'cohabSchedulePhase',
  'cohabScheduleSync', 'cohabAdvance', 'cohabPhaseDefaultActivity',
  'cohabTravelAdvance', 'cohabActivityClean', 'cohabPlaceClean',
];

// Ticks the real schedule sync the way setInterval(cohabPhoneAutonomyTick,15000) does,
// with cohabData applying its own 12-character activity cleaning on every read.
function tickWorkHours(source, { work, job, ticks = 40 }) {
  const counts = { save: 0, render: 0, push: 0 };
  const d = {
    phase: 'home', activity: '在家', place: '家', placeAt: 0, phaseAt: 0,
    nextAt: 0, nextPhase: '', scheduleSlotKey: '', stateSource: '', msgs: [],
  };
  const c = {
    id: 'c1', name: '先生', job,
    sched: { on: true, work, home: '家', amS: '08:00', amE: '12:00', pmS: '14:00', pmE: '18:00', leaves: [] },
  };
  const sandbox = {
    Date, Math, String, Number, Array, Object, JSON, Set, Map, isNaN, parseInt, RegExp,
    S: { settings: { timeAware: true }, cohabitation: { enabled: true, paused: false, cid: 'c1', homes: { c1: d } }, travel: null },
    getC: () => c,
    cohabRoot: () => sandbox.S.cohabitation,
    cohabData: () => {
      d.activity = sandbox.cohabActivityClean(d.activity) || sandbox.cohabPhaseDefaultActivity(d.phase);
      return d;
    },
    roleClockDate: t => new Date(+t || Date.now()),
    save: () => { counts.save += 1; },
    render: () => { counts.render += 1; },
    cohabSceneActive: () => true,
    cohabQueueArrival: () => {},
    roleServerPushSyncSoon: () => { counts.push += 1; },
    cohabPushNotice: () => {},
    tvAddStamp: () => {},
  };
  vm.runInNewContext(SCHEDULE_FUNCTIONS.map(name => functionSource(source, name)).join('\n'), sandbox);
  let now = new Date(2026, 8, 14, 15, 0, 0).getTime(); // Monday afternoon, inside the 14:00-18:00 work slot
  for (let i = 0; i < ticks; i += 1) {
    sandbox.cohabAdvance('c1', now);
    now += 15000;
  }
  return { counts, stored: d.activity, phase: d.phase };
}

for (const [label, path] of [['web', WEB], ['private', PRIVATE]]) {
  test(`${label}: a long workplace or job name no longer re-saves the cohab schedule every 15 seconds`, () => {
    const source = read(path);

    const short = tickWorkHours(source, { work: '公司', job: '设计' });
    assert.equal(short.phase, 'work');
    assert.equal(short.counts.save, 1, 'a settled work slot saves once');

    // '在市中心设计工作室忙平面设计相关的事' is 18 characters, past the 12-character
    // cohabActivityClean limit that cohabData re-applies on every read. Comparing the
    // raw spec.label against that stored, truncated value reported a change on every
    // tick and drove save/render/server-sync four times a minute for the whole work
    // block, which is what made the private App stutter only while the role was at work.
    const long = tickWorkHours(source, { work: '市中心设计工作室', job: '平面设计' });
    assert.equal(long.phase, 'work');
    assert.ok(long.stored.length <= 12, 'the stored activity stays within the cleaning limit');
    assert.equal(long.counts.save, 1, 'a long work label must not re-save on every tick');
    assert.equal(long.counts.render, 1, 'a long work label must not re-render on every tick');
    assert.equal(long.counts.push, 1, 'a long work label must not queue a server sync on every tick');
  });

  test(`${label}: repeated role server sync requests coalesce into the last one`, () => {
    const source = read(path);
    let scheduled = 0, cleared = 0, ran = 0;
    const pending = new Map();
    let nextId = 1;
    const sandbox = {
      String, Object,
      getC: () => ({ id: 'c1', proactive: { serverPush: true } }),
      roleServerPushSync: () => { ran += 1; },
      setTimeout: fn => { scheduled += 1; const id = nextId++; pending.set(id, fn); return id; },
      clearTimeout: id => { if (pending.delete(id)) cleared += 1; },
    };
    vm.runInNewContext(
      source.slice(source.indexOf('const _roleServerPushSoonTimers='), source.indexOf('\n', source.indexOf('function roleServerPushSyncSoon('))),
      sandbox,
    );
    for (let i = 0; i < 10; i += 1) sandbox.roleServerPushSyncSoon('c1');
    assert.equal(cleared, 9, 'each new request cancels the one still pending');
    for (const fn of [...pending.values()]) fn();
    assert.equal(ran, 1, 'ten rapid triggers perform a single server sync');
    assert.equal(scheduled, 10);
  });
}
