import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL(
  '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',
  import.meta.url
), 'utf8');
const bridge = fs.readFileSync(new URL(
  '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift',
  import.meta.url
), 'utf8');
const webView = fs.readFileSync(new URL(
  '../native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift',
  import.meta.url
), 'utf8');

test('private native normal saves are coalesced while urgent persistence stays immediate', () => {
  assert.match(app, /const PRIVATE_NATIVE_SAVE_GAP_MS=15000/);
  assert.match(app, /gap=native&&requested>0&&_saveLast/);
  assert.match(app, /function saveNowAsync\(\)\{const ok=saveNow\(\)/);
  assert.match(app, /function persistPendingStateOnHide\(\)[\s\S]{0,360}?return saveNow\(\)/);
});

test('private native pressure pauses optional maintenance but never role inbox pull', () => {
  assert.match(app, /window\.__smallPhoneNativePressure=function\(payload\)/);
  assert.match(app, /function northNativeMaintenancePaused\(\)/);
  assert.match(app, /function phoneFriendMaybeSync\(force\)[\s\S]{0,280}?northNativeMaintenancePaused\(\)/);
  assert.match(app, /function privatePhoneCloudAutoBackup\(\)[\s\S]{0,260}?northNativeMaintenancePaused\(\)/);
  assert.match(app, /function cohabPhoneAutonomyTick\(\)\{if\(northNativeMaintenancePaused\(\)\)return/);
  assert.match(app, /function companionPollSnapshot\(force\)[\s\S]{0,360}?northNativeMaintenancePaused\(\)/);
  const rolePull = app.slice(
    app.indexOf('async function roleServerPushPull(force)'),
    app.indexOf('const _nativeRolePushTaps', app.indexOf('async function roleServerPushPull(force)'))
  );
  assert.ok(rolePull.length > 1000, 'role inbox pull remains present');
  assert.doesNotMatch(rolePull, /northNativeMaintenancePaused/);
});

test('motion processing is sampled before acceleration math', () => {
  assert.match(app, /_stepMotionSampleAt=0/);
  assert.match(app, /function stepMotion\(e\)[\s\S]{0,180}?now-_stepMotionSampleAt<180/);
});

test('native storage keeps recovery but does not rewrite the backup for every save', () => {
  assert.match(bridge, /currentSavedAt - backupSavedAt >= 300_000/);
  assert.match(bridge, /if shouldRefreshBackup \{[\s\S]{0,180}?currentData\.write\(to: backupURL/);
  assert.match(bridge, /try data\.write\(to: url, options: \.atomic\)/);
});

test('iOS thermal and memory pressure reach the private WKWebView', () => {
  assert.match(webView, /ProcessInfo\.thermalStateDidChangeNotification/);
  assert.match(webView, /UIApplication\.didReceiveMemoryWarningNotification/);
  assert.match(webView, /window\.__smallPhoneNativePressure/);
  assert.match(webView, /lastSafeAreaInsets/);
});
