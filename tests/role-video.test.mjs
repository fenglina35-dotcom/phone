// ROLE_VIDEO_V1：她在微信里说「拍一个我在你眼中的样子」，角色给她拍「我眼中的你」视频。
// 两版真实页面：发出触发的话 → 角色照常回一句（提示里说他已经在做）→ 视频卡片出现、做完、能全屏播放；
// 剧本里编的数字、不是她原话的引用、不存在的镜头都会被丢掉；模型写不出剧本时卡片上写原因、有重试。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码（旧代码没有这个功能，应失败）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { read, ROOT, PRIV_DIR } from './_helpers.mjs';

test('both bundles ship the same role-video.js, attached in every entry, without her name in it', () => {
  const web = read('role-video.js'), priv = read(PRIV_DIR + 'role-video.js');
  assert.equal(web, priv, '两版必须是同一份');
  assert.doesNotMatch(web, /North/, '共用文件里不能写她的名字');
  assert.match(web, /window\.RoleVideo=/);
  for (const f of ['小手机.html', PRIV_DIR + '小手机.html', PRIV_DIR + 'index.html']) assert.match(read(f), /<script src="role-video\.js\?v=\d+"><\/script>/, f);
  assert.match(read('sw.js'), /url:'\.\/role-video\.js\?v='\+BUILD/);
  for (const f of ['app.js', PRIV_DIR + 'app.js']) {
    const a = read(f);
    assert.match(a, /if\(m\.type==='rolevideo'\)return typeof RoleVideo!=='undefined'\?RoleVideo\.cardHTML\(c,m\)/, f);
    assert.match(a, /if\(typeof RoleVideo!=='undefined'&&RoleVideo\.maybeStart\(c,t\)\)\{scheduleReply\(id,RoleVideo\.replyNote\(\)\);return;\}/, f);
  }
});

const SEED = () => {
  const id = 'rvtest1';
  S.contacts.push({ id, name: '林深', remark: '先生', persona: '温柔体贴，话不多', avatar: '' });
  const list = msgs(id), day = 86400000, start = Date.now() - 80 * day;
  const her = ['今天好累', '我爱你', '你累了吗？', '再试一次', '有笑声了有笑声了', '晚安', '我爱你，晚安', '想你了'], his = ['还好，你呢', '早点睡', '我在'];
  for (let d = 0, i = 0; d < 78; d += 2, i++) {
    list.push({ id: 'h' + i, role: 'user', type: 'text', content: her[i % her.length], time: start + d * day + 3600e3 });
    list.push({ id: 'a' + i, role: 'assistant', type: 'text', content: his[i % his.length], time: start + d * day + 3700e3 });
  }
  return id;
};

