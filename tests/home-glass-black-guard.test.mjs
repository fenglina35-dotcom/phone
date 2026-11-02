// HOME_GLASS_BLACK_GUARD_V1：主屏组件玻璃画出纯黑就不贴（组件保持半透明）、丢掉壁纸贴图重读，并记下原因；一键体检能看到。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES } from './_helpers.mjs';

const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
function fakeGL(pixel) {
  const calls = { deleted: 0 };
  const gl = new Proxy({ TRIANGLE_STRIP: 5, ARRAY_BUFFER: 1, FLOAT: 2, TEXTURE0: 3, TEXTURE_2D: 4, COLOR_BUFFER_BIT: 6, RGBA: 7, UNSIGNED_BYTE: 8,
    readPixels: (x, y, w, h, f, t, px) => px.set(pixel), deleteTexture: () => { calls.deleted++; }, getAttribLocation: () => 0, getUniformLocation: () => ({}) },
  { get: (o, k) => (k in o ? o[k] : () => {}) });
  return { gl, calls };
}

for (const [label, file] of BUNDLES) {
  const src = read(file);
  const run = (pixel) => {
    const { gl, calls } = fakeGL(pixel), ls = store(), drew = [];
    const _lg = { canvas: { width: 100, height: 100 }, prog: {}, buf: {}, texs: new Map([['wall', { tex: {}, w: 100, h: 200 }]]) };
    const ctx = vm.createContext({ localStorage: ls, lgGL: () => gl, _lg, Math, Uint8Array, JSON, Date, String });
    const names = ['lgDraw'].concat(src.includes('function lgLog(') ? ['lgLog', 'lgDiagRows'] : []);
    vm.runInContext(names.map((n) => fnSource(src, n)).join('\n') + ';this.draw=lgDraw;this.rows=typeof lgDiagRows==="function"?lgDiagRows:()=>[];', ctx);
    const target = { width: 50, height: 40, getContext: () => ({ clearRect() {}, drawImage() { drew.push(1); } }) };
    const g = { src: 'wall', w: 50, h: 40, x: 0, y: 0, radius: 10, dw: 390, dh: 840, opt: {} };
    const cfg = { thick: 22, edgeBlur: 1, tint: .16, sat: 1.1, hi: 1, rim: .6, tone: 'black', angle: 128, blur: 1.2, ior: 1.4, bend: 1.4, disp: .03 };
    const ok = ctx.draw(g, cfg, 0, 0, target, 1);
    return { ok, drew: drew.length, texLeft: _lg.texs.size, deleted: calls.deleted, rows: Array.from(ctx.rows()) };
  };

  test(label + ' a lens that comes out pure black is not attached, the wallpaper texture is reloaded, and the reason is logged', () => {
    const r = run([0, 0, 0, 255]);
    assert.equal(r.ok, false, '纯黑不贴上去');
    assert.equal(r.drew, 0);
    assert.equal(r.texLeft, 0, '丢掉贴图，下次重读');
    assert.equal(r.deleted, 1);
    assert.equal(r.rows.length, 1); assert.equal(r.rows[0].kind, 'black');
  });

  test(label + ' a normal lens is attached as before', () => {
    const r = run([120, 110, 100, 255]);
    assert.equal(r.ok, true); assert.equal(r.drew, 1); assert.equal(r.texLeft, 1); assert.equal(r.rows.length, 0);
  });

  test(label + ' 一键体检 has a 主屏玻璃 item that shows recent failures', async () => {
    assert.match(src, /\{id:'glass',group:'基础',title:'主屏玻璃'\}/);
    const i = src.indexOf('async glass(){'), body = src.slice(i, src.indexOf('},\n', i) + 1);
    assert.ok(i > 0, '缺少 glass 检查');
    const ctx = vm.createContext({ fmtDT: () => '11-02 20:00', Date, lgDiagRows: () => [] });
    vm.runInContext('this.check={' + body + '}.glass;', ctx);
    assert.equal((await ctx.check()).state, 'ok');
    ctx.lgDiagRows = () => [{ at: Date.now(), kind: 'black', detail: '画出来是纯黑' }];
    const r = await ctx.check();
    assert.equal(r.state, 'warn'); assert.match(r.why, /画出来是纯黑/);
  });
}
