import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const nativeRoot=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/SmallPhonePrivateRootView.swift',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const next=app.indexOf('\nfunction ',start+10);
  return app.slice(start,next<0?app.length:next).trim();
}

function compatEnvironment(navigator,standaloneMedia=false,privateApp=false){
  const context=vm.createContext({navigator,matchMedia:()=>({matches:standaloneMedia}),window:{__SMALL_PHONE_PRIVATE__:privateApp}});
  vm.runInContext(functionSource('appleHomeCompatNative')+';'+functionSource('appleHomeCompatBrowserEnvironment')+';'+functionSource('appleHomeCompatEnvironment')+';globalThis.result=appleHomeCompatEnvironment();',context);
  return context.result;
}

test('full-screen shell is capped to the current available viewport',()=>{
  assert.doesNotMatch(html,/viewport-fit=cover/);
  assert.match(html,/apple-mobile-web-app-status-bar-style" content="default"/);
  assert.match(html,/html,body,.phone,.screen\{height:100%;min-height:0;max-height:100%;overflow:hidden\}/);
  assert.match(html,/#app\{flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column;min-height:0;\}/);
  assert.match(html,/\.page\{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;\}/);
});

test('chat content scrolls inside the shell while the composer keeps its row',()=>{
  assert.match(html,/\.chatbg\{flex:1;overflow-y:auto;/);
  assert.match(html,/\.inputbar\{flex:0 0 auto;/);
  assert.match(html,/\.inputbar textarea\{[^}]*height:36px;[^}]*overflow-x:hidden;overflow-y:hidden;/,'the iOS caret starts inside an explicit clipped textarea box');
});

test('no script may substitute physical screen height for the app viewport',()=>{
  assert.doesNotMatch(html,/--north-shell-height|north-standalone-shell|__northStandaloneShellSync/);
  assert.doesNotMatch(html,/screen\.height/);
  assert.doesNotMatch(html,/min-height:-webkit-fill-available/);
  assert.doesNotMatch(app,/function syncAppViewport|--north-app-height/,'do not restore the keyboard-sensitive global viewport script');
});

test('Apple home-screen environment detection stays isolated from Android and the private App',()=>{
  assert.equal(compatEnvironment({userAgent:'Mozilla/5.0 (iPhone)',platform:'iPhone',maxTouchPoints:5,standalone:true}),true);
  assert.equal(compatEnvironment({userAgent:'Mozilla/5.0 (iPhone)',platform:'iPhone',maxTouchPoints:5,standalone:false}),false,'ordinary iPhone Safari must keep its existing layout');
  assert.equal(compatEnvironment({userAgent:'Mozilla/5.0 (Linux; Android 15)',platform:'Linux armv8l',maxTouchPoints:5,standalone:false},true),false,'Android standalone must never receive the Apple workaround');
  assert.equal(compatEnvironment({userAgent:'Mozilla/5.0 (Macintosh)',platform:'MacIntel',maxTouchPoints:5,standalone:true}),true,'iPad desktop user agent is still supported');
  assert.equal(compatEnvironment({userAgent:'Private WKWebView',platform:'iPhone',maxTouchPoints:5,standalone:false},false,true),false,'the private iOS App must not apply the web compatibility switch');
});

test('restored v950 shell keeps automatic Apple safe-area offsets disabled',()=>{
  assert.doesNotMatch(functionSource('renderSettings'),/苹果兼容适配|appleHomeCompatToggle|appleHomeCompatOn/);
  assert.doesNotMatch(app,/function appleHomeCompat(?:On|Toggle)\(/);
  assert.doesNotMatch(functionSource('applyAppleHomeCompat'),/north-ios-pwa-shell/);
  assert.match(functionSource('applyAppleHomeCompat'),/classList\.remove\('north-ios-home-safe'\)/);
  assert.match(functionSource('applyAppleHomeCompat'),/classList\.remove\('north-apple-remote-safe'\)/);
  assert.match(functionSource('applyAppleHomeCompat'),/return false/);
  assert.doesNotMatch(html,/html\.north-ios-pwa-shell \.phone/);
  assert.match(html,/html\.north-ios-home-safe\{--north-ios-home-safe-top:max\(env\(safe-area-inset-top,0px\),47px\);--north-ios-home-safe-bottom:0px\}/);
  assert.doesNotMatch(html,/html\.north-ios-home-safe[^}]*height:100dvh/,'the opt-in must not replace the stable 100% shell with a second viewport model');
  assert.match(html,/\.north-ios-home-safe \.home-premium-head\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.inputbar\{[^}]*var\(--north-ios-home-safe-bottom\)/);
  assert.match(html,/\.north-ios-home-safe \.tabbar\{[^}]*min-height:calc\(54px \+ var\(--north-ios-home-safe-bottom\)\);[^}]*padding-bottom:var\(--north-ios-home-safe-bottom\)/);
  assert.match(html,/\.north-ios-home-safe \.wx-premium>\.tabbar\{[^}]*height:calc\(58px \+ var\(--north-ios-home-safe-bottom\)\)/);
  assert.match(html,/\.north-ios-home-safe \.xnav\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.music-topbar\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.smshead\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.dytab\{[^}]*var\(--north-ios-home-safe-bottom\)/);
  assert.match(html,/\.north-ios-home-safe \.msgbanner\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.spybanner\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/html\.north-apple-remote-safe \.remote-control-top\{transform:translateY\(var\(--north-apple-remote-offset\)\)\}/,'the remote-control top banner moves only under the explicit Apple class');
  assert.match(html,/html\.north-native-app\.north-apple-remote-safe\{--north-apple-remote-offset:14px\}/,'the private app uses a small opt-in offset without receiving the browser-wide safe-area layout');
  assert.match(html,/\.north-ios-home-safe \.callscreen\.mini\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.nav\.cohab-wx-nav\{[^}]*height:calc\(56px \+ var\(--north-ios-home-safe-top\)\)!important/,'the co-living WeChat header must not compress its safe area');
  assert.match(html,/\.north-ios-home-safe \.callscreen\.mini \.cav\{margin:0!important\}/,'the mini-call avatar must override the full-screen call inset');
  assert.match(html,/\.north-ios-home-safe \.cin-nav,html\.north-ios-home-safe \.cin-watch-nav,html\.north-ios-home-safe \.cin-reader-nav,html\.north-ios-home-safe \.dg-nav\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(app,/class="nav shop-nav"/);
  assert.match(app,/class="nav food-nav"/);
  assert.match(html,/\.north-ios-home-safe \.shop-nav,html\.north-ios-home-safe \.food-nav\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.commerce-top\{[^}]*var\(--north-ios-home-safe-top\)/,'the runtime commerce override must receive the safe-area rule');
  assert.match(html,/\.north-ios-home-safe \.music-app-head\{[^}]*var\(--north-ios-home-safe-top\)/,'the music home header is independent from music-topbar');
  assert.match(html,/\.north-ios-home-safe \.dy-topbar\{[^}]*var\(--north-ios-home-safe-top\)/,'the runtime Douyin override must receive the safe-area rule');
  assert.match(html,/\.north-ios-home-safe \.dynav\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(app,/class="dynav dy-safe-nav"/);
  assert.match(app,/class="dy-feed-back"/);
  assert.match(html,/\.north-ios-home-safe \.dy-safe-nav\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.dy-feed-back\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(app,/class="travel-app"/);
  assert.match(app,/class="travel-head"/);
  assert.match(html,/\.north-ios-home-safe \.travel-head\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/html\.north-native-app \.phone\{position:fixed;inset:0/);
  assert.doesNotMatch(html,/\.north-native-app\.north-ios-home-safe/,'native pages keep the proven browser layout instead of browser-wide offsets');
  assert.match(nativeRoot,/\.ignoresSafeArea\(\.container, edges: \.bottom\)/,'the private native container keeps the web surface behind the home indicator');
  assert.match(nativeRoot,/statusBarTheme\.color[\s\S]*?\.ignoresSafeArea\(\.container, edges: \.top\)/,'the private app paints only the reserved status-bar lane with the selected theme');
  assert.match(nativeRoot,/case \.black:[\s\S]*?return \.black/,'pure black remains the safe fallback theme');
  const webViewMount=nativeRoot.slice(nativeRoot.indexOf('LocalPhoneWebView('),nativeRoot.indexOf('.id(webViewGeneration)')+'.id(webViewGeneration)'.length);
  assert.doesNotMatch(webViewMount,/\.ignoresSafeArea\(\)/,'the web view itself must never extend under the iPhone status bar');
});
