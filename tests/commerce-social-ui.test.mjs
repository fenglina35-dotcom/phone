import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ui = readFileSync(new URL('../commerce-ui.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('shopping redesign keeps every existing purchase route reachable', () => {
  assert.match(ui, /window\.renderShop=function/);
  assert.match(ui, /shop-grid/);
  for (const handler of ['openCart()', 'openOrders()', 'buyNow(', 'addCart(', 'giftFlow(', 'payFlow(', 'familyPayFlow(', 'coInvite()']) {
    assert.ok(ui.includes(handler), `missing shopping handler: ${handler}`);
  }
  assert.match(ui, /window\.shopProductDetail=function/);
});

test('Meituan redesign preserves cart, checkout, gifting and orders', () => {
  assert.match(ui, /window\.renderFood=function/);
  assert.match(ui, /美团外卖/);
  assert.match(ui, /mt-cats/);
  for (const handler of ['openFoodCart()', 'openFoodOrders()', 'foodCart(', 'foodBuy(', 'foodGiftFlow(', 'foodPayFlow(']) {
    assert.ok(ui.includes(handler), `missing food handler: ${handler}`);
  }
});

test('Douyin redesign keeps feed actions and exposes a center publish control', () => {
  assert.match(ui, /window\.renderDouyin=function/);
  assert.match(ui, /dycreate-wrap/);
  assert.match(ui, /window\.dyVideoCard=function/);
  for (const handler of ['dyLike(', 'dyComments(', 'dyTapVideo(', 'dyFwd(', 'dyCompose()']) {
    assert.ok(ui.includes(handler), `missing Douyin handler: ${handler}`);
  }
  assert.match(ui, /class="dy-home-back" onclick="home\(\)" aria-label="返回主屏幕"/);
  assert.match(html, /\.dy-home-back\{/);
});

test('Douyin profile uses a real profile grid and vector heart icons', () => {
  assert.match(ui, /window\.dyProfile=function/);
  assert.match(ui, /dy-profile-grid/);
  assert.match(ui, /svgIc\('heart',13,'#fff'/);
  assert.doesNotMatch(ui, /❤️/);
  assert.match(html, /\.dy-profile-card\{/);
});

test('delivery and presentation layers load after app.js and are available offline', () => {
  assert.match(html, /<script src="app\.js\?v=(\d+)"[^>]*><\/script>\s*<script src="delivery\.js\?v=\1"[^>]*><\/script>\s*<script src="commerce-ui\.js\?v=\1"/);
  assert.match(html, /\.shop-card\{/);
  assert.match(html, /\.mt-card\{/);
  assert.match(html, /\.dy-scene\{/);
  assert.match(sw, /commerce-ui\.js\?v='\+BUILD/);
  assert.match(sw, /delivery\.js\?v='\+BUILD/);
  assert.match(sw, /\/commerce-ui\\\.js\$/);
});
