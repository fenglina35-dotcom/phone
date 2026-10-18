import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// STICKER_STORE_V1 / DESK_PET_MISS_KISS_HUG_V1: the sticker store ships the same pet pack in the web and
// private bundles, every listed sticker exists as an animated transparent WebP, chat accepts those paths,
// and the desk pet itself can do the three new actions the stickers show.
const P = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const url = name => new URL('../' + name, import.meta.url);
const read = name => fs.readFileSync(url(name), 'utf8');

test('the sticker store and desk pet are the same file in both bundles', () => {
  assert.equal(read(P + 'wechat-me.js'), read('wechat-me.js'));
  assert.equal(read(P + 'desk-pet.js'), read('desk-pet.js'));
});

test('every pet sticker exists in both bundles as an animated WebP with transparency', () => {
  const src = read('wechat-me.js'), m = src.match(/const SS_PET=(\[[^\n]*\]);/);
  assert.ok(m, 'SS_PET must exist');
  const pet = vm.runInNewContext(m[1]);
  assert.equal(pet.length, 20);
  for (const [cmd, caption] of [['想你', '想你了'], ['亲亲', '亲亲'], ['抱抱', '抱抱'], ['伸懒腰', '哦']])
    assert.ok(pet.some(x => x[0] === cmd && x[1] === caption), cmd + ' sticker must be listed');
  pet.forEach((_, i) => {
    const name = 'assets/sticker-store/pet/pet-' + String(i + 1).padStart(2, '0') + '.webp';
    const web = fs.readFileSync(url(name)), priv = fs.readFileSync(url(P + name));
    assert.ok(web.equals(priv), name + ' must be identical in the private bundle');
    assert.equal(web.toString('latin1', 0, 4), 'RIFF');
    assert.ok(web.includes(Buffer.from('ANIM')), name + ' must be animated');
    assert.ok(web.includes(Buffer.from('ALPH')) || web.includes(Buffer.from('VP8L')), name + ' must keep transparency');
  });
});

test('chat shows bundled sticker-store pictures in both bundles', () => {
  for (const file of ['app.js', P + 'app.js']) {
    const src = read(file), m = src.match(/function isImg\(v\)\{[^\n]*?\}/);
    assert.ok(m, 'isImg must exist in ' + file);
    const isImg = vm.runInNewContext('(' + m[0] + ')');
    assert.ok(isImg('assets/sticker-store/pet/pet-01.webp'));
    assert.ok(isImg('assets/task-notes/stickers/sticker-01.png'), 'the cat stickers still show');
    assert.ok(!isImg('assets/sticker-store/../app.js'));
    assert.ok(!isImg('assets/other/pet-01.webp'));
  }
});

test('the desk pet can miss, kiss and hug, and the role is offered those actions', () => {
  const s = read('desk-pet.js');
  for (const k of ['想你', '亲亲', '抱抱']) assert.match(s, new RegExp("'" + k + "':\\{eyes:'"));
  assert.match(s, /miss:\{w:9,h:7,svg:/);
  assert.match(s, /kiss:\{w:7,h:3,svg:/);
  assert.match(s, /\.dp-root\.hug \.dp-nub-l,\.dp-root\.hug \.dp-nub-r\{animation:dpHug/);
  assert.match(s, /'求抱抱':'抱抱'/);
  // the role prompt lists every CMDS key, so new actions reach the role without a separate list
  assert.match(s, /可用表情和动作：'\+Object\.keys\(CMDS\)\.join\('、'\)/);
});

test('an added pack is its own emoji-panel tab and the role is told its keywords', () => {
  for (const name of ['assets/sticker-store/pet/icon.png']) assert.ok(fs.readFileSync(url(name)).equals(fs.readFileSync(url(P + name))), name);
  const wm = read('wechat-me.js'), tn = read('task-notes.js');
  assert.equal(read(P + 'task-notes.js'), tn);
  assert.match(wm, /window\.emojiPackTabs=function\(\)/);
  assert.doesNotMatch(wm, /S\.me\.stickers\.push\(\{img:x\.img/, 'adding a pack must not copy pictures into the custom row');
  assert.match(tn, /window\.emojiPackTabs\(\)/);
  assert.match(tn, /tn-egrid-clear span\{background:transparent\}/);
  assert.match(wm, /function stickerStorePrompt\(c\)/);
  for (const file of ['app.js', P + 'app.js']) assert.match(read(file), /if\(typeof stickerStorePrompt==='function'\)s\+=stickerStorePrompt\(c\);/);
});

test('with sticker frequency off the role still knows its stickers and sends one when asked', () => {
  for (const file of ['app.js', P + 'app.js']) {
    const s = read(file);
    assert.match(s, /STICKER_OFF_ON_REQUEST_V1/);
    assert.match(s, /\(S\.settings\.stkFreq==null\?2:S\.settings\.stkFreq\)<=0\)\{s\+='\\n- 表情包：/);
    assert.match(s, /不要说自己没有表情包，也不要改发照片。';if\(typeof stickerStorePrompt==='function'\)s\+=stickerStorePrompt\(c\);\}/);
  }
  assert.match(read('wechat-me.js'), /下面是你现在真的拥有、可以发的表情包/);
});

test('role photos can use five configurable image routes', () => {
  for (const file of ['app.js', P + 'app.js']) {
    const s = read(file);
    assert.match(s, /function imgRoutesState\(\)/);
    assert.match(s, /function imgRouteUse\(i\)/);
    assert.match(s, /\$\{imgRouteChipsHTML\(\)\}<div class="field" style="padding:0 14px"><label>接口地址/);
    assert.match(s, /if\(\$\('#s_ibase'\)\)imgRouteSync\(\);/);
  }
});

test('importing keeps animated stickers: native photo picker in the private app, any file from Files', () => {
  const bridge = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
  assert.match(bridge, /case "media\.pickImages":/);
  assert.match(bridge, /case "media\.pickImages\.read":/);
  assert.match(bridge, /configuration\.preferredAssetRepresentationMode = \.current/);
  assert.match(bridge, /\(\.gif, "image\/gif"\), \(\.webP, "image\/webp"\)/);
  assert.match(bridge, /static let contractVersion = 42/, 'an optional action, the bridge contract stays');
  const wm = read('wechat-me.js');
  assert.match(wm, /window\.SmallPhoneNative\.request\('media\.pickImages',/);
  assert.match(wm, /function ssImportPickFiles\(\)\{if\(typeof pickFiles!=='function'\)return;pickFiles\('',/);
  assert.match(wm, /function ssIsAnimated\(src\)/);
  assert.doesNotMatch(wm, /items:st\.items\.map\(\(x,i\)=>\(\{id:'m'\+i,img:x\.img,name:[^}]*anim/, 'the badge is never saved with a sticker');
});

