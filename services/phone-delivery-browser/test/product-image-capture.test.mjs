import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { TaobaoFlashBrowser } from '../src/taobao-flash-browser.mjs';

test('real browser converts the matching product image into a portable JPEG card image', async t => {
  let liveBrowser;
  try {
    liveBrowser = await chromium.launch({ channel: 'msedge', headless: true });
  } catch (error) {
    t.skip(`Microsoft Edge is unavailable: ${error?.message || error}`);
    return;
  }
  try {
    const page = await liveBrowser.newPage({ viewport: { width: 480, height: 720 } });
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nGQAAAAASUVORK5CYII=';
    await page.setContent(`
      <main style="padding:24px;background:#fff">
        <article><h1>瑞幸咖啡（活力广场店）</h1><h2>生椰拿铁（首创）</h2>
          <img alt="生椰拿铁（首创）" src="${png}" style="width:128px;height:128px;object-fit:cover">
        </article>
      </main>
    `);
    const extractor = new TaobaoFlashBrowser();
    const image = await extractor.readOrderImage(page, ['生椰拿铁（首创）']);
    assert.match(image, /^data:image\/jpeg;base64,\/9j\//);
    assert.ok(image.length > 100, 'captured JPEG should contain image bytes');
    assert.equal(await page.locator('#phone-delivery-order-image-capture').count(), 0, 'capture helper must be removed');
    assert.equal(await page.locator('[data-phone-delivery-order-image]').count(), 0, 'temporary marker must be removed');
  } finally {
    await liveBrowser.close();
  }
});