async function runPage(label, entry) {
  const { createRequire } = await import('node:module'), require = createRequire(import.meta.url), { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const origin = 'http://127.0.0.1:8792', bodies = [];
  let mode = 'good';
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    if (label === 'private') await page.addInitScript(() => {
      window.__SMALL_PHONE_PRIVATE__ = true;
      window.SmallPhoneNative = { request: async (cmd) => cmd === 'bridge.info' ? { contractVersion: 42, appKind: 'private-small-phone' } : { ok: false } };
    });
    await page.route('**/*', (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.host === 'api.test') {
        const body = String(req.postData() || ''); bodies.push(body);
        let content = '好，等我一下。';
        if (body.includes('镜头清单')) {
          if (mode === 'bad') content = '我不太会拍视频，抱歉。';
          else {
            const love = +(body.match(/她说「我爱你」（次）：(\d+)/) || [])[1];
            content = JSON.stringify({ music: '深夜', scenes: [
              { shot: '开场 · 一道光', sign: '—— 林深，拍给你' },
              { shot: '数字跳动', num: love, label: '你说过的我爱你', say: '你说过这么多次我爱你。' },
              { shot: '数字跳动', num: 99999, label: '编的数', say: '这个数是编的' },
              { shot: '细雨', say: '那天下雨，你一直在等我。' },
              { shot: '引用卡片', quote: '你累了吗？', date: '8月', say: '你问我累不累。' },
              { shot: '引用卡片', quote: '她从来没说过这句', date: '8月' },
              { shot: '微信消息回放', date: '那天夜里', msgs: [{ who: '她', text: '你累了吗？' }, { who: '我', text: '还好，你呢' }] },
              { shot: '心动', text: '你', sub: '最在意的', say: '你是我最在意的。' },
              { shot: '没有这个镜头', say: 'x' },
              { shot: '两颗星', say: '晚安。' },
            ] });
          }
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }) });
      }
      if (u.host === 'license.smallphoneapp.com') return route.fulfill({ status: 200, body: 'ok' });
      if (u.origin !== origin) return route.abort('failed');
      const f = path.join(ROOT, decodeURIComponent(u.pathname.slice(1)));
      const ok = f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile();
      return route.fulfill({ status: ok ? 200 : 404, body: ok ? fs.readFileSync(f) : '', contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
    });
    await page.goto(origin + encodeURI(entry) + '?northPreview=black-home');
    await page.waitForFunction(() => window.__northBootReady, null, { timeout: 60000 });
    const id = await page.evaluate((seed) => {
      S.me.locked = false; localStorage.setItem('yibei_unlocked', String(SHARE_EPOCH)); document.getElementById('gate')?.remove(); renderLockScreen();
      const r = S.settings.chatRouteActive || 0;
      S.settings.chat = Object.assign({}, S.settings.chat, { base: 'https://api.test/v1', key: 'k', model: 'main-model' });
      S.settings.aux = { base: 'https://api.test/v1', key: 'k', model: 'aux-model' };
      if (Array.isArray(S.settings.chatRoutes) && S.settings.chatRoutes[r]) Object.assign(S.settings.chatRoutes[r], { base: 'https://api.test/v1', key: 'k', model: 'main-model', aux: { base: 'https://api.test/v1', key: 'k', model: 'aux-model' } });
      /* 配音：给一段 0.6 秒的真声音 */
      const wav = () => { const sr = 22050, n = Math.round(sr * .6), b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
        w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 8) * 3000, true); return b; };
      window.__ttsCalls = 0; window.ttsApiOn = () => true; window.ttsArr = async () => { window.__ttsCalls++; return wav(); };
      const id = (new Function('return (' + seed + ')()'))(); go('chat', { id }); return id;
    }, SEED.toString());
    await page.evaluate((id) => { document.getElementById('cinput').value = '拍一个我在你眼中的样子'; sendText(id); }, id);
    await page.waitForFunction((id) => msgs(id).some((m) => m.type === 'rolevideo' && m.video && m.video.status === 'done'), id, { timeout: 60000 });
    const got = await page.evaluate((id) => { const m = msgs(id).find((x) => x.type === 'rolevideo'); render(); const el = document.querySelector('.rv-card'); return { scenes: m.video.script.scenes.map((s) => s.shot), nums: m.video.script.scenes.filter((s) => s.shot === '数字跳动').map((s) => s.num), opener: m.video.script.scenes[0], music: m.video.script.music, voices: m.video.voice.filter(Boolean).length, tts: window.__ttsCalls, dur: m.video.dur, card: el && el.textContent, side: el && el.closest('.msg').className, bubble: !!(el && el.closest('.bubble')), text: msgToText(m) }; }, id);
    assert.deepEqual(got.scenes, ['开场 · 一道光', '数字跳动', '细雨', '引用卡片', '微信消息回放', '心动', '两颗星'], '编的数字、不是她原话的引用、不存在的镜头被丢掉');
    assert.equal(got.opener.sign, '—— 林深，拍给你');
    assert.equal(got.music, 'night');
    assert.equal(got.voices, 5, '有旁白的 5 个镜头都配了音');
    assert.ok(got.dur >= 30, '时长 ' + got.dur);
    assert.match(got.card, /我眼中的你/); assert.match(got.card, /\d:\d\d/);
    assert.match(got.side, /them/, '卡片是角色那边发来的'); assert.equal(got.bubble, false, '没有气泡包边');
    assert.match(got.text, /\[视频\]「我眼中的你」（你拍给她的/);
    const prompt = bodies.find((b) => b.includes('镜头清单'));
    assert.ok(prompt, '有制作剧本的请求');
    for (const want of ['最短一分钟', '每个时期都要挑到', '准确数字', '她说「我爱你」（次）', '在一起', '她对你说的第一句话', '你累了吗？']) if (want !== '在一起') assert.ok(prompt.includes(want), '提示词里缺少：' + want);
    assert.ok((prompt.match(/### \d{4}年\d{1,2}月：她说了/g) || []).length >= 3, '素材按月份分了时期，覆盖从第一天到今天');
    for (let i = 0; i < 80 && !bodies.some((b) => b.includes('你已经开始做了')); i++) await page.waitForTimeout(500);
    assert.ok(bodies.some((b) => b.includes('你已经开始做了')), '角色照常回一句，并知道视频在做');
    await page.evaluate((id) => { const m = msgs(id).find((x) => x.type === 'rolevideo'); RoleVideo.open(id, m.id); }, id);
    await page.waitForTimeout(2500);
    const play = await page.evaluate(() => { const w = document.getElementById('rvPlayer'), cv = w && w.querySelector('canvas'); let lit = 0; if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 0; i < d.length; i += 4000) lit += d[i] + d[i + 1] + d[i + 2] > 60 ? 1 : 0; } return { open: !!w, lit, range: !!(w && w.querySelector('input[type=range]')) }; });
    assert.ok(play.open && play.range, '全屏播放器打开了，有进度条');
    assert.ok(play.lit > 0, '画面在动（不是全黑）');
    await page.evaluate(() => RoleVideo.close());
    assert.equal(await page.evaluate(() => !!document.getElementById('rvPlayer')), false);
    /* 模型写不出剧本：卡片上写原因，有重试 */
    mode = 'bad';
    await page.waitForTimeout(1500);
    await page.evaluate((id) => { document.getElementById('cinput').value = '我在你眼里是什么样子的'; sendText(id); }, id);
    await page.waitForFunction((id) => msgs(id).filter((m) => m.type === 'rolevideo').some((m) => m.video.status === 'failed'), id, { timeout: 60000 });
    const fail = await page.evaluate((id) => { render(); const m = msgs(id).filter((x) => x.type === 'rolevideo').pop(), el = document.querySelector('.rv-card[data-rv="' + m.id + '"]'); return { err: m.video.error, card: el && el.textContent, retry: !!(el && el.querySelector('.rv-retry')) }; }, id);
    assert.match(fail.err, /主模型：/); assert.match(fail.err, /副模型：/);
    assert.match(fail.card, /没做成/); assert.ok(fail.retry, '有重试按钮');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test('web page: say the words, get the video card, watch it, see why it failed', async () => { await runPage('web', '/小手机.html'); });
test('private page: say the words, get the video card, watch it, see why it failed', async () => { await runPage('private', '/' + PRIV_DIR + 'index.html'); });
