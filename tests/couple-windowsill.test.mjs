import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// COUPLE_WINDOWSILL_V1: the private couple space opens on 唐幡's 3D "赴约 · 窗台" (AGPL-3.0, private app only).
const P = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const T = 'native/private-small-phone/third_party/qiaosi-windowsill/';
const url = name => new URL('../' + name, import.meta.url);
const read = name => fs.readFileSync(url(name), 'utf8');

test('the windowsill is enabled again with the steady-30 setting she picked on her phone', () => {
  // COUPLE_WINDOWSILL_PAUSED_V1 paused it on 2026-10-20; after five rounds of scripts/windowsill_phone_test she chose
  // 「新方案，清晰度 1.6，稳定 30 张」 and asked for it in the app (WINDOWSILL_STEADY30_V1).
  const js = read(P + 'private-couple-windowsill.js');
  assert.doesNotMatch(js, /paused: true/);
  assert.doesNotMatch(js, /^\s*return;\s*$/m, 'no early exit before the windowsill is wired');
  const shell = read(T + 'smallphone/shell.js');
  assert.match(shell, /WINDOWSILL_STEADY30_V1/);
  assert.match(shell, /window\.__WS_DPR_MAX = saver \? 1\.25 : 1\.6;/);
  for (const k of ['__WS_SHADOW_FREEZE', '__WS_NO_AO', '__WS_NO_DOF', '__WS_PCF', '__WS_NO_CANDLE_SHADOW', '__WS_FAKE_AREA']) assert.match(shell, new RegExp('window\\.' + k + ' = true;'), k);
  assert.match(shell, /go = t - last >= 31/, 'at most 30 pictures a second, one decision per display frame');
  assert.doesNotMatch(shell, /__WS_NO_GLASS|glass\.enabled = false/, 'she asked to keep the glass');
  const built = read(P + 'couple-windowsill/windowsill.js');
  assert.match(built, /shadowMap\.autoUpdate=!window\.__WS_SHADOW_FREEZE/);
  assert.match(built, /window\.__WS_FAKE_AREA/);
  assert.match(built, /\.65/);
  assert.doesNotMatch(built, /__WS_DEV|__WS_PROF/, 'the speed-test hooks stay out of the app build');
});

