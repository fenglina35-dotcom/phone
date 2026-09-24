import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');
const html = readFileSync(join(root, '小手机.html'), 'utf8');

test('widget cards expose color and opacity controls with live rendering', () => {
  assert.match(app, /function widgetOpacityValue\(\)/);
  assert.match(app, /function widgetCardColor\(\)/);
  assert.match(app, /function widgetStyleVars\(\)/);
  assert.match(app, /id="wcardcolor"/);
  assert.match(app, /id="wopacity"/);
  assert.match(app, /oninput="widgetAppearanceSet\('wOpacity',this\.value\)"/);
  assert.match(app, /--widget-bg:/);
  assert.match(html, /\.home \.hwwrap \.hwid:not\(\.wpet\)\{background:var\(--widget-bg\)!important/);
});

test('widget text and desktop cat colors are independent', () => {
  assert.match(app, /function petcol\(\)/);
  assert.match(app, /function wPet\(\)\{const col=petcol\(\)/);
  assert.match(app, /id="wcolor"/);
  assert.match(app, /id="wpetcolor"/);
  assert.match(app, /widgetAppearanceSet\('wColor'/);
  assert.match(app, /widgetAppearanceSet\('petColor'/);
});

test('widget appearance survives beauty export, import, and data clearing', () => {
  const keys = app.match(/const BEAUTY_ME_KEYS=\[([^\]]+)\]/s)?.[1] || '';
  assert.ok(keys, 'BEAUTY_ME_KEYS must exist');
  // 导出、导入和「清空数据时留住美化」都走这一份名单
  assert.match(app, /me:pickObj\(me,BEAUTY_ME_KEYS\)/);
  assert.match(app, /beautyAssign\(S\.me,pack\.me,BEAUTY_ME_KEYS\)/);
  assert.match(app, /mergeBeautyPack\(beauty\)/);
  for (const key of ['wColor', 'wCardColor', 'wOpacity', 'petColor', 'wPic', 'homeAvMe', 'homeAvTa']) {
    assert.match(keys, new RegExp(`'${key}'`), `${key} must ride the shared beauty key list`);
  }
});
