import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// SKY_SYNC_NO_BLOCK_V1 (2026-10-30, her phone diagnostics): before every 先生 reply the private app awaited
// NorthSkyRoleSync.preparePhone(c), two or three cloud calls. When the network dropped they threw 「Load failed」,
// the whole reply was abandoned before any model request (诊断「未到模型请求阶段或已被其他流程接管」, a short English
// toast). The Sky sync must never stop or hold up a WeChat reply.
const PRIVATE = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js';
function fn(src, name) {
  const i = src.indexOf('async function ' + name + '(');
  assert(i >= 0, name + ' is defined in the private bundle');
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
const s = fs.readFileSync(PRIVATE, 'utf8');
const load = (prepare) => { const ctx = { setTimeout, clearTimeout, NorthSkyRoleSync: { preparePhone: prepare } }; vm.createContext(ctx); vm.runInContext(fn(s, 'skyPrepareBeforeReply'), ctx); return ctx; };

test('a failed Sky sync does not throw into the reply', async () => {
  const ctx = load(async () => { throw new TypeError('Load failed'); });
  assert.equal(await ctx.skyPrepareBeforeReply({ id: 'r1' }, 50), 'failed');
});
test('a slow Sky sync is waited for only a short while, and its late failure is swallowed', async () => {
  let rejectLate;
  const ctx = load(() => new Promise((_, reject) => { rejectLate = reject; }));
  const started = Date.now();
  assert.equal(await ctx.skyPrepareBeforeReply({ id: 'r1' }, 60), 'timeout');
  assert(Date.now() - started < 1000);
  let unhandled = false; const onU = () => { unhandled = true; }; process.on('unhandledRejection', onU);
  rejectLate(new TypeError('Load failed')); await new Promise(r => setTimeout(r, 30)); process.off('unhandledRejection', onU);
  assert.equal(unhandled, false);
});
test('a normal Sky sync still finishes before the reply', async () => {
  let done = false; const ctx = load(async () => { done = true; });
  assert.equal(await ctx.skyPrepareBeforeReply({ id: 'r1' }, 1000), 'ok'); assert.equal(done, true);
});
test('aiReply uses the guarded call, not a bare await', () => {
  assert(!s.includes('{await NorthSkyRoleSync.preparePhone(c);if(replyStale('), 'bare await is gone');
  assert(s.includes("if(!note&&typeof NorthSkyRoleSync!=='undefined'){await skyPrepareBeforeReply(c);if(replyStale(id,replyToken,replyAccount)||actId()!==replyAccount)return false;}"));
});

// TURN_ERROR_RECORD_V1: an error before any model request is written onto that turn in 请求故障诊断.
for (const file of ['request-diagnostics.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/request-diagnostics.js']) {
  test(file + ': an error before the model request is recorded on the turn', () => {
    const store = {};
    const ctx = { localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, actId: () => 'main', S: { settings: {} }, APP_VER: 'test' };
    ctx.globalThis = ctx; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
    const D = ctx.NorthRequestDiagnostics, turn = { c: { id: 'r1' }, channel: 'online' };
    D.turn(turn);
    assert.equal(D.turnError('r1', 'main', 'Load failed'), true);
    D.finishTurn(turn, '', { delivered: false });
    assert.match(turn.requestDiagnostic.reason, /还没请求模型就出错：Load failed/);
    const other = { c: { id: 'r1' }, channel: 'online' }; D.turn(other); D.finishTurn(other, '', { delivered: false });
    assert.equal(other.requestDiagnostic.reason, '未到模型请求阶段或已被其他流程接管', 'without an error the old wording stays');
  });
}
