import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('小手机.html');
const edge = read('supabase/functions/phone-role-push/index.ts');
const bridge = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
const pip = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift');
const coordinator = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/ScreenShareCoordinator.swift');
const broadcast = read('native/private-small-phone/XcodeProject/PhoneScreenBroadcast/SampleHandler.swift');
const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const info = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/Info.plist');

test('current release versions stay aligned after v910 screen-share support', () => {
  assert.match(app, /APP_VER='v1167 · 心动审判共同生活记忆修复版'/);
  assert.match(project, /CURRENT_PROJECT_VERSION = 294;/);
  assert.match(project, /MARKETING_VERSION = 1\.0\.294;/);
  assert.match(bridge, /contractVersion = 26/);
});

test('only the private app can switch recognition source to screen share', () => {
  assert.doesNotMatch(app, /navigator\.mediaDevices\.getDisplayMedia/);
  assert.match(app, /function screenShareAvailable\(\)\{return privateNativeAppOn\(\);\}/);
  assert.match(app, /screenShare\.frame/);
  assert.match(app, /function callVideoSourceOn\(\)/);
  assert.match(app, /callScreenShareOn\(\)\|\|callVideoCameraOn\(\)/);
  assert.match(app, /屏幕共享共用此设置/);
  assert.match(app, /口头让ta看仍不限次数/);
  assert.match(html, /call-screen-tools/);
});

test('role screen-share requests always wait for owner consent', () => {
  assert.match(app, /\[请求屏幕共享\|简短原因\]/);
  assert.match(app, /function callScreenShareRequest\(reason\)/);
  assert.match(app, /function callScreenShareRequest\(reason\)\{if\(!screenShareAvailable\(\)\|\|/);
  assert.match(app, /callScreenShareRequestApprove/);
  assert.match(app, /callScreenShareRequestDeny/);
  assert.match(app, /只有你同意并在 iPhone 系统面板确认后/);
});

test('native app provides broadcast extension, PiP subtitles, and background audio', () => {
  assert.match(project, /PhoneScreenBroadcast/);
  assert.match(broadcast, /RPBroadcastSampleHandler/);
  assert.match(broadcast, /screen-share-latest\.jpg/);
  assert.match(coordinator, /RPSystemBroadcastPickerView/);
  assert.match(pip, /AVPictureInPictureVideoCallViewController/);
  assert.match(pip, /private let subtitleLabel = UILabel\(\)/);
  assert.match(pip, /subtitleLabel\.numberOfLines = 0/);
  assert.match(bridge, /call\.audio\.play/);
  assert.match(info, /<string>audio<\/string>/);
});

test('app-watch refreshes snapshots and lets the role choose without a random follow-up', () => {
  assert.match(edge, /stage: "request_snapshot"/);
  assert.match(edge, /fresh_snapshot_no_usage_delta/);
  assert.match(edge, /requestedAt/);
  assert.match(edge, /parseRoleAppDecision/);
  assert.match(edge, /appAction: parsed\.action/);
  assert.doesNotMatch(edge, /followupChoice: Math\.random\(\) < 0\.5 \? "lock" : "message"/);
  assert.doesNotMatch(edge, /String\(payload\.followupChoice \|\| "message"\) === "lock"/);
});

test('proactive messages prioritize ordinary real chat and silence context', () => {
  assert.match(edge, /这是与上一轮分开的独立主动联系事件/);
  assert.match(edge, /禁止再次回答用户最后一句/);
  assert.match(edge, /silenceMinutes/);
  assert.match(edge, /距离同一角色最近一次真实互动约/);
});
