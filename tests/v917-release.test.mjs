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
  assert.match(app, /APP_VER='v1662 · 像素少女与电子宠物断网自动重下'/);
  assert.match(html, /__NORTH_SHELL_BUILD__='1662'/);
  assert.match(sw, /const BUILD='1662'/);
  assert.doesNotMatch(project, /CURRENT_PROJECT_VERSION = 40;|MARKETING_VERSION = 1\.0\.40;/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 439;/g) || []).length, 12);
  assert.equal((project.match(/MARKETING_VERSION = 1.0.439;/g) || []).length, 12);
  assert.match(webView, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.439 \(439\)'/);
});

test('album replaces the removed account runtime',()=>{assert.match(html,/photo-album\.js/);assert.doesNotMatch(html,/ai-account\.js/);});
