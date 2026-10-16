import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// A role's lock always carries an unlock time (default: the next 07:00 at least an hour away) and
// reopens on its own, in the small phone and on the real iPhone (ROLE_LOCK_UNTIL_V1).
const PRIVATE_DIR = 'native/private-small-phone/XcodeProject/';
function lockUntil(file) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('/* ROLE_LOCK_UNTIL_V1');
  const end = source.indexOf("if(typeof setInterval==='function')setInterval(lockUntilSweep");
  assert(start >= 0 && end > start, file + ' must carry the lock-until block');
  const c = { Date, Math, String, Number, Object, Array, JSON };
  vm.createContext(c);
  vm.runInContext(source.slice(start, end), c);
  return c;
}

for (const file of ['app.js', PRIVATE_DIR + 'PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  test(file + ': lock tags carry a time, the tag text keeps its target, and the default is the next 07:00', () => {
    const c = lockUntil(file), now = new Date(2026, 9, 16, 19, 0, 0, 0).getTime(), at = (y, m, d, h, mi) => new Date(y, m, d, h, mi, 0, 0).getTime();
    assert.equal(c.lockUntilParse('到07:00', now), at(2026, 9, 17, 7, 0));
    assert.equal(c.lockUntilParse('3天', now), now + 3 * 86400e3);
    assert.equal(c.lockUntilParse('2小时', now), now + 2 * 3600e3);
    assert.equal(c.lockUntilParse('30分钟', now), now + 30 * 60e3);
    assert.equal(c.lockUntilParse('明晚10点', now), at(2026, 9, 17, 22, 0));
    assert.equal(c.lockUntilParse('晚上9点半', now), at(2026, 9, 16, 21, 30));
    for (const name of ['抖音', '12306', '仅外置', '内外同时', '全部内外 App', '2048']) assert.equal(c.lockUntilParse(name, now), 0, name + ' is a target, not a time');
    assert.equal(c.lockUntilDefault(now), at(2026, 9, 17, 7, 0));
    assert.equal(c.lockUntilDefault(at(2026, 9, 17, 6, 30)), at(2026, 9, 18, 7, 0), 'never less than an hour');
    assert.equal(c.lockUntilDefault(at(2026, 9, 17, 2, 0)), at(2026, 9, 17, 7, 0));
    assert.equal(c.lockUntilClamp(now + 30 * 86400e3, now), now + 7 * 86400e3, 'at most seven days');
    const plan = c.lockUntilPrepare('好，锁了。\n[锁定|抖音|仅外置|到07:00]\n[锁定|游戏]');
    assert.equal(plan.content, '好，锁了。\n[锁定|抖音|仅外置]\n[锁定|游戏]');
    assert.equal(plan.items.length, 2);
    assert.equal(new Date(plan.items[0].at).getHours(), 7);
    assert.equal(plan.items[1].at, 0, 'no time in the tag: the words, then the role, then the default decide');
    assert.equal(c.lockUntilParse('三天', now), now + 3 * 86400e3);
    assert.equal(c.lockUntilParse('两个小时', now), now + 2 * 3600e3);
    assert.equal(c.lockUntilParse('到十一点', now), at(2026, 9, 16, 23, 0));
    assert.equal(c.lockUntilParse('到07:00', at(2026, 9, 16, 18, 0)), at(2026, 9, 17, 7, 0), 'a zero-padded clock time stays in the morning');
    assert.equal(c.lockUntilParse('到7点', at(2026, 9, 17, 2, 0)), at(2026, 9, 17, 7, 0));
    assert.equal(c.lockUntilParse('明天中午', now), at(2026, 9, 17, 12, 0));
    assert.equal(c.lockUntilParse('明天', now), at(2026, 9, 17, 7, 0));
    assert.equal(c.lockUntilFromText('今晚别玩了，明天中午再给你开。[锁定|抖音]', now), at(2026, 9, 17, 12, 0));
    assert.equal(c.lockUntilFromText('先锁你三天，好好反省。', now), now + 3 * 86400e3);
    assert.equal(c.lockUntilFromText('锁到早上七点，睡觉。', now), at(2026, 9, 17, 7, 0));
    assert.equal(c.lockUntilFromText('两小时后再给你解开', now), now + 2 * 3600e3);
    assert.equal(c.lockUntilFromText('乖，别玩了，我锁上了。', now), 0, 'nothing said: ask the role');
    assert.equal(c.lockUntilFromText('<think>锁到明天</think>不给你玩。', now), 0, 'inner thoughts are not a decision');
    assert.match(c.lockUntilText(now + (26 * 60 + 5) * 60e3, now), /^还剩1天2小时5分 · 10月17日 21:05 自动解锁$/);
  });
}

