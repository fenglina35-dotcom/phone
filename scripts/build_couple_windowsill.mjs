// COUPLE_WINDOWSILL_V1: build the private app's copy of 唐幡's "赴约 · 窗台" (third_party/qiaosi-windowsill).
// The upstream scene is an ES module that loads three.js from a CDN and fetches models; the private app opens
// local files, so everything is bundled into plain scripts: three.js + scene (windowsill.js), models (models.js).
// Upstream files are read as they are; nothing in third_party is rewritten.
// Usage: node scripts/build_couple_windowsill.mjs --tools <folder whose node_modules has esbuild@0.24.0 and three@0.170.0>
import {readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'native/private-small-phone/third_party/qiaosi-windowsill');
const out = join(root, 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/couple-windowsill');
const ti = process.argv.indexOf('--tools');
if (ti < 0 || !process.argv[ti + 1]) throw new Error('需要 --tools <装了 esbuild 和 three 的文件夹>');
const tools = resolve(process.argv[ti + 1]);
const esbuild = await import(pathToFileURL(join(tools, 'node_modules/esbuild/lib/main.js')).href);
const threeVer = JSON.parse(readFileSync(join(tools, 'node_modules/three/package.json'), 'utf8')).version;
if (threeVer !== '0.170.0') throw new Error('上游用的是 three@0.170.0，这里是 ' + threeVer);

// the scene script, in the same order upstream build.mjs uses
const jsDir = join(src, 'src/js');
const js = readdirSync(jsDir).filter(f => f.endsWith('.js')).sort().map(f => readFileSync(join(jsDir, f), 'utf8')).join('');
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

// the upstream page without the CDN import map; plain scripts instead of the module
let tpl = readFileSync(join(src, 'src/index.template.html'), 'utf8');
const im = tpl.match(/<script type="importmap">[\s\S]*?<\/script>\s*/);
if (!im) throw new Error('模板里找不到 importmap');
tpl = tpl.replace(im[0], '');
const mod = '<script type="module">\n/*@@SCRIPT@@*/</script>';
if (!tpl.includes(mod)) throw new Error('模板里找不到场景脚本的位置');
tpl = tpl.replace(mod, '<script src="shell.js"></script>\n<script src="models.js"></script>\n<script src="windowsill.js"></script>');
if (/cdn\.jsdelivr|https?:\/\/(?!github\.com\/TangfanOVO)/.test(tpl.replace(/<!--[\s\S]*?-->/g, ''))) throw new Error('页面里还有联网地址');
writeFileSync(join(out, 'index.html'), '<!-- 赴约 · 窗台 by 唐幡 (TangfanOVO), AGPL-3.0. Source: native/private-small-phone/third_party/qiaosi-windowsill -->\n' + tpl);
const kb = f => Math.round(readFileSync(join(out, f)).length / 1024);
console.log('couple-windowsill:', ['index.html', 'shell.js', 'models.js', 'windowsill.js'].map(f => f + ' ' + kb(f) + 'KB').join(', '));
