import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const publicRoot = new URL(
  '../native/public-north-review/PhoneCompanionTest/',
  import.meta.url,
);
const wellness = readFileSync(
  new URL('PhoneCompanionTest/CompanionWellnessService.swift', publicRoot),
  'utf8',
);
const syncView = readFileSync(
  new URL('PhoneCompanionTest/CompanionSyncView.swift', publicRoot),
  'utf8',
);
const project = readFileSync(
  new URL('PhoneCompanionTest.xcodeproj/project.pbxproj', publicRoot),
  'utf8',
);

test('public North requests and uploads HealthKit step count only', () => {
  assert.match(wellness, /quantityType\(forIdentifier: \.stepCount\)/);
  assert.match(wellness, /"steps": max\(0, stepValue \?\? 0\)/);

  for (const forbidden of [
    'activeEnergyBurned',
    'heartRate',
    'heartRateVariabilitySDNN',
    'sleepAnalysis',
    'stateOfMindType',
    'activeEnergyKcal',
    'heartRateBpm',
    'hrvMs',
    'sleepSeconds',
    'stateOfMind',
  ]) {
    assert.doesNotMatch(wellness, new RegExp(forbidden));
  }
});

test('public North UI and privacy prompt disclose step count only', () => {
  assert.match(syncView, /仅在你明确授权后读取健康 App 中的今日步数/);
  assert.match(syncView, /不申请或读取其他健康数据/);
  assert.doesNotMatch(syncView, /活动能量、心率、HRV 和睡眠/);

  const usageDescriptions = [
    ...project.matchAll(/INFOPLIST_KEY_NSHealthShareUsageDescription = "([^"]+)";/g),
  ].map((match) => match[1]);
  assert.equal(usageDescriptions.length, 2);
  for (const description of usageDescriptions) {
    assert.match(description, /今日步数/);
    assert.doesNotMatch(description, /睡眠|心率|HRV|心境|活动能量/);
  }
  const updateDescriptions = [...project.matchAll(/INFOPLIST_KEY_NSHealthUpdateUsageDescription = "([^"]+)";/g)];
  assert.equal(updateDescriptions.length, 2);
  for (const [, description] of updateDescriptions) assert.match(description, /不会写入或修改健康数据/);
});

test('public North candidate build number is 14 for every target configuration', () => {
  const buildNumbers = [
    ...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g),
  ].map((match) => match[1]);
  assert.equal(buildNumbers.length, 10);
  assert.deepEqual(new Set(buildNumbers), new Set(['14']));
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.1;/g) || []).length, 10);
});

test('public North preserves delivered Build13 neutral location permission explanations', () => {
  const content = readFileSync(new URL('PhoneCompanionTest/ContentView.swift', publicRoot), 'utf8');
  assert.match(content, /点击继续后，系统会询问是否允许访问位置/);
  assert.match(content, /你可以在系统提示中选择是否授权/);
  assert.equal((content.match(/Button\("继续"\)/g) || []).length, 2);
  assert.doesNotMatch(content, /Button\("允许定位"\)|Button\("允许后台持续定位"\)/);
});
