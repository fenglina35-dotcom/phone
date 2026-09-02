import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'glass-theme.css'),'utf8');
const html=fs.readFileSync(path.join(root,'小手机.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const plist=fs.readFileSync(path.join(root,'native/private-small-phone/Resources/PhoneWebBundleInfo.plist'),'utf8');
const project=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj'),'utf8');
const native=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift'),'utf8');

test('v1140 web keeps private 1.0.253 compatibility',()=>{
  assert.match(app,/APP_VER='v1140 · 网页智能家电与角色实灯控制版'/);
  assert.match(html,/__NORTH_SHELL_BUILD__='1140'/);
  assert.match(sw,/BUILD='1140'/);
  assert.match(plist,/<string>1125<\/string>/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 253;/g)||[]).length,12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.253;/g)||[]).length,12);
  assert.match(native,/1\.0\.253 \(253\)/);
});

test('normal taps and paging stay native until a real long press drag begins',()=>{
  assert.match(css,/#homeDesktop \.home-item\{touch-action:manipulation\}/);
  assert.match(css,/body\.home-drag-active #homeDesktop \.home-item\{touch-action:none\}/);
  assert.match(app,/function appPendingMove\(x,y\)[\s\S]*?APP_TAP_MOVE/);
  assert.doesNotMatch(app,/function appPanMove\(/);
  assert.doesNotMatch(app,/p\.sw\.scrollLeft=p\.swLeft-dx/);
  assert.match(app,/function appBeginDrag\(\)[\s\S]*?home-drag-active/);
});

test('all absolute-positioned home pages remain paintable and cleanup cannot leave a tap shield',()=>{
  assert.match(css,/glass-reference-page~\.apppage\{content-visibility:visible\}/);
  assert.match(css,/glass-second-page\{[^}]*content-visibility:visible/);
  assert.doesNotMatch(css,/glass-second-page\{[^}]*content-visibility:auto/);
  assert.match(app,/function homePgScroll\(el\)[\s\S]*?if\(next!==_homePage\)/);
  assert.match(app,/function appCancel\(\)[\s\S]*?home-drag-active[\s\S]*?pointerEvents=''[\s\S]*?aedit/);
  assert.match(app,/window\.addEventListener\('pagehide',appCancel\)/);
});
