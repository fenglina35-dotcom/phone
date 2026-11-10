// HOME_GLASS_FRESH_V1 (2026-11-05, fourth attempt with a different diagnosis): on iPhone the lens images already attached
// to widgets are wiped to black when she switches apps or memory is tight; their width/height stay, so the old code kept
// reusing them, and when a redraw failed it also kept the stale (black) one. Now a failed redraw removes the old lens
// (frosted fallback, never black), and returning to the app, losing the GL context, or coming back to the home page all
// redraw fresh images, with follow-up passes at about 1 s and 4 s.
// Verified in a real page: blackened lenses are replaced in all three paths; with drawing failing all widgets are frosted.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES } from './_helpers.mjs';

function fakeHost(withCanvas, key) {
  const classes = new Set(['lg-host', 'lg-ready']);
  const host = { isConnected: true, parentElement: { closest: () => null }, classList: { add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)) }, classes };
  host.canvas = withCanvas ? { width: 10, height: 10, dataset: { lgKey: key }, isConnected: true, remove() { host.canvas = null; this.isConnected = false; } } : null;
  host.querySelector = () => host.canvas;
  return host;
}

for (const [label, file] of BUNDLES) {
  const src = read(file);
  const ctx = vm.createContext({ Math, window: { devicePixelRatio: 2 }, _lg: { cache: new Map() } });
  vm.runInContext(['lgDropLens', 'lgApply', 'lgFree'].map(n => fnSource(src, n)).join('\n'), ctx);
  Object.assign(ctx, { lgStyle() {}, lgGeometry: () => ({ w: 10, h: 10 }), lgKey: () => 'k-new', lgTexture: async () => true,
    lgBake: () => null, lgCanvasOk: () => false, lgFreeCache() {}, lgRemember() {}, lgAttachTo() {} });
  const stale = fakeHost(true, '');
  const ok = await ctx.lgApply({}, [stale], 'wall', {});
  assert.equal(ok, false);
  assert.equal(stale.canvas, null, `${label}: a failed redraw removes the old (possibly black) lens`);
  assert.ok(!stale.classes.has('lg-ready'), `${label}: the widget falls back to its frosted look`);

  ctx.lgTexture = async () => false;
  const stale2 = fakeHost(true, '');
  await ctx.lgApply({}, [stale2], 'wall', {});
  assert.equal(stale2.canvas, null, `${label}: wallpaper not readable also drops the stale lens`);

  const resume = fnSource(src, 'lgResumeRedraw');
  assert.match(resume, /_lg\.fresh1=setTimeout\(\(\)=>lgResumeRedraw\(true\),1200\);_lg\.fresh2=setTimeout\(\(\)=>lgResumeRedraw\(true\),4000\);/, `${label}: follow-up redraws`);
  assert.match(src, /_lg\.texs\.clear\(\);if\(typeof document!=='undefined'&&!document\.hidden&&typeof lgResumeRedraw==='function'\)setTimeout\(lgResumeRedraw,800\);/, `${label}: redraw after the GL context is taken`);
  assert.match(fnSource(src, 'lgAfterRender'), /if\(!was\)\{lgFreeCache\(\);desk\.querySelectorAll\('canvas\.lg-canvas'\)\.forEach\(c=>\{c\.dataset\.lgKey='';\}\);/, `${label}: coming back to home redraws fresh`);
}
console.log('home glass fresh tests passed');

// Returning from background must discard wallpaper textures too, even if GL reports healthy.
for(const [label,file] of BUNDLES){let deleted=0;const textures=new Map([['wall',{tex:{}}]]),c=vm.createContext({_lg:{texs:textures,gl:{deleteTexture(){deleted++;}},cache:new Map()},document:{hidden:false,querySelectorAll:()=>[]},lgActive:()=>true,lgFreeCache(){},lgSoon(){},lgDropLens(){}});vm.runInContext(fnSource(read(file),'lgResumeRedraw'),c);c.lgResumeRedraw(true);assert.equal(textures.size,0,label+': stale GPU wallpaper must be reuploaded');assert.equal(deleted,1);}
