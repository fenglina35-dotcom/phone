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
  assert.match(app,/APP_VER='v1060 · 微信忙碌与外卖澄清续接修复版'/);
  assert.match(app,/const url='sw\.js\?v=1060&r=v1060-busy-delivery-clarification-1'/);
  assert.match(html,/__NORTH_SHELL_BUILD__='1060'/);
  assert.match(html,/app\.js\?v=1060/);
  assert.match(sw,/const BUILD='1060'/);
  assert.match(sw,/north-shell-v1060/);
  assert.match(index,/小手机\.html\?v=1060/);
  assert.match(repair,/小手机\.html\?v=1060/);
});

test('the private iOS package embeds web v1060 and keeps 1.0.183 delivery',()=>{
  assert.match(privateBundle,/<string>1060<\/string>/);
  assert.equal((xcode.match(/MARKETING_VERSION = 1\.0\.183;/g)||[]).length,12);
  assert.equal((xcode.match(/CURRENT_PROJECT_VERSION = 183;/g)||[]).length,12);
  assert.match(webView,/__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.183 \(183\)'/);
  assert.match(webView,/typeof window\.lockPullRefresh === 'function'/);
});

test('settings visibly proves which web core and private build are running',()=>{
  assert.match(app,/data-build-verification="1"/);
  assert.match(app,/当前已加载：\$\{APP_VER\}/);
  assert.match(app,/私人安装包 \$\{esc\(nativeBuild\)\}/);
});
