// ROLE_VIDEO_V1：她在微信里说「拍一个我在你眼中的样子」，角色给她拍「我眼中的你」视频。
// 两版真实页面：发出触发的话 → 角色照常回一句（提示里说他已经在做）→ 视频卡片出现、做完、能全屏播放；
// 剧本里编的数字、不是她原话的引用、不存在的镜头都会被丢掉；模型写不出剧本时卡片上写原因、有重试。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码（旧代码没有这个功能，应失败）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { read, ROOT, PRIV_DIR } from './_helpers.mjs';

test('both bundles ship the same role-video.js, attached in every entry, without her name in it', () => {
  /* 2026-11-02 踩坑：私人包目录默认不进版本库，role-video.js 没放行，前两次提交里根本没有它，装到手机上的是工作目录里的 */
  const tracked = cp.execFileSync('git', ['ls-files', PRIV_DIR + 'role-video.js'], { cwd: ROOT, encoding: 'utf8' }).trim();
  assert.equal(tracked, PRIV_DIR + 'role-video.js', '私人包的 role-video.js 必须进版本库');
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
  /* 聊天多到要存进大仓库（整包超过 2 万字），才会走「指纹没变就不重存」那条路 */
  S.messages.rvFiller = Array.from({ length: 700 }, (_, i) => ({ id: 'f' + i, role: 'user', type: 'text', content: '这是一条用来把聊天记录撑大的旧消息，第' + i + '条。', time: start + i }));
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
    let slowScript = true;
    await page.route('**/*', async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.host === 'api.test') {
        const body = String(req.postData() || ''); bodies.push(body);
        let content = '好，等我一下。';
        if (body.includes('你的剧本最后少了结尾镜头')) {
          content = mode === 'noend-ok' ? JSON.stringify({ shot: '信纸', lines: ['今天也想你'], sign: '林深', say: '晚安，我一直在。' }) : '我觉得不用结尾。';
        } else if (body.includes('镜头清单')) {
          /* 像真的一样：剧本写得慢，角色那句「等我一下」先到，视频后做好 */
          if (slowScript) { slowScript = false; await new Promise((r) => setTimeout(r, 15000)); }
          if (mode === 'bad') content = '我不太会拍视频，抱歉。';
          else if (mode === 'noend-ok' || mode === 'noend-bad') content = JSON.stringify({ music: '深夜', scenes: [
            { shot: '开场 · 一道光', sign: '—— 林深' },
            { shot: '细雨', say: '那天下雨。' },
            { shot: '引用卡片', quote: '你累了吗？', date: '8月', say: '你问我累不累。' },
            { shot: '薄雾', say: '你熬到了四点。' },
            { shot: '细雪', say: '下雪了。' },
            { shot: '大雪慢落', say: '我想一直陪着你。' },
          ] });
          else if (mode === 'en') content = JSON.stringify({ music: '温柔钢琴', scenes: [
            { shot: '开场 · 一道光', sign: '—— 林深' },
            { shot: '细雨', say: 'It was raining that night, and you waited for me.', zh: '那天晚上下雨，你一直在等我。' },
            { shot: '引用卡片', quote: '你累了吗？', date: '8月', say: 'You asked if I was tired.', zh: '你问我累不累。' },
            { shot: '星空', say: 'You stayed up until four.', zh: '你熬到了四点。' },
            { shot: '心动', text: '你', sub: '最在意的', say: 'You matter most to me.', zh: '你是我最在意的。' },
            { shot: '细雪', say: 'Good night.', zh: '晚安。' },
          ] });
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
    /* 真实情况：卡片出现、角色先回一句、她看到了（已读），这时小手机存过一次（记下了指纹）；视频过一会儿才做好，之后什么都没再变 */
    await page.waitForFunction((id) => { const l = msgs(id), i = l.findIndex((m) => m.type === 'rolevideo'); return i >= 0 && l.slice(i + 1).some((m) => m.role === 'assistant' && m.type === 'text' && m.seenAt) && l[i].video.status === 'making'; }, id, { timeout: 60000 });
    /* 模拟「刚存过」：大仓库里是「制作中」的那份，指纹也记下了 */
    await page.evaluate(async () => { const blob = JSON.stringify(S.messages); _heavy.messages = blob; _heavyStamp.messages = messageArchiveStamp(S.messages); _heavyReady.add('messages'); await imgPut('__messages', blob); });
    await page.waitForFunction((id) => msgs(id).some((m) => m.type === 'rolevideo' && m.video && m.video.status === 'done'), id, { timeout: 60000 });
    const got = await page.evaluate((id) => { const m = msgs(id).find((x) => x.type === 'rolevideo'); render(); const el = document.querySelector('.rv-card'); return { scenes: m.video.script.scenes.map((s) => s.shot), nums: m.video.script.scenes.filter((s) => s.shot === '数字跳动').map((s) => s.num), opener: m.video.script.scenes[0], music: m.video.script.music, endingBy: m.video.script.endingBy, voices: m.video.voice.filter(Boolean).length, tts: window.__ttsCalls, dur: m.video.dur, card: el && el.textContent, side: el && el.closest('.msg').className, bubble: !!(el && el.closest('.bubble')), text: msgToText(m) }; }, id);
    assert.deepEqual(got.scenes, ['开场 · 一道光', '数字跳动', '细雨', '引用卡片', '微信消息回放', '心动', '两颗星'], '编的数字、不是她原话的引用、不存在的镜头被丢掉');
    assert.equal(got.opener.sign, '—— 林深，拍给你');
    assert.equal(got.endingBy, 'role', '他自己选了结尾');
    assert.equal(got.music, 'night');
    assert.equal(got.voices, 5, '有旁白的 5 个镜头都配了音');
    assert.ok(got.dur >= 30, '时长 ' + got.dur);
    assert.match(got.card, /我眼中的你/); assert.match(got.card, /\d:\d\d/);
    assert.match(got.side, /them/, '卡片是角色那边发来的'); assert.equal(got.bubble, false, '没有气泡包边');
    assert.match(got.text, /\[视频\]「我眼中的你」（你拍给她的/);
    /* 重新打开小手机读到的是存进去的那份：做好的视频不能还是「制作中」 */
    /* 预览模式里 save() 不存，这里直接走保存时那一步：把 S 变成存档（_imgReplacer 决定聊天记录要不要重存进大仓库），等它写完 */
    await page.evaluate(async () => { JSON.stringify(S, _imgReplacer); await _messageArchiveWrite; await new Promise((r) => setTimeout(r, 300)); await _messageArchiveWrite; });
    const stored = await page.evaluate(async (id) => { const raw = await imgGetIDB('__messages'); if (!raw) return 'no-archive'; const all = JSON.parse(raw); const m = (all[id] || []).find((x) => x.type === 'rolevideo'); return m ? m.video.status + (m.video.script ? '+script' : '') : 'missing'; }, id);
    assert.equal(stored, 'done+script', '重新打开后视频还是做好的，剧本也在');
    const prompt = bodies.find((b) => b.includes('镜头清单'));
    assert.ok(prompt, '有制作剧本的请求');
    for (const want of ['# 写之前最后提醒', '按片子的情绪挑', '# 开头和结尾（一定要照这个来）', '最后一个镜头只能从下面这些里选一个', '最短一分钟', '每个时期都要挑到', '准确数字', '她说「我爱你」（次）', '在一起', '她对你说的第一句话', '你累了吗？']) if (want !== '在一起') assert.ok(prompt.includes(want), '提示词里缺少：' + want);
    assert.ok((prompt.match(/### \d{4}年\d{1,2}月：她说了/g) || []).length >= 3, '素材按月份分了时期，覆盖从第一天到今天');
    for (let i = 0; i < 80 && !bodies.some((b) => b.includes('你已经开始做了')); i++) await page.waitForTimeout(500);
    assert.ok(bodies.some((b) => b.includes('你已经开始做了')), '角色照常回一句，并知道视频在做');
    await page.evaluate((id) => { const m = msgs(id).find((x) => x.type === 'rolevideo'); RoleVideo.open(id, m.id); }, id);
    await page.waitForTimeout(2500);
    const play = await page.evaluate(() => { const w = document.getElementById('rvPlayer'), cv = w && w.querySelector('canvas'); let lit = 0; if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 0; i < d.length; i += 4000) lit += d[i] + d[i + 1] + d[i + 2] > 60 ? 1 : 0; } return { open: !!w, lit, range: !!(w && w.querySelector('input[type=range]')) }; });
    assert.ok(play.open && play.range, '全屏播放器打开了，有进度条');
    assert.ok(play.lit > 0, '画面在动（不是全黑）');
    const mic = await page.evaluate(async () => { const b = document.querySelector('#rvPlayer .rv-mic'); b.click(); await new Promise((r) => setTimeout(r, 900)); const off = RoleVideo._player(); b.click(); await new Promise((r) => setTimeout(r, 400)); const on = RoleVideo._player(); return { off: off.music, offPlaying: off.playing, on: on.music, onPlaying: on.playing }; });
    assert.deepEqual(mic, { off: false, offPlaying: false, on: true, onPlaying: true }, '左上角话筒关掉背景音乐、再打开');
    await page.evaluate(() => { const r = document.querySelector('#rvPlayer input[type=range]'); r.value = String(RoleVideo._player().total - .3); r.dispatchEvent(new Event('input')); });
    await page.waitForFunction(() => RoleVideo._player() && RoleVideo._player().ended, null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => !document.querySelector('#rvPlayer .rv-replay').hidden), true, '放完出现「重新播放」');
    await page.evaluate(() => document.querySelector('#rvPlayer canvas').click());
    await page.waitForTimeout(1200);
    const again = await page.evaluate(() => RoleVideo._player());
    assert.equal(again.ended, false, '点画面就从头再放');
    assert.ok(again.t > .3 && again.t < 3, '重新播放从头开始，时间在走：' + again.t);
    await page.evaluate(() => RoleVideo.close());
    assert.equal(await page.evaluate(() => !!document.getElementById('rvPlayer')), false);
    /* 配音是英文：旁白写英文，下面配中文翻译；最后一个不是收尾镜头时补一个 */
    mode = 'en';
    await page.evaluate((id) => { getC(id).voice = Object.assign({}, getC(id).voice, { lang: 'en' }); document.getElementById('cinput').value = '你眼中的我是什么样子'; sendText(id); }, id);
    await page.waitForFunction((id) => msgs(id).filter((m) => m.type === 'rolevideo').length >= 2 && msgs(id).filter((m) => m.type === 'rolevideo').pop().video.status === 'done', id, { timeout: 60000 });
    const en = await page.evaluate((id) => { const m = msgs(id).filter((x) => x.type === 'rolevideo').pop(); return m.video.script.scenes.map((s) => [s.shot, s.say || '', s.zh || '']); }, id);
    assert.ok(bodies.some((b) => b.includes('你的配音说的是英语')), '提示词告诉他用英语写旁白');
    assert.deepEqual(en[1], ['细雨', 'It was raining that night, and you waited for me.', '那天晚上下雨，你一直在等我。']);
    assert.equal(en.at(-1)[0], '心动', '最后一个（细雪）不是收尾镜头，把剧本里的收尾镜头「心动」挪到最后');
    await page.evaluate((id) => { getC(id).voice = Object.assign({}, getC(id).voice, { lang: 'zh' }); }, id);
    /* 剧本里没有结尾：单独再问他一次，用他选的；问了还不选，程序补一个带他最后那句旁白的 */
    const runOnce = async (m) => { mode = m; const n = await page.evaluate((id) => msgs(id).filter((x) => x.type === 'rolevideo').length, id); await page.waitForTimeout(1500);
      await page.evaluate((id) => { document.getElementById('cinput').value = '拍一个我在你眼中的样子'; sendText(id); }, id);
      await page.waitForFunction(([id, n]) => { const l = msgs(id).filter((x) => x.type === 'rolevideo'); return l.length > n && ['done', 'failed'].includes(l.at(-1).video.status); }, [id, n], { timeout: 60000 });
      return page.evaluate((id) => { const v = msgs(id).filter((x) => x.type === 'rolevideo').pop().video; return { status: v.status, err: v.error, by: v.script && v.script.endingBy, last: v.script && v.script.scenes.at(-1), prev: v.script && v.script.scenes.at(-2) }; }, id); };
    const ok = await runOnce('noend-ok');
    assert.equal(ok.status, 'done', ok.err);
    assert.equal(ok.by, 'asked'); assert.equal(ok.last.shot, '信纸'); assert.equal(ok.last.say, '晚安，我一直在。');
    assert.ok(bodies.some((b) => b.includes('你的剧本最后少了结尾镜头')), '单独问了他结尾');
    const bad = await runOnce('noend-bad');
    assert.equal(bad.status, 'done', bad.err);
    assert.equal(bad.by, 'added');
    assert.ok(['两颗星', '烟花', '星空', '上浮光点'].includes(bad.last.shot), bad.last.shot);
    assert.equal(bad.last.say, '我想一直陪着你。', '补的结尾带上他最后那句旁白');
    assert.equal(bad.prev.say, '', '那句旁白挪走了，不念两遍');
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
