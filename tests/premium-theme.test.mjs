import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'小手机.html'),'utf8');
const glass=fs.readFileSync(path.join(root,'glass-theme.css'),'utf8');

test('premium home theme keeps all three established color modes',()=>{
  assert.match(html,/\.home\{background:linear-gradient\(155deg,#18151a 0%,#211a20 44%,#171820 100%\)/);
  assert.match(html,/\.home:not\(\.tpink\):not\(\.twhite\)\{background:linear-gradient\(160deg,#3a2a52,#241d3d 45%,#3a2440 100%\)/);
  assert.match(html,/\.home\.tpink\{background:linear-gradient\(165deg,#ffe5ef,#ffd3e1 50%,#f9cfe0\)/);
  assert.match(html,/\.home\.twhite\{background:linear-gradient\(165deg,#ffffff,#f3f3f6 55%,#eaeaee\)/);
  assert.match(html,/\.dock\{[^}]*backdrop-filter:blur\(20px\) saturate\(120%\)/);
});

test('home time, couple avatars, mood face and original app line icons stay intact',()=>{
  assert.match(app,/class="home-premium-head\$\{clockOn\?'':' home-clock-hidden'\}"[\s\S]*?id="homeLiveTime">\$\{hm\(\)\}<\/time>/);
  assert.match(html,/@font-face\{font-family:"North Stencil Clock"[^}]*data:font\/woff2;base64,/);
  assert.match(html,/\.home-premium-clock time\{[^}]*font-family:var\(--north-clock-font\)[^}]*font-size:34px/);
  assert.match(html,/\.locktime\{[^}]*font-family:-apple-system[^}]*font-size:100px[^}]*-webkit-text-stroke:\.68px/);
  assert.match(html,/@media \(max-height:690px\)\{[\s\S]{0,160}\.locktime\{font-size:80px\}/);
  assert.match(app,/function renderLockClock\(force\)\{[^\n]*document\.hidden[^\n]*_lockClockPaintKey===key[^\n]*if\(t\)\{t\.textContent=v;t\.dataset\.time=v;applyLockTimeMaterial\(t,v\);\}/);
  assert.ok(fs.existsSync(path.join(root,'fonts','SairaStencilOne-OFL.txt')));
  assert.doesNotMatch(app,/class="home-premium-head"[^\n]*早上好/);
  assert.match(app,/function wCouple2\(\)[\s\S]*?<div class="av2">\$\{cir\(me\)\}\$\{cir\(ta\)\}<\/div>/);
  assert.match(app,/const ic=has\?moodIc\(md\.k,34,col\):moodIc\('happy',34,col\)/);
  assert.match(app,/me:_MI\('<circle cx="12" cy="12" r="8\.4"\/>/);
});

test('music and weather widgets use live artwork without the obsolete tiny upload overlay',()=>{
  assert.match(app,/class="home-record-cover" style="background-image:url\(\$\{s\.cover\}\)"/);
  assert.match(app,/class="home-record\$\{s&&_mPlaying\?' wdisc':''\}"/);
  assert.match(app,/wanted=_mCur\|\|\(S\.music&&S\.music\.lastSongId\),s=songs\.find\(x=>x\.id===wanted\)\|\|songs\[0\]\|\|null/);
  assert.match(app,/function homeWeatherIcon\(desc,col\)/);
  assert.match(app,/const pic=homeWeatherIcon\(weather&&weather\.desc,col\);/);
  assert.doesNotMatch(app,/function wPicUpload\(\)/);
  assert.doesNotMatch(app,/class="clkCustom"/);
});

test('formal home follows the approved v829 widget grid instead of a different card stack',()=>{
  assert.match(app,/function homeLayoutInit\(\)/);
  assert.match(app,/S\.me\.widgets\.map\(k=>'w:'\+k\)/);
  assert.match(html,/\.apppage \.home-widget-clock\{grid-column:span 2;grid-row:span 2/);
  assert.match(html,/\.apppage \.home-widget-disc,\.apppage \.home-widget-mood\{grid-column:span 2;grid-row:span 1/);
  assert.match(html,/\.apppage \.home-widget-couple2\{grid-column:span 2/);
  assert.match(html,/\.home-record\{width:58px;height:58px;border-width:8px/);
  assert.match(html,/\.home-mood-face\{width:48px;height:48px/);
});

test('formal home includes the complete edit layer and movable widgets',()=>{
  assert.match(app,/class="home-editbar"/);
  assert.match(app,/function appLiveReorder\(x,y\)/);
  assert.match(app,/function homeLayoutReadDom\(\)/);
  assert.match(app,/data-token="w:\$\{k\}" onpointerdown="appDown/);
  assert.match(app,/function homeEditFinish\(\)/);
  assert.match(html,/\.home\.home-editing \.home-editbar\{display:flex/);
  assert.match(html,/\.home-widget-ghost\{/);
});

test('Android touch devices keep glass styling without fragile large backdrop layers',()=>{
  assert.match(app,/const NORTH_ANDROID=.*?\/Android\/i\.test/);
  assert.match(glass,/@media \(pointer:coarse\),\(hover:none\)\{/);
  assert.match(glass,/html\.north-android\.north-glass-ui \.home \.home-widget-item[\s\S]*?backdrop-filter:none!important/);
  assert.match(glass,/html\.north-android\.north-glass-ui \.settings-glass>\.nav,[\s\S]*?html\.north-android\.north-glass-ui \.settings-glass \.section,[\s\S]*?html\.north-android\.north-glass-ui \.settings-glass \.minibtn\{backdrop-filter:none!important/);
  assert.match(glass,/\.settings-glass \.section\{[^}]*backdrop-filter:blur\(25px\) saturate\(145%\)/);
});

test('WeChat uses a full-bleed frame while original chat internals stay intact',()=>{
  assert.match(app,/const _wxStandalonePremium=\[[^\]]*'wxprofile'[^\]]*'wxaccounts'[^\]]*\]\.includes\(c\.p\)/);
  assert.match(app,/const _wxP=\(c\.p==='wechat'\|\|_wxStandalonePremium\)\?' wx-premium':\['chat','pfchat','pfgroup','group'\]\.includes\(c\.p\)\?' wx-chat-premium':''/);
  assert.match(app,/const _wxSection=c\.p==='wechat'\?' wx-'\+String\(wxTab==='moments'\?'discover':\(wxTab\|\|'chats'\)\):''/);
  assert.match(html,/\.wx-premium>\.nav\{/);
  assert.match(html,/\.wx-premium>\.tabbar\{/);
  assert.match(html,/\.wx-premium\{padding:0;[^}]*gap:0/);
  assert.match(html,/\.wx-premium>\.nav\{[^}]*border-radius:0;[^}]*box-shadow:none/);
  assert.match(html,/\.wx-premium>\.scroll\{[^}]*border-radius:0;[^}]*box-shadow:none/);
  assert.match(html,/\.wx-premium>\.scroll>\.list\{margin:0;border-radius:0/);
  assert.match(html,/\.wx-premium>\.tabbar\{[^}]*border-radius:0;[^}]*box-shadow:none/);
  assert.match(html,/微信高级框架只包裹四个主标签页/);
  assert.match(app,/const titles=\{chats:'微信',contacts:'通讯录',moments:'发现',me:'我'\}/);
  assert.match(app,/class="t wx-main-title"><b>\$\{titles\[wxTab\]\}<\/b><\/span>/);
  assert.doesNotMatch(app,/wxEarIcon|wx-title-ear/);
  assert.match(app,/class="wx-desktop-login"[^\n]*Windows 微信已登录/);
  assert.match(app,/privateNativeStatusBarThemeName\(\)[\s\S]*S\.me\.wxTheme==='white'\?'white':'black'/);
  assert.match(glass,/\.wx-premium>\.wx-main-nav\{[^}]*flex:0 0 58px[^}]*backdrop-filter:blur\(42px\) saturate\(155%\)[^}]*position:relative[^}]*z-index:6/);
  assert.match(glass,/\.wx-premium>\.wx-main-scroll\{[^}]*margin-top:-58px[^}]*padding-top:58px/);
  assert.match(glass,/\.wx-chats \.wx-chat-list \.row\.pin\{background:#202023!important\}/);
  assert.match(glass,/\.wx-chats\.wxlight \.wx-chat-list \.row\.pin\{background:#f4f4f6!important\}/);
});

test('Moments content is formally integrated without replacing its data or actions',()=>{
  assert.match(html,/\.wx-premium\.wx-moments>\.scroll>\.mcover\{/);
  assert.match(html,/\.wx-premium\.wx-moments>\.scroll>\.mpost\{/);
  assert.match(html,/\.wx-premium\.wx-moments>\.scroll\{padding:0;[^}]*scroll-padding-top:0/);
  assert.match(html,/\.wx-premium\.wx-moments>\.scroll>\.mcover\{[^}]*border-radius:0;[^}]*box-shadow:none/);
  assert.match(html,/\.wx-premium\.wx-moments>\.scroll>\.mpost\{margin:0;[^}]*border-bottom:\.5px solid[^}]*border-radius:0;[^}]*box-shadow:none/);
  assert.match(html,/\.wx-premium\.wx-moments:not\(\.wxlight\),\.wx-premium\.wx-moments:not\(\.wxlight\)>\.nav,[^}]*background:#111!important/);
  assert.match(html,/\.wx-premium\.wx-moments>\.scroll>\.mpost\{[^}]*background:#111/);
  assert.match(html,/\.wx-role-moments\{[^}]*background:#111/);
  assert.match(html,/\.wx-premium\.wx-moments\.wxlight>\.scroll>\.mpost\{[^}]*background:rgba\(255,255,255,\.78\)/);
  assert.match(app,/S\.moments\.filter\(p=>\(p\.acct\|\|'main'\)===actId\(\)\)/);
  assert.match(app,/class="tm">\$\{fmtDT\(p\.time\)\}/);
  assert.match(app,/momentDelete\('\$\{p\.id\}'\)/);
  assert.match(app,/momentMenu\('\$\{p\.id\}'\)/);
});

test('WeChat keeps the formal dynamic, microphone and reference-style bottom tabs',()=>{
  assert.match(app,/thought:'<path d="M5\.5 10a5 5 0 0 1 9-3 4 4 0 0 1 4\.5 4 3\.4 3\.4 0 0 1-3\.4 3\.4H8\.4A3\.4 3\.4 0 0 1 5\.5 10z"\/><path d="M5 16\.5h\.01M7\.5 19\.5h\.01"\/>',/);
  assert.match(app,/const mood=.*svgIc\('thought',15,'currentColor'\)/);
  assert.match(app,/mic:'<rect x="9" y="3" width="6" height="11" rx="3"\/><path d="M5\.6 11a6\.4 6\.4 0 0 0 12\.8 0M12 17\.4V21M8\.6 21h6\.8"\/>',/);
  assert.match(app,/tb\('chats',wxTabIcon\('chats'\),'微信'\)/);
  assert.match(app,/tb\('contacts',wxTabIcon\('contacts'\),'通讯录'\)/);
  assert.match(app,/tb\('moments',wxTabIcon\('moments'\),'发现'\)/);
  assert.match(app,/tb\('me',wxTabIcon\('me'\),'我'\)/);
  assert.match(app,/class="wx-tab-outline"/);
  assert.match(app,/class="wx-tab-solid"/);
  assert.match(glass,/\.wx-premium \.wx-main-tabbar \.tb\.on\{color:var\(--wx-green\)!important\}/);
  assert.match(glass,/backdrop-filter:blur\(34px\) saturate\(165%\)/);
  assert.doesNotMatch(app,/wx-tab-dot/);
});

test('software lock rendering remains independent of the visual theme',()=>{
  assert.match(app,/const locked=!!\(a\.lk&&appLocked\(k\)\)/);
  assert.match(app,/if\(appLocked\(k\)\)\{toast\('「'\+\(LOCKABLE\[k\]\|\|k\)\+'」已被ta锁定/);
  assert.match(html,/\.app\.app-locked\{cursor:not-allowed;opacity:1;\}/);
  assert.doesNotMatch(html,/\.home \.app\.app-locked \.ic:before/);
  assert.doesNotMatch(html,/\.home \.app\.app-locked \.ic>img[^}]*grayscale/);
});
