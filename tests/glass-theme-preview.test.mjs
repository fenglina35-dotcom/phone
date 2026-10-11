import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'glass-theme.css'),'utf8');
const iconKeys=fs.readdirSync(path.join(root,'assets','app-icons','glass','black')).filter(x=>x.endsWith('.webp')).map(x=>x.slice(0,-5));
function functionSource(name){
  const start=app.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const next=app.indexOf('\nfunction ',start+10);
  return app.slice(start,next<0?app.length:next).trim();
}

test('transparent black glass is the default with four glass packs only',()=>{
  assert.match(app,/uiMaterial:'glass',appIconPack:'black'/);
  assert.match(app,/function normalizeLoadedState\(\).*S\.me\.uiMaterial='glass'/);
  assert.match(app,/GLASS_ICON_PACKS=\{blue:'蓝白',pink:'粉白',gray:'灰白',black:'纯黑'\}/);
  assert.match(app,/const custom=S\.me\.appIcons&&S\.me\.appIcons\[key\],packed=custom\?'':appIconPackAsset\(key\)/);
});

test('all four generated packs contain one asset for each of the 24 apps',()=>{
  for(const pack of ['blue','pink','gray','black']){
    const files=fs.readdirSync(path.join(root,'assets','app-icons','glass',pack)).filter(x=>x.endsWith('.webp'));
    assert.equal(files.length,24,pack);
  }
});

test('pink pack keeps its original artwork while sharing the fixed desktop grid',()=>{
  for(const key of iconKeys){
    const black=fs.readFileSync(path.join(root,'assets','app-icons','glass','black',key+'.webp'));
    const pink=fs.readFileSync(path.join(root,'assets','app-icons','glass','pink',key+'.webp'));
    assert.ok(black.length>300&&pink.length>300,key);
    assert.notDeepEqual(pink,black,`${key} must retain the approved pink artwork instead of copying black`);
  }
  assert.match(app,/function previewHomePage\(page\)/);
  assert.match(app,/mode\.includes\('apps2'\)\?1:0/);
});

test('glass icon assets remain fully visible and centered in a larger app container',async()=>{
  for(const key of iconKeys){
    const file=path.join(root,'assets','app-icons','glass','black',key+'.webp');
    assert.ok(fs.statSync(file).size>300,`${key} should contain a real lossless icon asset`);
  }
  assert.match(css,/glass-pack-icon\{[^}]*overflow:hidden!important/);
  assert.match(css,/glass-pack-icon>img\{[^}]*width:100%[^}]*object-fit:contain[^}]*object-position:50% 50%/);
  assert.match(css,/\.home \.app \.ic\{width:64px;height:64px/);
});

