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

test('v1183 web files use one cache-busting build number',()=>{
  assert.match(app,/APP_VER='v1183 · 共同生活键盘与唱片配色修复版'/);
  assert.match(app,/const url='sw\.js\?v=1183&r=v1183-cohab-keyboard-vinyl-release-1'/);
  assert.match(html,/__NORTH_SHELL_BUILD__='1183'/);
  assert.match(html,/app\.js\?v=1183/);
  assert.match(sw,/const BUILD='1183'/);
  assert.match(sw,/north-shell-v1183-cohab-keyboard-vinyl-release-1/);
  assert.match(index,/小手机\.html\?v=1183/);
  assert.match(repair,/小手机\.html\?v=1183/);
});

test('the private iOS source embeds private web v1183 and keeps native build 309 before repackaging',()=>{
  assert.match(privateBundle,/<string>1183<\/string>/);
  assert.equal((xcode.match(/MARKETING_VERSION = 1\.0\.309;/g)||[]).length,12);
  assert.equal((xcode.match(/CURRENT_PROJECT_VERSION = 309;/g)||[]).length,12);
  assert.match(webView,/__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.309 \(309\)'/);
  assert.match(webView,/typeof window\.lockPullRefresh === 'function'/);
});

test('settings visibly proves which web core and private build are running',()=>{
  assert.match(app,/data-build-verification="1"/);
  assert.match(app,/当前已加载：\$\{APP_VER\}/);
  assert.match(app,/私人安装包 \$\{esc\(nativeBuild\)\}/);
});
