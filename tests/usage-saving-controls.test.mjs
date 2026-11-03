// Usage controls (2026-11-04): the user asked which background model calls can be saved without breaking features.
// 1. 共同生活 self-decided phone checks: switch, minimum gap (default 30 min), daily cap (default unlimited).
// 2. Cloud scheduled proactive contact: at most two model calls per check-in, unsent tries capped per day.
// 3. Call ledger: per-feature daily totals kept for 7 days (the 200-row log cannot cover a whole day).
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES, PRIV_DIR } from './_helpers.mjs';

for (const [label, file] of BUNDLES) {
  const src = read(file);
  let modelCalls = 0;
  const ctx = vm.createContext({
    Math, Number, String, Object, Array, JSON, Set, Date, Promise,
    S: { settings: {}, me: { name: '我' } }, _call: null, document: { visibilityState: 'visible' },
    _cohabPhoneDecisionBusy: new Set(), save() {}, todayStr: () => '2026-11-04', fmtDT: () => '',
    cohabRoot: () => ({ enabled: true, paused: false, cid: 'r1' }), getC: () => ({ id: 'r1', name: '他', persona: '' }),
    cohabTogetherScene: () => true, rolePhoneInspectionLaneActive: () => false, wxLoginActive: () => false,
    remoteControlActive: () => false, cohabPhoneTargets: () => ['微信聊天'], traitDesc: () => '',
    stripJSON: (x) => x, cohabPhoneTarget: () => '', cohabRunPhoneInspection: () => true,
    cohabRoleChat: async () => { modelCalls++; return '{"inspect":"none","nextMinutes":5}'; },
  });
  vm.runInContext(fnSource(src, 'cohabSettings') + ';' + fnSource(src, 'cohabPhoneAutonomyMaybe'), ctx);
  const d = { msgs: [], phoneInspectDueAt: 1 };
  ctx.cohabData = () => d;
  const fresh = ctx.cohabSettings({});
  assert.equal(fresh.autoInspect, true, `${label}: self-decided checks stay on by default`);
  assert.equal(fresh.autoInspectGap, 30, `${label}: default minimum gap is 30 minutes`);
  assert.equal(fresh.autoInspectMax, 0, `${label}: daily cap defaults to unlimited`);

  const t0 = Date.now();
  await ctx.cohabPhoneAutonomyMaybe('r1');
  assert.equal(modelCalls, 1, `${label}: a due check asks the model once`);
  assert.ok(d.phoneInspectDueAt - t0 >= 30 * 60000 - 1000, `${label}: the next ask waits the minimum gap even if the model says 5 minutes`);

  d.phoneInspectDueAt = 1; d.settings.autoInspect = false;
  await ctx.cohabPhoneAutonomyMaybe('r1');
  assert.equal(modelCalls, 1, `${label}: switched off means no model call`);

  d.settings.autoInspect = true; d.settings.autoInspectMax = 2; d.phoneInspectDueAt = 1;
  await ctx.cohabPhoneAutonomyMaybe('r1');
  d.phoneInspectDueAt = 1;
  await ctx.cohabPhoneAutonomyMaybe('r1');
  assert.equal(modelCalls, 2, `${label}: the daily cap stops further asks today`);

  assert.match(src, /他自己查你手机[\s\S]*?autoInspectGap[\s\S]*?每天最多问/, `${label}: settings show the switch, gap and cap`);
  assert.match(src, /modelLedgerDailyHTML\(\)\+'<details/, `${label}: ledger page shows the daily summary`);
}

// Cloud scheduled contact (repository copy; the live function gets the same minimal patch).
const push = read('supabase/functions/phone-role-push/index.ts');
assert.match(push, /PROACTIVE_CALL_BUDGET_V1[\s\S]*?if \(ordinaryProactive && ordinaryModelCalls >= 2\)/);
assert.match(push, /PROACTIVE_DAILY_TRIES_V1[\s\S]*?\.in\("outcome", \["silent", "unavailable"\]\)[\s\S]*?const decision = await roleMessage\(profile, recentBodies, ambientInstruction, ambientFacts, true, true\)/);

// Daily ledger totals, both bundles' request-diagnostics.js.
for (const file of ['request-diagnostics.js', PRIV_DIR + 'request-diagnostics.js']) {
  const store = {};
  const ctx = vm.createContext({
    globalThis: {}, localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
    document: { visibilityState: 'visible' }, actId: () => 'main', APP_VER: 'test',
  });
  ctx.globalThis = ctx;
  vm.runInContext(read(file), ctx);
  const D = ctx.NorthRequestDiagnostics;
  assert.equal(typeof D.daily, 'function', `${file}: daily totals exist`);
  const a = D.begin([{ role: 'user', content: 'x' }], { diagnosticFeature: '记录 ta 今天的心情' });
  D.data(a, { choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 1200, completion_tokens: 30 } });
  const b = D.begin([], { diagnosticFeature: '微信聊天' });
  D.data(b, { choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 9000, completion_tokens: 300 } });
  const c = D.begin([], { diagnosticFeature: '微信聊天（接着写）' });
  D.error(c, new Error('timeout'));
  const rows = D.daily();
  assert.equal(rows[0].feature, '微信聊天', `${file}: biggest usage first`);
  assert.equal(rows[0].n, 2, `${file}: continuation counted under its feature`);
  assert.equal(rows[0].cont, 1);
  assert.equal(rows[0].fail, 1);
  assert.equal(rows[0].input, 9000);
  assert.equal(rows[1].output, 30);
}
console.log('usage saving controls tests passed');