test('real preview loads the formal app and never saves preview state',()=>{
  const preview=fs.readFileSync(path.join(root,'theme-real-preview.html'),'utf8');
  assert.match(preview,/小手机\.html\?northPreview=/);
  assert.doesNotMatch(preview,/黑色软件图标[^<]*<img/);
  assert.match(app,/function save\(delay\)\{if\(NORTH_PREVIEW\)return true/);
  assert.match(app,/if\(NORTH_PREVIEW\)\{previewRoute\(\);return;\}/);
});

test('preview navigation is isolated from the production service worker shell',()=>{
  const preview=fs.readFileSync(path.join(root,'theme-real-preview.html'),'utf8');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.match(preview,/previewBuild=20260814f/);
  assert.match(preview,/navigator\.serviceWorker\.getRegistrations\(\)/);
  assert.match(preview,/key\.startsWith\('north-shell-'\)/);
  assert.match(app,/if\(NORTH_PREVIEW\|\|!\('serviceWorker'in navigator\)/);
  assert.match(sw,/theme-real-preview\\\.html/);
  assert.match(sw,/url\.searchParams\.has\('northPreview'\)/);
  assert.match(sw,/fetch\(request,\{cache:'no-store'\}\)/);
});

test('reference widgets use live storage and native-first telemetry without replacing drag layout',()=>{
  assert.match(app,/function dashboardStorage\(\).*storageInfo\(\)/);
  assert.match(app,/function dashboardRealBattery\(\)/);
  assert.match(app,/function dashboardPickPhoto\(\)/);
  assert.match(app,/WIDR=\{[^}]*dashboard:wDashboard,vinyl:wVinyl,sweetie:wSweetie/);
  assert.match(app,/data-token="w:\$\{k\}" onpointerdown="appDown/);
  assert.match(css,/\.home-widget-dashboard\{grid-column:1\/-1/);
  assert.match(css,/\.home-widget-vinyl\{grid-column:span 2/);
});

test('music player owns four independent colors while every home vinyl keeps its theme texture',()=>{
  for(const pack of ['black','pink','blue','gray']){
    assert.match(css,new RegExp(`north-pack-${pack} \\.home-vinyl-card \\.vinyl-record:before\\{background:repeating-radial-gradient`));
  }
  for(const color of ['black','white','blue','pink']){
    assert.match(css,new RegExp(`music-premium\\.music-disc-${color} \\.music-vinyl\\{background:repeating-radial-gradient`));
    assert.match(css,new RegExp(`music-premium\\.music-disc-${color} \\.music-headphone-action\\{`));
  }
  assert.match(css,/\.home-vinyl-card \.vinyl-record\.wdisc,html\.north-glass-ui \.music-vinyl\{animation-duration:24s!important\}/);
  assert.match(css,/music-disc-white \.music-headphone-action\{border-color:#202124!important;background:#fff!important/);
  assert.doesNotMatch(css,/north-pack-(?:black|pink|blue|gray) \.music-vinyl-wrap/);
  assert.doesNotMatch(css,/north-pack-(?:black|pink|blue|gray) \.music-vinyl-cover/);
});

test('glass home keeps only the dashboard clock',()=>{
  assert.match(app,/function homeClockColorSet\(value\)/);
  assert.match(app,/时间颜色（主屏 \/ 屏保）/);
  assert.match(css,/html\.north-glass-ui \.home-premium-head\{display:none!important/);
  assert.match(css,/\.dash-time b\{[^}]*font-size:24px/);
});

test('glass home keeps the pull-arrow behavior while matching the three light packs',()=>{
  assert.match(app,/function renderLockPull\(\)/);
  assert.match(app,/function lockShow\(drop\)/);
  assert.doesNotMatch(css,/html\.north-glass-ui \.lockpull/);
  assert.match(css,/north-pack-pink \.lockpull\{[^}]*background:linear-gradient/);
  assert.match(css,/north-pack-pink \.lockpull:before\{border-color:rgba\(255,226,239,\.96\)\}/);
  assert.match(css,/north-pack-blue \.lockpull\{[^}]*background:linear-gradient/);
  assert.match(css,/north-pack-blue \.lockpull:before\{border-color:rgba\(220,237,255,\.97\)\}/);
  assert.match(css,/north-pack-gray \.lockpull\{[^}]*background:linear-gradient/);
  assert.match(css,/north-pack-gray \.lockpull:before\{border-color:rgba\(72,76,85,\.9\)\}/);
  assert.doesNotMatch(css,/north-pack-black \.lockpull/);
  assert.match(css,/html\.north-glass-ui \.home-scroll\{overflow-y:auto;padding-top:38px;box-sizing:border-box\}/);
});

test('private iOS top safe-area strip follows theme colors without moving the web view',()=>{
  const bridge=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','PhoneNativeBridge.swift'),'utf8');
  const shell=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','SmallPhonePrivateRootView.swift'),'utf8');
  assert.match(app,/function privateNativeStatusBarThemeSync\(force\)/);
  assert.match(app,/function webStatusBarThemeSync\(theme\)/);
  assert.match(app,/request\('appearance\.statusBar',\{theme,color\}\)/);
  assert.match(app,/small-phone-native-ready[^\n]*privateNativeStatusBarThemeSync\(true\)/);
  for(const theme of ['pink','blue','gray','white'])assert.match(css,new RegExp(`north-shell-${theme} \\.statusbar\\{background:`));
  assert.doesNotMatch(css,/north-shell-black \.statusbar\{/);
  for(const theme of ['black','pink','blue','gray','white'])assert.match(bridge,new RegExp(`"${theme}"`));
  assert.match(bridge,/case "appearance\.statusBar"/);
  assert.match(shell,/case \.black:[\s\S]*return \.black/);
  assert.match(shell,/case \.pink:[\s\S]*234 \/ 255[\s\S]*243 \/ 255/);
  assert.match(shell,/case \.blue:[\s\S]*234 \/ 255[\s\S]*244 \/ 255/);
  assert.match(shell,/case \.gray:[\s\S]*230 \/ 255[\s\S]*232 \/ 255[\s\S]*236 \/ 255/);
  assert.match(shell,/case \.white:[\s\S]*return \.white/);
  assert.match(shell,/\.preferredColorScheme\(statusBarTint\?\.colorScheme \?\? statusBarTheme\.colorScheme\)/);
  assert.match(shell,/smallPhone\.statusBarTheme\.v1/);
  assert.match(shell,/LocalPhoneWebView/);
  assert.doesNotMatch(shell,/LocalPhoneWebView\s*\{[\s\S]{0,240}\}\s*\.ignoresSafeArea\(\.container, edges: \.top\)/);
});

test('public web browser chrome follows every shell theme while native staging stays black',()=>{
  const webHtml=fs.readFileSync(path.join(root,'小手机.html'),'utf8');
  const transform=fs.readFileSync(path.join(root,'native','private-small-phone','scripts','private-phone-web-transform.mjs'),'utf8');
  const sync=functionSource('webStatusBarThemeSync');
  assert.match(webHtml,/apple-mobile-web-app-status-bar-style" content="default"/);
  assert.match(sync,/root\.style\.setProperty\('--north-shell-status-color',color\)/);
  assert.match(sync,/meta\.remove\(\)/);
  assert.match(sync,/document\.head\.appendChild\(meta\)/);
  assert.match(sync,/apple\.setAttribute\('content','default'\)/);
  for(const [theme,color] of Object.entries({black:'#000',pink:'#ffeaf3',blue:'#eaf4ff',gray:'#e6e8ec',white:'#fff'})){
    assert.match(css,new RegExp(`north-shell-${theme}[^}]+background-color:${color.replace('#','\\#')}!important`));
  }
  assert.match(transform,/status-bar-style" content="default"[^\n]+status-bar-style" content="black"/);
});

test('second-page portrait caption keeps theme color with a translucent glass fill',()=>{
  assert.match(css,/\.glass-second-portrait-copy\{[^}]*background:rgba\(5,6,8,\.24\)[^}]*backdrop-filter:blur\(14px\)/);
  assert.match(css,/north-pack-pink \.glass-second-portrait-copy[^\{]*\{[^}]*rgba\(255,235,244,\.48\)[^}]*rgba\(246,190,215,\.3\)/);
  assert.match(css,/north-pack-blue \.glass-second-portrait-copy\{[^}]*rgba\(235,246,255,\.49\)[^}]*rgba\(184,216,251,\.31\)/);
  assert.match(css,/north-pack-gray \.glass-second-portrait-copy[^\{]*\{[^}]*rgba\(255,255,255,\.5\)[^}]*rgba\(220,225,233,\.32\)/);
  assert.match(css,/\.home\.tpink \.glass-second-portrait-copy/);
  assert.match(css,/\.home\.twhite \.glass-second-portrait-copy/);
});

test('final reference widgets keep the photo square and the vinyl controls removed',()=>{
  assert.match(css,/\.home-dashboard-photo\{width:128px;height:128px/);
  assert.match(css,/\.home-dashboard-photo img\{[^}]*inset:0!important[^}]*object-fit:cover/);
  assert.match(css,/\.vinyl-record:before\{[^}]*repeating-radial-gradient[^}]*radial-gradient/);
  assert.doesNotMatch(app,/class="vinyl-control"/);
  assert.doesNotMatch(app,/class="vinyl-switch"/);
  assert.match(css,/\.home \.dock\{display:grid!important;width:calc\(100% - 32px\)!important;max-width:348px!important/);
});

test('reference vinyl and right app column scale on narrow Android viewports without changing the 390px layout',()=>{
  assert.match(css,/glass-place-vinyl\{left:calc\(50% - 5px\)!important[^}]*width:calc\(50% - 21px\)!important/);
  assert.match(css,/glass-place-sweetie\{[^}]*width:calc\(50% - 21px\)!important/);
  assert.match(css,/glass-place-app-f\{left:calc\(75% - \.5px\)!important[^}]*width:calc\(25% - 27px\)!important/);
});

test('storage gauge shrinks as one complete circle while its glass tile stays fixed',()=>{
  assert.match(css,/\.dash-storage i\{[^}]*width:40px;height:40px[^}]*border-radius:50%/);
  assert.match(css,/\.dash-storage i:after\{[^}]*inset:6px[^}]*border-radius:50%/);
  assert.match(css,/\.dash-storage em\{[^}]*font-size:7px/);
  assert.match(css,/\.home-dashboard-grid\{[^}]*grid-template-columns:\.72fr 1fr 1fr/);
});

test('only non-black storage rings use the softened theme remainder',()=>{
  assert.match(css,/north-pack-pink \.dash-storage i\{background:conic-gradient\(rgba\(255,255,255,\.92\)[^}]*rgba\(255,190,216,\.34\)/);
  assert.match(css,/north-pack-blue \.dash-storage i\{background:conic-gradient\(rgba\(255,255,255,\.92\)[^}]*rgba\(185,215,255,\.34\)/);
  assert.match(css,/north-pack-gray \.dash-storage i\{background:conic-gradient\(rgba\(255,255,255,\.94\)[^}]*rgba\(215,216,222,\.38\)/);
  assert.match(css,/\.dash-storage i\{[^}]*conic-gradient\(#f3f3f3 var\(--dash-store\),#555 0\)/);
});

test('private bundle stages exactly four split glass packs without preview boards',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'native','private-small-phone','Resources','private-phone-web.manifest.json'),'utf8'));
  const glassDirs=manifest.directories.filter(x=>x.startsWith('assets/app-icons/glass/'));
  assert.deepEqual(glassDirs.sort(),['assets/app-icons/glass/black','assets/app-icons/glass/blue','assets/app-icons/glass/gray','assets/app-icons/glass/pink']);
  assert.ok(manifest.files.includes('glass-theme.css'));
  assert.ok(!manifest.directories.includes('assets'));
  assert.ok(!manifest.directories.some(x=>x.includes('boards')));
  assert.ok(!manifest.files.some(x=>/preview/i.test(x)));
});

test('dashboard date stays fully inside the shared time tile',()=>{
  assert.match(css,/\.dash-time\{[^}]*display:flex[^}]*padding:1px 0 2px/);
  assert.match(css,/\.dash-time b\{[^}]*line-height:\.94/);
  assert.match(css,/\.dash-time small\{[^}]*margin-top:2px[^}]*line-height:1[^}]*white-space:nowrap/);
});

test('dashboard inner tiles and photo are vertically centered at the same height',()=>{
  assert.match(css,/\.home-dashboard-grid\{[^}]*height:128px;align-self:center/);
  assert.match(css,/\.home-dashboard-photo\{[^}]*width:128px;height:128px;align-self:center/);
});

test('vinyl record is vertically centered in its square widget',()=>{
  assert.match(css,/\.vinyl-record\{[^}]*left:15px;right:15px;top:15px/);
  assert.match(css,/\.vinyl-arm\{[^}]*top:14px/);
});

test('home vinyl is a real play pause control and follows live audio state',()=>{
  assert.match(app,/home-vinyl-card \.vinyl-record/);
  assert.match(app,/classList\.toggle\('wdisc',_mPlaying\)/);
  assert.match(app,/aria-label="\$\{s&&_mPlaying\?'暂停音乐':s\?'播放音乐':'选择音乐'\}"/);
  assert.match(app,/event\.stopPropagation\(\);musicToggle\(\)/);
  assert.match(app,/onkeydown="if\(event\.key==='Enter'\|\|event\.key===' '/);
});

test('glass home deletes legacy widgets and keeps only the three approved live widgets',()=>{
  assert.match(app,/allowed=\['dashboard','vinyl','sweetie'\]/);
  assert.match(app,/const WIDS=\[\['dashboard'/);
  assert.doesNotMatch(app,/const WIDS=\[\['clock'/);
  assert.match(app,/function dashboardWeatherIcon\(desc\)/);
  assert.match(app,/dash-device dash-weather/);
  assert.match(app,/fetchWeather\(true\)/);
  assert.match(app,/旧组件已经移除，只保留以下三个组件/);
  assert.match(app,/function dashboardWeatherLabel\(desc\)/);
  for(const label of ['晴天','雨天','雷雨','雪天','多云','阴天','雾天'])assert.match(app,new RegExp(label));
});

test('every theme keeps its own very pale transparent glass tint',()=>{
  assert.match(css,/north-pack-pink \.home:not\(\.tpink\):not\(\.twhite\).*rgba\(255,219,233,\.18\)/);
  assert.match(css,/north-pack-blue \.home:not\(\.tpink\):not\(\.twhite\).*rgba\(217,236,255,\.18\)/);
  assert.match(css,/north-pack-gray \.home:not\(\.tpink\):not\(\.twhite\).*rgba\(255,255,255,\.2\)/);
  assert.match(css,/north-pack-black \.home-dashboard-card.*rgba\(34,35,40,\.18\)/);
  assert.match(app,/function glassWidgetDefaultOpacity\(\)\{return appIconPack\(\)==='black'\?18:14;\}/);
});

test('dashboard inner tiles stay translucent without stacking expensive blur layers',()=>{
  const inner=css.match(/\.home-dashboard-grid>div,\.home-dashboard-photo\{[^}]*\}/)?.[0]||'';
  assert.match(inner,/rgba\(70,71,76,\.18\)/);
  assert.doesNotMatch(inner,/backdrop-filter/);
  assert.match(css,/north-pack-pink \.home-dashboard-grid>div[^\{]*\{[^}]*rgba\(255,232,241,\.22\)/);
  assert.match(css,/north-pack-blue \.home-dashboard-grid>div[^\{]*\{[^}]*rgba\(232,243,255,\.22\)/);
  assert.match(css,/north-pack-gray \.home-dashboard-grid>div[^\{]*\{[^}]*rgba\(255,255,255,\.24\)/);
});

test('component glass tint and opacity are user-adjustable without changing layout',()=>{
  assert.match(app,/function glassWidgetAppearanceSet\(key,value\)/);
  assert.match(app,/function glassWidgetAppearanceReset\(\)/);
  assert.match(app,/组件玻璃色调/);
  assert.match(app,/组件透明度/);
  assert.match(css,/\.home\.glass-widget-custom .*--ng-widget-rgb/);
  assert.match(css,/\[class\*="north-pack-"\] \.home\.glass-widget-custom:not\(\.tpink\):not\(\.twhite\).*--ng-widget-alpha/);
  assert.match(css,/north-native-app\.north-glass-ui \.home\.glass-widget-custom \.glass-second-portrait[\s\S]*background-color:rgba\(var\(--ng-widget-rgb\),var\(--ng-widget-alpha\)\)!important/);
});

test('dashboard photo is a direct isolated upload target and sweetie text is readable',()=>{
  assert.match(app,/home-dashboard-photo"\$\{glassInnerAttrs\('photo'\)\} role="button" tabindex="0" onclick="event\.stopPropagation\(\);dashboardPickPhotoHome\(\)"/);
  assert.match(app,/function dashboardPickPhotoHome\(\)/);
  assert.match(css,/\.home-sweetie-card p\{[^}]*font-size:12px/);
  assert.match(app,/function sweetiePickAvatar\(which\)/);
  assert.match(app,/onpointerdown="event\.stopPropagation\(\)" onclick="event\.stopPropagation\(\);sweetiePickAvatar/);
  assert.match(css,/\.sweetie-avatar-picker\{width:60px;height:60px/);
  assert.match(css,/\.home-vinyl-card \.vinyl-cover\{inset:20%!important;width:60%!important;height:60%!important\}/);
  assert.doesNotMatch(css,/\.music-vinyl-cover\{[^}]*inset:20%/);
  assert.match(css,/\.home\[style\*="background:url"\]:before,html\.north-glass-ui \.home\[style\*="background:url"\]:after\{display:none!important;content:none!important\}/);
});

test('sweetie widget reuses the couple start date for an unboxed relationship-day label',()=>{
  assert.match(app,/loveDays=S\.couple&&S\.couple\.startDate\?coupleDays\(S\.couple\.startDate\):0/);
  assert.match(app,/class="sweetie-days">相恋 \$\{loveDays\} 天<\/div>/);
  assert.doesNotMatch(app,/class="sweetie-days">[^<]*情侣空间/);
  assert.match(css,/\.sweetie-days\{[^}]*position:absolute[^}]*color:inherit[^}]*font:inherit[^}]*font-size:9px[^}]*font-weight:550[^}]*text-align:center/);
  assert.doesNotMatch(css,/\.sweetie-days\{[^}]*(?:background|border|box-shadow):/);
});

test('legacy duplicate widgets are removed while the four-slot glass dock is restored',()=>{
  assert.match(app,/const WIDS=\[\['dashboard'/);
  assert.match(app,/const HOME_DOCK_DEFAULT=\['calendar','games','mail','settings'\];/);
  assert.match(app,/const HOME_SHORTCUTS=\{clock:\{[^}]*t:'时钟'[^}]*run:\(\)=>openApp\('calendar'\)/);
  assert.match(app,/const dockTokens=Array\.from\(dock\.children\)/);
  assert.match(app,/S\.me\.appDock=dockTokens/);
  assert.match(app,/before\.length!==beforeSet\.size\|\|after\.length!==afterSet\.size/,'a malformed drag must not persist missing or duplicated apps');
});

test('glass packs keep a free persisted mixed app-widget layout and appearance per pack',()=>{
  assert.doesNotMatch(app,/glassThemeNormalize\(\)/);
  assert.match(app,/function homeAppsHtml\(\)\{homeLayoutInit\(\);return S\.me\.homeLayout/);
  assert.match(app,/glass-reference-page/);
  assert.match(app,/_glassReferenceLayoutV2/);
  assert.match(app,/function appIconPackSet\(pack\)[\s\S]*S\.me\.uiMaterial='glass'/);
  assert.match(app,/function glassWidgetAppearanceEnsure\(\)[\s\S]*glassWidgetAppearances=\{\}/);
  assert.match(app,/map\[pack\]/);
  assert.match(app,/function appDown\(e,k\)\{if\(e\.pointerType/);
  const appDown=app.slice(app.indexOf('function appDown('),app.indexOf('function appBeginDrag('));
  assert.doesNotMatch(appDown,/preventDefault\(\)/,'pointerdown must not cancel the trailing click before a real pan or drag');
  assert.match(app,/function appBeginDrag\(\)[\s\S]*?p\.el\.setPointerCapture\(p\.pid\)/);
  assert.match(css,/#homeDesktop \.home-item\{touch-action:manipulation\}/);
  assert.match(app,/function appPendingMove\(x,y\)/);
  assert.doesNotMatch(app,/function appPanMove\(/);
  assert.match(css,/glass-reference-page~\.apppage\{content-visibility:visible/);
  assert.doesNotMatch(css,/glass-second-page\{[^}]*content-visibility:auto/);
  assert.match(css,/grid-auto-flow:dense/);
  assert.match(css,/north-pack-black \.home-dashboard-card[\s\S]*rgba\(34,35,40,\.18\)/);
});

test('app enlargement changes the whole icon box rather than cropping internal artwork',()=>{
  assert.doesNotMatch(css,/glass-pack-icon>img\{[^}]*inset:-4%/);
  assert.match(css,/glass-pack-icon>img\{[^}]*inset:0!important[^}]*object-fit:contain/);
  assert.match(css,/\.home \.dock \.app \.ic\{width:64px!important;height:64px!important/);
});

test('vinyl playback activates native iOS audio and every pack has a final record color',()=>{
  assert.match(app,/function musicNativeAudioActivate\(\)/);
  assert.match(app,/SmallPhoneNative\.request\('music\.audio\.activate'\)/);
  assert.match(app,/async function musicToggle\(\)/);
  assert.match(css,/north-pack-pink \.home-vinyl-card \.vinyl-record:before[^{]*\{[^}]*conic-gradient/);
  assert.match(css,/north-pack-blue \.home-vinyl-card \.vinyl-record:before[^{]*\{[^}]*conic-gradient/);
  assert.match(css,/north-pack-gray \.home-vinyl-card \.vinyl-record:before[^{]*\{[^}]*conic-gradient/);
  assert.match(css,/north-pack-black \.home-vinyl-card \.vinyl-record:before[^{]*\{[^}]*conic-gradient/);
  assert.match(css,/north-pack-gray \.home-vinyl-card \.vinyl-record:before\{background:repeating-radial-gradient[^}]*conic-gradient/);
  assert.match(css,/music-disc-black \.music-vinyl\{background:repeating-radial-gradient[^}]*conic-gradient/);
  assert.match(css,/music-disc-white \.music-vinyl\{background:repeating-radial-gradient[^}]*conic-gradient/);
  assert.match(css,/music-disc-blue \.music-vinyl\{background:repeating-radial-gradient[^}]*conic-gradient/);
  assert.match(css,/music-disc-pink \.music-vinyl\{background:repeating-radial-gradient[^}]*conic-gradient/);
  assert.doesNotMatch(css,/north-pack-(?:black|pink|blue|gray) \.music-vinyl\{/);
  assert.doesNotMatch(css,/north-pack-black \.home-vinyl-card \.vinyl-record,html\.north-glass-ui\.north-pack-black \.music-vinyl/);
  const bridge=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','PhoneNativeBridge.swift'),'utf8');
  const webView=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','LocalPhoneWebView.swift'),'utf8');
  assert.match(bridge,/case "music\.audio\.activate"[\s\S]*\.playback[\s\S]*setActive\(true\)/);
  assert.match(webView,/mediaTypesRequiringUserActionForPlayback = \[\]/);
});

test('music pairing avatars no longer show the two headphone guide lines',()=>{
  assert.match(css,/\.music-headphone-pair>svg\{display:none!important\}/);
});

// Legacy selection must migrate on load/import, while custom icons and user records survive.
test('removed line pack migrates to black in both runtimes and cannot be selected again',()=>{
  for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    const normalize=source.slice(source.indexOf('function normalizeLoadedState('),source.indexOf('\nnormalizeLoadedState();'));
    const packFn=source.match(/^function appIconPack\(\).*$/m)[0];
    const setFn=source.match(/^function appIconPackSet\(pack\).*$/m)[0];
    for(const requested of ['line','missing',undefined,'black','pink','gray','blue']){
      const custom={wechat:'data:image/png;base64,custom'},messages=[{text:'keep me'}];
      const ctx={S:{me:{appIconPack:requested,theme:'pink',appIcons:custom},contacts:[],settings:{},messages},GLASS_ICON_PACKS:{black:'纯黑',pink:'粉白',gray:'灰白',blue:'蓝白'},glassWidgetAppearanceEnsure(){},applyGlassTheme(){},save(){},render(){},privateNativeStatusBarThemeSync(){},toast(){}};
      vm.runInNewContext(normalize+';'+packFn+';'+setFn,ctx);
      const expected=['black','pink','gray','blue'].includes(requested)?requested:'black';
      ctx.normalizeLoadedState();assert.equal(ctx.S.me.appIconPack,expected);assert.equal(ctx.S.me.theme,'');assert.equal(ctx.appIconPack(),expected);
      ctx.appIconPackSet(requested);assert.equal(ctx.S.me.appIconPack,expected);assert.equal(ctx.S.me.appIcons,custom);assert.equal(ctx.S.messages,messages);
    }
    assert.doesNotMatch(source,/homeLineThemeSet|appIconPackSet\('line'\)|线条主题配色/);
  }
});

test('inner glass controls preserve zero, isolate themes and reset only one block',()=>{
 const ctx={S:{me:{_glassAppearanceSchema:3,appIconPack:'black',glassWidgetAppearances:{}}},save(){},render(){},$(){return null}};
 vm.createContext(ctx);
 vm.runInContext("const GLASS_INNER_PARTS={heart:'heart',time:'time'};"+['appIconPack','widgetHex','widgetRgba','glassWidgetDefaultTint','glassWidgetAppearanceEnsure','glassWidgetAppearance','glassInnerAppearance','glassInnerOpacity','glassInnerTint','glassInnerAttrs','glassInnerSet'].map(functionSource).join('\n'),ctx);
 vm.runInContext("glassInnerSet('heart','opacity',0);glassInnerSet('time','opacity',70)",ctx);
 assert.equal(vm.runInContext("glassInnerOpacity('heart')",ctx),0);
 assert.match(vm.runInContext("glassInnerAttrs('heart')",ctx),/0\.000/);
 ctx.S.me.appIconPack='blue';assert.equal(vm.runInContext("glassInnerOpacity('heart')",ctx),35);
 ctx.S.me.appIconPack='black';vm.runInContext("glassInnerSet('heart','reset')",ctx);
 assert.equal(vm.runInContext("glassInnerOpacity('time')",ctx),70);
 assert.doesNotMatch(vm.runInContext("glassInnerAttrs('heart')",ctx),/style=/);
});

test('system status custom colors validate and remain separate from theme selection',()=>{
 const ctx={S:{me:{statusBarColor:'#123abc'}}};vm.createContext(ctx);vm.runInContext(functionSource('statusBarCustomColor'),ctx);
 assert.equal(ctx.statusBarCustomColor(),'#123abc');ctx.S.me.statusBarColor='red';assert.equal(ctx.statusBarCustomColor(),'');
 assert.match(functionSource('privateNativeStatusBarThemeSync'),/stamp=theme\+'\|'\+color/);
 assert.match(css,/north-shell-custom \.statusbar\{background:var\(--north-shell-status-color\)/);
 const swift=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/SmallPhonePrivateRootView.swift'),'utf8');
 assert.match(swift,/statusBarTint\?\.color \?\? statusBarTheme\.color/);
 assert.match(swift,/0\.299 \* red \+ 0\.587 \* green \+ 0\.114 \* blue/);
});

test('continuous status color input keeps the open picker attached without full-page render',()=>{
 const paints=[],saves=[];const ctx={S:{me:{}},save(delay){saves.push(delay)},privateNativeStatusBarThemeSync(force){paints.push([force,ctx.S.me.statusBarColor]);return 'black'},render(){throw new Error('color input destroyed by page render')},document:{querySelectorAll(){return []}},webStatusBarThemeSync(){return '#000000'}};
 vm.createContext(ctx);vm.runInContext(functionSource('statusBarColorSet'),ctx);
 for(const color of ['#123456','#abcdef','#ffffff'])ctx.statusBarColorSet(color);
 assert.equal(ctx.S.me.statusBarColor,'#ffffff');assert.equal(paints.length,3);assert.deepEqual(saves,[250,250,250]);
 ctx.statusBarColorSet('');assert.equal(ctx.S.me.statusBarColor,'');
});

test('one vinyl slider preserves zero and updates both surfaces without rendering the modal',()=>{
 const styles=[],ctx={S:{me:{_glassAppearanceSchema:3,appIconPack:'black',glassWidgetAppearances:{}}},save(){},document:{querySelectorAll(){return [{style:{setProperty(k,v){styles.push([k,v])}}}]}},$(){return null}};vm.createContext(ctx);
 vm.runInContext(['appIconPack','glassWidgetAppearanceEnsure','glassWidgetAppearance','homeVinylOpacity','homeVinylOpacitySet'].map(functionSource).join('\n'),ctx);
 ctx.homeVinylOpacitySet(0);assert.equal(ctx.homeVinylOpacity(),0);assert.ok(styles.some(x=>x[1]==='0'));
 ctx.S.me.appIconPack='blue';assert.equal(ctx.homeVinylOpacity(),100);ctx.S.me.appIconPack='black';assert.equal(ctx.homeVinylOpacity(),0);ctx.homeVinylOpacitySet(null);assert.equal(ctx.homeVinylOpacity(),100);
 assert.match(css,/\.home-vinyl-card \.vinyl-arm\{opacity:var\(--home-vinyl-opacity,1\)/);
});

test('lock pull opacity accepts zero and persists independently per theme',()=>{
 const ctx={S:{me:{_glassAppearanceSchema:3,appIconPack:'black',glassWidgetAppearances:{}}},save(){},lockPullAppearancePaint(){},document:{querySelectorAll(){return []}},$(){return null}};vm.createContext(ctx);
 vm.runInContext(['appIconPack','glassWidgetAppearanceEnsure','glassWidgetAppearance','lockPullAppearance','lockPullOpacity','lockPullAppearanceSet'].map(functionSource).join('\n'),ctx);
 ctx.lockPullAppearanceSet('opacity',0);assert.equal(ctx.lockPullOpacity(),0);ctx.S.me.appIconPack='pink';assert.equal(ctx.lockPullOpacity(),100);ctx.S.me.appIconPack='black';ctx.lockPullAppearanceSet('reset');assert.equal(ctx.lockPullOpacity(),100);
 assert.match(css,/north-lockpull-opacity\{opacity:var\(--north-lockpull-opacity\)!important\}/);
});


test('resetting glass widgets preserves the independent lock pull button appearance',()=>{
 const ctx={S:{me:{_glassAppearanceSchema:3,appIconPack:'black',glassWidgetAppearances:{black:{opacity:5,vinylOpacity:0,lockPull:{opacity:42,color:'#397ba9'}}}}},save(){},render(){},widgetManager(){},toast(){}};vm.createContext(ctx);
 vm.runInContext(['appIconPack','glassWidgetAppearanceEnsure','glassWidgetAppearance','glassWidgetAppearanceReset'].map(functionSource).join('\n'),ctx);
 ctx.glassWidgetAppearanceReset();assert.equal(ctx.S.me.glassWidgetAppearances.black.lockPull.opacity,42);assert.equal(ctx.S.me.glassWidgetAppearances.black.vinylOpacity,undefined);
});

test('vinyl opacity fades only the decorative disc layer and arm, preserving the center cover',()=>{
 assert.match(css,/\.vinyl-record:before\{[^}]*pointer-events:none[^}]*opacity:var\(--home-vinyl-opacity,1\)/);
 assert.doesNotMatch(css,/\.home-vinyl-card \.vinyl-record[,\{][^}]*opacity:var\(--home-vinyl-opacity/);
 assert.match(functionSource('wVinyl'),/\$\{cover\}<\/div><svg class="vinyl-arm"/);
});

test('Apple standalone custom status colors are not forced black or overridden by the body theme',()=>{
 assert.match(functionSource('webStatusBarThemeSync'),/apple\.setAttribute\('content','default'\)/);
 assert.doesNotMatch(functionSource('webStatusBarThemeSync'),/appleHomeCompatBrowserEnvironment\(\)\?'black'/);
 assert.match(css,/html\.north-glass-ui\.north-shell-custom body\{background-color:var\(--north-shell-status-color\)!important\}/);
});


test('optical lab validates a separate bounded recipe while retaining explicit zero',()=>{const preview=fs.readFileSync(path.join(root,'theme-real-preview.html'),'utf8'),fields=preview.slice(preview.indexOf('const GL_LAB_FIELDS=['),preview.indexOf('const GL_LAB_KEY=')),normalize=preview.split(/\r?\n/).find(x=>x.startsWith('function glLabNormalize(')),ctx={};vm.createContext(ctx);vm.runInContext(fields+'\n'+normalize+'\nglobalThis.normalize=glLabNormalize;globalThis.fields=GL_LAB_FIELDS;',ctx);assert.equal(ctx.fields.length,22);const value=ctx.normalize({params:{blur:0,tint:0,ior:99,bend:-10,shadow:'bad',highlight:null}});assert.equal(value.params.blur,0);assert.equal(value.params.tint,0);assert.equal(value.params.ior,2);assert.equal(value.params.bend,0);assert.equal(value.params.shadow,1);assert.equal(value.params.highlight,1);assert.equal(Object.keys(value.params).length,22);assert.match(preview,/GL_LAB_KEY='north-glass-lab-v1'/);assert.match(preview,/glLabState\.active\|\|document\.hidden/);});


test('home-only optical trial preserves the approved 22-value recipe and limits surface targets',()=>{const html=fs.readFileSync(path.join(root,'theme-real-preview.html'),'utf8'),line=html.split(/\r?\n/).find(x=>x.startsWith('const GL_HOME_RECIPE=')),profile=JSON.parse(line.slice('const GL_HOME_RECIPE='.length,-1));assert.equal(profile.params.blur,2.25);assert.equal(profile.params.ior,1.38);assert.equal(profile.params.shadow,.5);assert.equal(profile.params.angle,315);assert.equal(profile.params.thickness,1.9);assert.equal(profile.params.outer,0);assert.equal(profile.params.bevel,3);assert.equal(profile.params.tint,.05);assert.equal(profile.params.dispersion,0);assert.equal(profile.params.materialBlur,0);assert.equal(profile.expand,false);assert.equal(profile.tone,'white');assert.equal(Object.keys(profile.params).length,22);assert.match(html,/assets\/travel-home\/shanghai\.jpg/);assert.match(html,/home-optical-canvas\{[^}]*pointer-events:none/);assert.match(html,/gl\.deleteTexture\(s\.texture\)/);assert.doesNotMatch(html,/localStorage\.setItem\(['"](?:sp|north-core)/);});


test('unified optical runtime uses the approved immutable recipe without changing business state',()=>{
 const source=app.slice(app.indexOf('/* NORTH_OPTICAL_MATERIAL_V1:'));
 const sandbox={window:{},document:{readyState:'loading',addEventListener(){}},console};
 vm.runInNewContext(source,sandbox);
 const runtime=sandbox.window.NorthOpticalGlass;
 const selected=JSON.parse(fs.readFileSync(path.join(root,'theme-real-preview.html'),'utf8').match(/const GL_HOME_RECIPE=(.*?);/)[1]);
 assert.equal(JSON.stringify(runtime.recipe),JSON.stringify(selected));
 assert.ok(Object.isFrozen(runtime.recipe.params));
 assert.ok(runtime.edgeAt(1,40,100,80,20)>runtime.edgeAt(50,40,100,80,20));
 for(const x of [-10,0,1,10,50,100,110])for(const y of [0,1,40,80]){
  const alpha=runtime.edgeAt(x,y,100,80,20);assert.ok(Number.isFinite(alpha)&&alpha>=0&&alpha<=1);
 }
 assert.doesNotMatch(source,/\bS\.|localStorage|fetch\(|\.onclick\s*=|\.innerHTML\s*=/);
 const privateApp=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'),'utf8');
 assert.equal(privateApp.slice(privateApp.indexOf('/* NORTH_OPTICAL_MATERIAL_V1:')),source);
});


test('glass CSS discovery handles nested-style CSSOM and disposed callbacks stay inactive',()=>{
 const source=app.slice(app.indexOf('/* NORTH_OPTICAL_MATERIAL_V1:'));
 let pending=null,queries=[],disconnected=0,attributes={};
 const document={readyState:'complete',hidden:false,body:{},styleSheets:[{cssRules:[{selectorText:'.dock',cssRules:[],style:{getPropertyValue:k=>k==='backdrop-filter'?'blur(22px)':''}}]}],querySelector:()=>null,querySelectorAll:s=>{queries.push(s);return[];},documentElement:{dataset:attributes},addEventListener(){},removeEventListener(){}};
 const sandbox={window:{addEventListener(){},removeEventListener(){}},document,console,MutationObserver:class{observe(){}disconnect(){disconnected++;}},ResizeObserver:class{observe(){}disconnect(){disconnected++;}},requestAnimationFrame:fn=>{pending=fn;return 1;},cancelAnimationFrame:()=>{pending=null;}};
 vm.runInNewContext(source,sandbox);assert.ok(pending);pending();
 assert.ok(queries.some(q=>q.includes('.dock')),'native .dock filter must be discovered even when a style rule has cssRules=[]');
 sandbox.window.NorthOpticalGlass.dispose();assert.equal(disconnected,2);pending=null;
 sandbox.window.NorthOpticalGlass.refresh();assert.equal(pending,null,'disposed late callbacks must not revive the material');
});


test('optical demo initializes a missing couple without changing normal preview fixtures',()=>{
 const sandbox={defState:()=>({me:{},settings:{},phoneapp:{rolePhones:{}},couple:null,spy:{}})};
 vm.createContext(sandbox);vm.runInContext(functionSource('previewSeed'),sandbox);
 const demo=sandbox.previewSeed('black-role-phone-optical');
 assert.equal(demo.couple.cid,'preview_1');assert.equal(demo.contacts[0].spy.pwd,'1234');
 assert.equal(demo.phoneapp.sms['13800000001'].length,2);
 assert.equal(sandbox.previewSeed('black-home').couple,null);
});


test('glass material discovers styles inserted later into the document head',()=>{
 const source=app.slice(app.indexOf('/* NORTH_OPTICAL_MATERIAL_V1:'));
 let callback,pending,observed,queries=[];const styles=[];
 const document={readyState:'complete',hidden:false,body:{},styleSheets:styles,querySelector:()=>null,querySelectorAll:s=>{queries.push(s);return[];},documentElement:{dataset:{}},addEventListener(){},removeEventListener(){}};
 const sandbox={document,window:{addEventListener(){},removeEventListener(){}},console,MutationObserver:class{constructor(fn){callback=fn;}observe(el){observed=el;}disconnect(){}},ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{pending=fn;return 1;},cancelAnimationFrame(){}};
 vm.runInNewContext(source,sandbox);pending();assert.equal(observed,document.documentElement);
 styles.push({cssRules:[{selectorText:'.late-glass-panel',cssRules:[],style:{getPropertyValue:k=>k==='backdrop-filter'?'blur(14px)':''}}]});
 callback([{type:'childList',target:{tagName:'STYLE'},addedNodes:[]}]);pending();
 assert.ok(queries.some(s=>s.includes('.late-glass-panel')),'newly injected styles must be discovered without a reload');
});


test('phone control SVG keeps original material without changing picture messages or glyph paths',()=>{const source=app.slice(app.indexOf('/* NORTH_OPTICAL_MATERIAL_V1:'));assert(!source.includes(".phcallctl>svg"));assert(source.includes("!el.closest('svg,.imsg-b.pic,.bubble.pic,.cal-color-grid,.cal-color-spectrum')"));assert(source.includes('svg,svg *'));assert.doesNotMatch(source,/\.innerHTML\s*=|\.textContent\s*=|setAttribute\('(?:d|viewBox|fill|stroke)'/);});


test('approved glass scope leaves WeChat, settings and non-SMS phone pages unchanged',()=>{
 const source=app.slice(app.indexOf('/* NORTH_OPTICAL_MATERIAL_V1:')).replace('window.NorthOpticalGlass={recipe,','window.NorthOpticalGlass={safeGlass,recipe,');
 class Element{constructor(area,denied=false){this.area=area;this.denied=denied;}matches(){return false;}closest(selector){if(selector.startsWith('#homeDesktop'))return selector.split(',').includes(this.area)?this:null;if(selector.startsWith('.settings-glass'))return this.denied?this:null;return null;}querySelector(){return null;}}
 const sandbox={window:{},HTMLElement:Element,document:{readyState:'loading',addEventListener(){}},console};vm.runInNewContext(source,sandbox);
 const check=sandbox.window.NorthOpticalGlass.safeGlass;
 for(const name of ['.wx-premium','.settings-glass','.phmain','.phcall','.phcontacts'])assert.equal(check(new Element(name)),false,name);
 for(const name of ['#homeDesktop','.spy-desktop:not(.spy-lock-screen)','.offstage','.offline-hub','.north-offline-sheet','.imsg','.cal-month-page','.cal-year-page','.cal-day-page','.cal-detail-page','.cal-integrated-page','.cal-sheet','.cal-sheet-page','.cal-new-sheet','.photo-album-page'])assert.equal(check(new Element(name)),true,name);
 assert.equal(check(new Element('#homeDesktop',true)),false,'nested settings must not inherit a home surface');
});

test('offscreen glass keeps its material and DOM replacements decorate before the next frame',()=>{
 const source=app.slice(app.indexOf('/* NORTH_OPTICAL_MATERIAL_V1:'));
 const registeredPass=source.slice(source.indexOf('for(const el of [...registered])'),source.indexOf('for(const el of document.querySelectorAll(selectors))'));
 assert.doesNotMatch(registeredPass,/r\.bottom<0|r\.top>innerHeight|r\.left>innerWidth/);
 assert.match(registeredPass,/!safeGlass\(el\)/);
 let callback,pending,paints=0;
 const document={readyState:'complete',hidden:false,body:{},styleSheets:[],querySelector:()=>null,querySelectorAll:()=>{paints++;return[];},documentElement:{dataset:{}},addEventListener(){},removeEventListener(){}};
 const sandbox={document,window:{addEventListener(){},removeEventListener(){}},console,MutationObserver:class{constructor(fn){callback=fn;}observe(){}disconnect(){}},requestAnimationFrame:fn=>{pending=fn;return 1;},cancelAnimationFrame:()=>{pending=null;}};
 vm.runInNewContext(source,sandbox);assert.equal(paints,0);
 callback([{type:'childList',target:{tagName:'DIV'},addedNodes:[{nodeType:1,matches:()=>false,querySelector:()=>null}]}]);assert.equal(paints,1);assert.equal(pending,null);
});

for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'])test(file+': widget foreground color and opacity persist independently without rerendering',()=>{
 const src=fs.readFileSync(file,'utf8'),names=['glassWidgetTextColor','glassWidgetTextOpacity','glassWidgetTextPaint','glassWidgetTextSet'],code=names.map(n=>{const start=src.indexOf('function '+n+'(');assert(start>=0,n);return src.slice(start,src.indexOf('\n',start));}).join('\n');
 let pack='black',saves=0;const map={},styles={},sandbox={glassWidgetAppearanceEnsure:()=>map,glassWidgetAppearance:()=>map[pack]||{},appIconPack:()=>pack,widgetHex:(v,f)=>/^#[a-f0-9]{6}$/i.test(v||'')?v:f,widgetRgba:(v,a)=>v+':'+a,document:{querySelectorAll:sel=>sel==='#homeDesktop'?[{style:{getPropertyValue:k=>styles[k],setProperty:(k,v)=>styles[k]=v}}]:[]},$:()=>null,save:()=>saves++};vm.createContext(sandbox);vm.runInContext(code,sandbox);
 assert.equal(sandbox.glassWidgetTextColor(),'#ffffff');assert.equal(sandbox.glassWidgetTextOpacity(),100);
 sandbox.glassWidgetTextSet('color','#ff3300');sandbox.glassWidgetTextSet('opacity',0);assert.equal(styles['--north-widget-ink'],'#ff3300:0');assert.equal(map.black.textOpacity,0);assert.equal(saves,2);
 pack='blue';assert.equal(sandbox.glassWidgetTextColor(),'#ffffff');assert.equal(sandbox.glassWidgetTextOpacity(),100);pack='black';assert.equal(sandbox.glassWidgetTextColor(),'#ff3300');sandbox.glassWidgetTextSet('opacity',200);assert.equal(sandbox.glassWidgetTextOpacity(),100);sandbox.glassWidgetTextSet('reset');assert.equal(sandbox.glassWidgetTextColor(),'#ffffff');assert.equal(sandbox.glassWidgetTextOpacity(),100);
});
test('resolved wallpaper images are reused and decorated parents cannot become a sampled wallpaper',()=>{
 const src=app.slice(app.indexOf('/* NORTH_OPTICAL_MATERIAL_V1:')).replace('window.NorthOpticalGlass={recipe,','window.NorthOpticalGlass={load,source,recipe,');
 const image={complete:true,naturalWidth:100,src:'https://example.test/wall.jpg'},root={hasAttribute:()=>false,matches:()=>false,parentElement:null,getBoundingClientRect:()=>({width:100,height:200})},nested={hasAttribute:()=>true,parentElement:root},sandbox={window:{},URL,location:{href:'https://example.test/',origin:'https://example.test'},Image:class{constructor(){throw Error('must reuse loaded image');}},document:{readyState:'loading',images:[image],addEventListener(){},body:{}},getComputedStyle:()=>({backgroundImage:'url("https://example.test/wall.jpg")',backgroundSize:'cover',backgroundPosition:'50% 50%'}),console};vm.runInNewContext(src,sandbox);const api=sandbox.window.NorthOpticalGlass;assert.equal(api.load({url:image.src}),image);assert.equal(api.source({parentElement:nested}).url,image.src);
});

test('text-only mutations do not redraw glass and lightweight fallback keeps a hollow rim',()=>{
 const src=app.slice(app.indexOf('/* NORTH_OPTICAL_MATERIAL_V1:')).replace('window.NorthOpticalGlass={recipe,','window.NorthOpticalGlass={fallback,recipe,');let callback,pending,paints=0;const document={readyState:'complete',hidden:false,body:{},styleSheets:[],querySelector:()=>null,querySelectorAll:()=>{paints++;return[];},documentElement:{dataset:{}},addEventListener(){},removeEventListener(){}};const sandbox={document,window:{addEventListener(){},removeEventListener(){}},console,MutationObserver:class{constructor(fn){callback=fn;}observe(){}disconnect(){}},requestAnimationFrame:fn=>{pending=fn;return 1;},cancelAnimationFrame(){}};vm.runInNewContext(src,sandbox);pending();const before=paints;for(let i=0;i<50;i++)callback([{type:'childList',target:{tagName:'SPAN'},addedNodes:[{nodeType:3}],removedNodes:[{nodeType:3}]}]);assert.equal(paints,before);const uri=sandbox.window.NorthOpticalGlass.fallback(300,900,24);assert.match(decodeURIComponent(uri),/fill="none"/);assert.equal(sandbox.window.NorthOpticalGlass.fallback(300,900,24),uri);
});
