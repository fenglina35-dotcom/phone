// 测试共用的小工具（2026-11-01）。新写测试直接用这里的，不要每个文件再写一遍。
//
//   import { REL, vre, read, fnSource, BUNDLES, PRIV_DIR } from './_helpers.mjs';
//
// REL：当前版本号，从程序本身读出（网页 app.js、私人 app.js、Xcode 工程），测试里不要再写死数字。
//      { web: 1874, private: 1878, ios: 524, webLabel: '…', privateLabel: '…' }
// vre(String.raw`app\.js\?v={WEB}`, 'g')：把 {WEB} {PRIV} {IOS} {WEBLABEL} {PRIVLABEL} 换成当前版本再做成正则。
// read(file)：读仓库里的文件；设 FIX_TEST_OLD=1 时读 HEAD 里的旧版本（用来确认回归测试在修复前会失败）。
// fnSource(src, name)：从一大段代码里取出 function name(...){...} 整个函数（含 async）。
// BUNDLES：[['web','app.js'],['private', PRIV_DIR+'app.js']]，两版都测时用。
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const PRIV_DIR = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
export const BUNDLES = [['web', 'app.js'], ['private', PRIV_DIR + 'app.js']];

export function read(file) {
  if (process.env.FIX_TEST_OLD) return cp.execFileSync('git', ['show', 'HEAD:' + file], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 });
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function appVer(text, file) {
  const m = String(text).match(/const APP_VER='v(\d+) · ([^']*)'/);
  if (!m) throw new Error('读不到 ' + file + ' 的 APP_VER');
  return { n: +m[1], label: m[2] };
}
const now = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const web = appVer(now('app.js'), 'app.js');
const priv = appVer(now(PRIV_DIR + 'app.js'), PRIV_DIR + 'app.js');
const builds = [...now('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj').matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) => +m[1]);
export const REL = Object.freeze({ web: web.n, private: priv.n, ios: builds[0], webLabel: web.label, privateLabel: priv.label });

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
export function vre(source, flags = '') {
  const filled = String(source)
    .replaceAll('{WEBLABEL}', esc(REL.webLabel))
    .replaceAll('{PRIVLABEL}', esc(REL.privateLabel))
    .replaceAll('{WEB}', String(REL.web))
    .replaceAll('{PRIV}', String(REL.private))
    .replaceAll('{IOS}', String(REL.ios));
  return new RegExp(filled, flags);
}

export function fnSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  const head = src.slice(Math.max(0, start - 6), start) === 'async ' ? start - 6 : start;
  let depth = 0, opened = false;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') { depth += 1; opened = true; }
    if (src[i] === '}') { depth -= 1; if (opened && depth === 0) return src.slice(head, i + 1); }
  }
  throw new Error(`unterminated ${name}`);
}
