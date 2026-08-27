import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const shell = read('sw.js');
const bundleInfo = read('native/private-small-phone/Resources/PhoneWebBundleInfo.plist');
const localWebView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');
const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const pip = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift');
const reportApp = read('native/private-small-phone/XcodeProject/PhoneCompanionReport/PhoneCompanionReport.swift');
const reportScene = read('native/private-small-phone/XcodeProject/PhoneCompanionReport/TotalActivityReport.swift');

test('v1087 web and private iOS 1.0.212 keep explicit build identities', () => {
  assert.match(app, /APP_VER='v1087 · 后台解锁去重与必达修复版'/);
  assert.match(app, /sw\.js\?v=1087&r=v1087-background-unlock-delivery-1/);
  assert.match(shell, /north-shell-v1087/);
  assert.match(bundleInfo, /<string>1087<\/string>/);
  assert.match(localWebView, /1\.0\.212 \(212\)/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 212;/g) || []).length, 12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.212;/g) || []).length, 12);
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
