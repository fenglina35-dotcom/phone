import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('小手机.html');
const sw = read('sw.js');
const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const webView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');

test('v1184 web source keeps private 1.0.315 compatibility', () => {
  assert.match(app, /APP_VER='v1780 · 网页快捷指令教程'/);
  assert.match(html, /__NORTH_SHELL_BUILD__='1780'/);
  assert.match(sw, /const BUILD='1780'/);
  assert.doesNotMatch(project, /CURRENT_PROJECT_VERSION = 40;|MARKETING_VERSION = 1\.0\.40;/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 460;/g) || []).length, 12);
  assert.equal((project.match(/MARKETING_VERSION = 1.0.460;/g) || []).length, 12);
  assert.match(webView, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.460 \(460\)'/);
});

test('album replaces the removed account runtime',()=>{assert.match(html,/photo-album\.js/);assert.doesNotMatch(html,/ai-account\.js/);});
