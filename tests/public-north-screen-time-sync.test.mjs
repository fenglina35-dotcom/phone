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

test('public North reads the fresh report-extension snapshot for ordinary App Store authorization', () => {
  assert.match(sync, /if authorizationStatus == \.approved\s*\{\s*return await fetchTodayExtensionUsage\(\)/s);
  assert.match(sync, /private func fetchTodayExtensionUsage\(\) async/);
  assert.match(sync, /shared\.requestID == request\.requestID/);
  assert.match(sync, /shared\.generatedAt >= request\.requestedAt/);
  assert.match(sync, /"report\.today\.request\.v3"/);
  assert.match(sync, /"report\.today\.snapshot\.v3"/);
  assert.match(report, /"report\.today\.request\.v3"/);
  assert.match(report, /"report\.today\.snapshot\.v3"/);
});

test('public North uploads a receiver-verifiable current-day usage payload', () => {
  assert.match(sync, /"usageDay": usageDay\(for: report\.generatedAt\)/);
  assert.match(sync, /"timeZone": TimeZone\.current\.identifier/);
  assert.match(sync, /"usageRevision": usageRevision/);
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
