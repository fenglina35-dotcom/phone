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
test('换了背景：按钮、输入框、对方气泡全是能透出背景的毛玻璃', () => {
  for (const s of shells) {
    assert.match(s, /\.imsg\.hasbg \.imsg-rb,\.imsg\.hasbg \.imsg-name,\.imsg\.hasbg \.imsg-plus\{[^}]*backdrop-filter:blur\(26px\)/);
    assert.match(s, /\.imsg\.hasbg \.imsg-field\{[^}]*backdrop-filter:blur\(26px\)/);
    assert.match(s, /\.imsg\.hasbg \.imsg-row\.them \.imsg-b\{[^}]*backdrop-filter:blur\(24px\)/);
    assert.match(s, /\.imsg\.hasbg \.imsg-row\.me \.imsg-b\{background:rgba\(10,132,255,\.72\)/);
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
test('气泡的小尖角是画出来的，不是方块', () => {
  for (const s of shells) {
    assert.match(s, /\.imsg-row\.them \.imsg-b:after\{left:-7px;clip-path:path\(/);
    assert.match(s, /\.imsg-row\.me \.imsg-b:after\{right:-7px;clip-path:path\(/);
    assert.match(s, /\.imsg-b:after\{[^}]*background:inherit/, '尖角的颜色要跟着气泡走');
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
