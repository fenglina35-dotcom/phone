import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('../app.js');
const html=read('../小手机.html');
const sw=read('../sw.js');
const index=read('../index.html');
const repair=read('../repair.html');
const privateBundle=read('../native/private-small-phone/Resources/PhoneWebBundleInfo.plist');
const xcode=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const webView=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');

test('v1045 web files use one cache-busting build number',()=>{
  assert.match(app,/APP_VER='v1084 · 睡眠来源与限额锁标识版'/);
  assert.match(app,/const url='sw\.js\?v=1084&r=v1084-sleep-limit-clarity-1'/);
  assert.match(html,/__NORTH_SHELL_BUILD__='1084'/);
  assert.match(html,/app\.js\?v=1084/);
  assert.match(sw,/const BUILD='1084'/);
  assert.match(sw,/north-shell-v1084/);
  assert.match(index,/小手机\.html\?v=1084/);
  assert.match(repair,/小手机\.html\?v=1084/);
});

test('the private iOS package embeds web v1084 and keeps 1.0.209 delivery',()=>{
  assert.match(privateBundle,/<string>1084<\/string>/);
  assert.equal((xcode.match(/MARKETING_VERSION = 1\.0\.209;/g)||[]).length,12);
  assert.equal((xcode.match(/CURRENT_PROJECT_VERSION = 209;/g)||[]).length,12);
  assert.match(webView,/__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.209 \(209\)'/);
  assert.match(webView,/typeof window\.lockPullRefresh === 'function'/);
});

test('settings visibly proves which web core and private build are running',()=>{
  assert.match(app,/data-build-verification="1"/);
  assert.match(app,/当前已加载：\$\{APP_VER\}/);
  assert.match(app,/私人安装包 \$\{esc\(nativeBuild\)\}/);
});
