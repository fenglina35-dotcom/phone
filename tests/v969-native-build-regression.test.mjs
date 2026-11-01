import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { REL, vre } from './_helpers.mjs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const shell = read('sw.js');
const bundleInfo = read('native/private-small-phone/Resources/PhoneWebBundleInfo.plist');
const localWebView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');
const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const pip = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift');
const reportApp = read('native/private-small-phone/XcodeProject/PhoneCompanionReport/PhoneCompanionReport.swift');
const reportScene = read('native/private-small-phone/XcodeProject/PhoneCompanionReport/TotalActivityReport.swift');

test('public web v1184 and private web v1189 remain compatible with native iOS 1.0.315', () => {
  assert.match(app, vre(String.raw`APP_VER='v{WEB} · {WEBLABEL}'`));
  assert.match(app, vre(String.raw`sw\.js\?v={WEB}&r=v{WEB}-owner-todo-report-1`));
  assert.match(shell, vre(String.raw`north-shell-v{WEB}-owner-todo-report-1`));
  assert.match(bundleInfo, /<string>1200<\/string>/);
  assert.match(localWebView, vre(String.raw`1\.0\.{IOS} \({IOS}\)`));
  assert.equal((project.match(vre(String.raw`CURRENT_PROJECT_VERSION = {IOS};`, 'g')) || []).length, 12);
  assert.equal((project.match(vre(String.raw`MARKETING_VERSION = 1.0.{IOS};`, 'g')) || []).length, 12);
});

test('native shared-media gain uses only public AVFoundation types', () => {
  assert.match(pip, /^@preconcurrency import AVFoundation/m);
  assert.match(pip, /AVAudioUnitEQ\(numberOfBands: 0\)/);
  assert.match(pip, /gainUnit\.globalGain = min\(12, 5 \+ extraGain\)/);
  assert.match(pip, /Timer\.scheduledTimer\(/);
  assert.match(pip, /#selector\(enhancedAudioDidFinish\)/);
  assert.match(pip, /@objc private func enhancedAudioDidFinish\(\)/);
  assert.doesNotMatch(pip, /AVAudioUnitDynamicsProcessor/);
  assert.doesNotMatch(pip, /completionCallbackType/);
  assert.doesNotMatch(pip, /scheduleFile\([^\n]+\)\s*\{/);
});

test('Device Activity report imports bridge SDK concurrency annotations', () => {
  assert.match(reportApp, /^@preconcurrency import DeviceActivity/m);
  assert.match(reportScene, /^@preconcurrency import DeviceActivity/m);
});
