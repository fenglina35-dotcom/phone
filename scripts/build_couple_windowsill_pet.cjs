// COUPLE_WINDOWSILL_V1: 小橘 on the windowsill's 透卡 / 流麻牌.
// The 20 animated 小橘 stickers (PhoneWeb.bundle/assets/sticker-store/pet/pet-NN.webp) are decoded in a browser
// (ImageDecoder composes the partial WebP frames), thinned to at most 10 frames each, and packed into one sheet.
// The sheet is written as a data URL inside couple-windowsill/pet.js: the app opens local files, and an image read
// from a file would taint the canvas the scene uploads to WebGL.
// Usage: scripts/run_tests_mac.sh --check scripts/build_couple_windowsill_pet.cjs
const {chromium} = require('playwright');
const fs = require('node:fs'), path = require('node:path');

const root = path.resolve(__dirname, '..');
const bundle = path.join(root, 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle');
const CELL = 160, MAX = 10;
// same order and names as SS_PET in wechat-me.js
const NAMES = ['开心', '爱心眼', '星星眼', '害羞', '眨眼', '难过', '生气', '惊讶', '晕乎乎', '睡觉', '跳舞', '挥手', '蹦跶', '转圈', '伸懒腰', '戴耳机', '戴帽子', '想你', '亲亲', '抱抱'];

(async () => {
  const files = NAMES.map((_, i) => fs.readFileSync(path.join(bundle, 'assets/sticker-store/pet/pet-' + String(i + 1).padStart(2, '0') + '.webp')).toString('base64'));
  const browser = await chromium.launch({headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
  try {
    const page = await browser.newPage();
    // ImageDecoder only exists on a secure page
    await page.route('https://pet.local/**', r => r.fulfill({contentType: 'text/html', body: '<!doctype html><title>pet</title>'}));
    await page.goto('https://pet.local/');
    const res = await page.evaluate(async ({files, CELL, MAX}) => {
      const rows = [], sheet = document.createElement('canvas');
      sheet.width = CELL * MAX; sheet.height = CELL * files.length;
      const g = sheet.getContext('2d'); g.imageSmoothingQuality = 'high';
      for (let r = 0; r < files.length; r++) {
        const bytes = Uint8Array.from(atob(files[r]), c => c.charCodeAt(0));
        const dec = new ImageDecoder({data: bytes, type: 'image/webp'});
        await dec.tracks.ready;
        const n = dec.tracks.selectedTrack.frameCount, step = Math.ceil(n / MAX), ms = [];
        for (let i = 0, c = 0; i < n; i += step, c++) {
          const {image} = await dec.decode({frameIndex: i});
          g.drawImage(image, c * CELL, r * CELL, CELL, CELL);
          let d = 0; for (let j = i; j < Math.min(n, i + step); j++) d += (await dec.decode({frameIndex: j})).image.duration / 1000;
          ms.push(Math.max(60, Math.round(d))); image.close();
        }
        rows.push(ms);
      }
      return {rows, url: sheet.toDataURL('image/webp', .86)};
    }, {files, CELL, MAX});
    const out = path.join(bundle, 'couple-windowsill/pet.js');
    fs.writeFileSync(out, '/* 小橘（小手机自己画的桌宠表情）贴到窗台透卡上用的帧图，由 scripts/build_couple_windowsill_pet.cjs 生成 */\n'
      + 'window.__WS_PET_SHEET=' + JSON.stringify({cell: CELL, names: NAMES, rows: res.rows, url: res.url}) + ';\n');
    console.log('pet.js', Math.round(fs.statSync(out).size / 1024) + 'KB', res.rows.map(r => r.length).join(','));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message || e); process.exit(1); });
