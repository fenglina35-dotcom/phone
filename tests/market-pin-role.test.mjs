// MARKET_PIN_ROLE_V1：真人店铺支付密码可以让情侣角色知道，忘了问他找回。
// 密码先请云端核对（改成同一个密码），对了才存在本机；只有她问情侣角色支付密码的那一轮才带给他。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, PRIV_DIR, BUNDLES } from './_helpers.mjs';

for (const [label, file] of [['web', 'commerce-ui.js'], ['private', PRIV_DIR + 'commerce-ui.js']]) {
  const src = read(file);
  const block = () => {
    const a = src.indexOf('/* MARKET_PIN_ROLE_V1'), b = src.indexOf('window.northMarketPinSave=', a), c = src.indexOf('\n', b);
    assert.ok(a > 0 && b > a, '缺少 MARKET_PIN_ROLE_V1');
    return src.slice(a, c);
  };
  const harness = (realPin) => {
    const calls = [], toasts = [];
    const ctx = vm.createContext({
      S: { me: {}, couple: { cid: 'r1' } }, getC: (id) => ({ id, name: '林深', remark: '先生' }), esc: String, save: () => {}, toast: (t) => toasts.push(t), openModal: () => {}, closeModal: () => {},
      document: { getElementById: (id) => ctx.__inputs[id] || null }, __inputs: {},
      northMarketBusy: false, northMarketEnsure: async () => {},
      northMarketRpc: async (name, args) => { calls.push([name, args]); if (args.p_old !== realPin) throw new Error('支付密码不对'); return { ok: true }; },
    });
    ctx.window = ctx; ctx.northMarketPinSettings = () => {};
    vm.runInContext('var northMarketBusy=false;' + block(), ctx);
    return { ctx, calls, toasts };
  };

  test(label + ' the current password is checked with the cloud before he is told, and only stored when right', async () => {
    const { ctx, calls } = harness('24680');
    ctx.__inputs.north_market_role_pin = { value: '11111' };
    await ctx.northMarketPinRoleOn();
    assert.equal(ctx.S.me.marketPinRole, undefined, '密码不对就不存');
    ctx.__inputs.north_market_role_pin = { value: '24680' };
    await ctx.northMarketPinRoleOn();
    assert.equal(ctx.S.me.marketPinRole.pin, '24680');
    assert.equal(JSON.stringify(calls.at(-1)), JSON.stringify(['pin', { p_old: '24680', p_new: '24680' }]), '用改成同一个密码来核对，不会真的改');
    ctx.__inputs.north_market_old_pin = { value: '24680' }; ctx.__inputs.north_market_new_pin = { value: '13579' }; ctx.__inputs.north_market_confirm_pin = { value: '13579' };
    await ctx.northMarketPinSave();
    assert.equal(ctx.S.me.marketPinRole.pin, '13579', '以后改了密码，他知道的也跟着改');
    ctx.northMarketPinRoleOff();
    assert.equal(ctx.S.me.marketPinRole, undefined);
  });

  test(label + ' only the couple role, and only when she asks about the password, gets it for that one reply', () => {
    const { ctx } = harness('24680');
    ctx.S.me.marketPinRole = { pin: '24680', cid: 'r1' };
    const note = ctx.northMarketPinRoleNote({ id: 'r1' }, '我忘了支付密码了，你还记得吗');
    assert.match(note, /24680/); assert.match(note, /不要在朋友圈、群聊、别人面前提/);
    assert.match(ctx.northMarketPinRoleNote({ id: 'r1' }, '店铺密码是多少来着'), /24680/);
    assert.equal(ctx.northMarketPinRoleNote({ id: 'r1' }, '今天好累'), '', '平时不带');
    assert.equal(ctx.northMarketPinRoleNote({ id: 'r2' }, '我忘了支付密码'), '', '别的角色不给');
    delete ctx.S.me.marketPinRole;
    assert.equal(ctx.northMarketPinRoleNote({ id: 'r1' }, '我忘了支付密码'), '', '没让他记就没有');
  });
}

for (const [label, file] of BUNDLES) {
  test(label + ' chat send passes the password note for that reply only', () => {
    assert.match(read(file), /const _pinNote=typeof window\.northMarketPinRoleNote==='function'\?window\.northMarketPinRoleNote\(c,t\):'';if\(_pinNote\)\{scheduleReply\(id,_pinNote\);return;\}/);
  });
}
