/* COUPLE_WINDOWSILL_V1（2026-10-19 她要的情侣空间大改）：私人版情侣空间的首页换成 3D「赴约 · 窗台」。
   场景是唐幡（TangfanOVO）的开源作品（AGPL-3.0），源码在 native/private-small-phone/third_party/qiaosi-windowsill，
   App 里用的是 couple-windowsill/ 下打包好的版本（不联网）。只在私人版；网页版不接（需要作者书面授权）。
   - 情侣空间首页显示窗台；原来的全部内容（甜蜜日常、管控授权、伴生设备）原样在「设置与授权」页（go('couple',{list:1})），
     入口是桌上的手机：点手机，卡片上点「进入小手机」（她要求，不放右上角按钮，窗台上也不显示锁定条）。
   - 窗台挂在小手机屏幕里（来电、横幅、弹窗、提示、远程操控都在它上面），不跟着小手机重画；离开或进后台就拆掉，省电。
   - 窗台框让出状态栏和底部横条（框里的页面拿不到这两处的高度，按钮会和时间叠在一起）；深色底，加载时盖一层「正在摆好书桌…」，加载完淡出（不闪白）；3D 画面被系统回收（会闪白、贴图变黑）时重新加载，最多两次，再不行退回原来的情侣空间。
   - 省电模式（S.settings.windowsillSaver）：清晰度降到 1.25（平时 1.6，两种都每秒最多 30 张）。
   - 3D 打不开（WebGL 不可用）时直接退回原来的情侣空间。
   - 一起听（她要求，在情侣空间里直接放）：电脑屏幕上是小手机「音乐」正在放的歌，每秒报给窗台一次（歌名、歌手、进度、带时间的歌词）；
     卡片上的上一首 / 播放暂停 / 下一首直接调音乐自己的 musicPrev / musicToggle / musicNext，离开窗台歌也接着放（和音乐 App 一样）。
   - 窗台上那张透卡（上游的第二只桌宠）去掉了，只留桌上的流麻牌（她要求）。
   - 桌宠小橘：每两秒把桌宠现在的表情指令（角色或她让它做的）、心情和名字报给窗台，透卡上的小橘跟着变。 */
