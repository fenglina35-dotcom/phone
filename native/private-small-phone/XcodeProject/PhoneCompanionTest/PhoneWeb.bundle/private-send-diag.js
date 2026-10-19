/* SEND_DIAG_V1（2026-10-20，临时诊断，修好「发消息时旧消息闪一下」后整个删掉）
   她和情侣角色发文字时，旧消息会空一下再出来（截图里只剩头像），发表情不会；电脑上照她的设置复现不出来，所以在她手机上记录。
   - 只在发消息（文字 sendText、表情 sendSticker / ssSendIn）后的 3 秒内记录，平时什么都不做。
   - 记：聊天里的消息行被删、被加了几行（按第几行记，不记内容）、哪几行播了出现动画（脚本动画和样式动画）、
     每一帧的间隔（看有没有卡住）、聊天滚动到哪、整页重画（render）几次各用多久、画面里有几行的气泡是透明的。
   - 不记：消息文字、图片、名字、任何设置或密钥。
   - 只留最近 20 次，存在 App 自己的存档里（原生存储，名字 __send_diag），不上传；电脑用数据线读。 */
(function () {
  'use strict';
  if (window.__SMALL_PHONE_PRIVATE__ !== true) return;
  var KEY = '__send_diag', LIMIT = 20, WINDOW_MS = 3000, log = [], active = null;

  function rows(box) { return box ? [].slice.call(box.querySelectorAll('.msg')) : []; }
  function rowIndex(el) { var a = active; if (!a || !el || !el.closest) return null; var r = el.closest('.msg'); if (!r) return null; var i = a.before.indexOf(r); return i >= 0 ? 'old#' + (a.before.length - i) : 'new'; }
  function persist() {
    try {
      if (!window.SmallPhoneNative || typeof window.SmallPhoneNative.request !== 'function') return;
      window.SmallPhoneNative.request('storage.put', {key: KEY, ver: 1, savedAt: Date.now(), stateJSON: JSON.stringify(log)}).catch(function () {});
    } catch (e) {}
  }

  function start(kind, id) {
    if (active) finish();
    var box = document.getElementById('chatbg'), c = typeof cur === 'function' ? cur() : null;
    var a = active = {
      at: new Date().toISOString(), kind: kind, couple: !!(S.couple && S.couple.cid && S.couple.cid === id),
      page: c && c.p, boxStart: !!box, rowsBefore: rows(box).length, scrollBefore: box ? Math.round(box.scrollTop) : null,
      heightBefore: box ? box.scrollHeight : null, before: rows(box), box: box, t0: performance.now(),
      removed: [], added: [], boxReplaced: false, anims: [], cssAnims: [], frames: [], renders: [], hiddenMax: 0, hiddenAt: null
    };
    // rows removed / added anywhere in the page
    a.mo = new MutationObserver(function (ms) {
      var t = Math.round(performance.now() - a.t0);
      ms.forEach(function (m) {
        [].forEach.call(m.removedNodes, function (n) {
          if (n.nodeType !== 1) return;
          if (n === a.box || (n.contains && a.box && n.contains(a.box))) a.boxReplaced = t;
          var k = n.matches && n.matches('.msg') ? 1 : (n.querySelectorAll ? n.querySelectorAll('.msg').length : 0);
          if (k) a.removed.push([t, k]);
        });
        [].forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1) return;
          var k = n.matches && n.matches('.msg') ? 1 : (n.querySelectorAll ? n.querySelectorAll('.msg').length : 0);
          if (k) a.added.push([t, k]);
        });
      });
    });
    a.mo.observe(document.body, {childList: true, subtree: true});
    // script animations (the natural message motion) and stylesheet animations
    a.origAnimate = Element.prototype.animate;
    Element.prototype.animate = function () {
      if (active === a && a.anims.length < 120) a.anims.push([Math.round(performance.now() - a.t0), rowIndex(this) || (this.className && String(this.className).slice(0, 24)) || this.tagName]);
      return a.origAnimate.apply(this, arguments);
    };
    a.onCss = function (e) { if (a.cssAnims.length < 120) a.cssAnims.push([Math.round(performance.now() - a.t0), e.animationName, rowIndex(e.target) || String(e.target.className || e.target.tagName).slice(0, 24)]); };
    document.addEventListener('animationstart', a.onCss, true);
    // every frame: the gap since the last one, the scroll position, and how many rows on screen have a see-through bubble
    var last = a.t0;
    function frame(now) {
      if (active !== a) return;
      var b = document.getElementById('chatbg'), hidden = 0, onScreen = 0;
      if (b) {
        var br = b.getBoundingClientRect();
        rows(b).forEach(function (r) {
          var rr = r.getBoundingClientRect(); if (rr.bottom < br.top || rr.top > br.bottom) return;
          onScreen++;
          var el = r.querySelector('.bubble') || r.querySelector('.col'), o = 1;
          for (var p = el; p && p !== b; p = p.parentElement) o *= +getComputedStyle(p).opacity;
          if (o < .5) hidden++;
        });
      }
      if (hidden > a.hiddenMax) { a.hiddenMax = hidden; a.hiddenAt = Math.round(now - a.t0); }
      if (a.frames.length < 240) a.frames.push([Math.round(now - a.t0), Math.round(now - last), b ? Math.round(b.scrollTop) : -1, onScreen, hidden, b === a.box ? 0 : 1]);
      last = now; requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    a.timer = setTimeout(finish, WINDOW_MS);
  }

  function finish() {
    var a = active; if (!a) return; active = null;
    clearTimeout(a.timer); a.mo.disconnect(); document.removeEventListener('animationstart', a.onCss, true);
    if (Element.prototype.animate !== a.origAnimate) Element.prototype.animate = a.origAnimate;
    var box = document.getElementById('chatbg'), now = rows(box);
    var kept = a.before.filter(function (r) { return r.isConnected; }).length;
    var gaps = a.frames.map(function (f) { return f[1]; }).filter(function (g, i) { return i > 0; });
    log.push({
      at: a.at, kind: a.kind, couple: a.couple, page: a.page, rowsBefore: a.rowsBefore, rowsAfter: now.length, oldRowsKept: kept,
      boxReplaced: a.boxReplaced, scrollBefore: a.scrollBefore, scrollAfter: box ? Math.round(box.scrollTop) : null, heightBefore: a.heightBefore, heightAfter: box ? box.scrollHeight : null,
      longestFrameMs: gaps.length ? Math.max.apply(null, gaps) : null, slowFrames: gaps.filter(function (g) { return g > 50; }).length,
      hiddenMax: a.hiddenMax, hiddenAt: a.hiddenAt, renders: a.renders, removed: a.removed.slice(0, 40), added: a.added.slice(0, 40),
      anims: a.anims, cssAnims: a.cssAnims, frames: a.frames
    });
    while (log.length > LIMIT) log.shift();
    persist();
  }

  // whole-page redraws while a send is being watched
  if (typeof render === 'function') {
    var coreRender = render;
    render = function () {
      var a = active, t = a ? performance.now() : 0, r = coreRender.apply(this, arguments);
      if (a && active === a && a.renders.length < 40) a.renders.push([Math.round(t - a.t0), Math.round(performance.now() - t)]);
      return r;
    };
  }
  function wrap(name, kind, idArg) {
    var fn = window[name]; if (typeof fn !== 'function') return;
    window[name] = function () {
      try { var id = arguments[idArg]; if (name !== 'sendText' || (document.getElementById('cinput') && document.getElementById('cinput').value.trim())) start(kind, id); } catch (e) {}
      return fn.apply(this, arguments);
    };
  }
  wrap('sendText', 'text', 0);
  wrap('sendSticker', 'sticker', 0);
  wrap('ssSendIn', 'store-sticker', 0);
  window.SendDiag = {log: function () { return log; }, finish: finish};
})();
