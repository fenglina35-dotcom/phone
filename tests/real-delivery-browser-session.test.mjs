import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../services/phone-delivery-browser/src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../services/phone-delivery-browser/src/server.mjs', import.meta.url), 'utf8');

test('delivery browser uses its real browser identity and can attach to a visible user session', () => {
  assert.doesNotMatch(source, /iPhone; CPU iPhone OS|Safari\/604\.1|isMobile:\s*true|hasTouch:\s*true/);
  assert.match(source, /await this\.attachCdp\(chromium, this\.cdpUrl\)/);
  assert.match(source, /chromium\.connectOverCDP\(endpoint\)/);
  assert.match(server, /PHONE_DELIVERY_CDP_URL/);
  assert.match(source, /process\.platform === 'win32'[\s\S]*launchWindowsVisibleCdp/);
  assert.match(source, /--remote-debugging-port=\$\{this\.cdpPort\}/);
  assert.doesNotMatch(source, /ignoredDefaultArgs|disable-blink-features=AutomationControlled|navigator\s*,\s*['"]webdriver/);
});

test('service startup and settings capability checks never prewarm or navigate the browser', () => {
  assert.doesNotMatch(server, /await browser\.prewarm\(\)/);
  assert.doesNotMatch(server, /browser\.prewarm\(\)\.then/);
  assert.match(server, /const data = await adapter\.handle\(action/);
});

test('checkout uses visible pointer input before its single bounded retry', () => {
  const start = source.indexOf('const checkoutState = async');
  const end = source.indexOf('await page.waitForTimeout(1800)', start);
  const block = source.slice(start, end);
  assert.match(block, /await this\.tapControl\(page, checkout\)/);
  assert.match(block, /checkoutPageReady/);
  assert.doesNotMatch(block, /checkout\.evaluate/);
});

test('platform verification pauses and resumes instead of restarting the delivery search', () => {
  assert.match(source, /waitForHuman\s*&&\s*!this\.headless/);
  assert.match(source, /if\s*\(!kind\)\s*\{[\s\S]*clearRiskChallenge\(\)[\s\S]*return Date\.now\(\) - startedAt/);
  assert.match(source, /humanWaitMs\s*\+=\s*await this\.riskCheck/);
});

test('closed saved shops can fall through to one bounded global search for role ordering', () => {
  assert.match(source, /!allowGlobalSearch\s*&&\s*\(closedMerchants\.length \|\| closedRoutes\.length\)/);
  assert.match(source, /Math\.min\(this\.shops\.length, 3/);
  assert.match(source, /await this\.searchInsideShop\(shopPage, itemQuery\)/);
});

test('store-local product search clicks the magnifier and never mistakes refresh for search', () => {
  const start = source.indexOf('async searchInsideShop');
  const end = source.indexOf('purchaseControls(page)', start);
  const block = source.slice(start, end);
  assert.match(block, /button\[aria-label\*="搜索"\]/);
  assert.match(block, /刷新\|重试\|reload\|refresh/);
  assert.match(block, /await this\.tapControl\(page, trigger\)/);
  assert.match(block, /pressSequentially\(query/);
  assert.match(block, /page\.getByText\(\/\^搜索\$\//);
  assert.doesNotMatch(block, /page\.reload|goto\(/);
});

test('option inspection and cart creation restore the exact store-local search state', () => {
  const inspectStart = source.indexOf('async inspectOptionsFor');
  const inspectEnd = source.indexOf('async inspectOptionsControl', inspectStart);
  const inspectBlock = source.slice(inspectStart, inspectEnd);
  assert.match(inspectBlock, /searchInsideShop\(page, ref\.itemName\)/);

  const orderStart = source.indexOf('async createOrder({ ref');
  const orderEnd = source.indexOf('async dialogGroups', orderStart);
  const orderBlock = source.slice(orderStart, orderEnd);
  assert.match(orderBlock, /searchInsideShop\(page, ref\.itemName\)/);
  assert.match(orderBlock, /await this\.activateProductControl\(page, add\)/);
  assert.match(orderBlock, /await this\.activateControl\(page, plus\)/);
  assert.match(source, /async activateProductControl\(page, control\)[\s\S]*?control\.evaluate\(node => node\.click\(\)\)/);
  assert.doesNotMatch(orderBlock, /await add\.evaluate\(node => node\.click\(\)\)/);
});

test('real product imagery is carried from the platform menu into the final order card data', () => {
  assert.match(source, /candidate\.currentSrc \|\| candidate\.src \|\| candidate\.getAttribute\('data-src'\)/);
  assert.match(source, /imageUrl:\s*\/\^https:/);
  assert.match(source, /\[class\*="order-item"\]/);
  assert.match(source, /cart\.required\.map\(row => row\.name\)/);
  assert.match(source, /matchedPageImage/);
  assert.match(source, /rows\.find\(row => row\.imageUrl\)\?\.imageUrl \|\| matchedPageImage/);
  assert.match(source, /async readOrderImage\(page, itemNames = \[\]\)/, 'the live order and payment pages must be able to recover the genuine product image');
  assert.match(source, /minimized-fee__content-left-logo/, 'the real Alibaba order-detail thumbnail class must be recognized even when its image is a computed CSS background');
  assert.match(source, /const capturedImageUrl = await this\.readOrderImage\(page, itemNames\)/, 'the confirmation page must embed the genuine product image before navigating away');
  assert.match(source, /browserOrderRef: \{ stage: 'confirm', url: page\.url\(\), itemNames, imageUrl \}/, 'the browser order reference must retain the real requested item names and captured image');
  assert.match(source, /const existingImageUrl = clean\(browserOrderRef\?\.imageUrl, 440_000\);[\s\S]*?const initialImageUrl = \(existingImageUrl\.startsWith\('data:image\/'\) \? existingImageUrl : ''\)[\s\S]*?\|\| await this\.readOrderImage\(page, itemNames\)[\s\S]*?\|\| existingImageUrl;/, 'checkout must prefer the portable embedded image, recover from the page when needed, and retain the original URL as a final fallback');
  assert.match(source, /const imageUrl = initialImageUrl \|\| await this\.readOrderImage\(candidate, itemNames\)/, 'the cashier result must return a genuine page image when checkout originally omitted it');
  assert.match(source, /await this\.readOrderImage\(page, itemNames\) \|\| clean\(browserOrderRef\?\.imageUrl, 440_000\)/, 'status polling must preserve the embedded image after the platform leaves the order page');
  assert.match(source, /\.screenshot\(\{ type: 'jpeg'/, 'the browser must embed a captured real product image when hot-link URLs are blocked in the private WebView');
  assert.match(source, /data:image\/jpeg;base64/, 'the captured product image must be returned as a self-contained data URL');
  assert.match(source, /return \{ status, etaText, imageUrl \}/, 'status polling must send a later recovered real image back to the app');
});
