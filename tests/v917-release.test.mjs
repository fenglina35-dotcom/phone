import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('小手机.html');
const sw = read('sw.js');
const account = read('ai-account.js');
const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const webView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');

test('v1027 web source keeps private 1.0.148 compatibility', () => {
  assert.match(app, /APP_VER='v1027 · X网友评论风格'/);
  assert.match(html, /__NORTH_SHELL_BUILD__='1027'/);
  assert.match(sw, /const BUILD='1027'/);
  assert.doesNotMatch(project, /CURRENT_PROJECT_VERSION = 40|MARKETING_VERSION = 1\.0\.40/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 148;/g) || []).length, 12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.148;/g) || []).length, 12);
  assert.match(webView, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.148 \(148\)'/);
});

test('AI account first screen carries the approved visible red notice', () => {
  assert.match(account, /内置AI的新购买入口已经关闭/);
  assert.match(account, /color:#ff5b6f/);
});
