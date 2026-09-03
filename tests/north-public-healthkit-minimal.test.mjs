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
  assert.doesNotMatch(project, /NSHealthUpdateUsageDescription/);
});

test('public North build number is 8 for every target configuration', () => {
  const buildNumbers = [
    ...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g),
  ].map((match) => match[1]);
  assert.equal(buildNumbers.length, 10);
  assert.deepEqual(new Set(buildNumbers), new Set(['8']));
});
