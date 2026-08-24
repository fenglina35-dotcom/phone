import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('../app.js');
const gate=read('../license-gate.js');
const root=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest/SmallPhonePrivateRootView.swift');
const project=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const webView=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');
const bundleInfo=read('../native/private-small-phone/Resources/PhoneWebBundleInfo.plist');

test('private App version, bundled core and native status area are current',()=>{
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 183;/g)||[]).length,12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.183;/g)||[]).length,12);
  assert.match(webView,/__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.183 \(183\)'/);
  assert.match(bundleInfo,/<string>1060<\/string>/);
  assert.match(root,/statusBarTheme\.color\s*\n\s*\.ignoresSafeArea\(\.container, edges: \.top\)/);
  assert.match(root,/case \.black:[\s\S]*return \.black/);
  assert.match(root,/\.preferredColorScheme\(statusBarTheme\.colorScheme\)/);
  assert.doesNotMatch(root,/Color\(red: 38 \/ 255, green: 33 \/ 255, blue: 39 \/ 255\)/);
});

test('private App does not expose the web Apple compatibility switch',()=>{
  assert.match(app,/function appleHomeCompatEnvironment\(\)\{return appleHomeCompatBrowserEnvironment\(\);\}/);
  assert.doesNotMatch(app,/苹果兼容适配|appleHomeCompatToggle|appleHomeCompatOn/);
  assert.match(app,/classList\.remove\('north-ios-home-safe'\)/);
});

test('private App authorization view omits browser management while keeping biometric recovery',()=>{
  const start=app.indexOf('function licenseStatusSection()');
  const branchEnd=app.indexOf('if(managed)setTimeout(licenseRefreshStatus,0);',start);
  assert.ok(start>=0&&branchEnd>start);
  const privateBranch=app.slice(start,branchEnd);
  assert.match(privateBranch,/私人 App 授权/);
  assert.match(privateBranch,/绑定扫脸 \/ 指纹恢复/);
  assert.doesNotMatch(privateBranch,/已授权浏览器|Safari \/ Edge|浏览器合并/);
  assert.match(gate,/if \(isPrivateApp\(\)\) return \/iPad\/i\.test\(ua\) \? 'iPad · 私人App' : 'iPhone · 私人App'/);
  assert.match(gate,/isPrivateApp\(\) \? '当前 App 还没有授权' : '本浏览器还没有授权'/);
});
