/* 小手机 · 窗台外壳（COUPLE_WINDOWSILL_V1）
   作者唐幡（TangfanOVO）的「赴约 · 窗台」原样不改，这一层只做小手机需要的事：
   1. App 里是本地文件，不能用 fetch 读模型：场景要 ./models/*.gltf.json 时，从打包好的 window.__WS_MODELS 里给。
   2. 画质：清晰度上限（正常 2，省电 1.25）和“跑不动才降一档”的门槛（正常每秒低于 22 帧、省电低于 16 帧才降），
      由 scripts/build_couple_windowsill.mjs 在打包时把上游两个常数换成读这里的值；省电模式每秒最多画 30 帧。
   3. 底色改深色：上游底色是浅米白，画面清空或重新调整大小时会闪白。3D 画面被系统回收时通知外面重新加载。
   4. 去掉标题下的「草稿 · 演示数据」（她要求）；左上角只有一个小箭头「返回」，凑近某样东西时让位给上游的「退回」。
   5. 桌上的手机：屏幕画她的锁屏（壁纸、日期、时间）；点一下翻过来亮起，再点一下屏幕（或卡片上的「进入小手机」）进入小手机。
   6. 打不开 WebGL 时告诉外面退回原来的情侣空间。
   这一层和场景一样按 AGPL-3.0 提供，见同目录 UPSTREAM.md。 */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var saver = q.get('saver') === '1';
  window.__WS_DPR_MAX = saver ? 1.25 : 2;
  window.__WS_LOWQ_FPS = saver ? 16 : 22;

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

  // The desk phone (上游 key 'phone', 卡片标题「对话」) leads into the small phone itself.
  var PHONE_TITLE = '对话';
  function phoneCard() { var t = document.getElementById('k-title'); return !!(t && t.textContent === PHONE_TITLE); }

  document.addEventListener('DOMContentLoaded', function () {
    var st = document.createElement('style');
    st.textContent = '#sp-back{position:absolute;z-index:40;left:8px;top:calc(env(safe-area-inset-top,0px) + 10px);width:44px;height:44px;display:flex;align-items:center;justify-content:center;padding:0;border:0;background:none;color:#fff;filter:drop-shadow(0 1px 3px rgba(0,0,0,.55))}body.focused #sp-back{display:none}'
      + '#head{left:auto!important;right:14px!important;text-align:right}#head span{display:none!important}';
    document.head.appendChild(st);
    var b = document.createElement('button');
    b.id = 'sp-back'; b.type = 'button'; b.setAttribute('aria-label', '返回');
    b.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    b.addEventListener('click', function (e) { e.stopPropagation(); tell({type: 'windowsill:back'}); });
    (document.getElementById('app') || document.body).appendChild(b);

    // card for the desk phone: say where it goes, and open the small phone instead of upstream's "草稿里先不跳转"
    var goT = document.getElementById('k-go-t'), note = document.getElementById('k-note');
    function relabel() {
      if (!phoneCard()) return;
      if (goT && goT.textContent !== '进入小手机') goT.textContent = '进入小手机';
      if (note && note.textContent.indexOf('设置与授权') < 0) note.textContent = '屏幕亮着时再点一下，就进入小手机；情侣空间的设置与授权、各个页面都在里面。';
    }
    if (goT) new MutationObserver(relabel).observe(document.getElementById('card') || goT, {childList: true, subtree: true, characterData: true});
    document.addEventListener('click', function (e) {
      var go = e.target && e.target.closest && e.target.closest('#k-go');
      if (!go || !phoneCard()) return;
      e.stopImmediatePropagation(); e.preventDefault();
      tell({type: 'windowsill:open', key: 'phone'});
    }, true);

    var canvas = document.getElementById('c');
    if (canvas) canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); tell({type: 'windowsill:lost'}); });
    // the scene shows #err when WebGL is unavailable; let the phone fall back to the old couple space
    setTimeout(function () { var er = document.getElementById('err'); if (er && getComputedStyle(er).display !== 'none') tell({type: 'windowsill:nogl'}); }, 2500);
  });
  // tell the phone once everything is loaded (a timer, not animation frames: a hidden frame may not be drawn)
  window.addEventListener('load', function () { setTimeout(function () { tell({type: 'windowsill:ready'}); }, 400); });
})();