test('the desk is wired to her small phone (WINDOWSILL_DESK_V1)', () => {
  const js = read(P + 'private-couple-windowsill.js'), shell = read(T + 'smallphone/shell.js'), built = read(P + 'couple-windowsill/windowsill.js');
  // names she asked for
  // the bundler writes Chinese as \\u escapes
  const fn = t => 'fn:"' + [...t].map(ch => '\\u' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join('') + '"';
  for (const t of ['星星罐', '他在哪', '致谢', '相册']) assert.ok(built.includes(fn(t)), t);
  for (const t of ['梗库', '我在哪', '彩蛋']) assert.ok(!built.includes(fn(t)), t);
  // his daily notes: one side-model call a day, three lines of six characters at most
  assert.match(js, /p\.wsNotesTried === today/);
  assert.match(js, /if \(holder && ready && !parked && onWindowsill\(\)\) writeNotes\(\); \}, 4000\)/, 'only after she has looked for a few seconds');
  assert.match(js, /每张最多 3 行，每行最多 6 个字/);
  assert.match(js, /for \(var i = 0; i < l\.length; i \+= 6\) lines\.push\(l\.slice\(i, i \+ 6\)\)/);
  assert.match(js, /\.slice\(0, 3\)\.join\('\\n'\)/);
  // the candle: no confirm and no toast (she: 灰色的不要), the flame is the answer
  assert.doesNotMatch(js, /uiConfirm\('吹灭蜡烛|uiConfirm\('点上蜡烛/);
  assert.match(js, /window\.toast = function \(\) \{\}; if \(!sleeping\)/);
  assert.match(shell, /window\.__WS_QUIET_CANDLE = true;/);
  // coming back is instant: leaving parks the windowsill (paused) instead of closing it (WINDOWSILL_KEEP_V1)
  assert.match(js, /function park\(\)/); assert.match(js, /PARK_MS = 10 \* 60000/);
  assert.match(js, /if \(document\.hidden\) park\(\); else sync\(\);/);
  assert.match(shell, /if \(window\.__WS_PAUSED\) \{ held\.push\(cb\); return 0; \}/);
  // the note pad shows the real weekday; the desk phone is pink metal
  assert.match(built, /"\\u5468"\+"\\u65E5\\u4E00\\u4E8C\\u4E09\\u56DB\\u4E94\\u516D"\[new Date\(\)\.getDay\(\)\]/);
  assert.match(shell, /window\.__WS_PHONE_COLOR = '#c98a98';/);
  // the album camera she set herself; the brass pot on the sill removed (she asked)
  assert.match(read('scripts/build_couple_windowsill.mjs'), /d: V\(-4\.15, 7\.9, 6\.6\), t: V\(-4\.2, 7\.6, 0\), fov: 30/);
  assert.match(read('scripts/build_couple_windowsill.mjs'), /\['at\(j, 8\.9, SILL_Y, -4\.1, \.4\); add\(j, null\);', '\/\* 黄铜小壶：她要求去掉 \*\/'\]/);
  assert.match(built, /window\.__WS_CANDLE_TAP\?window\.__WS_CANDLE_TAP\(\):/);
  // real weather where she is, the crane flies off while he is out
  assert.match(js, /api\.open-meteo\.com\/v1\/forecast\?latitude=' \+ pos\.coords\.latitude\.toFixed\(3\)/);
  assert.match(js, /30 \* 60000/);
  assert.match(shell, /window\.__WS_PLANE\.visible = d\.letterUnread > 0/); assert.match(js, /letterUnread: unread/);   // the paper plane means unopened letters
  assert.match(shell, /function craneAway\(out\)/); assert.match(shell, /px\.userData\.key = 'where'/);   // still tappable once it has flown off
  assert.match(js, /function season\(\) \{ var s = S\.settings && S\.settings\.windowsillSeason;/, 'the season is hers, remembered, not the month');
  assert.match(js, /d\.type === 'windowsill:season'/);
  assert.match(built, /window\.__WS_SEASON_CHANGED&&window\.__WS_SEASON_CHANGED\(/);
  // every close-up goes to 2.6 while the camera moves in
  assert.match(read('scripts/build_couple_windowsill.mjs'), /const want = !!focusKey && focusT > \.6 && \(focusKey !== 'phone' \|\| phoneFlip\.v > \.6\);/);
  // her photos are not darkened by the room light
  assert.match(shell, /mat\.emissiveMap = t; mat\.emissiveIntensity = \.55;/);
  // star jar = 任务便签 stars; the buttons open the matching pages
  assert.match(js, /S\.taskNotes && S\.taskNotes\.stars/);
  assert.match(js, /else if \(key === 'jar'\) go\('tasks'\)/);
  // 相册: five places, tap to enlarge, only picture data stored
  assert.match(shell, /var PH_NAMES = \['拍立得', '明信片', '三连拍上', '三连拍中', '三连拍下'\]/);
  assert.match(shell, /t\.image = c; t\.dispose\(\); t\.needsUpdate = true;/);
  assert.match(js, /slot >= 0 && slot < 5 && \(d\.data === '' \|\| \(typeof d\.data === 'string' && d\.data\.indexOf\('data:image\/'\) === 0\)\)/);
});

test('the public web gets the same windowsill without her name and with an off switch (COUPLE_WINDOWSILL_WEB_V1)', () => {
  const web = read('couple-windowsill.js');
  assert.doesNotMatch(web, /North/, 'her name stays in the private app');
  assert.match(web, /写便签，贴在你们窗台边的挂板上/);
  assert.match(web, /网页版看不到健康数据/);
  assert.match(web, /S\.settings\.windowsillOff/);
  assert.match(web, /src="couple-windowsill\/index\.html/);
  assert.match(read(T + 'UPSTREAM.md'), /作者也同意放进公开网页版/);
  for (const f of ['index.html', 'shell.js', 'models.js', 'pet.js', 'windowsill.js']) assert.equal(read('couple-windowsill/' + f), read(P + 'couple-windowsill/' + f), f + ' is the same build in both');
});

test('the upstream scene is kept with its licence and origin', () => {
  assert.match(read(T + 'LICENSE'), /GNU AFFERO GENERAL PUBLIC LICENSE/);
  assert.match(read(T + 'UPSTREAM.md'), /309508f1ce637269638810d9b1e43cb5d1aeb7bd/);
  assert.match(read(T + 'UPSTREAM.md'), /唐幡/);
  assert.ok(fs.readdirSync(url(T + 'src/js')).filter(f => f.endsWith('.js')).length >= 20);
});

test('the built page works offline: no CDN, models and three.js bundled', () => {
  const html = read(P + 'couple-windowsill/index.html');
  assert.doesNotMatch(html, /cdn\.jsdelivr|importmap|type="module"/);
  assert.match(html, /<script src="shell\.js"><\/script>\s*<script src="models\.js"><\/script>\s*<script src="pet\.js"><\/script>\s*<script src="windowsill\.js"><\/script>/);
  const models = read(P + 'couple-windowsill/models.js');
  for (const m of ['laptop', 'phone', 'bookcase', 'organizer']) assert.ok(models.includes('"./models/' + m + '.gltf.json"'), m);
  const scene = read(P + 'couple-windowsill/windowsill.js');
  assert.match(scene, /AGPL-3\.0/);
  assert.ok(scene.length > 500000, 'three.js and the scene are bundled');
  assert.equal(read(P + 'couple-windowsill/shell.js'), read(T + 'smallphone/shell.js'));
  const shell = read(T + 'smallphone/shell.js');
  assert.match(shell, /window\.__WS_MODELS/);
  assert.match(shell, /#head span\{display:none!important\}/, 'no 草稿 · 演示数据');
  assert.match(shell, /windowsill:back/);
  assert.match(shell, /windowsill:nogl/);
});

test('only the private app loads the windowsill, inside the phone screen under overlays', () => {
  for (const f of ['index.html', '小手机.html']) assert.match(read(P + f), /<script src="private-couple-windowsill\.js\?v=\d+"><\/script>/);
  // 2026-10-20 she asked for it on the public web too (the author agreed): the web loads its own copy (COUPLE_WINDOWSILL_WEB_V1)
  assert.match(read('小手机.html'), /<script src="couple-windowsill\.js\?v=\d+"/);
  assert.doesNotMatch(read('小手机.html'), /private-couple-windowsill/);
  const js = read(P + 'private-couple-windowsill.js');
  assert.match(js, /#cw-holder\{position:absolute;inset:0;z-index:150;/);
  assert.match(js, /\(document\.querySelector\('\.screen'\) \|\| document\.body\)\.appendChild\(holder\)/);
  assert.match(js, /go\('couple', \{list: 1\}\)/);
  assert.match(js, /S\.settings\.windowsillSaver/);
  assert.doesNotMatch(js, /cw-set|cw-locks/, 'no top-right button or lock strip on the windowsill');
  assert.match(js, /d\.type === 'windowsill:open' && d\.key === 'phone'\) \{ go\('couple', \{list: 1\}\); \}/, 'the desk phone opens 设置与授权');
  assert.match(js, /windowsill:lost/);
  const shell = read(T + 'smallphone/shell.js');
  assert.match(shell, /进入小手机/);
  assert.match(shell, /:root\{--bg:#0d0b0a!important\}/, 'dark background, no white flash');
  assert.match(shell, /webglcontextlost/);
  assert.doesNotMatch(shell, /返回<\/|>返回'/, 'the back button is just an arrow');
  const built = read(P + 'couple-windowsill/windowsill.js');
  assert.match(built, /__WS_DPR_MAX/);
  assert.match(built, /__WS_LOWQ_FPS/);
  assert.match(built, /window\.__WS_PHONE_SCREEN=/, 'the desk phone screen texture is handed to the shell');
  assert.match(built, /window\.__WS_PHONE_ENTER/, 'a second tap on the lit phone enters the small phone');
  assert.match(shell, /轻点进入小手机/);
  assert.match(shell, /windowsill:lock/);
  assert.match(js, /function sendLock\(\)/);
  assert.match(js, /top:env\(safe-area-inset-top,0px\);bottom:env\(safe-area-inset-bottom,0px\)/, 'the windowsill keeps clear of the status bar and home bar');
  // sharper picture: gentler depth of field, the low tier keeps 1.5x
  assert.match(built, /__WS_DOF/);
  assert.match(built, /__WS_LOWQ_PR/);
  // 一起听 plays the small phone's own music; the card has prev / play / next
  assert.match(js, /musicToggle\(\)/);
  assert.match(js, /musicNext\(\)/);
  assert.match(js, /musicPrev\(\)/);
  assert.match(js, /type: 'windowsill:np'/);
  assert.match(shell, /windowsill:music/);
  assert.match(shell, /data-m="prev"[\s\S]*data-m="toggle"[\s\S]*data-m="next"/);
  assert.match(shell, /fuyue\.setNowPlaying/);
  // 小橘 on the 透卡 / 流麻牌, following the desk pet
  assert.match(built, /window\.__WS_PET\.tick/);
  assert.match(js, /__deskPet\.state\(\)/);
  assert.match(built, /__WS_NO_SILL_PET/, 'the 透卡 on the sill is taken out (she: 多余的桌宠)');
  const page = read(P + 'couple-windowsill/index.html');
  assert.match(page, /<script src="pet\.js"><\/script>/);
  assert.match(read(P + 'couple-windowsill/pet.js'), /^\/\*[^]*?\*\/\nwindow\.__WS_PET_SHEET=\{"cell":160,"names":\["开心"/);
  assert.doesNotMatch(read(P + 'couple-windowsill/pet.js'), /https?:\/\//, 'the frames are inside the file, nothing is fetched');
  // the release gate reads the unlock time where it now lives
  assert.match(read('scripts/check_chat_authorized_phone.cjs'), /_couTab=2;go\('couple',\{list:1\}\);const shown=document\.body\.innerText\.includes\('自动解锁'\);/);
});
