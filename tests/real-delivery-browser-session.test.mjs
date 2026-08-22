import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../services/phone-delivery-browser/src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../services/phone-delivery-browser/src/server.mjs', import.meta.url), 'utf8');

test('delivery browser uses its real browser identity and can attach to a visible user session', () => {
  assert.doesNotMatch(source, /iPhone; CPU iPhone OS|Safari\/604\.1|isMobile:\s*true|hasTouch:\s*true/);
  assert.match(source, /chromium\.connectOverCDP\(this\.cdpUrl\)/);
  assert.match(server, /PHONE_DELIVERY_CDP_URL/);
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

test('real product imagery is carried from the platform menu into the final order card data', () => {
  assert.match(source, /image\?\.currentSrc \|\| image\?\.src/);
  assert.match(source, /imageUrl:\s*\/\^https:/);
});
