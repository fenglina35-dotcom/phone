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
  assert.match(app,/APP_VER='v1085 · WebContent降载与微信手动总结版'/);
  assert.match(app,/const url='sw\.js\?v=1085&r=v1085-webcontent-memory-wechat-summary-1'/);
  assert.match(html,/__NORTH_SHELL_BUILD__='1085'/);
  assert.match(html,/app\.js\?v=1085/);
  assert.match(sw,/const BUILD='1085'/);
  assert.match(sw,/north-shell-v1085/);
  assert.match(index,/小手机\.html\?v=1085/);
  assert.match(repair,/小手机\.html\?v=1085/);
});

test('the private iOS package embeds web v1085 and keeps 1.0.210 delivery',()=>{
  assert.match(privateBundle,/<string>1085<\/string>/);
  assert.equal((xcode.match(/MARKETING_VERSION = 1\.0\.210;/g)||[]).length,12);
  assert.equal((xcode.match(/CURRENT_PROJECT_VERSION = 210;/g)||[]).length,12);
  assert.match(webView,/__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.210 \(210\)'/);
  assert.match(webView,/typeof window\.lockPullRefresh === 'function'/);
});

test('settings visibly proves which web core and private build are running',()=>{
  assert.match(app,/data-build-verification="1"/);
  assert.match(app,/当前已加载：\$\{APP_VER\}/);
  assert.match(app,/私人安装包 \$\{esc\(nativeBuild\)\}/);
});
