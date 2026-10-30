import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// COUPLE_REAL_LOCATION_V1 (2026-10-30, her screenshot: 南天成路62号, 误差约 52 米, two or three km from home, yet he kept
// saying she was at home). The 情侣空间 card was right; the 共同生活 prompt called its simulated 「在家」 the highest truth.
// A fresh real location away from home is now written next to the 共同生活 status.
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  const load = (loc) => {
    const st = { roleAccess: true, permissions: { location: true }, homeLocation: { lat: 31.40, lng: 120.62, radius: 200 }, location: loc };
    const ctx = { S: { me: { name: 'North' }, couple: { cid: 'r1' } }, companionState: () => st, fmtDT: () => '10月22日 06:28', Math };
    vm.createContext(ctx);
    vm.runInContext(['companionNormalizeHomeLocation', 'companionHomeLocation', 'companionDistanceMeters', 'companionLocationAtHome', 'companionRealAwayFact'].map(n => fn(s, n)).join('\n'), ctx);
    return ctx;
  };
  const away = { lat: 31.4232, lng: 120.6386, accuracy: 52, place: '江苏省苏州市相城区南天成路62号', sourcePlace: '江苏省苏州市相城区南天成路62号', ts: Date.now() - 60000 };
  test(file + ': he is told she is out when her iPhone says so', () => {
    const t = load(away).companionRealAwayFact({ id: 'r1' });
    assert.match(t, /North此刻不在家，在「江苏省苏州市相城区南天成路62号」/); assert.match(t, /误差约 52 米/);
  });
  test(file + ': nothing is added at home, for old locations, or for other roles', () => {
    assert.equal(load(Object.assign({}, away, { lat: 31.4001, lng: 120.6201 })).companionRealAwayFact({ id: 'r1' }), '', 'at home');
    assert.equal(load(Object.assign({}, away, { ts: Date.now() - 2 * 3600e3 })).companionRealAwayFact({ id: 'r1' }), '', 'too old');
    assert.equal(load(away).companionRealAwayFact({ id: 'r2' }), '', 'not the couple role');
  });
  test(file + ': both the WeChat and the 共同生活 prompts carry it', () => {
    assert.equal((s.match(/typeof companionRealAwayFact==='function'\?companionRealAwayFact\(c\):''/g) || []).length, 3);
  });
}