(function () {
  'use strict';
  // 2026-10-20 重新启用（COUPLE_WINDOWSILL_PAUSED_V1 停用过一段）：她在独立测速网页上选定「新方案，清晰度 1.6，稳定 30 张」后要求装回 App，
  // 画质做法见 couple-windowsill/shell.js 的 WINDOWSILL_STEADY30_V1。
  if (typeof renderCouple !== 'function' || typeof render !== 'function') return;
  var frame = null, holder = null, failed = false, reloads = 0, ready = false, ticker = 0, sentSong = null;

  function onWindowsill() {
    var c = typeof cur === 'function' ? cur() : null;
    return !!(c && c.p === 'couple' && !c.list && !failed);
  }
  function saverOn() { return !!(S.settings && S.settings.windowsillSaver); }

  function mount() {
    if (holder) return;
    holder = document.createElement('div');
    holder.id = 'cw-holder';
    holder.innerHTML = '<style>#cw-holder{position:absolute;inset:0;z-index:150;background:#0d0b0a}#cw-holder iframe{position:absolute;left:0;right:0;top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px);width:100%;height:calc(100% - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));border:0;display:block;background:#0d0b0a}'
      + '#cw-wait{position:absolute;inset:0;z-index:1;background:#0d0b0a;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.7);font:14px -apple-system,"PingFang SC",sans-serif;pointer-events:none;transition:opacity .35s}#cw-holder.shown #cw-wait{opacity:0}</style>'
      + '<div id="cw-wait">正在摆好书桌…</div>'
      + '<iframe title="赴约 · 窗台" allow="autoplay" src="couple-windowsill/index.html' + (saverOn() ? '?saver=1' : '') + '"></iframe>';
    frame = holder.querySelector('iframe');
    // inside the phone screen, under the call screen, banners, modals, toasts and the remote-control layer (z-index 200 and up)
    (document.querySelector('.screen') || document.body).appendChild(holder);
  }
  function unmount() {
    if (!holder) return;
    ready = false; sentSong = null; clearInterval(ticker); ticker = 0;
    try { frame.src = 'about:blank'; } catch (e) {}
    holder.remove(); holder = null; frame = null;
  }
  // her lock-screen wallpaper goes onto the desk phone's screen
  function sendLock() {
    var raw = (S.me && (S.me.lockBg || S.me.homeBg)) || '';
    var post = function (src) { try { if (frame) frame.contentWindow.postMessage({type: 'windowsill:lock', bg: typeof isImg === 'function' && isImg(src) ? src : ''}, '*'); } catch (e) {} };
    var src = typeof storedImageDisplaySource === 'function' ? storedImageDisplaySource(raw) : raw;
    if (typeof isStoredImgRef === 'function' && isStoredImgRef(src) && typeof imgMany === 'function') {
      imgMany([String(raw).slice(4)]).then(function (found) { post((found && found[String(raw).slice(4)]) || ''); }, function () { post(''); });
    } else post(src);
  }
  function post(msg) { try { if (frame && ready) frame.contentWindow.postMessage(msg, '*'); } catch (e) {} }
  // 一起听: the music app's own player state (globals of app.js: _ma, _mCur, _mAudioSongId)
  function nowPlaying() {
    var songs = (S.music && S.music.songs) || [], id = typeof _mCur !== 'undefined' ? _mCur : null;
    var s = songs.find(function (x) { return x.id === id; }) || null, a = typeof _ma !== 'undefined' ? _ma : null;
    var live = !!(s && a && typeof _mAudioSongId !== 'undefined' && _mAudioSongId === id);
    var msg = {type: 'windowsill:np', songs: songs.length, title: s ? (s.title || '一首歌') : '', artist: s ? (s.artist || '') : '',
      dur: live && isFinite(a.duration) ? a.duration : (s && s.duration) || 0, pos: live ? a.currentTime || 0 : 0, playing: !!(live && !a.paused)};
    if (s && sentSong !== s.id) {
      sentSong = s.id;
      var lines = typeof parseLyrics === 'function' ? parseLyrics(s.lyrics) : [];
      msg.lyrics = lines.filter(function (l) { return l.t != null && l.txt; }).map(function (l) { return {t: l.t, text: l.txt}; });
    }
    return msg;
  }
  function petNow() {
    var p = (S.settings && S.settings.deskPet) || {}, st = null;
    try { st = window.__deskPet && window.__deskPet.state(); } catch (e) {}
    var left = st && st.cmd ? Math.max(0, (st.cmdUntil || 0) - Date.now()) : 0;
    return {type: 'windowsill:pet', name: p.name || '小橘', cmd: left ? st.cmd : '', cmdLeft: left, mood: st && st.napping ? 'sleep' : (st && st.mood) || ''};
  }
  var lastPet = 0;
  function report() { if (!frame || !ready) return; post(nowPlaying()); if (Date.now() - lastPet > 1900) { lastPet = Date.now(); post(petNow()); } }
  function music(cmd) {
    var songs = (S.music && S.music.songs) || [];
    if (!songs.length) { if (typeof toast === 'function') toast('音乐里还没有歌，先去添加一首'); return; }
    var p = cmd === 'next' ? musicNext() : cmd === 'prev' ? musicPrev() : musicToggle();
    Promise.resolve(p).then(function () { setTimeout(report, 150); }, function () {});
    setTimeout(report, 400);
  }
  function sync() { if (onWindowsill()) mount(); else unmount(); }
  function fallBack(msg) { failed = true; unmount(); render(); if (msg && typeof toast === 'function') toast(msg); }

  window.addEventListener('message', function (e) {
    if (!frame || e.source !== frame.contentWindow) return;
    var d = e.data || {};
    if (d.type === 'windowsill:ready') {
      if (holder) holder.classList.add('shown'); sendLock();
      ready = true; lastPet = 0; report(); clearInterval(ticker); ticker = setInterval(report, 1000);
    }
    else if (d.type === 'windowsill:music') { music(d.cmd); }
    else if (d.type === 'windowsill:open' && d.key === 'music') { if (typeof openApp === 'function') openApp('music'); else go('music'); }
    else if (d.type === 'windowsill:back') { if (onWindowsill()) back(); }
    else if (d.type === 'windowsill:open' && d.key === 'phone') { go('couple', {list: 1}); }
    else if (d.type === 'windowsill:lost') { if (++reloads > 2) fallBack('3D 窗台加载不稳定，先用原来的情侣空间'); else { unmount(); sync(); } }
    else if (d.type === 'windowsill:nogl') { fallBack('这台设备打不开 3D 窗台，先用原来的情侣空间'); }
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
