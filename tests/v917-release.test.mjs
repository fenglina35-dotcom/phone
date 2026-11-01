import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { REL, vre } from './_helpers.mjs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('小手机.html');
const sw = read('sw.js');
const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const webView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');

test('v1184 web source keeps private 1.0.315 compatibility', () => {
  assert.match(app, vre(String.raw`APP_VER='v{WEB} · {WEBLABEL}'`));
  assert.match(html, vre(String.raw`__NORTH_SHELL_BUILD__='{WEB}'`));
  assert.match(sw, vre(String.raw`const BUILD='{WEB}'`));
  assert.doesNotMatch(project, /CURRENT_PROJECT_VERSION = 40;|MARKETING_VERSION = 1\.0\.40;/);
  assert.equal((project.match(vre(String.raw`CURRENT_PROJECT_VERSION = {IOS};`, 'g')) || []).length, 12);
  assert.equal((project.match(vre(String.raw`MARKETING_VERSION = 1.0.{IOS};`, 'g')) || []).length, 12);
  assert.match(webView, vre(String.raw`__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.{IOS} \({IOS}\)'`));
});

test('album replaces the removed account runtime',()=>{assert.match(html,/photo-album\.js/);assert.doesNotMatch(html,/ai-account\.js/);});
