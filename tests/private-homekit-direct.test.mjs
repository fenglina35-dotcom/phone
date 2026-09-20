import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bridge=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/HomeKitLightBridge.swift');
const native=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
const plist=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/Info.plist');
const entitlements=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneCompanionTest.entitlements');
const project=read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const web=read('smart-home.js');
const privateWeb=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/smart-home.js');

test('private iOS declares HomeKit permission and exposes the direct native bridge',()=>{
  assert.match(plist,/NSHomeKitUsageDescription/);
  assert.match(entitlements,/com\.apple\.developer\.homekit/);
  assert.match(project,/com\.apple\.HomeKit = \{\s*enabled = 1;/);
  assert.match(bridge,/import HomeKit/);
  assert.match(bridge,/HMHomeManager/);
  assert.match(bridge,/authorizationStatus\.contains\(\.authorized\)/);
  assert.match(bridge,/HMServiceTypeLightbulb/);
  assert.match(bridge,/verifyReadback/);
  assert.match(bridge,/"verified": true/);
  assert.match(native,/static let contractVersion = 40/);
  assert.match(native,/case "homekit\.lights\.snapshot"/);
  assert.match(native,/case "homekit\.light\.command"/);
});

test('web quota guard stays separate while the private shell retains direct HomeKit control',()=>{
  assert.match(web,/WEB_QUOTA_GUARD=true/);
  assert.doesNotMatch(web,/WEB_PAGE_POLL_MS|WEB_IDLE_POLL_MS|scheduleWebPoll/);
  assert.doesNotMatch(privateWeb,/WEB_QUOTA_GUARD|WEB_LINKED_KEY/);
  assert.match(privateWeb,/window\.wxSmartHomeRoleExecute=execute/);
  assert.match(privateWeb,/SmallPhoneNative\.request\('homekit\.lights\.snapshot'/);
  assert.match(privateWeb,/SmallPhoneNative\.request\('homekit\.light\.command'/);
  assert.match(web,/function privateMode\(\)/);
  assert.match(web,/window\.__SMALL_PHONE_PRIVATE__===true/);
  assert.match(web,/SmallPhoneNative\.request\('homekit\.lights\.snapshot'/);
  assert.match(web,/SmallPhoneNative\.request\('homekit\.light\.command'/);
  assert.match(web,/允许访问苹果家庭/);
  assert.match(web,/不需要连接电脑/);
  assert.match(web,/网页配对暂时关闭/);
  assert.match(web,/恢复已有配对/);
});
