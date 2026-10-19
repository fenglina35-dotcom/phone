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
  assert.match(html, /<script src="shell\.js"><\/script>\s*<script src="models\.js"><\/script>\s*<script src="windowsill\.js"><\/script>/);
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
  assert.match(js, /lockUntilText\(at\)/, 'lock unlock times stay visible on the windowsill');
});
