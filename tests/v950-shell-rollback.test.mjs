import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const webHtml=read('../小手机.html');
const webApp=read('../app.js');
const privateHtml=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html');
const privateAlias=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html');
const privateApp=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');
const privateRoot=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest/SmallPhonePrivateRootView.swift');

test('private shells retain the stable manifest contract with native content resizing',()=>{
  for(const html of [privateHtml,privateAlias]){
    assert.match(html,/name="viewport" content="width=device-width, initial-scale=1\.0, maximum-scale=1\.0, user-scalable=no, interactive-widget=resizes-content"/);
    assert.doesNotMatch(html,/viewport-fit=cover/);
    assert.match(html,/apple-mobile-web-app-status-bar-style" content="black"/);
    assert.doesNotMatch(html,/black-translucent/);
    assert.match(html,/name="theme-color" content="#ff8fab"/);
    assert.match(html,/background_color:'#111111',theme_color:'#ff8fab'/);
    assert.match(html,/--north-ios-home-safe-bottom:0px/);
    assert.doesNotMatch(html,/north-ios-pwa-bottom|north-system-bar-color|north_pwa_system_bar_color/);
    assert.doesNotMatch(html,/bottom:calc\(0px -/);
  }
});

test('the public web shell restores the successful v950 viewport contract',()=>{
  assert.match(webHtml,/name="viewport" content="width=device-width, initial-scale=1\.0, maximum-scale=1\.0, user-scalable=no, interactive-widget=resizes-content"/);
  assert.doesNotMatch(webHtml,/viewport-fit=cover/);
  assert.match(webHtml,/apple-mobile-web-app-status-bar-style" content="default"/);
  assert.doesNotMatch(webHtml,/black-translucent/);
  assert.match(webHtml,/name="theme-color" content="#ff8fab"/);
  assert.match(webHtml,/--north-ios-home-safe-top:max\(env\(safe-area-inset-top,0px\),47px\)/);
  assert.match(webHtml,/--north-ios-home-safe-bottom:0px/);
  assert.doesNotMatch(webHtml,/north-ios-pwa-bottom|north-system-bar-color|north_pwa_system_bar_color/);
});

test('all dynamic system-bar repair code is gone while private App still covers the bottom inset',()=>{
  for(const app of [webApp,privateApp]){
    assert.doesNotMatch(app,/pwaSystemBarColorApply|pwaWallpaperBottomColor|pwaSystemBarSync|north-ios-pwa-shell|north-ios-pwa-bottom/);
  }
  assert.match(privateRoot,/ignoresSafeArea\(\.container, edges: \.bottom\)/);
  assert.doesNotMatch(privateRoot,/ignoresSafeArea\(\.keyboard, edges: \.bottom\)/,
    'the private WKWebView must follow the native keyboard frame without a delayed second jump');
});
