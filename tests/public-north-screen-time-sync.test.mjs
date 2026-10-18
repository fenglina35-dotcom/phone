import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { execFileSync } from 'node:child_process';

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

const contentPath = 'native/public-north-review/PhoneCompanionTest/PhoneCompanionTest/ContentView.swift';
const content = process.env.NORTH_PUBLIC_LOCK_BASELINE === '1'
  ? execFileSync('git', ['show', `HEAD:${contentPath}`], { cwd: new URL('../', import.meta.url), encoding: 'utf8' })
  : fs.readFileSync(new URL('PhoneCompanionTest/ContentView.swift', publicRoot), 'utf8');

function swiftBody(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `missing ${signature}`);
  const open = source.indexOf('{', start);
  let depth = 1, end = open + 1;
  for (; depth && end < source.length; end++) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
  }
  assert.equal(depth, 0);
  return source.slice(open + 1, end - 1);
}

// Replay only the actual Swift Set/assignment operations in the lifecycle helper.
// This is a deterministic stale-view race check, not an Apple-framework simulator.
function replayLockHelper(name, state) {
  let body = swiftBody(content, `private func ${name}()`)
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\blockedAppTokens\b/g, 'state.view')
    .replace(/manualLockStore\.shield\.applications/g, 'state.live')
    .replace(/state\.view\.isEmpty/g, '(state.view.size === 0)')
    .replace(/\bnil\b/g, 'null')
    .replace(/\?\? \[\]/g, '?? new Set()')
    .replace(/saveLockedApps\(\)/g, 'state.saved = new Set(state.view)');
  assert.match(body.trim(), /^state\.(?:live|view)\s*=/);
  assert.doesNotMatch(body, /[^\w](?:await|try|if|for|while)\b/);
  Function('state', body)(state);
}

function replayViewEntry(state) {
  const entry = swiftBody(content, '.task');
  const calls = [...entry.matchAll(/\b(applyManualLocks|reloadManualLocksFromStore)\(\)/g)];
  assert.ok(calls.length, 'view entry must explicitly reconcile lock state');
  for (const [, name] of calls) replayLockHelper(name, state);
}

test('remote lock survives a previously initialized empty local page entering the screen', () => {
  const state = { view: new Set(), live: new Set(['douyin']), saved: new Set(['douyin']) };
  replayViewEntry(state);
  assert.deepEqual(state.live, new Set(['douyin']));
  assert.deepEqual(state.saved, new Set(['douyin']));
  assert.deepEqual(state.view, new Set(['douyin']));
});

test('remote unlock is not undone by a local page holding an old locked state', () => {
  const state = { view: new Set(['douyin']), live: null, saved: new Set() };
  replayViewEntry(state);
  assert.equal(state.live, null);
  assert.deepEqual(state.saved, new Set());
  assert.deepEqual(state.view, new Set());
});

test('local lock edits refresh current remote changes before mutating a token', () => {
  for (const name of ['toggleManualLock(for token:', 'lockAllSelectedApps()', 'unlockAllManuallyLockedApps()', 'reconcileSavedDataWithSelection()']) {
    const body = swiftBody(content, `private func ${name}`);
    const refresh = body.indexOf('reloadManualLocksFromStore()');
    const mutation = body.search(/lockedAppTokens\.(?:formIntersection|contains|removeAll|formUnion)|lockedAppTokens =/);
    assert.ok(refresh >= 0 && mutation > refresh, `${name} must refresh before editing`);
  }
  assert.match(swiftBody(content, 'private func lockAllSelectedApps()'), /lockedAppTokens\.formUnion\(selection\.applicationTokens\)/);
});

test('foreground and remote-change notifications refresh UI without writing shields', () => {
  const foreground = swiftBody(content, '.onChange(of: scenePhase)');
  assert.match(foreground, /reloadManualLocksFromStore\(\)/);
  assert.doesNotMatch(foreground, /applyManualLocks\(\)/);
  assert.match(content, /for: \.companionManualLocksDidChange/);
  assert.match(sync, /NotificationCenter\.default\.post\(\s*name: \.companionManualLocksDidChange/s);
  assert.doesNotMatch(swiftBody(content, 'private func reloadManualLocksFromStore()'), /saveLockedApps|shield\.applications\s*=/);
});

test('remote readback persists the latest store and never rolls back a newer local edit', () => {
  const apply = swiftBody(sync, 'private func applyRemoteCommand(');
  for (const action of ['lock', 'unlock']) {
    const start = apply.indexOf(`case "${action}":`);
    const end = apply.indexOf('\n        case ', start + 1);
    const branch = apply.slice(start, end);
    const readback = branch.slice(branch.indexOf('try await Task.sleep'));
    assert.doesNotMatch(readback, /shield\.applications\s*=|saveLockedTokens\(tokens\)/);
    assert.equal((readback.match(/saveLockedTokens\(manualLockStore\.shield\.applications \?\? \[\]\)/g) || []).length, 2);
  }
});
