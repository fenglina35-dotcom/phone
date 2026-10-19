// SEND_TOUCH_DEFER_V1: sending to a role with server push must not rebuild the server context in the send frame.
// On her iPhone that rebuild (roleServerPushRecentContext) took hundreds of ms right after she pressed send, and the
// older bubbles went blank for a moment. The notice now goes out after the send animation, merged per role, and is
// flushed at once when the App is hidden. Runs real sendText on both entrypoints.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

test('server push touch waits until the send has been drawn, and is flushed when hidden', async () => {
  const {chromium} = require('playwright');
  const path = require('node:path');
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try {
    for (const privateApp of [false, true]) {
      const page = await browser.newPage({viewport: {width: 390, height: 844}});
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      if (privateApp) await page.addInitScript(() => { window.__SMALL_PHONE_PRIVATE__ = true; window.SmallPhoneNative = {request: async () => ({ok: false})}; });
      await page.route('**/*', route => {
        const u = new URL(route.request().url());
        if (u.origin !== 'http://127.0.0.1:8779') return route.abort();
        const f = path.resolve(decodeURIComponent(u.pathname.slice(1)));
        const ok = f.startsWith(process.cwd() + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile();
        return route.fulfill({status: ok ? 200 : 404, body: ok ? fs.readFileSync(f) : '', contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html'});
      });
      await page.goto('http://127.0.0.1:8779/' + (privateApp ? 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html' : '小手机.html') + '?northPreview=black-home');
      await page.waitForFunction(() => window.__northBootReady);
      const r = await page.evaluate(async () => {
        S.me.locked = false; S.settings.sound = false; S.settings.manualReply = true; S.settings.manualReplyScenes = {wechat: true};
        const c = S.contacts[0]; c.blocked = false; c.proactive = {enabled: true, serverPush: true};
        const calls = [];
        roleServerPushTouchActivity = (id, at) => { calls.push({id, at, t: performance.now()}); return Promise.resolve(true); };
        stack = [{p: 'home'}, {p: 'chat', id: c.id}]; render();
        const input = document.getElementById('cinput');
        input.value = '第一条'; sendText(c.id);
        const inSendFrame = calls.length;
        input.value = '第二条'; sendText(c.id);
        const afterTwo = calls.length;
        await new Promise(res => setTimeout(res, 1300));
        const rows = msgs(c.id), last = rows[rows.length - 1];
        const merged = calls.length, sameRole = calls.every(x => x.id === c.id), atLast = calls.length ? calls[0].at === last.time : false;
        // hidden right after sending: no waiting
        input.value = '第三条'; sendText(c.id);
        Object.defineProperty(document, 'hidden', {configurable: true, get: () => true});
        document.dispatchEvent(new Event('visibilitychange'));
        const flushed = calls.length;
        delete document.hidden;
        await new Promise(res => setTimeout(res, 1200));
        Object.keys(_replyTimers).forEach(k => { clearTimeout(_replyTimers[k]); delete _replyTimers[k]; });
        return {inSendFrame, afterTwo, merged, sameRole, atLast, flushed, total: calls.length};
      });
      const where = privateApp ? 'private' : 'web';
      assert.equal(r.inSendFrame, 0, where + ': the server notice ran inside the send');
      assert.equal(r.afterTwo, 0, where + ': the server notice ran inside the second send');
      assert.equal(r.merged, 1, where + ': two quick sends should give one server notice');
      assert.equal(r.sameRole, true);
      assert.equal(r.atLast, true, where + ': the notice must carry the latest message time');
      assert.equal(r.flushed, 2, where + ': going to the background must send the pending notice at once');
      assert.equal(r.total, 2, where + ': the flushed notice must not be sent again');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
