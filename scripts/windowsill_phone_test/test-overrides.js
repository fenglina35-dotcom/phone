/* 窗台测速专用（只在 scripts/windowsill_phone_test 的测试版里，App 里没有）：
   shell.js 先按 App 的值设好画质，这里再按地址里的参数改，方便同一个页面试不同画质。
   dpr=清晰度上限  lowfps=每秒低于几帧才降一档（1 = 不降）  lowpr=降档后的清晰度  dof=景深虚化强弱 */
(function () {
  var q = new URLSearchParams(location.search);
  function n(k) { var v = q.get(k); return v === null || v === '' || isNaN(+v) ? null : +v; }
  var d = n('dpr'), f = n('lowfps'), p = n('lowpr'), o = n('dof');
  if (d !== null) window.__WS_DPR_MAX = d;
  if (f !== null) window.__WS_LOWQ_FPS = f;
  if (p !== null) window.__WS_LOWQ_PR = p;
  if (o !== null) window.__WS_DOF = o;
})();
