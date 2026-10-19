/* 小手机 · 窗台外壳（COUPLE_WINDOWSILL_V1）
   作者唐幡（TangfanOVO）的「赴约 · 窗台」原样不改，这一层只做小手机需要的事：
   1. App 里是本地文件，不能用 fetch 读模型：场景要 ./models/*.gltf.json 时，从打包好的 window.__WS_MODELS 里给。
   2. 画质：清晰度上限和“跑不动就降一档”照作者原来的（正常 1.6、每秒不到 34 帧就降；省电 1.25、不到 16 帧才降），降档后 1.25 倍；
      景深虚化减到 0.45（看着清楚靠少虚化，不靠加像素：iPhone 15 加到 2 倍时只有二十几帧，动起来发涩）；
      看的过程中不再切换清晰度（每切一次整张画面重建，会闪一下屏），第一次测速做完才揭开加载层，降档发生在加载层后面。
      由 scripts/build_couple_windowsill.mjs 在打包时把上游常数换成读这里的值；省电模式每秒最多画 30 帧。
   3. 底色改深色：上游底色是浅米白，画面清空或重新调整大小时会闪白。3D 画面被系统回收时通知外面重新加载。
   4. 去掉标题下的「草稿 · 演示数据」（她要求）；左上角只有一个小箭头「返回」，凑近某样东西时让位给上游的「退回」。
   5. 桌上的手机：屏幕画她的锁屏（壁纸、日期、时间）；点一下翻过来亮起，再点一下屏幕（或卡片上的「进入小手机」）进入小手机。
   6. 打不开 WebGL 时告诉外面退回原来的情侣空间。
   7. 一起听：电脑屏幕上放的是小手机「音乐」里真正在放的歌（外面每秒报一次），卡片上有上一首 / 播放暂停 / 下一首，点了让外面的播放器去做。
   8. 窗台上的透卡去掉（她觉得多余）；流麻牌上的小家伙换成小手机的桌宠小橘（pet.js 里的动图帧，由 scripts/build_couple_windowsill_pet.cjs 生成）；
      角色或她让桌宠做的表情、桌宠睡着、正在放歌，卡上跟着变；点一下换一个表情。帧图没加载好时仍是上游的颜文字。

   这一层和场景一样按 AGPL-3.0 提供，见同目录 UPSTREAM.md。 */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var saver = q.get('saver') === '1';
  window.__WS_DPR_MAX = saver ? 1.25 : 1.6;   // upstream's own cap; 2 made an iPhone 15 crawl
  window.__WS_LOWQ_FPS = saver ? 16 : 34;     // upstream's own threshold
  window.__WS_LOWQ_PR = saver ? 1 : 1.25;
  window.__WS_NO_CRISP = true;                // no resolution switch while looking around (it flashes)
  window.__WS_DOF = .45;                    // gentler depth-of-field blur
  window.__WS_NO_SILL_PET = true;           // no 透卡 on the sill: 小橘 lives on the 流麻牌 on the desk only

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opt) {
    var m = window.__WS_MODELS && window.__WS_MODELS[String(url)];
    if (m) return Promise.resolve(new Response(JSON.stringify(m), {status: 200, headers: {'Content-Type': 'application/json'}}));
    return realFetch ? realFetch(url, opt) : Promise.reject(new Error('offline'));
  };

  if (saver) {
    var raf = window.requestAnimationFrame.bind(window), last = 0;
    window.requestAnimationFrame = function (cb) {
      return raf(function step(t) {
        if (t - last < 31) return raf(step);
        last = t; cb(t);
      });
    };
  }

  var early = document.createElement('style');
  early.textContent = ':root{--bg:#0d0b0a!important}html,body{background:#0d0b0a!important}';
  (document.head || document.documentElement).appendChild(early);

  function tell(msg) { try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*'); } catch (e) {} }
  window.smallPhoneWindowsill = {tell: tell, saver: saver};

  // The desk phone shows her own lock screen (wallpaper, date, time) instead of upstream's demo chat.
  // Upstream draws that texture at 2x and turned 180°, so the same transform is used here.
  var lockBg = null, lockSeen = false;
  function drawLock() {
    var tex = window.__WS_PHONE_SCREEN, c = tex && tex.image;
    if (!c || !c.getContext) return;
    var g = c.getContext('2d'), w = 540, h = 1110, d = new Date(), pad = function (n) { return String(n).padStart(2, '0'); };
    var F = function (wt, sz) { return wt + ' ' + sz + 'px system-ui, -apple-system, "PingFang SC", sans-serif'; };
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#050608'; g.fillRect(0, 0, c.width, c.height);
    g.setTransform(-2, 0, 0, -2, c.width, c.height);
    g.save(); g.beginPath(); g.roundRect(10, 10, w - 20, h - 20, 64); g.clip();
    if (lockBg && lockBg.naturalWidth) {
      var k = Math.max((w - 20) / lockBg.naturalWidth, (h - 20) / lockBg.naturalHeight), iw = lockBg.naturalWidth * k, ih = lockBg.naturalHeight * k;
      g.drawImage(lockBg, 10 + (w - 20 - iw) / 2, 10 + (h - 20 - ih) / 2, iw, ih);
    } else {
      var bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#3b3150'); bg.addColorStop(1, '#14171c'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    }
    var shade = g.createLinearGradient(0, 0, 0, h); shade.addColorStop(0, 'rgba(0,0,0,.32)'); shade.addColorStop(.42, 'rgba(0,0,0,0)'); shade.addColorStop(.8, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = shade; g.fillRect(0, 0, w, h); g.restore();
    g.fillStyle = '#020203'; g.beginPath(); g.roundRect(w / 2 - 74, 30, 148, 42, 21); g.fill();
    g.textAlign = 'center'; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 8;
    g.fillStyle = 'rgba(255,255,255,.92)'; g.font = F(500, 30); g.fillText((d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + '日一二三四五六'[d.getDay()], w / 2, 150);
    g.fillStyle = '#fff'; g.font = F(600, 150); g.fillText(pad(d.getHours()) + ':' + pad(d.getMinutes()), w / 2, 300);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = F(500, 26); g.fillText('轻点进入小手机', w / 2, h - 92);
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.roundRect(w / 2 - 70, h - 46, 140, 8, 4); g.fill();
    tex.needsUpdate = true;
  }
  window.addEventListener('message', function (e) {
    var dt = e.data || {};
    if (dt.type !== 'windowsill:lock') return;
    lockSeen = true;
    if (dt.bg) { var im = new Image(); im.onload = function () { lockBg = im; drawLock(); }; im.onerror = function () { lockBg = null; drawLock(); }; im.src = dt.bg; }
    else { lockBg = null; drawLock(); }
  });
  setInterval(function () { if (lockSeen) drawLock(); }, 20000);
  window.__WS_PHONE_ENTER = function () { tell({type: 'windowsill:open', key: 'phone'}); };

  // 一起听: what the small phone's own player is playing; the parent reports it every second (windowsill:np)
  var np = null;
  function feedNowPlaying() {
    if (!np || !window.fuyue) return;
    if (np.title) {
      var o = {title: np.title, artist: np.artist || '', dur: Math.max(1, np.dur || 1), pos: Math.max(0, np.pos || 0), playing: !!np.playing};
      if (np.lyrics !== undefined) o.lyrics = np.lyrics && np.lyrics.length ? np.lyrics : null;
      window.fuyue.setNowPlaying(o);
    } else window.fuyue.setNowPlaying({title: np.songs ? '还没开始放' : '还没有歌', artist: '小手机 · 音乐', dur: 1, pos: 0, playing: false, lyrics: null});
  }

  // 小橘 on the 透卡 / 流麻牌: frames from pet.js, picked by what the small phone's desk pet is doing
  // pet.js is loaded after this file, so the sheet is read once the page is parsed
  var SHEET = null, sheetImg = null, pet = {name: '小橘', cmd: '', cmdLeft: 0, mood: '', at: 0};
  document.addEventListener('DOMContentLoaded', function () {
    SHEET = window.__WS_PET_SHEET || null;
    if (SHEET) { var sim = new Image(); sim.onload = function () { sheetImg = sim; }; sim.src = SHEET.url; }
  });
  var row = -1, fi = 0, pacc = 0, manual = -1, manualUntil = 0, idleAt = 0, idleRow = 0;
  var IDLE = ['开心', '挥手', '眨眼', '伸懒腰'];
  function rowOf(n) { return SHEET ? SHEET.names.indexOf(n) : -1; }
  function wantRow(ctxName) {
    var now = Date.now();
    if (pet.cmd && now < pet.at + pet.cmdLeft && rowOf(pet.cmd) >= 0) return rowOf(pet.cmd);
    if (manual >= 0 && now < manualUntil) return manual;
    if (pet.mood === 'sleep' || ctxName === '打盹') return rowOf('睡觉');
    if (ctxName === '戴耳机摇' || (np && np.playing)) return rowOf('戴耳机');
    if (ctxName === '害羞') return rowOf('害羞');
    if (ctxName === '戴眼镜看书') return rowOf('星星眼');
    if (pet.mood === 'sad') return rowOf('难过');
    if (now > idleAt) { idleAt = now + 30000; idleRow = rowOf(IDLE[Math.floor(Math.random() * IDLE.length)]); }
    return idleRow;
  }
  function paintPet(g) { var c = SHEET.cell; g.clearRect(0, 0, 240, 240); g.drawImage(sheetImg, fi * c, row * c, c, c, 0, 0, 240, 240); }
  window.__WS_PET = {
    tick: function (dt, g, ctxName, redraw) {
      if (!sheetImg) return false;
      var r = wantRow(ctxName);
      if (r !== row) { row = r; fi = 0; pacc = 0; paintPet(g); redraw(); return true; }
      pacc += Math.min(dt, .1) * 1000;
      if (pacc >= SHEET.rows[row][fi]) { pacc = 0; fi = (fi + 1) % SHEET.rows[row].length; paintPet(g); redraw(); }
      return true;
    },
    next: function () {
      if (!sheetImg) return false;
      manual = ((manual >= 0 && Date.now() < manualUntil ? manual : row) + 1) % SHEET.names.length; manualUntil = Date.now() + 20000;
      return true;
    },
    state: function () { return {row: row, name: SHEET && SHEET.names[row], frame: fi, loaded: !!sheetImg}; }
  };

  window.addEventListener('message', function (e) {
    var dt = e.data || {};
    if (dt.type === 'windowsill:np') { np = dt; feedNowPlaying(); /* lyrics come only when the song changes; the scene keeps them */ if (window.__spRelabel) window.__spRelabel(); }
    else if (dt.type === 'windowsill:pet') { pet = {name: dt.name || '小橘', cmd: dt.cmd || '', cmdLeft: dt.cmdLeft || 0, mood: dt.mood || '', at: Date.now()}; }
  });

  // The desk phone (上游 key 'phone', 卡片标题「对话」) leads into the small phone itself.
  var PHONE_TITLE = '对话', MUSIC_TITLE = '一起听', PET_TITLE = '桌宠 · 心情';
  function cardIs(title) { var t = document.getElementById('k-title'); return !!(t && t.textContent === title); }
  function phoneCard() { return cardIs(PHONE_TITLE); }

  document.addEventListener('DOMContentLoaded', function () {
    var st = document.createElement('style');
    st.textContent = '#sp-back{position:absolute;z-index:40;left:8px;top:calc(env(safe-area-inset-top,0px) + 10px);width:44px;height:44px;display:flex;align-items:center;justify-content:center;padding:0;border:0;background:none;color:#fff;filter:drop-shadow(0 1px 3px rgba(0,0,0,.55))}body.focused #sp-back{display:none}'
      + '#head{left:auto!important;right:14px!important;text-align:right}#head span{display:none!important}'
      // the music row looks like upstream's .go row: no fill, a thin top line, the card's text shadow (the glass is drawn by the scene)
      + '#sp-mc{display:none;margin-top:10px;border-top:1px solid rgba(255,255,255,.22);justify-content:space-around;align-items:center}body.sp-music #sp-mc{display:flex}'
      + '#sp-mc button{width:64px;height:48px;border:0;padding:0;background:none;color:#fffdf9;display:flex;align-items:center;justify-content:center;cursor:pointer;filter:drop-shadow(0 0 1px rgba(22,18,14,.95)) drop-shadow(0 1px 4px rgba(18,14,10,.55))}#sp-mc button:active{opacity:.6}';
    document.head.appendChild(st);
    var b = document.createElement('button');
    b.id = 'sp-back'; b.type = 'button'; b.setAttribute('aria-label', '返回');
    b.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    b.addEventListener('click', function (e) { e.stopPropagation(); tell({type: 'windowsill:back'}); });
    (document.getElementById('app') || document.body).appendChild(b);

    // card for the desk phone: say where it goes, and open the small phone instead of upstream's "草稿里先不跳转"
    var goT = document.getElementById('k-go-t'), note = document.getElementById('k-note'), goB = document.getElementById('k-go');
    var ICON = {
      prev: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM20 5.5v13L9.5 12z"/></svg>',
      play: '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15L19.5 12z"/></svg>',
      pause: '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg>',
      next: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5.5v13L14.5 12z"/></svg>'
    };
    var mc = document.createElement('div'); mc.id = 'sp-mc';
    mc.innerHTML = '<button type="button" data-m="prev" aria-label="上一首">' + ICON.prev + '</button><button type="button" data-m="toggle" aria-label="播放">' + ICON.play + '</button><button type="button" data-m="next" aria-label="下一首">' + ICON.next + '</button>';
    if (goB) goB.parentNode.insertBefore(mc, goB);
    var tgl = mc.querySelector('[data-m="toggle"]'), shownPlaying = null;
    function paintToggle() {
      var on = !!(np && np.playing);
      if (on === shownPlaying) return;
      shownPlaying = on; tgl.innerHTML = on ? ICON.pause : ICON.play; tgl.setAttribute('aria-label', on ? '暂停' : '播放');
    }
    mc.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-m]'); if (!b) return;
      e.stopPropagation();
      var m = b.getAttribute('data-m');
      if (m === 'toggle' && np && np.title) { np.playing = !np.playing; paintToggle(); }   // answer the tap at once; the next report corrects it
      tell({type: 'windowsill:music', cmd: m});
    });
    function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }
    function relabel() {
      var music = cardIs(MUSIC_TITLE);
      document.body.classList.toggle('sp-music', music);
      if (phoneCard()) {
        setText(goT, '进入小手机');
        if (note && note.textContent.indexOf('设置与授权') < 0) note.textContent = '屏幕亮着时再点一下，就进入小手机；情侣空间的设置与授权、各个页面都在里面。';
      } else if (music) {
        paintToggle();
        setText(goT, '打开小手机里的音乐');
        if (np) setText(note, !np.songs ? '小手机「音乐」里还没有歌，先去添加一首，就能在这里一起听。'
          : np.title ? (np.playing ? '正在放：' : '暂停在：') + np.title + (np.artist ? ' · ' + np.artist : '') + '。离开窗台也会接着放。'
          : '点 ▶ 就从音乐里的歌开始放。');
      } else if (cardIs(PET_TITLE) && sheetImg) {
        setText(note, pet.name + '是小手机里的桌宠：它在小手机里做什么表情（角色让它做的也算），卡上就是什么样子；点一下换一个。');
      }
    }
    window.__spRelabel = relabel;
    if (goT) new MutationObserver(relabel).observe(document.getElementById('card') || goT, {childList: true, subtree: true, characterData: true});
    document.addEventListener('click', function (e) {
      var go = e.target && e.target.closest && e.target.closest('#k-go');
      if (!go) return;
      var key = phoneCard() ? 'phone' : cardIs(MUSIC_TITLE) ? 'music' : '';
      if (!key) return;
      e.stopImmediatePropagation(); e.preventDefault();
      tell({type: 'windowsill:open', key: key});
    }, true);

    var canvas = document.getElementById('c');
    if (canvas) canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); tell({type: 'windowsill:lost'}); });
    // the scene shows #err when WebGL is unavailable; let the phone fall back to the old couple space
    setTimeout(function () { var er = document.getElementById('err'); if (er && getComputedStyle(er).display !== 'none') tell({type: 'windowsill:nogl'}); }, 2500);
  });
  // tell the phone once everything is loaded (a timer, not animation frames: a hidden frame may not be drawn)
  // ...and only after the first speed check (a drop to the lower tier resizes everything and would flash in view); at most 6.5 s
  window.addEventListener('load', function () {
    var t0 = Date.now(), iv = setInterval(function () {
      if (!window.__WS_TIER_SET && Date.now() - t0 < 6500) return;
      clearInterval(iv); setTimeout(function () { tell({type: 'windowsill:ready'}); }, 150);
    }, 100);
  });
})();
