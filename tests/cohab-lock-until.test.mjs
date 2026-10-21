import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// COHAB_LOCK_UNTIL_V1 (2026-10-21): she found 抖音 locked by her role during 共同生活 voice mode with no unlock
// time on the shield. 共同生活 / 线下 lock tags went through cohabApplyPhoneTags, which never took the
// ROLE_LOCK_UNTIL_V1 path that chat locks use, so no time was recorded and nothing reopened the app.
const PRIVATE_APP = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js';
const FILES = (process.env.COHAB_LOCK_FILES || ['app.js', PRIVATE_APP].join(',')).split(',');

function fnSource(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert(start >= 0, name + ' must exist');
  let depth = 0, i = source.indexOf('{', start);
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) break;
  }
  return source.slice(start, i + 1);
}

function load(file) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('/* ROLE_LOCK_UNTIL_V1');
  const end = source.indexOf("if(typeof setInterval==='function')setInterval(lockUntilSweep");
  assert(start >= 0 && end > start, file + ' must carry the lock-until block');
  const locked = new Set(), dispatched = [], native = [];
  const apps = [{ id: 'ios.douyin', name: '抖音' }, { id: 'ios.x', name: 'X' }];
  const c = {
    Date, Math, String, Number, Object, Array, JSON, Promise, setTimeout: () => 0,
    window: {}, S: { couple: { cid: 'r1', locks: {} }, me: {} },
    save() {}, msgs: () => [], LOCKABLE: {},
    companionState: () => ({ apps }),
    companionExternalAlreadyInState: (st, app, action) => action === 'lock' && locked.has(app.id),
    companionExternalTargetsByText: (st, text) => apps.filter(a => String(text).includes(a.name)),
    companionDispatchRoleByText(action, target) {
      dispatched.push([action, target]);
      const app = apps.find(a => a.name === String(target).trim());
      if (!app) return false;
      if (action === 'lock') locked.add(app.id); else locked.delete(app.id);
      return true;
    },
    companionLocalNativeAvailable: () => true,
    cohabPhoneTarget: () => '', cohabRunPhoneInspection() {},
    roleInterceptDiagnosticAction() {}, roleInterceptDiagnosticTurnRememberFailure() {},
  };
  c.window.SmallPhoneNative = { request: (cmd, body) => { native.push([cmd, body]); return Promise.resolve(); } };
  vm.createContext(c);
  vm.runInContext(source.slice(start, end), c);
  vm.runInContext(fnSource(source, 'cohabApplyPhoneTags'), c);
  c.window._lockUntilAsking = null;
  return { c, dispatched, native, source };
}

for (const file of FILES) {
  test(file + ': a 共同生活 lock records its unlock time and tells the iPhone', () => {
    const { c, dispatched, native } = load(file);
    const role = { id: 'r1', name: '先生', remark: '先生' };
    const before = Date.now();
    const out = c.cohabApplyPhoneTags('他把手机扣在桌上。\n[共同生活锁定|抖音|2小时]', role, {}, { schedule: false });
    assert.equal(out.text, '他把手机扣在桌上。', 'the tag never reaches the scene');
    assert.deepEqual(dispatched, [['lock', '抖音']], 'the lock goes out for the app alone, without the time segment');
    const at = c.S.couple.lockUntil && c.S.couple.lockUntil['ext:ios.douyin'];
    assert.ok(at >= before + 2 * 3600e3 - 5e3 && at <= Date.now() + 2 * 3600e3 + 5e3, 'two hours from now is recorded');
    assert.deepEqual(native.map(r => r[0]), ['device.autoUnlock'], 'the shield shows the time and the iPhone reopens the app by itself');
    assert.equal(native[0][1].externalAppId, 'ios.douyin');
    assert.equal(native[0][1].unlockAt, at);
  });

  test(file + ': a 线下 lock without a time still gets one (the role\'s words, else the next 07:00)', () => {
    const { c } = load(file);
    const role = { id: 'r1', name: '先生' };
    c.cohabApplyPhoneTags('明天中午再给你开。\n[线下锁定|X]', role, {}, { schedule: false });
    const at = c.S.couple.lockUntil && c.S.couple.lockUntil['ext:ios.x'];
    assert.ok(at > Date.now(), 'an unlock time is always set');
    const d = new Date(at);
    assert.equal(d.getHours(), 12, 'taken from what the role said');
  });

  test(file + ': the role is told to add the unlock time in 共同生活 too', () => {
    const s = fs.readFileSync(file, 'utf8');
    assert(s.includes('锁定写 [共同生活锁定|准确App名|到07:00]，锁定时必须在标签最后加解锁时间'), file);
    assert(s.includes('COHAB_LOCK_UNTIL_V1'), file);
  });
}

test('LOCK_DONE_TEXT_V1: the iPhone reports which app was locked, in plain words (she asked)', () => {
  const swift = fs.readFileSync('native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift', 'utf8');
  assert(swift.includes('return lockedName.isEmpty ? "应用已经锁定" : "\\(lockedName)已经锁定"'));
  assert(!swift.includes('屏蔽配置已写入；最终是否生效'), 'the old technical sentence is gone');
});
