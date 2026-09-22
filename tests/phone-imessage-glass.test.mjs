import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const PRIVATE = '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const priv = readFileSync(new URL(PRIVATE + 'app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const shell = readFileSync(new URL(PRIVATE + '小手机.html', import.meta.url), 'utf8');
const index = readFileSync(new URL(PRIVATE + 'index.html', import.meta.url), 'utf8');
const shells = [html, shell, index];
const lines = app.split('\n');
const source = name => {
  const i = lines.findIndex(x => x.startsWith(`function ${name}(`) || x.startsWith(`async function ${name}(`));
  assert.ok(i >= 0, `找不到 ${name}`);
  let j = i + 1;
  while (j < lines.length && !/^(async function |function |let |const |\/\*)/.test(lines[j])) j++;
  return lines.slice(i, j).join('\n');
};

/* ===== 只有通讯录里的人才走 iMessage 那一套 ===== */
test('通讯录里的人走新版，陌生号和匿名号还是老样子', () => {
  const ctx = { phDigits: n => String(n), phSmsIsAliasKey: k => String(k).includes(':alias:') };
  vm.createContext(ctx);
  vm.runInContext(source('phImsgOn'), ctx);
  ctx.phFind = () => ({ num: '138', name: '小宝', kind: 'role' });
  assert.equal(vm.runInContext("phImsgOn('138','138')", ctx), true, '通讯录里的角色该走新版');
  assert.equal(vm.runInContext("phImsgOn('138','138:alias:100')", ctx), false, '匿名号那条线本来就是陌生人');
  ctx.phFind = () => null;
  assert.equal(vm.runInContext("phImsgOn('10086','10086')", ctx), false, '没存进通讯录的号码不该走新版');
});
test('renderPhoneSMS 先分流，老的那套一行没动', () => {
  const fn = source('renderPhoneSMS');
  assert.match(fn, /if\(phImsgOn\(num,sk\)\)return renderPhoneIMsg\(/);
  assert.match(fn, /class="smschat"/, '陌生号还得走原来那套 .smschat');
  for (const x of [app, priv]) assert.match(x, /function renderPhoneIMsg\(num,sk,arr,x\)/);
});

/* ===== 背景图 ===== */
test('背景图一人一张，按号码存', () => {
  const ctx = { S: { }, save: () => {}, phDigits: n => String(n), phNorm: n => String(n).replace(/^0+/, '') };
  const p = { smsBg: null };
  ctx.phState = () => p;
  vm.createContext(ctx);
  vm.runInContext([source('phSmsBgMap'), source('phSmsBg'), source('phSmsBgSet'), source('phSmsBgClear')].join('\n'), ctx);
  assert.equal(vm.runInContext("phSmsBg('138')", ctx), '', '一开始没有背景');
  vm.runInContext("phSmsBgSet('138','data:a')", ctx);
  vm.runInContext("phSmsBgSet('139','data:b')", ctx);
  assert.equal(vm.runInContext("phSmsBg('138')", ctx), 'data:a');
  assert.equal(vm.runInContext("phSmsBg('139')", ctx), 'data:b', '两个人的背景不能串');
  vm.runInContext("phSmsBgClear('138')", ctx);
  assert.equal(vm.runInContext("phSmsBg('138')", ctx), '');
  assert.equal(vm.runInContext("phSmsBg('139')", ctx), 'data:b', '删一个不能把另一个也删了');
});
test('换背景只在联系人页里（以及聊天里那个 ＋）', () => {
  assert.match(source('renderPhoneContact'), /phSmsBgPick\('\$\{esc\(num\)\}'\)/, '联系人页要有「聊天背景」这一行');
  assert.match(source('phSmsPlus'), /phSmsBgPick/);
  assert.match(source('phSmsBgPick'), /compressBackground\(f\)/);
  assert.match(source('phSmsBgPick'), /toast\('这张图读不出来，换一张'\)/, '读不出来要说一声，不能默默存个空的');
});
test('换过背景才挂 hasbg，全屏铺满', () => {
  const fn = source('renderPhoneIMsg');
  assert.match(fn, /class="imsg\$\{bg\?' hasbg':''\}"/);
  assert.match(fn, /background-image:url\(\$\{storedImageDisplaySource\(bg\)\}\)/);
  for (const s of shells) assert.match(s, /\.imsg\{position:relative;height:100%;[^}]*background-size:cover/);
});

/* ===== 液态玻璃 ===== */
test('玻璃是「透过去看得见背景」，不是磨砂糊成一片', () => {
  for (const s of shells) {
    const rules = s.match(/\.imsg\.hasbg [^{]*\{[^}]*backdrop-filter:blur\((\d*\.?\d+)px\)[^}]*\}/g) || [];
    assert.ok(rules.length >= 3, '玻璃规则太少，正则可能失效了');
    for (const r of rules) {
      const px = parseFloat(r.match(/backdrop-filter:blur\((\d*\.?\d+)px\)/)[1]);
      assert.ok(px <= 6, `模糊 ${px}px 太重了，她要的是隔着一杯水看得见背景：${r.slice(0, 50)}`);
    }
  }
});
test('白边不是整圈包边，是左上实、右下虚的两道高光', () => {
  for (const s of shells) {
    const glass = s.match(/\.imsg\.hasbg \.imsg-rb,[^{]*\{[^}]*\}/)[0];
    assert.match(glass, /border:0/, '整圈 1px 白边要撤掉');
    assert.match(glass, /inset 1\.4px 1\.4px 0 rgba\(255,255,255,\.72\)/, '左上那道要实');
    assert.match(glass, /inset -1\.2px -1\.2px 0 rgba\(255,255,255,\.2\)/, '右下那道要虚');
    assert.equal(/border:1px solid rgba\(255,255,255/.test(glass), false, '又变回整圈包边了');
  }
});
test('贴边那一圈单独折射：真玻璃的光都挤在弧面上', () => {
  /* 她要的「像隔着一杯水」「有些被玻璃拉长放大」——中间看得清，贴边被拽亮拽歪。
     这一圈用 mask-composite 把 content-box 那块挖掉，只留最外面一条。 */
  for (const s of shells) {
    const ring = s.match(/\.imsg\.hasbg \.imsg-rb:before,[^{]*\.imsg\.hasbg \.imsg-b:before\{[^}]*\}/);
    assert.ok(ring, '找不到贴边折射那一层');
    const r = ring[0];
    assert.match(r, /box-sizing:border-box;padding:(\d+(?:\.\d+)?)px/, '得靠 padding 定这一圈的厚度');
    assert.match(r, /mask:linear-gradient\(#000 0 0\) content-box,linear-gradient\(#000 0 0\)/, '两层 mask 才挖得出一个圈');
    assert.match(r, /mask-composite:exclude/, '没有 exclude 就不是圈，是整块');
    assert.match(r, /-webkit-mask-composite:xor/, '老 Safari 只认 -webkit- 的 xor');
    const px = parseFloat(r.match(/backdrop-filter:blur\((\d*\.?\d+)px\)/)[1]);
    assert.ok(px < 1, `贴边这圈要比中间更锐，现在是 ${px}px`);
    assert.match(r, /brightness\(1\.(?:1|2|3)\d?\)/, '贴边要比中间亮一点，才有折射的样子');
    assert.match(r, /background:linear-gradient\(140deg/, '这一圈的高光自己也要有虚有实，不是一圈均匀的白');
  }
});
test('蓝气泡和发送键那一圈单独调轻，不然冲成荧光青', () => {
  for (const s of shells) {
    assert.match(s, /\.imsg\.hasbg \.imsg-row\.me \.imsg-b:before,\.imsg\.hasbg \.imsg-send:before\{[^}]*saturate\(1\.0\d\)/);
  }
});
test('头像不做毛玻璃——她特地说了「除了角色的头像」', () => {
  for (const s of shells) {
    const glass = s.match(/\.imsg\.hasbg [^{]*\{[^}]*backdrop-filter[^}]*\}/g) || [];
    assert.ok(glass.length >= 3, '玻璃规则太少，正则可能失效了');
    for (const rule of glass) assert.equal(/\.avatar/.test(rule), false, '头像被拉进玻璃规则里了：' + rule.slice(0, 60));
  }
});
test('背景图再亮，顶上和底下也压了一层淡渐变，按钮不会看不见', () => {
  for (const s of shells) {
    assert.match(s, /\.imsg\.hasbg:before\{[^}]*linear-gradient\(180deg,rgba\(0,0,0,\.34\)/);
    assert.match(s, /\.imsg>\*\{position:relative;z-index:1;\}/, '内容要压在那层渐变上面');
  }
});
test('气泡连同尾巴是一整块剪出来的，不是贴上去的第二块', () => {
  for (const s of shells) {
    /* 尾巴曾经是独立的 :after，自己又做一遍毛玻璃，重叠处糊两遍 → 换背景就看见拼接缝 */
    assert.equal(/\.imsg-b:after\{/.test(s), false, '尾巴又变回贴上去的独立元素了，换背景会有缝');
    assert.match(s, /\.imsg-row\.them \.imsg-b\{padding:8px 14px 8px 23px;clip-path:polygon\(/);
    assert.match(s, /\.imsg-row\.me \.imsg-b\{padding:8px 23px 8px 14px;[^}]*clip-path:polygon\(/);
    assert.equal(/\.imsg-b\{[^}]*border-radius/.test(s), false, 'border-radius 会和 clip-path 打架，形状要么缺要么不是并集');
  }
});
test('一整块只有一层背景、一层 backdrop-filter', () => {
  for (const s of shells) {
    const them = s.match(/\.imsg\.hasbg \.imsg-row\.them \.imsg-b\{[^}]*\}/)[0];
    assert.equal((them.match(/backdrop-filter/g) || []).length, 2, '只该有 -webkit- 和标准各一条');
  }
});
test('输入栏往上挪了一点', () => {
  for (const s of shells) {
    assert.match(s, /\.imsg-bar\{[^}]*padding:8px 12px 24px;/);
    assert.match(s, /html\.north-ios-home-safe \.imsg-bar\{padding-bottom:calc\(24px \+ var\(--north-ios-home-safe-bottom\)\);\}/);
  }
});

/* ===== 有字才出现发送键 ===== */
test('输入框有字才冒出蓝色发送键', () => {
  for (const s of shells) {
    assert.match(s, /\.imsg-send\{display:none;/);
    assert.match(s, /\.imsg-bar\.typing \.imsg-send\{display:flex;\}/);
    assert.match(s, /\.imsg-bar\.typing \.imsg-wave\{display:none;\}/, '有字的时候那个话筒要让位');
  }
  const fn = source('phSmsTyping');
  assert.match(fn, /bar\.classList\.toggle\('typing',!!String\(ta\.value\|\|''\)\.trim\(\)\)/);
  assert.match(source('renderPhoneIMsg'), /oninput="phSmsTyping\(\)"/);
});
test('空格不算字，发完了那个键要收回去', () => {
  const ctx = { cls: new Set() };
  ctx.$ = () => ({ value: ctx.val, closest: () => ({ classList: { toggle: (n, on) => { on ? ctx.cls.add(n) : ctx.cls.delete(n); } } }) });
  vm.createContext(ctx);
  vm.runInContext(source('phSmsTyping'), ctx);
  ctx.val = '   ';
  vm.runInContext('phSmsTyping()', ctx);
  assert.equal(ctx.cls.has('typing'), false, '只打了空格不该冒出发送键');
  ctx.val = '想你';
  vm.runInContext('phSmsTyping()', ctx);
  assert.equal(ctx.cls.has('typing'), true);
  ctx.val = '';
  vm.runInContext('phSmsTyping()', ctx);
  assert.equal(ctx.cls.has('typing'), false);
  for (const x of [app, priv]) assert.match(x, /ta\.value='';phSmsTyping\(\);/, '发完要把那个键收回去');
});

/* ===== 两个粉色按钮 ===== */
test('那两个粉色按钮撤了，功能进了右上角三个点', () => {
  for (const x of [app, priv]) {
    assert.equal(/<button class="btn p"[^>]*>新建联系人<\/button>/.test(x), false, '通讯录页那个粉按钮还在');
    assert.equal(/<button class="btn p"[^>]*>新信息<\/button>/.test(x), false, '信息页那个粉按钮还在');
    assert.match(x, /onclick="closeModal\(\);phNewSms\(\)"><span>新信息<\/span>/, '新信息要进 ⋯ 菜单');
    assert.match(x, /onclick="phEditContact\(''\)"><span>新建联系人<\/span>/, '新建联系人要在 ⋯ 菜单里');
  }
});

/* ===== 不许误伤 ===== */
test('电话那一片所有 onclick 叫到的函数都真的存在', () => {
  const names = new Set();
  for (const m of app.matchAll(/onclick="(?:closeModal\(\);)?(ph[A-Za-z0-9_]+)\(/g)) names.add(m[1]);
  assert.ok(names.size > 20, '抓到的电话按钮太少，正则可能失效了');
  const missing = [...names].filter(n => !new RegExp(`(?:async )?function ${n}\\(`).test(app));
  assert.deepEqual(missing, [], '这些按钮点了会报错：' + missing.join('、'));
});
