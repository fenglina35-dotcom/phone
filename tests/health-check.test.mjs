// HEALTH_CHECK_V1：设置里的「一键体检」。两版真实页面从设置首页点进去、开始检查，结果和原因正确，往下滑后重画不弹回顶部。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码（旧代码没有这个页面，应失败）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PRIV = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read = (file) => process.env.FIX_TEST_OLD
  ? cp.execFileSync('git', ['show', 'HEAD:' + file], { cwd: root, encoding: 'utf8', maxBuffer: 64e6 })
  : fs.readFileSync(path.join(root, file), 'utf8');

function scripts(html) { return [...html.matchAll(/<script[^>]*src="([^"]*)"/g)].map((m) => m[1].split('?')[0]); }

test('every attached script in both entries has a check mark defined only in that file', () => {
  for (const [label, html, base] of [['web', '小手机.html', ''], ['private', PRIV + 'index.html', PRIV]]) {
    const app = read(base + 'app.js');
    const m = app.match(/const HEALTH_SCRIPT_MARKS=(\{[^\n]*?\});/);
    assert.ok(m, label + ' 缺少 HEALTH_SCRIPT_MARKS');
    const marks = JSON.parse(m[1]), files = scripts(read(html)), texts = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(root, base + f), 'utf8')]));
    for (const f of files) {
      if (f === 'web-hotfix.js') continue; // 网页版 app.js 按规定不能写它的标记名，体检里不检查它
      const mark = marks[f];
      assert.ok(mark, label + ' ' + f + ' 没有登记检查方法');
      if (mark.startsWith('shop:')) { assert.ok(texts[f].includes('"name":"' + mark.slice(5) + '"'), f); continue; }
      const def = new RegExp('(?:function\\s+' + mark + '\\s*\\(|(?:window|root|global|self|globalThis|g)\\.' + mark + '\\s*=(?!=)|(?:const|let|var)\\s+' + mark + '\\s*=)');
      assert.ok(def.test(texts[f]), label + ' ' + f + ' 里找不到 ' + mark);
      const others = files.filter((g) => g !== f && def.test(texts[g]));
      assert.deepEqual(others, [], label + ' ' + mark + ' 不只在 ' + f + ' 里定义，没加载也会误判成已加载');
    }
  }
});

