import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const publicRoot = new URL(
  '../native/public-north-review/PhoneCompanionTest/',
  import.meta.url,
);
const sync = fs.readFileSync(
  new URL('PhoneCompanionTest/CompanionSyncView.swift', publicRoot),
  'utf8',
);
const report = fs.readFileSync(
  new URL('PhoneCompanionReport/TotalActivityReport.swift', publicRoot),
  'utf8',
);

test('public report compatibility code is retained but usage collection is no longer invoked', () => {
  assert.doesNotMatch(sync, /report = await fetchTodayDirectUsage\(\)/);
  assert.doesNotMatch(sync, /CompanionUsageReportSurface/);
  assert.match(sync, /if authorizationStatus == \.approved\s*\{\s*return await fetchTodayExtensionUsage\(\)/s);
  assert.match(sync, /private func fetchTodayExtensionUsage\(\) async/);
  assert.match(sync, /shared\.requestID == request\.requestID/);
  assert.match(sync, /shared\.generatedAt >= request\.requestedAt/);
  assert.match(sync, /"report\.today\.request\.v3"/);
  assert.match(sync, /"report\.today\.snapshot\.v3"/);
  assert.match(report, /"report\.today\.request\.v3"/);
  assert.match(report, /"report\.today\.snapshot\.v3"/);
});

test('public North uploads only App control inventory without zero or cached usage', () => {
  const payload = sync.match(/let screenTime: \[String: Any\] = \[([\s\S]*?)\]/)?.[1] ?? '';
  assert.match(payload, /"reportAvailable": false/);
  assert.match(payload, /"apps": appRows/);
  assert.doesNotMatch(payload, /totalSeconds|usageDay|usageRevision/);
  assert.doesNotMatch(sync, /"usedSeconds": usageByID/);
});

test('public North retries transient command transport failures', () => {
  assert.match(sync, /for attempt in 0\.\.<2/);
  assert.match(sync, /isRetryableTransportError\(error\)/);
  assert.match(sync, /\.timedOut/);
  assert.match(sync, /\.networkConnectionLost/);
});

test('public North validates authorization before changing a remote daily limit', () => {
  const limitCase = sync.match(/case "limit":([\s\S]*?)case [^\n]+:/)?.[1] ?? '';
  assert.match(limitCase, /screenTimeControlAuthorizationSettled\(\)/);
  assert.match(limitCase, /rebuildDailyLimitMonitoring\(persistedSettings\)/);
  assert.match(sync, /includesPastActivity: true/);
});