for (const file of ['app.js', PRIVATE_DIR + 'PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  test(file + ': the role gets one plain list of every running unlock time, real iPhone apps included', () => {
    const c = lockUntil(file), now = Date.now();
    c.LOCKABLE = { nearby: '附近的人' };
    c.S = { couple: { lockUntil: { 'int:nearby': now + 3 * 3600e3, 'ext:ios.abc': now + 26 * 3600e3, 'ext:gone': now + 3600e3, 'int:nearby2': now - 1000 } } };
    c.companionState = () => ({ apps: [{ id: 'ios.abc', name: '抖音' }] });
    c.companionExternalById = (st, id) => st.apps.find(a => a.id === id) || null;
    const rows = c.lockUntilRoleRows();
    assert.equal(rows.length, 2, JSON.stringify(rows));
    assert.match(rows[0], /^· 附近的人：\d+月\d+日 \d\d:\d\d 自动解锁，还剩(2小时59分|3小时0分)$/);
    assert.match(rows[1], /^· 抖音（真实 iPhone）：/);
  });
}

test('the role is told every lock needs an unlock time, in both bundles', () => {
  for (const file of ['app.js', PRIVATE_DIR + 'PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
    const s = fs.readFileSync(file, 'utf8');
    assert.equal(s.split('锁定时必须在标签最后加解锁时间').length - 1, 2, file);
    assert(s.includes("const _lockPlan=typeof lockUntilPrepare==='function'?lockUntilPrepare(content):null,_lockBefore=_lockPlan?lockUntilSnapshot():null;if(_lockPlan)content=_lockPlan.content;"), file);
    assert(s.includes('if(_lockPlan)lockUntilCommit(_lockPlan,_lockBefore,c,decisionText||content);'), file);
    assert(s.includes("roleInterceptStage:'锁定解锁时间'"), file + ' asks the role in the background when no time was given');
    assert.equal(s.split("lockUntilRoleNote('int:'+k)").length - 1, 3, file + ': the role sees its own unlock time in every internal lock list');
    assert.equal(s.split("lockUntilRoleNote('ext:'+app.id)").length - 1, 2, file + ': and for real iPhone apps');
    assert(s.includes("if(_untilRows.length)s+='\\n\\n# 你自己定的自动解锁时间（本轮真实状态）\\n'"), file + ': the list does not depend on internal app grants');
    assert(s.includes("${typeof lockUntilOf==='function'&&lockUntilOf(k)?esc(lockUntilText(lockUntilOf(k))):'已锁'}"), file);
  }
});

test('the iPhone releases a due role lock with the app closed and never puts it back', () => {
  const svc = fs.readFileSync(PRIVATE_DIR + 'PhoneCompanionTest/CompanionSyncView.swift', 'utf8');
  const bridge = fs.readFileSync(PRIVATE_DIR + 'PhoneCompanionTest/PhoneNativeBridge.swift', 'utf8');
  const monitor = fs.readFileSync(PRIVATE_DIR + 'PhoneCompanionMonitor/DeviceActivityMonitorExtension.swift', 'utf8');
  const shield = fs.readFileSync(PRIVATE_DIR + 'PhoneCompanionShield/ShieldConfigurationExtension.swift', 'utf8');
  assert(bridge.includes('case "device.autoUnlock":'));
  assert(svc.includes('func scheduleAutoUnlock(externalID: String, at date: Date) -> Bool'));
  assert(svc.includes('repeats: false'));
  assert(/private func effectiveLockedTokens\(\) -> Set<ApplicationToken> \{\n        applyDueAutoUnlocks\(\)/.test(svc), 'expired entries leave the saved lists before they are re-applied');
  assert(svc.includes('forgetAutoUnlock(externalID: externalID)'), 'an early unlock cancels the timer');
  assert(monitor.includes('if activity.rawValue.hasPrefix("autoUnlock.") { return }'), 'starting a timer must not clear daily limits');
  assert(monitor.includes('releaseDueRoleLocks()'));
  assert(monitor.includes('ManagedSettingsStore(named: .init("persistentLockLedger"))'));
  assert(shield.includes('remainingText(until: Date(timeIntervalSince1970: unlockAt))'), 'the shield page shows the time left');
});
