import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// COMPANION_MULTI_BIND_V1 (2026-10-30, her request): one 小手机 App can be linked to several iPhone Apps. Before, linking a
// second iPhone App to the same 小手机 App dropped the first one, and locks and limits only reached one iPhone App.
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  test(file + ': linking a second iPhone App keeps the first', () => {
    assert(s.includes('st.bindings=st.bindings.filter(x=>x.externalAppId!==app.id);'));
    assert(!s.includes('x.externalAppId!==app.id&&x.internalAppId!==internalId'));
  });
  test(file + ': a lock reaches every linked iPhone App, the 小手机 side changes once', () => {
    const st = { bindings: [{ internalAppId: 'shop', externalAppId: 'ios.a' }, { internalAppId: 'shop', externalAppId: 'ios.b' }, { internalAppId: 'food', externalAppId: 'ios.c' }] };
    const calls = [];
    const ctx = { companionState: () => st };
    vm.createContext(ctx);
    vm.runInContext(fn(s, 'companionBindingsForInternal') + '\n' + fn(s, 'companionDispatchBound'), ctx);
    ctx.companionDispatchBoundOne = (action, id, opt, b) => { calls.push([b && b.externalAppId, !!opt._skipInternal]); return { ok: true, detail: b.externalAppId, scope: 'both', internalId: opt._skipInternal ? '' : id, externalId: b.externalAppId }; };
    const r = ctx.companionDispatchBound('lock', 'shop', {});
    assert.deepEqual(calls, [['ios.a', false], ['ios.b', true]]);
    assert.deepEqual(r.externalIds, ['ios.a', 'ios.b']); assert.equal(r.internalId, 'shop');
    calls.length = 0; ctx.companionDispatchBound('lock', 'food', {}); assert.deepEqual(calls, [['ios.c', false]], 'a single link works as before');
  });
}
