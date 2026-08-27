import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const bridge = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift', import.meta.url), 'utf8');
const pip = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift', import.meta.url), 'utf8');
const alarm = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/NativeAlarmService.swift', import.meta.url), 'utf8');
const delegate = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneCompanionTestApp.swift', import.meta.url), 'utf8');
const project = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj', import.meta.url), 'utf8');

test('current release versions align', () => {
  assert.match(app, /APP_VER='v1084 · 睡眠来源与限额锁标识版'/);
  assert.match(html, /__NORTH_SHELL_BUILD__='1084'/);
  assert.match(project, /CURRENT_PROJECT_VERSION = 209;/);
  assert.match(project, /MARKETING_VERSION = 1\.0\.209;/);
  assert.match(bridge, /contractVersion = 25/);
});

test('shared-screen vision owns a finite native background task', () => {
  assert.match(bridge, /beginVisionBackgroundTask\(token: token\)/);
  assert.match(bridge, /UIApplication\.shared\.beginBackgroundTask/);
  assert.match(bridge, /case "screenShare\.vision\.complete"/);
  assert.match(bridge, /UIApplication\.shared\.endBackgroundTask\(taskID\)/);
  assert.match(app, /screenShare\.vision\.complete/);
  assert.match(app, /if\(frameToken\)await reply/);
  assert.match(app, /finally\{callNativeScreenVisionComplete\(frameToken\)/);
});

test('main call subtitles reveal each complete phrase at the v850 fixed size', () => {
  assert.match(html, /\.csline\{[^}]*animation:csphrasein \.3s/);
  assert.match(html, /@keyframes csphrasein/);
  assert.match(html, /\.csline\{[^}]*font-size:18px/);
  assert.doesNotMatch(html, /\.csline\.compact/);
  assert.doesNotMatch(html, /\.csline\.dense/);
  assert.doesNotMatch(app, /function callSubtitleSizeClass\(text\)/);
  assert.doesNotMatch(app, /function callSubtitleChars/);
});

test('native floating subtitles keep their independent size and mirror the complete-phrase motion', () => {
  assert.match(pip, /duration: 0\.3/);
  assert.match(pip, /translationX: 0, y: 8/);
  assert.match(pip, /subtitleLabel\.alpha = 0/);
  assert.match(pip, /controlPoint1: CGPoint\(x: 0\.25, y: 0\.1\)/);
  assert.match(pip, /controlPoint2: CGPoint\(x: 0\.25, y: 1\)/);
  assert.match(pip, /length > 130 \? 9\.5 : \(length > 80 \? 11 : 14\)/);
  assert.match(pip, /self\.subtitleLabel\.alpha = 1/);
  assert.doesNotMatch(pip, /private final class CallSubtitleView/);
});

test('alarm notes become role messages in background and chat history', () => {
  assert.match(app, /alarmPrepareCompanionText/);
  assert.match(app, /companionText:String\(a\.companionText/);
  assert.match(app, /alarmApplyFiredEvents\(result&&result\.firedEvents\)/);
  assert.match(app, /_alarm:true/);
  assert.match(alarm, /UNCalendarNotificationTrigger/);
  assert.match(alarm, /"smallPhoneAlarm": alarmInfo/);
  assert.match(alarm, /deliveredRoleEvents\(\)/);
  assert.match(delegate, /recordInteractedRoleAlarm/);
});
