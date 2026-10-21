/* 小手机 · 窗台外壳（COUPLE_WINDOWSILL_V1）
   作者唐幡（TangfanOVO）的「赴约 · 窗台」原样不改，这一层只做小手机需要的事：
   1. App 里是本地文件，不能用 fetch 读模型：场景要 ./models/*.gltf.json 时，从打包好的 window.__WS_MODELS 里给。
   2. 画质（WINDOWSILL_STEADY30_V1，她在 iPhone 15 上用测速网页 scripts/windowsill_phone_test 试了五轮后选的）：
      清晰度 1.6（省电 1.25），每秒最多画 30 张；影子只画一次、太阳挪动时才重画；不要阴影细节和景深虚化；影子边简单；
      蜡烛不投影子；两盏面光换成便宜的光（窗口照进来一道柔光＋电脑屏幕前一盏小灯），玻璃保留。
      这些开关由 scripts/build_couple_windowsill.mjs 在打包时接进上游脚本（上游文件不改）。
   3. 底色改深色：上游底色是浅米白，画面清空或重新调整大小时会闪白。3D 画面被系统回收时通知外面重新加载。
   4. 去掉标题下的「草稿 · 演示数据」（她要求）；左上角只有一个小箭头「返回」，凑近某样东西时让位给上游的「退回」。
   5. 桌上的手机：屏幕画她的锁屏（壁纸、日期、时间）；点一下翻过来亮起，再点一下屏幕（或卡片上的「进入小手机」）进入小手机。
   6. 打不开 WebGL 时告诉外面退回原来的情侣空间。
   7. 一起听：电脑屏幕上放的是小手机「音乐」里真正在放的歌（外面每秒报一次），卡片上有上一首 / 播放暂停 / 下一首，点了让外面的播放器去做。
   9. WINDOWSILL_DESK_V1：桌上的东西接小手机（她定的对照表）：挂历=在一起天数和纪念日，便签=他每天的碎碎念，蜡烛=晚安/睡眠（先问），
      书=共读，茶=健康，千纸鹤=他在哪（出门就飞走），风铃=他有新动态时自己晃，信=信箱，木盒=游戏大厅，手帐=出门，星星罐=任务便签的星星，
      盆景=致谢作者；天气跟她所在地的真实天气，季节她自己调、会记住。挂板上五个地方放她的照片（相册），点了放大看。
   8. 窗台上的透卡去掉（她觉得多余）；流麻牌上的小家伙换成小手机的桌宠小橘（pet.js 里的动图帧，由 scripts/build_couple_windowsill_pet.cjs 生成）；
      信=信箱，有没拆的信时窗台上才落下纸飞机；
      角色或她让桌宠做的表情、桌宠睡着、正在放歌，卡上跟着变；点一下换一个表情。帧图没加载好时仍是上游的颜文字。
   这一层和场景一样按 AGPL-3.0 提供，见同目录 UPSTREAM.md。 */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  // WINDOWSILL_STEADY30_V1: the setting she picked on her iPhone 15 (「新方案，清晰度 1.6，稳定 30 张」) is the default.
  // WINDOWSILL_GFX_PAGE_V1: her 「窗台画面」 page in the small phone can change each of them; it arrives as ?g={...}
  var G = {dpr: 1.6, zoom: 2.6, fps: 30, drop: true, ao: false, dof: false, liveShadow: false, softShadow: false, candleShadow: false, realLight: false};
  try { var gq = JSON.parse(q.get('g') || '{}'); Object.keys(G).forEach(function (k) { if (typeof gq[k] === typeof G[k]) G[k] = gq[k]; }); } catch (e) {}
  if (q.get('saver') === '1') G.dpr = 1.25;
  G.dpr = Math.min(2.6, Math.max(1, +G.dpr || 1.6));
  var saver = G.dpr <= 1.25;
  window.__WS_DPR_MAX = G.dpr;
  window.__WS_LOWQ_FPS = G.drop ? 14 : 1;   // capped at 30, so only drop a tier when it really cannot keep up (1 = never drop)
  window.__WS_LOWQ_PR = saver ? 1 : 1.25;
  window.__WS_ZOOM_PR = G.zoom > 0 ? Math.min(2.6, G.zoom) : G.dpr;   // close-ups turn sharp (0 = stay as the overview)
  window.__WS_DOF = .45;
  window.__WS_SHADOW_FREEZE = !G.liveShadow; // shadows drawn once, again only when the sun moves
  window.__WS_NO_AO = !G.ao;                 // no ambient-occlusion pass
  window.__WS_NO_DOF = !G.dof;               // no depth-of-field blur (also what made the room look blurry)
  window.__WS_PCF = !G.softShadow;           // plain shadow edges
  window.__WS_NO_CANDLE_SHADOW = !G.candleShadow;
  window.__WS_FAKE_AREA = !G.realLight;      // cheap stand-ins for the two area lights (the glass stays)
  window.__WS_QUIET_CANDLE = true;          // no 晚安 / 蜡烛点上了 bubble (she asked: no grey pop-ups on the candle)
  window.__WS_PHONE_COLOR = '#c98a98';      // the desk phone in pink metal (she asked); same metal finish as upstream
  window.__WS_PHONE_BACK = '#d9a7b1';       // frosted back glass, camera ring and side band follow the pink
  window.__WS_PHONE_RING = '#b47e8a';
  window.__WS_PHONE_BAND = '#9d6c78';
  window.__WS_NO_SILL_PET = true;           // no 透卡 on the sill: 小橘 lives on the 流麻牌 on the desk only

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opt) {
    var m = window.__WS_MODELS && window.__WS_MODELS[String(url)];
    if (m) return Promise.resolve(new Response(JSON.stringify(m), {status: 200, headers: {'Content-Type': 'application/json'}}));
    return realFetch ? realFetch(url, opt) : Promise.reject(new Error('offline'));
  };

  {   // at most 30 pictures a second unless she chose 不限 on the 窗台画面 page; parking (pause / resume) works either way (steady 30 felt smoother than 16-40).
      // One decision per display frame (by its timestamp), so every callback of that frame is let through or held together;
      // deciding per callback let the scene's loop take every slot and starved any other callback.
    var raf = window.requestAnimationFrame.bind(window), last = 0, seenT = -1, go = true, held = [];
    window.requestAnimationFrame = function (cb) {
      if (window.__WS_PAUSED) { held.push(cb); return 0; }   // parked while she is elsewhere in the small phone: draw nothing
      return raf(function step(t) {
        if (window.__WS_PAUSED) { held.push(cb); return; }
        if (t !== seenT) { seenT = t; go = G.fps !== 30 || t - last >= 31; if (go) last = t; }
        if (!go) return raf(step);
        cb(t);
      });
    };
    window.__WS_RESUME = function () { window.__WS_PAUSED = false; var h = held; held = []; h.forEach(function (cb) { window.requestAnimationFrame(cb); }); };
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

  // WINDOWSILL_DESK_V1: what is on the desk shows her real small phone (windowsill:data from outside), and each card's button
  // opens the matching page. Keyed by the card title (upstream TAGS fn; 梗库/我在哪/彩蛋 renamed at build time).
  var DESK = {'在一起': 'cal', '碎碎念': 'notes', '晚安': 'candle', '共读': 'book', '健康': 'mug', '信': 'letter', '玩具厅': 'toys', '出门走走': 'trips', '他在哪': 'where', '空间': 'space', '星星罐': 'jar', '致谢': 'maple'};
  var desk = null, chimeTimer = 0, seasonSet = '';
  var CN_MONTH = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
  // the wall calendar paper (240 x 320, the author's colours): month, days together, the next anniversary on the first line
  function drawCalendar(d) {
    var t = window.__WS_CAL_TEX, c = t && t.image; if (!c || !c.getContext || !d.days) return;
    var x = c.getContext('2d'), now = new Date(), F = function (wt, sz, fam) { return wt + ' ' + sz + 'px ' + (fam || 'system-ui, "PingFang SC", sans-serif'); };
    x.setTransform(c.width / 240, 0, 0, c.height / 320, 0, 0);
    x.fillStyle = '#ece5d8'; x.fillRect(0, 0, 240, 320);
    x.fillStyle = '#6e4a40'; x.fillRect(0, 0, 240, 34);
    x.fillStyle = '#efe7da'; x.font = F(500, 18); x.textAlign = 'center'; x.fillText(CN_MONTH[now.getMonth()].split('').join(' ') + ' 月', 120, 24);
    var n = String(d.days), fs = n.length > 3 ? 72 : 96;
    x.fillStyle = '#2f2b28'; x.font = F(600, fs, '"Songti SC", "Noto Serif CJK SC", serif'); x.fillText(n, 120, 170);
    x.fillStyle = '#6f6862'; x.font = F(400, 22); x.fillText('在一起 · 天', 120, 214);
    x.strokeStyle = '#cfc6b6'; x.lineWidth = 1; for (var i = 0; i < 3; i++) { x.beginPath(); x.moveTo(36, 248 + i * 22); x.lineTo(204, 248 + i * 22); x.stroke(); }
    if (d.anniv) { x.fillStyle = '#7a5c50'; x.font = F(400, 15); x.fillText(String(d.anniv).slice(0, 12), 120, 243); }
    x.setTransform(1, 0, 0, 1, 0, 0); t.needsUpdate = true;
  }
  function applyDesk() {
    var d = desk; if (!d || !window.fuyue) return;
    try {
      if (d.notes && d.notes.length) window.fuyue.setNotes(d.notes);
      drawCalendar(d);
      craneAway(!!d.out);   // flown off while he is out
      if (window.__WS_PLANE) window.__WS_PLANE.visible = d.letterUnread > 0;   // a paper plane lands on the sill while letters wait unopened
      window.fuyue.setFootprints(!!d.out);
      if (d.season && d.season !== seasonSet && window.__fy) { seasonSet = d.season; window.__fy.set({season: d.season}); }
      if (d.weather) window.fuyue.setWeather(d.weather);
      if (d.book) window.fuyue.setBookPage(d.book);
      if (typeof d.candleLit === 'boolean' && window.__WS_CANDLE_SET) window.__WS_CANDLE_SET(d.candleLit);
      clearInterval(chimeTimer);
      if (d.chimeNew && window.__fy) { window.__fy.swing(); chimeTimer = setInterval(function () { if (desk && desk.chimeNew) window.__fy.swing(); }, 25000); }
    } catch (e) {}
    if (window.__spRelabel) window.__spRelabel();
  }
  // the paper crane: hidden while he is out, but its place stays tappable through an invisible box (hidden things cannot be tapped)
  function craneAway(out) {
    var crane = window.__WS_CRANE, F = window.__fy; if (!crane || !F) return;
    if (!crane.userData.spProxy) {
      var T = F.THREE, box = new T.Box3().setFromObject(crane), size = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3()), k = crane.getWorldScale(new T.Vector3()).x || 1;
      var px = new T.Mesh(new T.BoxGeometry(Math.max(size.x, .6), Math.max(size.y, .6), Math.max(size.z, .6)), new T.MeshBasicMaterial({colorWrite: false, depthWrite: false}));
      px.position.copy(crane.worldToLocal(ctr)); px.scale.setScalar(1 / k); px.rotation.y = -crane.rotation.y; px.userData.key = 'where'; px.castShadow = false; px.receiveShadow = false;
      crane.add(px); crane.userData.spProxy = px;
    }
    crane.children.forEach(function (ch) { if (ch !== crane.userData.spProxy) ch.visible = !out; });
  }
  window.__WS_SEASON_CHANGED = function (s) { tell({type: 'windowsill:season', season: s}); };   // remembered by the small phone
  // the candle asks the small phone first (goodnight starts sleep there)
  window.__WS_CANDLE_TAP = function () { tell({type: 'windowsill:candle', lit: window.__WS_CANDLE_LIT ? window.__WS_CANDLE_LIT() : true}); };

  // 相册: five places on the board (0 拍立得, 1 明信片, 2-4 三连拍 top / middle / bottom), tap a photo to see it full size
  var PH_NAMES = ['拍立得', '明信片', '三连拍上', '三连拍中', '三连拍下'], photos = ['', '', '', '', ''], phImg = [null, null, null, null, null], phOrig = [null, null, null];
  // 挂板亮度（WINDOWSILL_BOARD_BRIGHT_V1）：她在小手机「窗台画面」页里拖，0 = 作者原样；照片三块一起调，其他贴图另一条，外层记住后随照片发来
  var phBright = 0, miscBright = 0, brTry = 0;   // miscBright: 挂板上其他的贴图（挂历、碎碎念、纸胶带、车票、玉兰花瓣）
  function applyBright(m) {
    var W = window.__WS_WALLPH, mesh = W && W[m]; if (!mesh) return false;
    var mat = mesh.material, t = mat.map, k = phBright / 100 * 1.2;
    if (k > 0) { if (mat.emissiveMap !== t) { mat.emissive && mat.emissive.set('#ffffff'); mat.emissiveMap = t; mat.needsUpdate = true; } mat.emissiveIntensity = k; }
    else if (mat.emissiveMap) { mat.emissiveMap = null; mat.emissiveIntensity = 0; mat.needsUpdate = true; }
    return true;
  }
  function glow(mat, k) {
    if (!mat || !mat.map || !('emissiveIntensity' in mat)) return;
    if (k > 0) { if (mat.emissiveMap !== mat.map) { mat.emissive && mat.emissive.set('#ffffff'); mat.emissiveMap = mat.map; mat.needsUpdate = true; } mat.emissiveIntensity = k; }
    else if (mat.emissiveMap) { mat.emissiveMap = null; mat.emissiveIntensity = 0; mat.needsUpdate = true; }
  }
  function applyMisc() {
    var L = window.__WS_BOARD_MISC; if (!L) return false;
    var k = miscBright / 100 * 1.2;
    L.forEach(function (o) { o && o.traverse && o.traverse(function (m) { if (m.isMesh) glow(m.material, k); }); });
    return true;
  }
  function applyBrightAll() {
    var ok = applyBright(0) & applyBright(1) & applyBright(2) & applyMisc();
    if (!ok && brTry++ < 40) setTimeout(applyBrightAll, 500);   // the board is built after the first message may arrive
  }
  function cover(g, img, x, y, w, h) {
    var k = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); g.restore();
  }
  function paperOf(i) { return i < 2 ? i : 2; }
  // redraw one paper at twice the author's size: her picture underneath, the photos on top
  function paintPaper(m) {
    var W = window.__WS_WALLPH, mesh = W && W[m]; if (!mesh) return;
    var t = mesh.material.map; if (!phOrig[m]) phOrig[m] = t.image;
    var o = phOrig[m], c = document.createElement('canvas'), K = 2; c.width = o.width * K; c.height = o.height * K;
    var g = c.getContext('2d'); g.drawImage(o, 0, 0, c.width, c.height);
    if (m === 0 && phImg[0]) cover(g, phImg[0], 14 * K, 14 * K, 172 * K, 172 * K);
    if (m === 1 && phImg[1]) { cover(g, phImg[1], 0, 0, c.width, c.height); g.fillStyle = 'rgba(236,230,220,.92)'; g.fillRect(0, 0, c.width, 8 * K); g.fillRect(0, c.height - 8 * K, c.width, 8 * K); g.fillRect(0, 0, 8 * K, c.height); g.fillRect(c.width - 8 * K, 0, 8 * K, c.height); }
    if (m === 2) for (var f = 0; f < 3; f++) if (phImg[2 + f]) cover(g, phImg[2 + f], 8 * K, (10 + f * 88) * K, 64 * K, 78 * K);
    t.image = c; t.dispose(); t.needsUpdate = true;   // a new size needs a fresh GPU texture
    if (mesh.material.emissiveMap) mesh.material.emissiveMap = null;   // the redrawn picture becomes the new glow map
    applyBright(m);
  }
  function setPhoto(i, url, keep) {
    photos[i] = url || '';
    if (!keep) tell({type: 'windowsill:photo', slot: i, data: url || ''});
    if (!url) { phImg[i] = null; paintPaper(paperOf(i)); if (window.__spRelabel) window.__spRelabel(); return; }
    var im = new Image();
    im.onload = function () { phImg[i] = im; paintPaper(paperOf(i)); if (window.__spRelabel) window.__spRelabel(); };
    im.src = url;
  }
  // a chosen file, shrunk to 1600 px on the long side
  function readPhoto(file, done) {
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        done(c.toDataURL('image/jpeg', .86));
      };
      im.onerror = function () { done(''); };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function pick(slots) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = slots.length > 1;
    inp.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    inp.onchange = function () {
      var files = [].slice.call(inp.files || [], 0, slots.length); inp.remove();
      files.forEach(function (f, n) { readPhoto(f, function (url) { if (url) setPhoto(slots[n], url); }); });
    };
    document.body.appendChild(inp); inp.click();
  }
  var viewer = null, viewing = -1;
  function openView(i) {
    if (!photos[i]) { pick([i]); return; }
    viewing = i; viewer.querySelector('img').src = photos[i]; viewer.querySelector('b').textContent = PH_NAMES[i];
    viewer.classList.add('on');
  }
  function closeView() { if (viewer) viewer.classList.remove('on'); viewing = -1; }
  // a photo on the board: once the camera is at the board it opens full size; otherwise the scene goes to the board first
  window.__WS_PHOTO_TAP = function (hit, focusKey) {
    if (focusKey !== 'photos' && focusKey !== 'notes' && focusKey !== 'cal') return false;
    var slot = hit.object && hit.object.userData && hit.object.userData.slot;
    if (slot == null) return false;
    if (slot === 2 && hit.uv) slot = hit.uv.y > .667 ? 2 : hit.uv.y > .353 ? 3 : 4;   // the strip's three cells
    openView(slot); return true;
  };

  window.addEventListener('message', function (e) {
    var dt = e.data || {};
    if (dt.type === 'windowsill:data') { desk = dt; applyDesk(); }
    else if (dt.type === 'windowsill:photos') { (dt.list || []).slice(0, 5).forEach(function (u, i) { if ((u || '') !== photos[i]) setPhoto(i, u, true); }); var nb = dt.bright >= 0 && dt.bright <= 100 ? +dt.bright : phBright, nm = dt.brightMisc >= 0 && dt.brightMisc <= 100 ? +dt.brightMisc : miscBright; if (nb !== phBright || nm !== miscBright) { phBright = nb; miscBright = nm; brTry = 0; applyBrightAll(); } }
    else if (dt.type === 'windowsill:candleSet' && window.__WS_CANDLE_SET) window.__WS_CANDLE_SET(!!dt.lit);
    else if (dt.type === 'windowsill:pause') window.__WS_PAUSED = true;
    else if (dt.type === 'windowsill:resume' && window.__WS_RESUME) window.__WS_RESUME();
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
      + '#sp-ph{display:none;margin-top:10px;gap:8px;justify-content:space-between}body.sp-photos #sp-ph{display:flex}'
      + '#sp-ph button{flex:1;min-width:0;border:0;padding:0;background:none;color:#fffdf9;font:inherit;font-size:11px;text-shadow:inherit;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer}'
      + '#sp-ph i{display:block;width:100%;aspect-ratio:1;border-radius:9px;background:center/cover no-repeat;box-shadow:0 0 0 1px rgba(255,255,255,.55),0 2px 8px rgba(18,14,10,.35)}'
      + '#sp-ph i.empty{background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.45);position:relative}#sp-ph i.empty:after{content:"+";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:24px;font-style:normal;font-weight:300}'
      + '#sp-view{position:absolute;inset:0;z-index:60;background:rgba(8,7,6,.94);display:none;flex-direction:column;align-items:center;justify-content:center;color:#fffdf9;text-shadow:0 0 1px rgba(22,18,14,.95),0 1px 6px rgba(18,14,10,.5)}#sp-view.on{display:flex}'
      + '#sp-view img{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:calc(100% - 24px);max-height:calc(100% - 200px);object-fit:contain;border-radius:6px;box-shadow:0 10px 40px rgba(0,0,0,.5)}'
      + '#sp-view b{position:absolute;top:calc(env(safe-area-inset-top,0px) + 22px);font-size:15px;font-weight:700;letter-spacing:.04em}'
      + '#sp-view div{position:absolute;left:24px;right:24px;bottom:calc(env(safe-area-inset-bottom,0px) + 22px);display:flex;border-top:1px solid rgba(255,255,255,.22)}'
      + '#sp-view div button{flex:1;min-height:48px;border:0;background:none;color:#fffdf9;font:inherit;font-size:14px;text-shadow:inherit;cursor:pointer}'
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
    // 相册: five thumbnails on the card, and a full-size viewer
    var ph = document.createElement('div'); ph.id = 'sp-ph';
    ph.innerHTML = PH_NAMES.map(function (n, i) { return '<button type="button" data-i="' + i + '"><i></i><span>' + n + '</span></button>'; }).join('');
    if (goB) goB.parentNode.insertBefore(ph, goB);
    ph.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('button[data-i]'); if (!b) return; e.stopPropagation(); openView(+b.getAttribute('data-i')); });
    viewer = document.createElement('div'); viewer.id = 'sp-view';
    viewer.innerHTML = '<b></b><img alt=""><div><button type="button" data-v="swap">换一张</button><button type="button" data-v="drop">撤下</button><button type="button" data-v="close">关上</button></div>';
    viewer.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-v]'), i = viewing; e.stopPropagation();
      if (b && b.getAttribute('data-v') === 'swap') { closeView(); pick([i]); }
      else if (b && b.getAttribute('data-v') === 'drop') { closeView(); setPhoto(i, ''); }
      else closeView();
    });
    (document.getElementById('app') || document.body).appendChild(viewer);
    var thumbsShown = '';
    function paintThumbs() {
      var key = photos.map(function (u) { return u ? u.length + u.slice(-24) : ''; }).join('|');
      if (key === thumbsShown) return; thumbsShown = key;
      [].forEach.call(ph.querySelectorAll('i'), function (el, i) { el.className = photos[i] ? '' : 'empty'; el.style.backgroundImage = photos[i] ? 'url("' + photos[i] + '")' : ''; });
    }
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
      var music = cardIs(MUSIC_TITLE), photoCard = cardIs('相册');
      document.body.classList.toggle('sp-music', music);
      document.body.classList.toggle('sp-photos', photoCard);
      if (photoCard) {
        paintThumbs();
        var n = photos.filter(Boolean).length;
        setText(note, n ? '墙上贴着你的 ' + n + ' 张照片。点墙上的照片或下面的小图放大看，放大后可以换一张或撤下。' : '拍立得、明信片和三连拍的三格，一共五个地方可以放你自己的照片。点下面的小图选一张，或者一次选几张按顺序贴上去。');
      }
      var tk = document.getElementById('k-title'), dk = tk && DESK[tk.textContent];
      if (dk && desk && desk.cards && desk.cards[dk]) { var cd = desk.cards[dk]; if (cd.note) setText(note, cd.note); if (cd.go) setText(goT, cd.go); }
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
      if (cardIs('相册')) { e.stopImmediatePropagation(); e.preventDefault(); pick([0, 1, 2, 3, 4]); return; }
      var tk = document.getElementById('k-title'), dk = tk && DESK[tk.textContent];
      if (dk && dk !== 'candle' && dk !== 'maple') { e.stopImmediatePropagation(); e.preventDefault(); tell({type: 'windowsill:open', key: dk}); return; }
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
  window.addEventListener('load', function () { setTimeout(function () { tell({type: 'windowsill:ready'}); }, 400); });
})();
