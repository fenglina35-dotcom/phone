import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REL, vre } from './_helpers.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'glass-theme.css'),'utf8');
const html=fs.readFileSync(path.join(root,'小手机.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const plist=fs.readFileSync(path.join(root,'native/private-small-phone/Resources/PhoneWebBundleInfo.plist'),'utf8');
const project=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj'),'utf8');
const native=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift'),'utf8');

test('v1184 web keeps private 1.0.315 compatibility',()=>{
  assert.match(app,vre(String.raw`APP_VER='v{WEB} · {WEBLABEL}'`));
  assert.match(html,vre(String.raw`__NORTH_SHELL_BUILD__='{WEB}'`));
  assert.match(sw,vre(String.raw`BUILD='{WEB}'`));
  assert.match(plist,/<string>1200<\/string>/);
  assert.equal((project.match(vre(String.raw`CURRENT_PROJECT_VERSION = {IOS};`, 'g'))||[]).length,12);
  assert.equal((project.match(vre(String.raw`MARKETING_VERSION = 1.0.{IOS};`, 'g'))||[]).length,12);
  assert.match(native,vre(String.raw`1\.0\.{IOS} \({IOS}\)`));
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
