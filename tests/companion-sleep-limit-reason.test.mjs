import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const wellness = fs.readFileSync(
  new URL(
    '../native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionWellnessService.swift',
    import.meta.url
  ),
  'utf8'
);
const sync = fs.readFileSync(
  new URL(
    '../native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift',
    import.meta.url
  ),
  'utf8'
);

test('companion sleep selects one latest deduplicated session', () => {
  assert.match(wellness, /byAdding:\s*\.day,[\s\S]*?value:\s*-7/);
  assert.match(wellness, /let clippedStart = max\(start, sample\.startDate\)/);
  assert.match(wellness, /let clippedEnd = min\(end, sample\.endDate\)/);
  assert.match(wellness, /interval\.start <= last\.end/);
  assert.match(wellness, /maximumSessionGap: TimeInterval = 30 \* 60/);
  assert.match(wellness, /sessions\.max\(by:/);
  assert.doesNotMatch(
    wellness,
    /let seconds = rows\.reduce\(0\)[\s\S]{0,120}endDate\.timeIntervalSince/
  );
});

test('native snapshot keeps daily-limit and manual lock reasons separate', () => {
  assert.match(sync, /"manualLocked": manualLockedTokens\.contains\(token\)/);
  assert.match(sync, /"limitReached": limitLockedTokens\.contains\(token\)/);
  assert.match(sync, /private func reconcileReachedDailyLimits/);
  assert.match(sync, /usageDay\(for: report\.generatedAt\) == usageDay\(for: Date\(\)\)/);
  assert.match(sync, /usedSeconds >= Double\(minutes \* 60\)/);
  assert.match(sync, /dailyLimitStore\.shield\.applications = reached/);
  assert.match(sync, /saveLimitLockedTokens\(reached\)/);
});

test('small-phone UI labels a reached daily limit in red instead of calling it a role lock', () => {
  assert.match(
    app,
    /limitReached\?'今日限额已达到':manualLocked\?'角色或手动锁定'/
  );
  assert.match(app, /app\.limitReached\?'#ff526d'/);
  assert.match(app, /font-weight:\$\{app\.limitReached\?'700':'400'\}/);
  assert.match(app, /row\.limitReached===true/);
  assert.match(app, /row\.manualLocked===true/);
});

test('real companion sleep hides legacy timer durations and call lull is not called measured sleep', () => {
  assert.match(app, /_realSleep=companionRoleReadsExternal\(c,'health'\)/);
  assert.match(app, /!_realSleep\?_sl\.slice\(0,5\)/);
  assert.match(app, /通话陪睡间隔，不等于设备测得的真实睡眠/);
  assert.match(app, /这个数字只证明通话陪睡状态持续了多久/);
  assert.match(app, /绝不能说“你睡了这么久”/);
});