test('the health page is reachable from settings and keeps its scroll position', () => {
  for (const file of ['app.js', PRIV + 'app.js']) {
    const app = read(file);
    assert.match(app, /onclick="go\('healthcheck'\)"><i class="ios-settings-icon"[^>]*>\$\{settingsLineIcon\('health'\)\}<\/i><span><b>一键体检<\/b>/);
    assert.match(app, /else if\(c\.p==='healthcheck'\)html=renderHealthCheck\(\);/);
    assert.match(app, /const map=\{healthcheck:\['healthscroll',0\]/);
  }
});

async function runPage(label, entry) {
  const { createRequire } = await import('node:module'), require = createRequire(import.meta.url), { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const origin = 'http://127.0.0.1:8791';
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    if (label === 'private') await page.addInitScript(() => {
      window.__SMALL_PHONE_PRIVATE__ = true;
      window.SmallPhoneNative = { request: async (cmd) => cmd === 'bridge.info' ? { contractVersion: 42, appKind: 'private-small-phone' } : cmd === 'account.backup.info' ? { ok: true, found: true, backup: { uploaded_at: new Date().toISOString(), byte_count: 1048576 } } : { ok: false } };
    });
    await page.route('**/*', (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.host === 'api.test') {
        const body = String(req.postData() || '');
        if (body.includes('main-model')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"message":"Invalid API key provided"}}' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: body.includes('image_url') ? 'AB12' : '在' } }] }) });
      }
      if (u.host === 'license.smallphoneapp.com') return route.fulfill({ status: 200, body: 'ok' });
      if (u.origin !== origin) return route.abort('failed');
      const f = path.join(root, decodeURIComponent(u.pathname.slice(1)));
      const ok = f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile();
      return route.fulfill({ status: ok ? 200 : 404, body: ok ? fs.readFileSync(f) : '', contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
    });
    await page.goto(origin + encodeURI(entry) + '?northPreview=black-home');
    await page.waitForFunction(() => window.__northBootReady, null, { timeout: 60000 });
    await page.evaluate(() => {
      S.me.locked = false; localStorage.setItem('yibei_unlocked', String(SHARE_EPOCH)); document.getElementById('gate')?.remove(); renderLockScreen();
      const r = S.settings.chatRouteActive || 0;
      S.settings.chat = Object.assign({}, S.settings.chat, { base: 'https://api.test/v1', key: 'k', model: 'main-model' });
      S.settings.aux = { base: 'https://api.test/v1', key: 'k', model: 'aux-model' };
      if (Array.isArray(S.settings.chatRoutes) && S.settings.chatRoutes[r]) Object.assign(S.settings.chatRoutes[r], { base: 'https://api.test/v1', key: 'k', model: 'main-model', aux: { base: 'https://api.test/v1', key: 'k', model: 'aux-model' } });
      S.settings.imgGen = false; S.settings.web = { enabled: true }; S.settings.search = { mode: 'jina', base: 'https://jina.unreachable.test' };
      visionTestImage = () => ({ dataURL: 'data:image/png;base64,iVBORw0KGgo=', code: 'AB12' });
      _setCategory = ''; go('settings');
    });
    const row = page.locator('.ios-settings-row', { hasText: '一键体检' });
    await row.scrollIntoViewIfNeeded(); await row.click();
    await page.locator('.health-btns button', { hasText: '开始检查' }).click();
    await page.waitForFunction(() => !_health.running && _health.at > 0, null, { timeout: 180000 });
    const r = await page.evaluate(() => Object.fromEntries(Object.entries(_health.results).map(([k, v]) => [k, v])));
    assert.equal(r.files.state, 'ok', r.files.why);
    assert.equal(r.storage.state, 'ok', r.storage.why);
    assert.equal(r.chat.state, 'bad'); assert.match(r.chat.why, /HTTP 401：API Key 无效/); assert.doesNotMatch(r.chat.why, /HTTP 401：HTTP 401/);
    assert.equal(r.aux.state, 'ok');
    assert.equal(r.search.state, 'bad'); assert.match(r.search.why, /自己的服务器是通的/);
    assert.equal(r.image.state, 'skip');
    if (label === 'private') { assert.equal(r.bridge.state, 'ok'); assert.equal(r.backup.state, 'ok'); assert.equal(r.pwa.state, 'skip'); }
    else { assert.equal(r.bridge.state, 'skip'); assert.ok(['ok', 'warn'].includes(r.swcache.state), r.swcache.why); }
    const box = await page.evaluate(() => { const el = document.querySelector('.health-row.is-bad .health-why'), row = el.closest('.health-row').getBoundingClientRect(), g = el.closest('.health-group').getBoundingClientRect(), b = el.getBoundingClientRect(); return { inRow: b.bottom <= row.bottom + 0.5, inGroup: row.bottom <= g.bottom + 0.5, wraps: getComputedStyle(el).whiteSpace !== 'nowrap' && el.scrollWidth <= el.clientWidth + 1 }; });
    assert.deepEqual(box, { inRow: true, inGroup: true, wraps: true }, '红色原因完整显示并被包住');
    await page.evaluate(() => { document.getElementById('healthscroll').scrollTop = 600; });
    const before = await page.evaluate(() => document.getElementById('healthscroll').scrollTop);
    await page.evaluate(() => render());
    const after = await page.evaluate(() => document.getElementById('healthscroll').scrollTop);
    assert.ok(before > 100 && Math.abs(after - before) < 2, '重画后不弹回顶部 ' + before + '→' + after);
    assert.match(await page.evaluate(() => healthReportText()), /原因：HTTP 401/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test('web page: from settings, run the whole check, see reasons, no bounce', async () => { await runPage('web', '/小手机.html'); });
test('private page: from settings, run the whole check, see reasons, no bounce', async () => { await runPage('private', '/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html'); });
