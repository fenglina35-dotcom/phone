import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
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
  assert.match(ui, /class="dy-home-back" onclick="dyBack\(\)" aria-label="返回上一页"/);
  assert.match(html, /\.dy-home-back\{/);
});

/* 抖音「我」页已按真实抖音在 app.js 的 dyProfile 里重做。commerce-ui.js 原先用
   window.dyProfile=function 把它整个覆盖掉，导致改了核心却看不到效果——和
   private-reply-intercept.js 同类的陷阱，现已移除，只保留一份实现。 */
test('Douyin profile lives in one place and commerce-ui no longer overrides it', () => {
  assert.doesNotMatch(ui, /window\.dyProfile=function/, 'commerce-ui 不能再覆盖「我」页');
  assert.match(ui, /window\.dyProfileSwitch=function/, '旧的 onclick 仍要有兼容入口');
  assert.doesNotMatch(ui, /❤️/, '抖音壳里用矢量心，不用 emoji');
  assert.match(app, /function dyProfile\(\)\{const p=S\.dy\.profile/, '实现在 app.js');
  assert.match(html, /\.dyme-cover\{/, '样式随页面一起进壳');
  assert.match(html, /\.dyme-tabs span\.on:after\{/, '分栏下划线');
});

test('delivery and presentation layers load after app.js and are available offline', () => {
  assert.match(html, /<script src="app\.js\?v=(\d+)[^"]*"[^>]*><\/script>[\s\S]*?<script src="delivery\.js\?v=\1"[^>]*><\/script>\s*<script src="commerce-ui\.js\?v=\1"/);
  assert.match(html, /vendor\/qr\/qrcode\.js[\s\S]*vendor\/qr\/jsQR\.js[\s\S]*wechat-me\.js/);
  assert.match(html, /\.shop-card\{/);
  assert.match(html, /\.mt-card\{/);
  assert.match(html, /\.dy-scene\{/);
  assert.match(sw, /commerce-ui\.js\?v='\+BUILD/);
  assert.match(sw, /delivery\.js\?v='\+BUILD/);
  assert.match(sw, /\/commerce-ui\\\.js\$/);
});
