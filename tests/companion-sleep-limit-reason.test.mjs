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

test('snapshot refresh never reapplies a reached limit after an explicit unlock', () => {
  assert.doesNotMatch(sync, /private func reconcileReachedDailyLimits/);
  assert.doesNotMatch(sync, /reconcileReachedDailyLimits\(report:/);
  assert.doesNotMatch(sync, /"manualLocked":/);
  assert.doesNotMatch(sync, /"limitReached":/);
});

test('changing a native daily limit clears the stale reached lock for that app', () => {
  assert.match(sync, /case "limit":[\s\S]{0,900}var reachedTokens = loadLimitLockedTokens\(\)/);
  assert.match(sync, /reachedTokens\.remove\(token\)/);
  assert.match(sync, /dailyLimitStore\.shield\.applications = reachedTokens\.isEmpty/);
  assert.match(sync, /saveLimitLockedTokens\(reachedTokens\)/);
  assert.doesNotMatch(app, /row\.limitReached===true/);
  assert.doesNotMatch(app, /row\.manualLocked===true/);
});

test('real companion sleep hides legacy timer durations and call lull is not called measured sleep', () => {
  assert.match(app, /_realSleep=companionRoleReadsExternal\(c,'health'\)/);
  assert.match(app, /!_realSleep\?_sl\.slice\(0,5\)/);
  assert.match(app, /通话陪睡间隔，不等于设备测得的真实睡眠/);
  assert.match(app, /这个数字只证明通话陪睡状态持续了多久/);
  assert.match(app, /绝不能说“你睡了这么久”/);
});
