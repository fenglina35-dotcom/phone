/* COUPLE_WINDOWSILL_V1（2026-10-19 她要的情侣空间大改，第一步）：私人版情侣空间的首页换成 3D「赴约 · 窗台」。
   场景是唐幡（TangfanOVO）的开源作品（AGPL-3.0），源码在 native/private-small-phone/third_party/qiaosi-windowsill，
   App 里用的是 couple-windowsill/ 下打包好的版本（不联网）。只在私人版；网页版不接（需要作者书面授权）。
   - 情侣空间首页显示窗台；原来的全部内容（甜蜜日常、管控授权、真实手机）原样收进「设置与授权」页（go('couple',{list:1})）。
   - 窗台挂在页面外层，不跟着小手机重画，免得每次刷新都重新加载 3D；离开情侣空间就拆掉，省电。
   - 省电模式（S.settings.windowsillSaver）：像素密度按 1、每秒最多 30 帧。
   - 3D 打不开（WebGL 不可用）时直接退回原来的情侣空间。 */
(function () {
  'use strict';
  if (typeof renderCouple !== 'function' || typeof render !== 'function') return;
  var frame = null, holder = null, failed = false;

  function onWindowsill() {
    var c = typeof cur === 'function' ? cur() : null;
    return !!(c && c.p === 'couple' && !c.list && !failed);
  }
  function saverOn() { return !!(S.settings && S.settings.windowsillSaver); }

  function mount() {
    if (holder) return;
    holder = document.createElement('div');
    holder.id = 'cw-holder';
    holder.innerHTML = '<style>#cw-holder{position:absolute;inset:0;z-index:150;background:#0d0b0a}#cw-holder iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}'
      + '#cw-set{position:absolute;z-index:2;right:14px;top:calc(env(safe-area-inset-top,0px) + 70px);height:32px;padding:0 13px;border:1px solid rgba(255,255,255,.28);border-radius:16px;background:rgba(20,16,14,.42);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:#fff;font:600 13px -apple-system,"PingFang SC",sans-serif}'
      + '#cw-locks{position:absolute;z-index:2;right:14px;top:calc(env(safe-area-inset-top,0px) + 112px);max-width:72%;padding:8px 12px;border:1px solid rgba(255,255,255,.22);border-radius:14px;background:rgba(20,16,14,.46);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:#fff;font:12.5px/1.6 -apple-system,"PingFang SC",sans-serif;text-align:right}#cw-locks:empty{display:none}#cw-locks b{font-weight:600}'
      + '#cw-wait{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.7);font:14px -apple-system,"PingFang SC",sans-serif;pointer-events:none;transition:opacity .4s}</style>'
      + '<div id="cw-wait">正在摆好书桌…</div>'
      + '<iframe title="赴约 · 窗台" allow="autoplay" src="couple-windowsill/index.html' + (saverOn() ? '?saver=1' : '') + '"></iframe>'
      + '<button id="cw-set" type="button">设置与授权</button><div id="cw-locks" role="status"></div>';
    holder.querySelector('#cw-set').addEventListener('click', function () { go('couple', {list: 1}); });
    frame = holder.querySelector('iframe');
    // inside the phone screen, under the call screen, banners, modals, toasts and the remote-control layer (z-index 200 and up)
    (document.querySelector('.screen') || document.body).appendChild(holder);
  }
  function unmount() {
    if (!holder) return;
    try { frame.src = 'about:blank'; } catch (e) {}
    holder.remove(); holder = null; frame = null;
  }
  // ROLE_LOCK_UNTIL_V1 shows each lock's unlock time in the couple space; the windowsill keeps showing it.
  function lockRows() {
    var cp = S.couple || {}, rows = [], seen = {};
    Object.keys(cp.locks || {}).forEach(function (k) {
      if (typeof LOCKABLE === 'undefined' || !LOCKABLE[k] || !cp.locks[k]) return;
      var at = typeof lockUntilOf === 'function' ? lockUntilOf(k) : 0; seen[k] = 1;
      rows.push('<b>' + esc(LOCKABLE[k]) + '</b> 锁着' + (at && typeof lockUntilText === 'function' ? '<br>' + esc(lockUntilText(at)) : ''));
    });
    return rows.join('<br>');
  }
  function paintLocks() { var el = holder && holder.querySelector('#cw-locks'); if (el) el.innerHTML = lockRows(); }
  function sync() { if (onWindowsill()) { mount(); paintLocks(); } else unmount(); }
  setInterval(function () { if (holder) paintLocks(); }, 30000);

  window.addEventListener('message', function (e) {
    if (!frame || e.source !== frame.contentWindow) return;
    var d = e.data || {};
    if (d.type === 'windowsill:ready') { var w = holder && holder.querySelector('#cw-wait'); if (w) w.style.opacity = '0'; }
    else if (d.type === 'windowsill:back') { if (onWindowsill()) back(); }
    else if (d.type === 'windowsill:nogl') { failed = true; unmount(); render(); if (typeof toast === 'function') toast('这台设备打不开 3D 窗台，先用原来的情侣空间'); }
  });

  // The windowsill page itself: the old couple space stays the same and becomes the「设置与授权」list.
  var coreRenderCouple = renderCouple;
  renderCouple = function () {
    var html = coreRenderCouple.apply(this, arguments);
    var c = cur();
    if (c && c.list) {
      var bar = '<div class="section" style="margin:10px 12px 0"><div class="it"><span>窗台省电模式<br><small style="color:#888">画面稍微柔一点，手机不容易发热</small></span><span class="sw ' + (saverOn() ? 'on' : '') + '" onclick="S.settings.windowsillSaver=!S.settings.windowsillSaver;save();render()"></span></div></div>';
      return html.replace(/(<div class="scroll[^"]*"[^>]*>)/, '$1' + bar);
    }
    return failed ? html : '<div style="position:absolute;inset:0;background:#0d0b0a"></div>';
  };
  var coreRender = render;
  render = function () { var r = coreRender.apply(this, arguments); try { sync(); } catch (e) {} return r; };
  document.addEventListener('visibilitychange', function () { if (document.hidden) unmount(); else sync(); });
  window.CoupleWindowsill = {sync: sync, mounted: function () { return !!holder; }};
})();
