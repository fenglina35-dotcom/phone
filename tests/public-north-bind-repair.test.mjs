// PUBLIC_NORTH_BIND_REPAIR_V1（2026-10-31 她说：私人版虚拟 App 关联真实 App 不会再变回去，公开版还会）：
// 公开 North 读回的 App 编号变了时，要像私人版一样按名字/外置编号把关联接回去；读到一次「没连上」也不清空关联。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = process.env.FIX_TEST_ROOT || new URL('..', import.meta.url).pathname;

function fnSrc(src, name) {
  const i = src.indexOf('function ' + name + '(');
  const ends = [src.indexOf('\nfunction ', i + 5), src.indexOf('\nasync function ', i + 5)].filter(x => x > 0);
  return src.slice(i, Math.min(...ends));
}

function setup() {
  const app = fs.readFileSync(ROOT + '/app.js', 'utf8');
  const store = {};
  const ctx = {
    S: { couple: { cid: 'r1' } }, Date, JSON, Math, Map, Set, Array, Object, String, Number, Error,
    LOCKABLE: { douyin: '抖音', wechat: '微信' },
    actId: () => 'main', cloudId: () => 'u1', uid: (() => { let n = 0; return () => 'x' + (++n); })(),
    privateNativeAppOn: () => true, renderCompanionPage: () => '', companionApplyHomeLocation() {},
    companionDefaultState: () => ({ apps: [], bindings: [], permissions: {}, automations: {}, automationWindows: {}, commands: [], lockIntents: {} }),
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(['companionRememberBindingTarget', 'companionRepairBindings', 'companionBindingBackupKey', 'companionBindingBackupRows', 'companionBindingBackupWrite', 'companionBindingBackupRestore'].map(n => fnSrc(app, n)).join('\n'), ctx);
  vm.runInContext(fs.readFileSync(ROOT + '/public-north-policy.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(ROOT + '/public-north-runtime.js', 'utf8'), ctx);
  return ctx;
}

const snap = (apps, at) => ({ linked: true, deviceId: 'dev1', snapshot: { generatedAt: new Date(at).toISOString(), screenTime: { generatedAt: new Date(at).toISOString(), apps } } });

test('公开 North 的 App 编号变了，关联按名字接回去', () => {
  const ctx = setup(), R = ctx.NorthPublicRuntime, st = R.state();
  assert.ok(R.apply(st, snap([{ id: 'tok-old', name: '抖音', bindingCode: '01' }], Date.now() - 60000)));
  st.bindings = [{ id: 'b1', internalAppId: 'douyin', externalAppId: 'tok-old', externalAppName: '抖音', externalBindingCode: '01' }];
  assert.ok(R.apply(st, snap([{ id: 'tok-new', name: '抖音', bindingCode: '01' }], Date.now())));
  assert.equal(st.bindings.length, 1, '关联还在');
  assert.equal(st.bindings[0].externalAppId, 'tok-new', '接到新的编号上');
});

test('公开 North 读到一次「没连上」不清空关联', () => {
  const ctx = setup(), R = ctx.NorthPublicRuntime, st = R.state();
  R.apply(st, snap([{ id: 'tok-a', name: '微信', bindingCode: '02' }], Date.now() - 60000));
  st.bindings = [{ id: 'b2', internalAppId: 'wechat', externalAppId: 'tok-a', externalAppName: '微信', externalBindingCode: '02' }];
  R.apply(st, { linked: false });
  assert.equal(st.bindings.length, 1);
  assert.equal(st.roleAccess, false, '没连上时角色权限照旧暂停');
});

test('私人包里那份公开版文件没有动', () => {
  const priv = fs.readFileSync(ROOT + '/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/public-north-runtime.js', 'utf8');
  assert.ok(!priv.includes('PUBLIC_NORTH_BIND_REPAIR_V1'));
});
