import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const browser = await readFile(new URL('../services/phone-delivery-browser/src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
const delivery = await readFile(new URL('../delivery.js', import.meta.url), 'utf8');

test('browser captures a real matching product image before payment navigation', () => {
  assert.match(browser, /capturedImageUrl\s*=\s*await this\.readOrderImage\(page, itemNames\)/);
  assert.match(browser, /Boolean\(haystack\).*wanted\.some/);
  assert.match(browser, /width:\s*'192px'/);
  assert.match(browser, /height:\s*'192px'/);
  assert.match(browser, /objectFit:\s*'cover'/);
  assert.match(browser, /type:\s*'jpeg',\s*quality:\s*82/);
  assert.match(browser, /phone-delivery-order-image-capture'\)\?\.remove\(\)/);
  assert.match(browser, /removeAttribute\('data-phone-delivery-order-image'\)/);
});

test('checkout ETA must come from the exact platform range', () => {
  assert.match(browser, /export function checkoutEtaText/);
  assert.match(browser, /预计[^\\n]{0,24}送达/);
  assert.match(browser, /etaText:\s*checkoutEtaText\(raw\)/);
  assert.match(browser, /exactEtaText\s*=\s*checkoutEtaText\(candidateBody\)/);
});

test('chat card accepts real images and keeps the kangaroo fallback', () => {
  assert.match(delivery, /safeOrderImage/);
  assert.match(delivery, /delivery-fallback-kangaroo\.jpg/);
  assert.match(delivery, /order\.imageUrl/);
});
