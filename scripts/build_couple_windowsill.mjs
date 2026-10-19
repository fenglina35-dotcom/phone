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
const kb = f => Math.round(readFileSync(join(out, f)).length / 1024);
console.log('couple-windowsill:', ['index.html', 'shell.js', 'models.js', 'pet.js', 'windowsill.js'].map(f => f + ' ' + kb(f) + 'KB').join(', '));
