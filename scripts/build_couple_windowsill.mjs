// COUPLE_WINDOWSILL_V1: build the private app's copy of 唐幡's "赴约 · 窗台" (third_party/qiaosi-windowsill).
// The upstream scene is an ES module that loads three.js from a CDN and fetches models; the private app opens
// local files, so everything is bundled into plain scripts: three.js + scene (windowsill.js), models (models.js).
// Upstream files are read as they are; nothing in third_party is rewritten.
// Usage: node scripts/build_couple_windowsill.mjs --tools <folder whose node_modules has esbuild@0.24.0 and three@0.170.0>
//        add --test-out <dir> to build only the phone speed-test copy (scripts/windowsill_phone_test), never the app's:
//        it also exposes the render passes as window.__WS_DEV and loads test-overrides.js (picture settings from the address).
import {readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'native/private-small-phone/third_party/qiaosi-windowsill');
const appOut = join(root, 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/couple-windowsill');
const oi = process.argv.indexOf('--test-out');
const testOut = oi >= 0 && process.argv[oi + 1] ? resolve(process.argv[oi + 1]) : null;
if (testOut && testOut.startsWith(join(root, 'native'))) throw new Error('测试版不能放进 App 的文件夹');
const out = testOut || appOut;
const ti = process.argv.indexOf('--tools');
if (ti < 0 || !process.argv[ti + 1]) throw new Error('需要 --tools <装了 esbuild 和 three 的文件夹>');
const tools = resolve(process.argv[ti + 1]);
const esbuild = await import(pathToFileURL(join(tools, 'node_modules/esbuild/lib/main.js')).href);
const threeVer = JSON.parse(readFileSync(join(tools, 'node_modules/three/package.json'), 'utf8')).version;
if (threeVer !== '0.170.0') throw new Error('上游用的是 three@0.170.0，这里是 ' + threeVer);

// the scene script, in the same order upstream build.mjs uses
const jsDir = join(src, 'src/js');
let js = readdirSync(jsDir).filter(f => f.endsWith('.js')).sort().map(f => readFileSync(join(jsDir, f), 'utf8')).join('');
// Two upstream constants read values set by smallphone/shell.js (quality cap; only drop quality when really slow).
// Each replacement must match exactly once, so an upstream change is noticed instead of silently skipped.
for (const [from, to] of [
  ['const DPR = Math.min(window.devicePixelRatio || 1, framed ? 2 : 1.6);', 'const DPR = Math.min(window.devicePixelRatio || 1, framed ? 2 : (window.__WS_DPR_MAX || 1.6));'],
  ['if (ftAcc / ftN > 1 / 34) goLowQ();', 'if (ftAcc / ftN > 1 / (window.__WS_LOWQ_FPS || 34)) goLowQ();'],
  // less depth-of-field blur: on a phone screen the strong camera blur reads as blurry (she: 其他的画面这么糊)
  ['bokeh.uniforms.aperture.value = ap; bokeh.uniforms.maxblur.value = mb;', 'bokeh.uniforms.aperture.value = ap * (window.__WS_DOF ?? 1); bokeh.uniforms.maxblur.value = mb * (window.__WS_DOF ?? 1);'],
  // the low tier keeps some sharpness instead of dropping to 1x for good
  ['renderer.setPixelRatio(1); composer.setPixelRatio(1); resize(); sun.shadow.mapSize.set(1024, 1024);', 'renderer.setPixelRatio(window.__WS_LOWQ_PR || 1); composer.setPixelRatio(window.__WS_LOWQ_PR || 1); resize(); sun.shadow.mapSize.set(1024, 1024);'],
  ['const pr = want ? Math.min(window.devicePixelRatio || 1, 2.6) : (lowQ ? 1 : DPR);', 'const pr = want ? Math.min(window.devicePixelRatio || 1, 2.6) : (lowQ ? (window.__WS_LOWQ_PR || 1) : DPR);'],
  // the phone screen turns sharp while the camera is still moving in, not a second after it arrives
  ["const want = focusKey === 'phone' && focusT > .97 && phoneFlip.v > .97;", "const want = focusKey === 'phone' && focusT > .6 && phoneFlip.v > .6;"],
  // the desk phone's screen texture, so shell.js can draw her own lock screen on it
  ['const scr = new THREE.MeshPhysicalMaterial({map: screen, roughness: .15', 'window.__WS_PHONE_SCREEN = screen; const scr = new THREE.MeshPhysicalMaterial({map: screen, roughness: .15'],
  // tap the phone once: it turns over and lights up (upstream); tap the lit screen again: enter the small phone
  ["if (hit && hit.object.userData.key === 'phone' && focusKey === 'phone'){ flipPhone(phoneFlip.to < .5); return; }", "if (hit && hit.object.userData.key === 'phone' && focusKey === 'phone'){ if (phoneFlip.to > .5 && window.__WS_PHONE_ENTER){ window.__WS_PHONE_ENTER(); return; } flipPhone(phoneFlip.to < .5); return; }"],
  // the 透卡 on the sill is a second desk pet; she wants only the 流麻牌 on the desk (她：窗台上那个多余的桌面宠物，去掉)
  ['for (const t of TAGS) t.view = t.out ? 1 : 0;', "if (window.__WS_NO_SILL_PET){ TAGS.splice(TAGS.findIndex(t => t.key === 'pet'), 1); tcard.removeFromParent(); cardShadow.mesh.removeFromParent(); }\nfor (const t of TAGS) t.view = t.out ? 1 : 0;"],
  // WINDOWSILL_STEADY30_V1 (she picked it on her iPhone 15 after five rounds of the phone speed test, scripts/windowsill_phone_test):
  // each switch below is read from smallphone/shell.js. Shadows are drawn once and again only when the sun moves (they were
  // ~5,000 of ~5,500 draws per frame); no ambient occlusion and no depth-of-field blur; plain PCF shadow edges; no candle
  // shadow; the two rect area lights (the costliest light per pixel) become a shadowless light from the window (0.65x,
  // matched by desk/sill brightness for day, dusk and night) and a small point light at the laptop screen. Glass kept.
  ['renderer.shadowMap.enabled = true;', 'renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = !window.__WS_SHADOW_FREEZE;'],
  ['renderer.shadowMap.type = THREE.PCFSoftShadowMap;', 'renderer.shadowMap.type = window.__WS_PCF ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;'],
  ['candleLight.castShadow = true;', 'candleLight.castShadow = !window.__WS_NO_CANDLE_SHADOW;'],
  ['scene.add(screenGlow);', `scene.add(screenGlow);
const fakeWin = window.__WS_FAKE_AREA ? new THREE.DirectionalLight('#ffffff', 0) : null, fakeGlow = window.__WS_FAKE_AREA ? new THREE.PointLight('#ffffff', 0, 9, 1.5) : null;
if (fakeWin){ winLight.visible = false; screenGlow.visible = false; fakeWin.position.copy(winLight.position); const tg = new THREE.Object3D(); tg.position.copy(winLight.position).add(V(0, -7, 12)); scene.add(tg); fakeWin.target = tg; scene.add(fakeWin); fakeGlow.position.copy(screenGlow.position); scene.add(fakeGlow); }
let steadySunAt = null, steadyT = 0, steadyN = 0;
const steadyTick = dt => {
  if (fakeWin){ fakeWin.intensity = winLight.intensity * .65; fakeWin.color.copy(winLight.color); fakeGlow.intensity = screenGlow.intensity; fakeGlow.color.copy(screenGlow.color); }
  if (!window.__WS_SHADOW_FREEZE) return;
  steadyT += dt;
  const moved = !steadySunAt || steadySunAt.distanceToSquared(sun.position) > 1 || !sun.shadow.map;   // the sun moved about half a degree, or the low tier dropped the map
  const settle = steadyN < 4 && steadyT > [1, 3, 6, 10][steadyN];                                    // models finish loading in the first seconds
  if (moved || settle){ if (settle) steadyN++; renderer.shadowMap.needsUpdate = true; steadySunAt = (steadySunAt || new THREE.Vector3()).copy(sun.position); }
};`],
  ['const glass = new GlassPass(); composer.addPass(glass);', 'const glass = new GlassPass(); composer.addPass(glass); if (window.__WS_NO_AO) gtao.enabled = false; if (window.__WS_NO_DOF) bokeh.enabled = false;'],
  ['  composer.render();\n  instant = false;', '  steadyTick(dt);\n  composer.render();\n  instant = false;'],
  // WINDOWSILL_DESK_V1 (2026-10-20, her mapping of the desk to the small phone): names she asked for, and small hooks that
  // smallphone/shell.js fills with her real data. The look of the room stays the author's.
  ["fn: '梗库'", "fn: '星星罐'"],
  ["fn: '我在哪'", "fn: '他在哪'"],
  ["fn: '彩蛋'", "fn: '致谢'"],
  // the wall calendar: shell.js redraws the paper with the real days together and the next anniversary
  ['cal.add(paperM(1.35, 1.8, tx, .03));', 'cal.add(paperM(1.35, 1.8, tx, .03)); window.__WS_CAL_TEX = tx;'],
  // the paper plane on the sill only lands when there are unopened letters (the author's own idea for it)
  ["plane.rotation.set(0, 2.5, 0); add(plane, 'letter');", "plane.rotation.set(0, 2.5, 0); add(plane, 'letter'); window.__WS_PLANE = plane;"],
  // the paper crane is away while he is out
  ["crane.rotation.y = .7; add(crane, 'where');", "crane.rotation.y = .7; add(crane, 'where'); window.__WS_CRANE = crane;"],
  // the candle: blowing it out means goodnight (starts sleep in the small phone), so the small phone asks first
  ["  say(candleTo ? '蜡烛点上了' : '晚安');\n};", "  if (!window.__WS_QUIET_CANDLE) say(candleTo ? '蜡烛点上了' : '晚安');\n};\nwindow.__WS_CANDLE_LIT = () => candleTo > .5; window.__WS_CANDLE_SET = on => { if ((candleTo > .5) !== !!on) blowCandle(); };"],
  ["if (focusKey === 'candle'){ blowCandle(); return; }", "if (focusKey === 'candle'){ if (window.__WS_CANDLE_TAP) window.__WS_CANDLE_TAP(); else blowCandle(); return; }"],
  ["if (hit && hit.object.userData.key === 'candle' && focusKey === 'candle'){ blowCandle(); return; }", "if (hit && hit.object.userData.key === 'candle' && focusKey === 'candle'){ if (window.__WS_CANDLE_TAP) window.__WS_CANDLE_TAP(); else blowCandle(); return; }"],
  // 相册 (her photos on the board, five places: Polaroid, postcard, the three cells of the strip); the tag sits on the postcard
  ['// 拍立得、明信片、车票、一条三连拍、一片压干的玉兰花瓣\n{', '// 拍立得、明信片、车票、一条三连拍、一片压干的玉兰花瓣\nconst WALLPH = []; window.__WS_WALLPH = WALLPH;\n{'],
  ['add(onBoard(paperM(.85, 1.02, pol), 1.55, 1.6, .09, .01), null);', "(WALLPH[0] = add(onBoard(paperM(.85, 1.02, pol), 1.55, 1.6, .09, .01), 'photos')).userData.slot = 0;"],
  ["add(onBoard(pinIt(paperM(1.5, 1.03, pc, .05), 1.5, 1.03, ['tl', 'tr'], .05), -1.2, -.95, -.05), null);", "(WALLPH[1] = add(onBoard(pinIt(paperM(1.5, 1.03, pc, .05), 1.5, 1.03, ['tl', 'tr'], .05), -1.2, -.95, -.05), 'photos')).userData.slot = 1;"],
  ["add(onBoard(pinIt(paperM(.42, 1.45, strip, .03), .42, 1.45, ['tr'], .03), 1.68, .02, .1, .006), null);", "(WALLPH[2] = add(onBoard(pinIt(paperM(.42, 1.45, strip, .03), .42, 1.45, ['tr'], .03), 1.68, .02, .1, .006), 'photos')).userData.slot = 2;"],
  // the 相册 tag sits on the postcard (her red circle); its camera is the position she set herself with the tuning panel
  ["  {key: 'notes', obj: notes,", "  {key: 'photos', obj: WALLPH[1], at: V(-.45, .05, .1), fn: '相册', name: '挂板上的照片', lab: 'PHOTOS', note: '', go: '选几张照片放上墙', shot: (window.__WS_PHOTO_SHOT = {d: V(-4.15, 7.9, 6.6), t: V(-4.2, 7.6, 0), fov: 30, abs: true})},\n  {key: 'notes', obj: notes,"],
  ["  if (hit && hit.object.userData.key === 'quick'){", "  if (hit && hit.object.userData.key === 'photos' && window.__WS_PHOTO_TAP && window.__WS_PHOTO_TAP(hit, focusKey)) return;\n  if (hit && hit.object.userData.key === 'quick'){"],
  // the note pad by the letter shows the real day of the week (she asked); the desk phone in pink metal (she asked)
  ["x.fillText('周六 · 海边', 0, 0);", "x.fillText('周' + '日一二三四五六'[new Date().getDay()] + ' · 海边', 0, 0);"],
  ["alu: new THREE.MeshPhysicalMaterial({color: '#28324a',", "alu: new THREE.MeshPhysicalMaterial({color: window.__WS_PHONE_COLOR || '#28324a',"],
  ["glassBack: new THREE.MeshPhysicalMaterial({color: '#39445c',", "glassBack: new THREE.MeshPhysicalMaterial({color: window.__WS_PHONE_BACK || '#39445c',"],
  ["ring: new THREE.MeshPhysicalMaterial({color: '#323c52',", "ring: new THREE.MeshPhysicalMaterial({color: window.__WS_PHONE_RING || '#323c52',"],
  ["band: std('#262d3b', .6),", "band: std(window.__WS_PHONE_BAND || '#262d3b', .6),"],
  // the brass pot behind the maple on the sill is taken away (she asked); the rest of the sill stays the author's
  ['at(j, 8.9, SILL_Y, -4.1, .4); add(j, null);', '/* 黄铜小壶：她要求去掉 */'],
  // 小橘 on the 透卡 / 流麻牌 (shell.js draws her desk pet's frames; upstream's kaomoji stay as the fallback)
  ["    tick(dt){\n      const b = ctx();", "    tick(dt){\n      if (window.__WS_PET && window.__WS_PET.tick(dt, g, ctx(), () => drawPet(cv))) return;\n      const b = ctx();"],
  ['next(){ const k = PICK.indexOf(cur);', 'next(){ if (window.__WS_PET && window.__WS_PET.next()) return; const k = PICK.indexOf(cur);'],
]) {
  if (js.split(from).length !== 2) throw new Error('上游代码变了，找不到：' + from);
  js = js.replace(from, () => to);
}
// speed-test copy only: hand the render passes to the test page so it can switch them off one at a time
if (testOut) {
  const from = 'const glass = new GlassPass(); composer.addPass(glass);';
  if (js.split(from).length !== 2) throw new Error('上游代码变了，找不到：' + from);
  js = js.replace(from, () => from + ' window.__WS_DEV = {renderer, composer, gtao, bokeh, glass, grade, sun, candleLight, winLight, screenGlow};');
  // how often the laptop screen is redrawn (upstream: 24 times a second while you look at it, 10 otherwise)
  const np = "NP.acc += dt; if (NP.acc < (focusKey === 'music' ? 1 / 24 : 1 / 10)) return;";
  if (js.split(np).length !== 2) throw new Error('上游代码变了，找不到：' + np);
  js = js.replace(np, () => "NP.acc += dt; if (NP.acc < (focusKey === 'music' ? (window.__WS_NP_FOCUS_DT || 1 / 24) : (window.__WS_NP_DT || 1 / 10))) return;");
  // time every step of a frame into window.__WS_PROF (the test page reads it per scene)
  const M = n => ` __M('${n}');`;
  for (const [from, to] of [
    ['  stepCandle(dt, t); stepPhone(dt); stepSteam(dt, t); stepNP(dt); stepCrisp();', "  const __p = window.__WS_PROF; let __t = performance.now(); const __M = n => { if (!__p) return; const x = performance.now(); __p[n] = (__p[n] || 0) + x - __t; __t = x; };\n  __M('begin'); stepCandle(dt, t);" + M('candle') + ' stepPhone(dt);' + M('phone') + ' stepSteam(dt, t);' + M('steam') + ' stepNP(dt);' + M('laptop') + ' stepCrisp();' + M('crisp')],
    ['  stepTod(instant ? 1 : 1 - Math.exp(-dt * 1.5));', '  stepTod(instant ? 1 : 1 - Math.exp(-dt * 1.5));' + M('daylight')],
    ['  stepWeather(dt, t); SKYU.uT.value = t; LIFE.step(dt, t);', "  stepWeather(dt, t);" + M('weather') + ' SKYU.uT.value = t; LIFE.step(dt, t);' + M('life')],
    ['  placeCamera(viewT);', '  placeCamera(viewT);' + M('camera')],
    ['  stepFurin(t, dt);', '  stepFurin(t, dt);' + M('windchime')],
    ['  FALL.step(dt, t);', '  FALL.step(dt, t);' + M('leaves')],
    ['  PET.tick(dt); QS.step(dt, t); cardShadow.update(', '  PET.tick(dt);' + M('pet') + ' QS.step(dt, t);' + M('quicksand') + ' cardShadow.update('],
    ['  placeTags();', '  placeTags();' + M('cardShadow+tags')],
    ['  glassSync(); grade.uniforms.time.value = t % 10;', '  glassSync();' + M('glass') + ' grade.uniforms.time.value = t % 10;'],
    ['  composer.render();\n  instant = false;', '  composer.render();' + M('draw') + '\n  instant = false;'],
  ]) {
    if (js.split(from).length !== 2) throw new Error('上游代码变了，找不到：' + from);
    js = js.replace(from, () => to);
  }
}
const result = await esbuild.build({
  stdin: {contents: js, resolveDir: tools, sourcefile: 'windowsill-scene.js', loader: 'js'},
  bundle: true, format: 'iife', target: ['safari16'], minify: true, legalComments: 'eof', write: false,
  nodePaths: [join(tools, 'node_modules')], logLevel: 'error',
});
mkdirSync(out, {recursive: true});
const banner = '/* 赴约 · 窗台 — 唐幡 (TangfanOVO), AGPL-3.0, https://github.com/TangfanOVO/qiaosi (309508f1). three.js r170, MIT. Built for 小手机 by scripts/build_couple_windowsill.mjs; source in native/private-small-phone/third_party/qiaosi-windowsill. */\n';
writeFileSync(join(out, 'windowsill.js'), banner + result.outputFiles[0].text);

// models served from data instead of files
const models = {};
for (const f of readdirSync(join(src, 'models')).filter(f => f.endsWith('.gltf.json')).sort()) models['./models/' + f] = JSON.parse(readFileSync(join(src, 'models', f), 'utf8'));
writeFileSync(join(out, 'models.js'), banner + 'window.__WS_MODELS=' + JSON.stringify(models) + ';\n');

copyFileSync(join(src, 'smallphone/shell.js'), join(out, 'shell.js'));
if (testOut) {
  copyFileSync(join(appOut, 'pet.js'), join(out, 'pet.js'));
  copyFileSync(join(root, 'scripts/windowsill_phone_test/test-overrides.js'), join(out, 'test-overrides.js'));
}

// the upstream page without the CDN import map; plain scripts instead of the module
let tpl = readFileSync(join(src, 'src/index.template.html'), 'utf8');
const im = tpl.match(/<script type="importmap">[\s\S]*?<\/script>\s*/);
if (!im) throw new Error('模板里找不到 importmap');
tpl = tpl.replace(im[0], '');
const mod = '<script type="module">\n/*@@SCRIPT@@*/</script>';
if (!tpl.includes(mod)) throw new Error('模板里找不到场景脚本的位置');
// pet.js comes from scripts/build_couple_windowsill_pet.cjs (小橘's frames); it is not rebuilt here
try { readFileSync(join(out, 'pet.js')); } catch (e) { throw new Error('先运行 scripts/build_couple_windowsill_pet.cjs 生成 pet.js'); }
tpl = tpl.replace(mod, '<script src="shell.js"></script>\n' + (testOut ? '<script src="test-overrides.js"></script>\n' : '') + '<script src="models.js"></script>\n<script src="pet.js"></script>\n<script src="windowsill.js"></script>');
if (/cdn\.jsdelivr|https?:\/\/(?!github\.com\/TangfanOVO)/.test(tpl.replace(/<!--[\s\S]*?-->/g, ''))) throw new Error('页面里还有联网地址');
writeFileSync(join(out, 'index.html'), '<!-- 赴约 · 窗台 by 唐幡 (TangfanOVO), AGPL-3.0. Source: native/private-small-phone/third_party/qiaosi-windowsill -->\n' + tpl);
// the public web build gets the very same page (she says the author agreed, 2026-10-20): couple-windowsill/ at the web root
if (!testOut) {
  const webOut = join(root, 'couple-windowsill');
  mkdirSync(webOut, {recursive: true});
  for (const f of ['index.html', 'shell.js', 'models.js', 'pet.js', 'windowsill.js']) copyFileSync(join(out, f), join(webOut, f));
}
const kb = f => Math.round(readFileSync(join(out, f)).length / 1024);
console.log('couple-windowsill:', ['index.html', 'shell.js', 'models.js', 'pet.js', 'windowsill.js'].map(f => f + ' ' + kb(f) + 'KB').join(', '));
