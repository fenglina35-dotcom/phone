/* 小手机 · 窗台外壳（COUPLE_WINDOWSILL_V1）
   作者唐幡（TangfanOVO）的「赴约 · 窗台」原样不改，这一层只做小手机需要的事：
   1. App 里是本地文件，不能用 fetch 读模型：场景要 ./models/*.gltf.json 时，从打包好的 window.__WS_MODELS 里给。
   2. 省电模式（地址带 saver=1）：像素密度按 1 算，每秒最多画 30 帧。
   3. 去掉标题下的「草稿 · 演示数据」（她要求）；左上角「返回」：告诉外面的小手机页面退出窗台；打不开 WebGL 时告诉外面退回原来的情侣空间。
   这一层和场景一样按 AGPL-3.0 提供，见同目录 UPSTREAM.md。 */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var saver = q.get('saver') === '1';

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opt) {
    var m = window.__WS_MODELS && window.__WS_MODELS[String(url)];
    if (m) return Promise.resolve(new Response(JSON.stringify(m), {status: 200, headers: {'Content-Type': 'application/json'}}));
    return realFetch ? realFetch(url, opt) : Promise.reject(new Error('offline'));
  };

  if (saver) {
    try { Object.defineProperty(window, 'devicePixelRatio', {get: function () { return 1; }, configurable: true}); } catch (e) {}
    var raf = window.requestAnimationFrame.bind(window), last = 0;
    window.requestAnimationFrame = function (cb) {
      return raf(function step(t) {
        if (t - last < 31) return raf(step);
        last = t; cb(t);
      });
    };
  }

  function tell(msg) { try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*'); } catch (e) {} }
  window.smallPhoneWindowsill = {tell: tell, saver: saver};

  document.addEventListener('DOMContentLoaded', function () {
    var st = document.createElement('style');
    st.textContent = '#sp-back{position:absolute;z-index:40;left:14px;top:calc(env(safe-area-inset-top,0px) + 14px);display:flex;align-items:center;gap:2px;height:36px;padding:0 14px 0 8px;border:1px solid rgba(255,255,255,.28);border-radius:18px;background:rgba(20,16,14,.42);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:#fff;font:600 15px -apple-system,"PingFang SC",sans-serif}'
      + '#head{left:auto!important;right:14px!important;text-align:right}#head span{display:none!important}';
    document.head.appendChild(st);
    var b = document.createElement('button');
    b.id = 'sp-back'; b.type = 'button'; b.setAttribute('aria-label', '返回小手机');
    b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>返回';
    b.addEventListener('click', function (e) { e.stopPropagation(); tell({type: 'windowsill:back'}); });
    (document.getElementById('app') || document.body).appendChild(b);
    tell({type: 'windowsill:ready'});
    // the scene shows #err when WebGL is unavailable; let the phone fall back to the old couple space
    setTimeout(function () { var e = document.getElementById('err'); if (e && getComputedStyle(e).display !== 'none') tell({type: 'windowsill:nogl'}); }, 2500);
  });
})();
