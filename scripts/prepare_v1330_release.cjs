const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function edit(relative, replacements) {
  const file = path.join(ROOT, relative);
  let source = fs.readFileSync(file, 'utf8');
  for (const [from, to, expected] of replacements) {
    const found = source.split(from).length - 1;
    if (found === 0 && source.includes(to)) continue;
    if (found !== expected) {
      throw new Error(`${relative}: expected ${expected} occurrences of ${JSON.stringify(from)}, found ${found}`);
    }
    source = source.split(from).join(to);
  }
  fs.writeFileSync(file, source, 'utf8');
}

const WEB_TAG_OLD = 'v1328-web-delivery-tag-1';
const WEB_TAG_NEW = 'v1330-web-delivery-context-1';
const PRIVATE_TAG_OLD = 'v1329-private-delivery-tag-1';
const PRIVATE_TAG_NEW = 'v1331-private-delivery-context-1';

edit('app.js', [
  ["window.__NORTH_SHELL_BUILD__!=='1328'", "window.__NORTH_SHELL_BUILD__!=='1330'", 1],
  ["const APP_VER='v1328 · 屏保上滑手势与回弹修复'", "const APP_VER='v1330 · 外卖上下文与偏好记忆修复'", 1],
  [`sw.js?v=1328&r=${WEB_TAG_OLD}`, `sw.js?v=1330&r=${WEB_TAG_NEW}`, 1],
]);

for (const relative of ['小手机.html']) {
  edit(relative, [
    [WEB_TAG_OLD, WEB_TAG_NEW, 3],
    ['1328-web-delivery-tag-1', '1330-web-delivery-context-1', 1],
    ['1328', '1330', 33],
  ]);
}

edit('index.html', [['v=1328', 'v=1330', 1]]);
edit('repair.html', [['v=1328', 'v=1330', 2]]);
edit('sw.js', [
  [WEB_TAG_OLD, WEB_TAG_NEW, 4],
  ["const BUILD='1328'", "const BUILD='1330'", 1],
]);
edit('web-hotfix.js', [
  [WEB_TAG_OLD, WEB_TAG_NEW, 2],
  ['sw.js?v=1328', 'sw.js?v=1330', 1],
]);

const PRIVATE = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
edit(PRIVATE + 'app.js', [
  ["window.__NORTH_SHELL_BUILD__!=='1329'", "window.__NORTH_SHELL_BUILD__!=='1331'", 1],
  ["const APP_VER='v1329 · 屏保上滑手势与回弹修复'", "const APP_VER='v1331 · 外卖上下文与偏好记忆修复'", 1],
  [`sw.js?v=1329&r=${PRIVATE_TAG_OLD}`, `sw.js?v=1331&r=${PRIVATE_TAG_NEW}`, 1],
]);
for (const relative of [PRIVATE + 'index.html', PRIVATE + '小手机.html']) {
  edit(relative, [
    [PRIVATE_TAG_OLD, PRIVATE_TAG_NEW, 2],
    ['1329-private-delivery-tag-1', '1331-private-delivery-context-1', 1],
    ['1329', '1331', 36],
  ]);
}
edit(PRIVATE + 'repair.html', [['v=1329', 'v=1331', 1]]);
edit(PRIVATE + 'web-hotfix.js', [
  [PRIVATE_TAG_OLD, PRIVATE_TAG_NEW, 2],
  ['sw.js?v=1329', 'sw.js?v=1331', 1],
]);

edit('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift', [
  ['1.0.398 (398)', '1.0.399 (399)', 2],
]);
edit('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift', [
  ['1.0.398 (398)', '1.0.399 (399)', 1],
]);
edit('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj', [
  ['CURRENT_PROJECT_VERSION = 398;', 'CURRENT_PROJECT_VERSION = 399;', 12],
  ['MARKETING_VERSION = 1.0.398;', 'MARKETING_VERSION = 1.0.399;', 12],
]);

edit('native/private-small-phone/XcodeProject/请在Mac编译前先读.md', [
  ['# v1329 私人同步 屏保上滑手势与回弹修复 iOS398', '# v1331 私人同步 外卖上下文与偏好记忆修复 iOS399', 1],
  ['当前私人内置源码为 v1329，私人 iOS 升为 **1.0.398 (398)**', '当前私人内置源码为 v1331，私人 iOS 升为 **1.0.399 (399)**', 1],
  ['网页同源为 v1328', '网页同源为 v1330', 1],
]);

const testDir = path.join(ROOT, 'tests');
for (const name of fs.readdirSync(testDir)) {
  if (!name.endsWith('.test.mjs') || name === 'permanent-fix-guard.test.mjs') continue;
  const file = path.join(testDir, name);
  let source = fs.readFileSync(file, 'utf8');
  source = source
    .split("v1328 · 屏保上滑手势与回弹修复").join('v1330 · 外卖上下文与偏好记忆修复')
    .split("v1329 · 屏保上滑手势与回弹修复").join('v1331 · 外卖上下文与偏好记忆修复')
    .split(WEB_TAG_OLD).join(WEB_TAG_NEW)
    .split(PRIVATE_TAG_OLD).join(PRIVATE_TAG_NEW)
    .split('1328-web-delivery-tag-1').join('1330-web-delivery-context-1')
    .split('1329-private-delivery-tag-1').join('1331-private-delivery-context-1')
    .split('v=1328').join('v=1330')
    .split("BUILD='1328'").join("BUILD='1330'")
    .split("__NORTH_SHELL_BUILD__='1328'").join("__NORTH_SHELL_BUILD__='1330'")
    .split("__NORTH_SHELL_BUILD__!==\\'1328\\'").join("__NORTH_SHELL_BUILD__!==\\'1330\\'")
    .split("__NORTH_SHELL_BUILD__!=='1328'").join("__NORTH_SHELL_BUILD__!=='1330'")
    .split('webVersion,1328').join('webVersion,1330')
    .split("APP_VER='v1328 ·").join("APP_VER='v1330 ·")
    .split('CURRENT_PROJECT_VERSION = 398').join('CURRENT_PROJECT_VERSION = 399')
    .split('MARKETING_VERSION = 1.0.398').join('MARKETING_VERSION = 1.0.399')
    .split('1\\.0\\.398').join('1\\.0\\.399')
    .split('\\(398\\)').join('\\(399\\)')
    .split('private v1329').join('private v1331')
    .split('public v1328').join('public v1330')
    .split('iOS398').join('iOS399')
    .split('iOS 394').join('iOS 399')
    .split('1329').join('1331');
  fs.writeFileSync(file, source, 'utf8');
}

console.log('prepared v1330 web / v1331 private / iOS 1.0.399 (399)');
