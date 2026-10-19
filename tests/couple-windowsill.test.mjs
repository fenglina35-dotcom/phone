import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// COUPLE_WINDOWSILL_V1: the private couple space opens on 唐幡's 3D "赴约 · 窗台" (AGPL-3.0, private app only).
const P = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const T = 'native/private-small-phone/third_party/qiaosi-windowsill/';
const url = name => new URL('../' + name, import.meta.url);
const read = name => fs.readFileSync(url(name), 'utf8');

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
  assert.doesNotMatch(read('小手机.html'), /couple-windowsill/, 'the web build stays as it is');
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
