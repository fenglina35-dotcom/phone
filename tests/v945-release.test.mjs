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

test('v1179 web files use one cache-busting build number',()=>{
  assert.match(app,/APP_VER='v1179 · 格式与拼图修正版'/);
  assert.match(app,/const url='sw\.js\?v=1179&r=v1179-format-bead-fix-1'/);
  assert.match(html,/__NORTH_SHELL_BUILD__='1179'/);
  assert.match(html,/app\.js\?v=1179/);
  assert.match(sw,/const BUILD='1179'/);
  assert.match(sw,/north-shell-v1179-format-bead-fix-1/);
  assert.match(index,/小手机\.html\?v=1179/);
  assert.match(repair,/小手机\.html\?v=1179/);
});

test('the private iOS source embeds private web v1179 and uses native build 305 after packaging',()=>{
  assert.match(privateBundle,/<string>1179<\/string>/);
  assert.equal((xcode.match(/MARKETING_VERSION = 1\.0\.305;/g)||[]).length,12);
  assert.equal((xcode.match(/CURRENT_PROJECT_VERSION = 305;/g)||[]).length,12);
  assert.match(webView,/__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.305 \(305\)'/);
  assert.match(webView,/typeof window\.lockPullRefresh === 'function'/);
});

test('settings visibly proves which web core and private build are running',()=>{
  assert.match(app,/data-build-verification="1"/);
  assert.match(app,/当前已加载：\$\{APP_VER\}/);
  assert.match(app,/私人安装包 \$\{esc\(nativeBuild\)\}/);
});
