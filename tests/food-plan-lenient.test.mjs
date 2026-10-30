import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// FOOD_PLAN_LENIENT_V1 (2026-10-30, her screenshot 「外卖暂时没有下单成功：点餐需求未能解析」): the role decided to order
// 南瓜小米粥 but the step that reads the model's order plan rejected the whole order for small format slips, e.g. the
// quantity written as "1" instead of 1 or one preference missing a field. Usable parts are now kept; only a plan with
// nothing usable fails, and the failure says which part was wrong.
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
for (const file of ['commerce-ui.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js']) {
  const s = fs.readFileSync(file, 'utf8');
  const spec = s.match(/var NORTH_SPEC_WORD=[^\n]*?;\n/)[0];
  const load = () => { const ctx = {}; vm.createContext(ctx); vm.runInContext(spec + ['northRoleModelJSON', 'northRoleInt', 'northRoleWords', 'northRolePrefs', 'northRolePlanItems', 'northRoleMoveSpecWords', 'northRolePlan'].map(n => fn(s, n)).join('\n'), ctx); return ctx; };
  const plan = (o) => JSON.stringify(o);
  test(file + ': small format slips no longer cancel the order', () => {
    const ctx = load();
    let p = ctx.northRolePlan(plan({ queries: ['南瓜小米粥', '粥'], must: ['南瓜', '粥'], quantity: '1' }), '南瓜小米粥', '', '');
    assert.equal(p.quantity, 1, 'quantity written as text');
    p = ctx.northRolePlan(plan({ queries: ['粥'], must: ['粥'] }), '南瓜小米粥', '', '');
    assert.equal(p.quantity, 1, 'quantity missing means one');
    p = ctx.northRolePlan(plan({ queries: ['粥'], must: ['粥'], quantity: 1, preferences: [{ group: '温度', value: '热' }, { group: '甜度' }, null] }), '南瓜小米粥', '', '');
    assert.equal(p.preferences.length, 1, 'a broken preference is dropped, not fatal');
    p = ctx.northRolePlan(plan({ queries: [], must: ['粥'], quantity: 1 }), '南瓜小米粥', '', '');
    assert(p.queries.includes('南瓜小米粥'), 'the ordered name is always searched');
    p = ctx.northRolePlan('好的，我来帮你点：' + plan({ queries: ['粥'], must: ['粥'], quantity: 2, specs: { size: '大份' } }), '南瓜小米粥', '', '');
    assert.equal(p.quantity, 2); assert.equal(typeof p.specs, 'string');
  });
  test(file + ': a plan with nothing usable still fails before payment, and says why', () => {
    const ctx = load();
    assert.throws(() => ctx.northRolePlan('我不知道', '南瓜小米粥', '', ''), /尚未扣款/);
    assert.throws(() => ctx.northRolePlan(plan({ queries: ['粥'], must: [], quantity: 1 }), '', '', ''), /口味与品类/);
  });
}
