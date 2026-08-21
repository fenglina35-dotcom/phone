import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('小手机.html');
const bridge = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
const webView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');
const coordinator = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/ScreenShareCoordinator.swift');
const companion = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift');
const contentView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/ContentView.swift');
const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');

test('current web and private release versions align', () => {
  assert.match(app, /APP_VER='v1036 · 真实奶茶与微信发现页合并版'/);
  assert.match(project, /CURRENT_PROJECT_VERSION = 156;/);
  assert.match(project, /MARKETING_VERSION = 1\.0\.156;/);
  assert.match(bridge, /contractVersion = 25/);
  assert.match(webView, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.156 \(156\)'/);
});

test('native speech freezes the system frame that belongs to the final utterance', () => {
  assert.match(bridge, /event\["isFinal"\] as\? Bool == true/);
  assert.match(bridge, /freezeLatestFrame\(\)/);
  assert.match(coordinator, /screen-share-frozen-/);
  assert.match(coordinator, /screenFrameToken/);
  assert.match(webView, /screenFrameToken: payload\.screenFrameToken/);
  assert.match(app, /const meta=\{screenFrameToken:String\(ev\.screenFrameToken\|\|''\)/);
  assert.match(app, /hfHeard\(t,meta\)/);
  assert.match(app, /screenShare\.frame',frameToken\?\{token:String\(frameToken\)\}:\{\}/);
});

test('private active calls keep native listening when the web view becomes hidden', () => {
  assert.match(app, /function callHFMayStayInNativeBackground\(\)/);
  assert.match(app, /if\(_callHF&&!callHFMayStayInNativeBackground\(\)\)/);
  assert.match(bridge, /rotateRecognition[\s\S]*cleanupCurrentRecognition\(deactivateAudioSession: false\)/);
  assert.match(bridge, /func stop[\s\S]*cleanupCurrentRecognition\(deactivateAudioSession: true\)/);
});

test('background final speech events are queued and replayed after returning', () => {
  assert.match(bridge, /pendingSpeechEvents/);
  assert.match(bridge, /case "speech\.pending"/);
  assert.match(bridge, /enriched\["eventId"\] = UUID\(\)\.uuidString/);
  assert.match(webView, /flushPending\(\)/);
  assert.match(app, /SmallPhoneNativeSpeech\.flushPending\(\)/);
});

test('role screen-share request is visually above the active call', () => {
  assert.match(html, /\.modal\.call-modal\{position:fixed;z-index:12000/);
  assert.match(app, /function openCallModal\(html\)/);
  assert.match(app, /callScreenShareRequest[\s\S]*openCallModal\(`/);
  assert.match(app, /m\.classList\.remove\('call-modal'\)/);
});

test('remote app view refreshes real Screen Time before acknowledging command', () => {
  assert.match(companion, /if row\.command\.action == "view"/);
  assert.match(companion, /fetchTodayDirectUsageWithTimeout\(\)/);
  assert.match(companion, /reportForReceipt = snapshot/);
  assert.match(companion, /report: reportForReceipt/);
  assert.match(companion, /controlOnly: row\.command\.action != "view"/);
});

test('daily limits include usage accumulated before monitoring was rebuilt', () => {
  assert.match(companion, /threshold: DateComponents\([\s\S]{0,120}includesPastActivity: true/);
  assert.match(contentView, /threshold: DateComponents\(minute: minutes\),[\s\S]{0,80}includesPastActivity: true/);
});
