/* HEALTH_KEEP_LAST_V1（2026-10-20）：她在后台看到之前有心率，App 里却没有。手机锁着时 HealthKit 读不到，
   新上传的一份健康数据里心率为空，App 以前整份替换，之前的心率就消失了。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function fn(src, name) {
  const start = src.indexOf('function ' + name + '('); assert.ok(start >= 0, name);
  let i = src.indexOf('{', start), depth = 0, q = '', esc = false;
  for (; i < src.length; i++) { const ch = src[i];
    if (q) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === q) q = ''; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '{') depth++; else if (ch === '}' && --depth === 0) return src.slice(start, i + 1); }
  throw new Error(name);
}

for (const p of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  test(p + ': a new health snapshot without heart rate keeps the last one with its own time', () => {
    const src = read(p), ctx = vm.createContext({});
    vm.runInContext(fn(src, 'companionKeepLastHealth'), ctx);
    const prev = {ts: 1, steps: 100, heartRateBpm: 68, heartRateAt: 1000, heartRateSource: 'Apple Watch', hrvMs: 40, hrvAt: 900, hrvSource: 'Apple Watch', electrocardiogramAt: null};
    const locked = {ts: 2, steps: 120, heartRateBpm: null, heartRateAt: null, heartRateSource: '', hrvMs: null, hrvAt: null, hrvSource: '', electrocardiogramAt: null};
    const kept = ctx.companionKeepLastHealth(locked, prev);
    assert.equal(kept.heartRateBpm, 68); assert.equal(kept.heartRateAt, 1000); assert.equal(kept.heartRateSource, 'Apple Watch');
    assert.equal(kept.hrvMs, 40); assert.equal(kept.steps, 120, 'new values still win');
    const fresh = ctx.companionKeepLastHealth(Object.assign({}, locked, {heartRateBpm: 75, heartRateAt: 2000}), prev);
    assert.equal(fresh.heartRateBpm, 75); assert.equal(fresh.heartRateAt, 2000);
    assert.equal(ctx.companionKeepLastHealth(null, prev), prev, 'a snapshot without health keeps the last health');
    assert.match(fn(src, 'companionApplyServerPayloadV7'), /companionKeepLastHealth\(companionNormalizeHealth\(snapshot\.health\),prior&&prior\.health\)/);
  });
}
