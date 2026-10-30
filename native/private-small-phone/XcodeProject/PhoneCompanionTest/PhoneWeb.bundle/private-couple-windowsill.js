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
   - WINDOWSILL_DESK_V1（2026-10-20 她定的对照表）：桌上每样东西显示小手机里的真实内容，卡片按钮打开对应页面——
     挂历=在一起天数和下一个纪念日，便签=他每天的碎碎念（每天第一次打开窗台时调一次副模型，每张最多 3 行、每行最多 6 字），
     蜡烛=晚安/睡眠（吹灭就是晚安、点上就是醒啦，不弹框不弹提示），书=共读，茶=健康（伴生同步的数据，只看），千纸鹤=他在哪（他出门就飞走、沙滩有脚印），
     风铃=他发了新动态你还没看时自己晃，信=信箱（有没拆的信时窗台上才有纸飞机），木盒=游戏大厅，手帐=出门，星星罐=任务便签的星星，盆景=致谢作者；
     天气按她手机所在位置查 open-meteo（和小手机天气同一来源，坐标只留三位小数，半小时一次），季节她自己调、会记住。
     相册：挂板上五个地方（拍立得、明信片、三连拍三格）放她的照片，存在 S.couple.wallPhotos（大图存档时自动进图片库）。
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

  // WINDOWSILL_GFX_PAGE_V1（2026-10-21 她要的）：测速时试过的画面做法做成开关，放在情侣空间「设置与授权」里单独一页「窗台画面」，
  // 她看哪个好用开哪个；挂板亮度的两条滑条也搬到这一页（相册卡片上不再占位置）。存在 S.settings.windowsillGfx，
  // 改了以后回到窗台会重新摆一次书桌（画面开关要在窗台打开前定好）。默认值就是她在手机测速网页上选定的「清晰度 1.6、稳定 30 张」。
  var GFX_DEF = {dpr: 1.6, zoom: 2.6, fps: 30, drop: true, ao: false, dof: false, liveShadow: false, softShadow: false, candleShadow: false, realLight: false};
  var GFX_OPT = {dpr: [1.25, 1.6, 2], zoom: [0, 2.2, 2.6], fps: [30, 60]};
  function gfx() {
    var g = (S.settings && S.settings.windowsillGfx) || {}, out = {};
    Object.keys(GFX_DEF).forEach(function (k) {
      var v = g[k];
      if (GFX_OPT[k]) out[k] = GFX_OPT[k].indexOf(+v) >= 0 ? +v : (k === 'dpr' && saverOn() ? 1.25 : GFX_DEF[k]);
      else out[k] = typeof v === 'boolean' ? v : GFX_DEF[k];
    });
    return out;
  }
  function gfxKey() { return JSON.stringify(gfx()); }
  var brightDirty = false;
  function gfxSet(k, v) {
    if (!S.settings) S.settings = {};
    var g = S.settings.windowsillGfx || (S.settings.windowsillGfx = {});
    if (k === 'reset') { delete S.settings.windowsillGfx; delete S.settings.windowsillSaver; if (S.couple) { S.couple.wallBright = 0; S.couple.wallBrightMisc = 0; } brightDirty = true; }
    else if (GFX_OPT[k]) { if (GFX_OPT[k].indexOf(+v) >= 0) g[k] = +v; }
    else if (k in GFX_DEF) g[k] = !gfx()[k];
    save(); render();
  }
  function brightSet(k, v, done) {
    v = Math.round(+v); if (!(v >= 0 && v <= 100)) return;
    var el = document.getElementById('cwg-' + k); if (el) el.textContent = v ? v : '原样';
    if (done && wallBright(k) !== v) { cp()[k] = v; brightDirty = true; save(); }
  }
  function gfxPage() {
    var g = gfx();
    var pills = function (k, list) {
      return '<span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">' + list.map(function (o) {
        var on = g[k] === o[0];
        return '<span onclick="CoupleWindowsill.set(\'' + k + '\',' + o[0] + ')" style="padding:5px 10px;border-radius:14px;font-size:12px;cursor:pointer;white-space:nowrap;'
          + (on ? 'background:#f0a9c1;color:#1a191c' : 'background:rgba(255,255,255,.07);color:#cfc7cb') + '">' + o[1] + '</span>';
      }).join('') + '</span>';
    };
    var row = function (title, sub, right) { return '<div class="it"><span>' + title + (sub ? '<br><small style="color:#888">' + sub + '</small>' : '') + '</span>' + right + '</div>'; };
    var sw = function (k, title, sub) { return row(title, sub, '<span class="sw ' + (g[k] ? 'on' : '') + '" onclick="CoupleWindowsill.set(\'' + k + '\')"></span>'); };
    var slider = function (k, title, sub) {
      var v = wallBright(k);
      return '<div class="it" style="display:block"><div style="display:flex;justify-content:space-between"><span>' + title + '<br><small style="color:#888">' + sub + '</small></span><span id="cwg-' + k + '" style="color:#888;font-size:13px">' + (v ? v : '原样') + '</span></div>'
        + '<input type="range" min="0" max="100" step="1" value="' + v + '" style="width:100%;margin-top:8px;accent-color:#e89db5" oninput="CoupleWindowsill.bright(\'' + k + '\',this.value)" onchange="CoupleWindowsill.bright(\'' + k + '\',this.value,1)"></div>';
    };
    var head = function (t) { return '<div style="margin:16px 18px 6px;font-size:12px;color:#888">' + t + '</div>'; };
    return '<div class="nav"><span class="l" onclick="back()">‹</span><span class="t">窗台画面</span><span class="r"></span></div>'
      + '<div class="scroll" id="couplescroll" style="padding-bottom:30px">' + (typeof COUPLE_CSS === 'string' ? COUPLE_CSS : '') + '<div class="cs-sub">'
      + head('画面（改了以后回到窗台，会重新摆一次书桌，等几秒）')
      + '<div class="section" style="margin:0 12px">'
      + row('清晰度', '平时看整个窗台时', pills('dpr', [[1.25, '柔和省电'], [1.6, '1.6 推荐'], [2, '更清楚']]))
      + row('凑近时', '凑近某样东西时临时变清楚', pills('zoom', [[0, '不变'], [2.2, '2.2'], [2.6, '2.6 推荐']]))
      + row('每秒画面', '稳定 30 张更顺、不容易发热', pills('fps', [[30, '稳定 30 张'], [60, '不限']]))
      + sw('drop', '跑不动时自动降清晰度', '手机发热变慢时自己降一档，不卡')
      + '</div>'
      + head('效果（开了更好看，也更耗电、更容易发热）')
      + '<div class="section" style="margin:0 12px">'
      + sw('ao', '角落阴影细节', '缝隙、角落更有层次；测速时最耗电的一项')
      + sw('dof', '远处虚化', '像相机一样，远处糊一点')
      + sw('liveShadow', '影子跟着动', '每一张都重画影子；不开时影子只在太阳挪动时重画')
      + sw('softShadow', '柔和影子边', '影子边缘更柔')
      + sw('candleShadow', '蜡烛投影子', '蜡烛点着时在桌上投出影子')
      + sw('realLight', '作者原来的面光', '窗口和电脑屏幕的光用作者原来的做法；不开时用省电的替代光')
      + '</div>'
      + head('挂板亮度（左边那块板，回到窗台就能看到）')
      + '<div class="section" style="margin:0 12px">'
      + slider('wallBright', '照片', '拍立得、明信片、三连拍的三格')
      + slider('wallBrightMisc', '其他', '挂历、碎碎念便签、车票、纸胶带、花瓣')
      + '</div>'
      + '<div class="section" style="margin:16px 12px 0"><div class="it" style="justify-content:center;color:#e89db5" onclick="CoupleWindowsill.set(\'reset\')">恢复推荐设置</div></div>'
      + '</div></div>';
  }

  function mount() {
    if (holder) return;
    holder = document.createElement('div');
    holder.id = 'cw-holder';
    holder.innerHTML = '<style>#cw-holder{position:absolute;inset:0;z-index:150;background:#0d0b0a}#cw-holder iframe{position:absolute;left:0;right:0;top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px);width:100%;height:calc(100% - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));border:0;display:block;background:#0d0b0a}'
      + '#cw-wait{position:absolute;inset:0;z-index:1;background:#0d0b0a;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.7);font:14px -apple-system,"PingFang SC",sans-serif;pointer-events:none;transition:opacity .35s}#cw-holder.shown #cw-wait{opacity:0}</style>'
      + '<div id="cw-wait">正在摆好书桌…</div>'
      + '<iframe title="赴约 · 窗台" allow="autoplay" src="couple-windowsill/index.html?g=' + encodeURIComponent(gfxKey()) + '"></iframe>';
    holder.setAttribute('data-gfx', gfxKey());
    frame = holder.querySelector('iframe');
    // inside the phone screen, under the call screen, banners, modals, toasts and the remote-control layer (z-index 200 and up)
    (document.querySelector('.screen') || document.body).appendChild(holder);
  }
  function unmount() {
    if (!holder) return;
    ready = false; sentSong = null; clearInterval(ticker); ticker = 0; clearInterval(deskTimer); deskTimer = 0;
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
  // ---------- WINDOWSILL_DESK_V1 ----------
  function cp() { return S.couple || (S.couple = {}); }
  function him() { return cp().cid && typeof getC === 'function' ? getC(cp().cid) : null; }
  function dayKey(t) { var d = new Date(t || Date.now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function hhmm(t) { var d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function clip(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; }
  function nextAnniv() {
    var list = (cp().anniversaries || []).filter(function (a) { return a && a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date); }), now = new Date(), best = null;
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    list.forEach(function (a) {
      var m = +a.date.slice(5, 7) - 1, d = +a.date.slice(8, 10), t = new Date(now.getFullYear(), m, d);
      if (t < today) t = new Date(now.getFullYear() + 1, m, d);
      var left = Math.round((t - today) / 86400000);
      if (!best || left < best.left) best = {left: left, title: a.title || '纪念日'};
    });
    return best ? (best.left ? '还有' + best.left + '天 · ' : '今天 · ') + best.title : '';
  }
  function heIsOut(c) {
    try { if (!c || !c.sched || !c.sched.on || typeof activitySpec !== 'function') return false; var home = c.sched.home || '家', a = activitySpec(c); return !!(a && a.label && a.label.indexOf(home) < 0 && !/睡/.test(a.label)); } catch (e) { return false; }
  }
  function hisLatestMoment(c) {
    var list = (S.moments || []).filter(function (m) { return m && c && m.authorId === c.id && m.text; });
    list.sort(function (a, b) { return (b.time || 0) - (a.time || 0); });
    return list[0] || null;
  }
  // the season is whatever she last chose on the windowsill (not the calendar month)
  function season() { var s = S.settings && S.settings.windowsillSeason; return /^(spring|summer|autumn|winter)$/.test(s || '') ? s : null; }
  function deskData() {
    var c = him(), name = c ? (c.remark || c.name || '他') : '他', cards = {}, sl = S.me && S.me.sleep, sleeping = !!(sl && sl.active);
    var days = typeof coupleDays === 'function' && cp().startDate ? coupleDays(cp().startDate) : 0, anniv = nextAnniv();
    cards.cal = {note: (days ? '在一起第 ' + days + ' 天。' : '还没填在一起的日子。') + (anniv ? anniv + '。' : ''), go: '看纪念日'};
    var notes = cp().wsNotes && cp().wsNotes.notes || null;
    cards.notes = {note: notes ? name + '今天写的：' + notes.map(function (n) { return n.replace(/\n/g, ''); }).join('；') : name + '今天还没写碎碎念。', go: '去跟' + name + '聊聊'};
    cards.candle = {note: sleeping ? '你在睡觉（' + hhmm(sl.active) + ' 开始）。点上蜡烛，就是醒啦。' : '睡前吹灭蜡烛，就是跟' + name + '说晚安、开始记录睡眠。', go: sleeping ? '点上蜡烛（醒啦）' : '吹灭蜡烛（说晚安）'};
    var book = ((S.cinema && S.cinema.sessions) || []).filter(function (x) { return x && x.kind === 'book'; }).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })[0];
    cards.book = {note: book ? '你们在读《' + clip(book.title, 16) + '》，' + (typeof cinemaProgressText === 'function' ? cinemaProgressText(book) : '') + '。' : '还没有一起读的书，去放映室挑一本。', go: '去共读'};
    /* WS_HEALTH_LAST_V1（2026-10-30 她说：窗台热茶一直显示没同步，很久没戴手表也该显示之前的心率）：以前只读角色正在查手机时的那份数据，平时永远是空的。
       现在没有角色查看数据时，读平时存着的伴生健康数据（会保留上一次的心率），并写上心率测量时间。 */
    var st = (typeof companionRoleDataState === 'function' && companionRoleDataState()) || (S.couple && typeof companionState === 'function' ? companionState() : null), hh = st && st.health;
    var hrAt = hh && +hh.heartRateAt ? (typeof fmtDT === 'function' ? fmtDT(+hh.heartRateAt) : new Date(+hh.heartRateAt).toLocaleString()) : '';
    cards.mug = {note: hh && typeof companionHealthSummary === 'function' ? clip(companionHealthSummary(hh, true), 80) + (hrAt ? '（心率测于 ' + hrAt + '）' : '') : '健康数据还没同步过来。', go: '看健康'};
    var unread = (S.mail || []).filter(function (m) { return m && !m.read; }).length;
    cards.letter = {note: unread ? '有 ' + unread + ' 封信还没拆，窗台上落了一只纸飞机。' : '信都拆过了。', go: '打开信箱'};
    cards.toys = {go: '去游戏大厅'};
    var trips = ((S.travel && S.travel.trips) || []).filter(function (t) { return t && t.date; }), trip = trips[trips.length - 1];
    cards.trips = {note: trip ? '最近一次出门：' + trip.date + ' ' + (trip.from || '') + (trip.to ? '→' + trip.to : '') + '。' : '还没有出门的记录。', go: '看出门'};
    var out = heIsOut(c), act = null; try { act = c && typeof activitySpec === 'function' ? activitySpec(c) : null; } catch (e) {}
    cards.where = {note: (act && act.label ? name + '现在' + act.label + '。' : '') + (out ? '千纸鹤跟着' + name + '飞出去了。' : '千纸鹤停在书上，' + name + '在家。'), go: '看' + name + '在哪'};
    var mo = hisLatestMoment(c), fresh = !!(mo && mo.id !== cp().wsSeenMoment && Date.now() - (mo.time || 0) < 3 * 86400000);
    cards.space = {note: mo ? (fresh ? name + '发了新动态：' : name + '最近的动态：') + '「' + clip(mo.text, 40) + '」' : name + '最近没发动态。', go: '去' + name + '的朋友圈'};
    cards.jar = {note: '罐子里有 ' + Math.max(0, +(S.taskNotes && S.taskNotes.stars) || 0) + ' 颗星星，做完任务星星就会多。', go: '打开任务便签'};
    cards.maple = {note: '这张书桌是唐幡（TangfanOVO）做的「赴约 · 窗台」，开源分享，经她同意放进了小手机。谢谢她。', go: '去唐幡的 GitHub 看看'};
    var w = cp().wsWeather;
    return {type: 'windowsill:data', cards: cards, notes: notes, days: days, anniv: anniv, out: out, season: season(), chimeNew: fresh, letterUnread: unread,
      weather: w && w.data || null, candleLit: !sleeping};
  }
  function deskReport() { post(deskData()); }

  // his 碎碎念 on the note board: one call to the side model a day, the first time she opens the windowsill that day
  var notesBusy = false;
  function cleanNote(t) {
    // a note holds 3 lines of 6 characters: longer lines wrap every 6 characters, anything past the third line is dropped
    var lines = [];
    String(t || '').replace(/[“”"「」]/g, '').split(/\n|\\n|\/|｜/).forEach(function (l) { l = l.trim(); for (var i = 0; i < l.length; i += 6) lines.push(l.slice(i, i + 6)); });
    return lines.filter(Boolean).slice(0, 3).join('\n');
  }
  // only once she has been looking at the windowsill for a few seconds (a locked app bouncing her here for a moment,
  // or passing through, does not spend a model call); never while it is parked
  var notesTimer = 0;
  function ensureNotes() { clearTimeout(notesTimer); notesTimer = setTimeout(function () { if (holder && ready && !parked && onWindowsill()) writeNotes(); }, 4000); }
  async function writeNotes() {
    var p = cp(), c = him(), today = dayKey();
    if (notesBusy || !c || (p.wsNotes && p.wsNotes.day === today) || p.wsNotesTried === today || typeof dyAuxGen !== 'function') return;
    notesBusy = true; p.wsNotesTried = today; save();
    try {
      var name = c.name || '你', persona = clip(c.persona || c.desc || '', 700);
      var recent = (typeof msgs === 'function' ? msgs(c.id) : []).filter(function (m) { return m && (m.type === 'text' || !m.type) && m.content; }).slice(-12)
        .map(function (m) { return (m.role === 'user' ? 'North' : '你') + '：' + clip(m.content, 50); }).join('\n');
      var wx = S.weather && S.weather.desc ? '，' + (S.weather.place || '') + S.weather.desc + (S.weather.temp != null ? S.weather.temp + '度' : '') : '';
      var messages = [
        {role: 'system', content: '你是' + name + '。' + persona + '\n你在给 North 写便签，贴在你们窗台边的挂板上。'},
        {role: 'user', content: '今天是' + new Date().toLocaleDateString('zh-CN') + wx + '。最近你们聊过：\n' + (recent || '（今天还没聊）') +
          '\n\n用你自己的口吻写 3 张便签给 North，是今天的碎碎念：日常小事、叮嘱、想她。每张最多 3 行，每行最多 6 个字，行与行之间用换行分开；不要表情符号，不要落款。' +
          '只输出 JSON 数组，例如 ["降温了\\n记得加衣服", "晚上想吃\\n你做的面"]'}
      ];
      var list = await dyAuxGen(messages, {}, function (r) {
        var m = String(r || '').match(/\[[\s\S]*\]/); if (!m) return null;
        var a; try { a = JSON.parse(m[0]); } catch (e) { return null; }
        a = (Array.isArray(a) ? a : []).map(cleanNote).filter(Boolean).slice(0, 3);
        return a.length ? a : null;
      }, 2);
      p.wsNotes = {day: today, notes: list}; save(); deskReport();
    } catch (e) {} finally { notesBusy = false; }
  }

  // real weather where she is: the same open-meteo source as the small phone's weather, every half hour
  var wxBusy = false;
  function ensureWeather() {
    var p = cp();
    if (wxBusy || (p.wsWeather && Date.now() - p.wsWeather.at < 30 * 60000) || !navigator.geolocation) return;
    wxBusy = true;
    navigator.geolocation.getCurrentPosition(async function (pos) {
      try {
        var u = 'https://api.open-meteo.com/v1/forecast?latitude=' + pos.coords.latitude.toFixed(3) + '&longitude=' + pos.coords.longitude.toFixed(3) +
          '&current=weather_code,precipitation,rain,showers,snowfall,wind_speed_10m&wind_speed_unit=ms';
        var w = await fetch(u).then(function (r) { return r.json(); }), cu = (w && w.current) || {}, code = +cu.weather_code || 0;
        p.wsWeather = {at: Date.now(), data: {windMs: +cu.wind_speed_10m || 0, rainMmH: ((+cu.rain || 0) + (+cu.showers || 0)) || (+cu.precipitation || 0), snowCmH: +cu.snowfall || 0, thunder: code >= 95}};
        save(); deskReport();
      } catch (e) {} finally { wxBusy = false; }
    }, function () { wxBusy = false; }, {timeout: 8000, maximumAge: 600000});
  }

  // the candle: blowing it out is goodnight (starts sleep), lighting it is waking up. No confirm and no toast (she: 灰色的不要);
  // the flame going out or coming back is the answer.
  function candle() {
    var sl = S.me && S.me.sleep, sleeping = !!(sl && sl.active), keep = window.toast;
    try { window.toast = function () {}; if (!sleeping) { if (typeof sleepStart === 'function') sleepStart(); } else if (typeof sleepEnd === 'function') sleepEnd(); }
    finally { window.toast = keep; }
    post({type: 'windowsill:candleSet', lit: !(S.me.sleep && S.me.sleep.active)}); deskReport();
  }

  // each card's button opens the matching page of the small phone
  function openDesk(key) {
    var c = him(), app = function (k, alt) { if (typeof openApp === 'function') openApp(k); else go(alt || k); };
    if (key === 'cal' || key === 'mug') go('couple', {list: 1});
    else if (key === 'notes') { if (c && typeof openChat === 'function') openChat(c.id); }
    else if (key === 'book') app('cinema');
    else if (key === 'letter') app('mail');
    else if (key === 'toys') app('games', 'gameshub');
    else if (key === 'trips') app('travel');
    else if (key === 'where') { if (c) go('livemap', {id: c.id}); }
    else if (key === 'space') { var mo = hisLatestMoment(c); if (mo) { cp().wsSeenMoment = mo.id; save(); } if (c) go('roleMoments', {id: c.id}); }
    else if (key === 'jar') go('tasks');
  }

  // 相册: five places on the board
  function wallPhotos() { var c = cp(); if (!Array.isArray(c.wallPhotos)) c.wallPhotos = []; while (c.wallPhotos.length < 5) c.wallPhotos.push(''); return c.wallPhotos; }
  // 挂板亮度：她在窗台相册卡上拖的值（0 = 作者原样，最多 100），跟照片一起记在情侣空间里
  function wallBright(k) { var v = +(S.couple || {})[k || 'wallBright']; return v >= 0 && v <= 100 ? Math.round(v) : 0; }
  function sendPhotos() {
    var raw = wallPhotos().slice(0, 5), keys = raw.filter(function (v) { return typeof isStoredImgRef === 'function' && isStoredImgRef(v); }).map(function (v) { return String(v).slice(4); });
    var finish = function (found) {
      post({type: 'windowsill:photos', list: raw.map(function (v) {
        if (typeof isStoredImgRef === 'function' && isStoredImgRef(v)) v = (found && found[String(v).slice(4)]) || (typeof storedImageDisplaySource === 'function' ? storedImageDisplaySource(v) : '');
        return typeof v === 'string' && v.indexOf('data:image/') === 0 ? v : '';
      }), bright: wallBright(), brightMisc: wallBright('wallBrightMisc')});
    };
    if (keys.length && typeof imgMany === 'function') imgMany(keys).then(finish, function () { finish({}); }); else finish({});
  }
  var deskTimer = 0;

  // WINDOWSILL_KEEP_V1: leaving the windowsill parks it (hidden, drawing paused) instead of closing it, so coming back is instant
  // (she: 每一次进入返回都要重新读取). After 10 minutes away it is closed for real to give the memory back.
  var parked = false, parkTimer = 0, PARK_MS = 10 * 60000;
  function park() {
    if (!holder || parked) return;
    parked = true; holder.style.display = 'none'; clearTimeout(notesTimer);
    try { if (frame) frame.contentWindow.postMessage({type: 'windowsill:pause'}, '*'); } catch (e) {}
    clearInterval(ticker); ticker = 0; clearInterval(deskTimer); deskTimer = 0;
    clearTimeout(parkTimer); parkTimer = setTimeout(function () { parked = false; unmount(); }, PARK_MS);
  }
  function unpark() {
    if (!holder || !parked) return;
    parked = false; clearTimeout(parkTimer); holder.style.display = '';
    try { if (frame) frame.contentWindow.postMessage({type: 'windowsill:resume'}, '*'); } catch (e) {}
    if (ready) {
      report(); clearInterval(ticker); ticker = setInterval(report, 1000);
      sendLock(); deskReport(); ensureWeather(); ensureNotes();
      clearInterval(deskTimer); deskTimer = setInterval(function () { deskReport(); ensureWeather(); }, 30000);
    }
  }
  function sync() {
    if (onWindowsill()) {
      if (holder && holder.getAttribute('data-gfx') !== gfxKey()) { parked = false; clearTimeout(parkTimer); unmount(); }   // picture settings changed: set the desk up again
      if (holder && parked) unpark(); else mount();
      if (brightDirty && ready) { brightDirty = false; sendPhotos(); }
    } else park();
  }
  function fallBack(msg) { failed = true; parked = false; clearTimeout(parkTimer); unmount(); render(); if (msg && typeof toast === 'function') toast(msg); }

  window.addEventListener('message', function (e) {
    if (!frame || e.source !== frame.contentWindow) return;
    var d = e.data || {};
    if (d.type === 'windowsill:ready') {
      if (holder) holder.classList.add('shown'); sendLock();
      ready = true; lastPet = 0; report(); clearInterval(ticker); ticker = setInterval(report, 1000);
      deskReport(); sendPhotos(); ensureWeather(); ensureNotes();
      clearInterval(deskTimer); deskTimer = setInterval(function () { deskReport(); ensureWeather(); }, 30000);
    }
    else if (d.type === 'windowsill:music') { music(d.cmd); }
    else if (d.type === 'windowsill:candle') { candle(); }
    else if (d.type === 'windowsill:season' && /^(spring|summer|autumn|winter)$/.test(d.season || '')) { if (!S.settings) S.settings = {}; if (S.settings.windowsillSeason !== d.season) { S.settings.windowsillSeason = d.season; save(); } }
    else if (d.type === 'windowsill:open' && d.key && d.key !== 'phone' && d.key !== 'music') { openDesk(d.key); }
    else if (d.type === 'windowsill:photo') {
      var slot = +d.slot;
      if (slot >= 0 && slot < 5 && (d.data === '' || (typeof d.data === 'string' && d.data.indexOf('data:image/') === 0))) { wallPhotos()[slot] = d.data; save(); }
    }
    else if (d.type === 'windowsill:open' && d.key === 'music') { if (typeof openApp === 'function') openApp('music'); else go('music'); }
    else if (d.type === 'windowsill:back') { if (onWindowsill()) back(); }
    else if (d.type === 'windowsill:open' && d.key === 'phone') { go('couple', {list: 1}); }
    else if (d.type === 'windowsill:lost') { if (++reloads > 2) fallBack('3D 窗台加载不稳定，先用原来的情侣空间'); else { parked = false; clearTimeout(parkTimer); unmount(); sync(); } }
    else if (d.type === 'windowsill:nogl') { fallBack('这台设备打不开 3D 窗台，先用原来的情侣空间'); }
  });

  // The windowsill page itself: the old couple space stays the same and becomes the「设置与授权」list.
  var coreRenderCouple = renderCouple;
  renderCouple = function () {
    var html = coreRenderCouple.apply(this, arguments);
    var c = cur();
    if (c && c.list && c.gfx) return gfxPage();
    if (c && c.list) {
      // COUPLE_REDESIGN_V1: the 窗台画面 entry is one more row at the bottom of 甜蜜日常 (the slot is only on the card home page)
      var bar = '<div class="cs-row" onclick="go(\'couple\',{list:1,gfx:1})"><span class="ic"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#e9e2e5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 13l5-4 4 3 3-2 6 4"/><path d="M8 21h8"/></svg></span><div class="tx"><b class="serif">窗台画面</b><small>清晰度、每秒张数、影子效果、挂板亮度</small></div><span class="ar">›</span></div>';
      return html.replace('<div id="cou_extra_slot"></div>', '<div id="cou_extra_slot">' + bar + '</div>');
    }
    return failed ? html : '<div style="position:absolute;inset:0;background:#0d0b0a"></div>';
  };
  var coreRender = render;
  render = function () { var r = coreRender.apply(this, arguments); try { sync(); } catch (e) {} return r; };
  document.addEventListener('visibilitychange', function () { if (document.hidden) park(); else sync(); });
  window.CoupleWindowsill = {sync: sync, mounted: function () { return !!holder; }, set: gfxSet, bright: brightSet};
})();
