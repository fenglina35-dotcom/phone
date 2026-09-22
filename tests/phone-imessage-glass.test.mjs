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
test('手动换背景只在联系人页里', () => {
  assert.match(source('renderPhoneContact'), /phSmsBgPick\('\$\{esc\(num\)\}'\)/, '联系人页要有「聊天背景」这一行');
  assert.match(source('phSmsBgPick'), /compressBackground\(f\)/);
  assert.match(source('phSmsBgPick'), /toast\('这张图读不出来，换一张'\)/, '读不出来要说一声，不能默默存个空的');
  for (const x of [app, priv]) {
    assert.equal(/function phSmsPlus\(/.test(x), false, '＋ 现在直接开相册，那个菜单撤了');
    assert.equal(/phSmsPlus\(/.test(x), false, '还有地方在叫已经删掉的 phSmsPlus');
  }
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
test('高光是沿着轮廓描的一条细线，不是有宽度的包边', () => {
  /* 她看到上一版说「为什么会有这种很明显的分界线包边」。那时候是拿 mask 挖了个
     6px 的圈，圈的内沿就是一道台阶。现在父元素按外轮廓剪、:before 按同一条
     轮廓往里缩剪，父元素的底色只从那条缝里露出来——缝多宽，高光就多细。 */
  for (const s of shells) {
    assert.equal(/mask-composite:exclude/.test(s), false, '又用回挖圈那一套了，圈的内沿会变成分界线');
    for (const who of ['them', 'me']) {
      const out = s.match(new RegExp(`\\.imsg-row\\.${who} \\.imsg-b\\{[^}]*clip-path:polygon\\(([^)]*(?:\\)[^)]*)*?)\\);`));
      const inn = s.match(new RegExp(`\\.imsg-row\\.${who} \\.imsg-b:before\\{clip-path:polygon\\(([^)]*(?:\\)[^)]*)*?)\\);`));
      assert.ok(out && inn, `${who} 少了外轮廓或内轮廓`);
      const n = t => t.split(',').length;
      assert.equal(n(out[1]), n(inn[1]), '内外轮廓点数要一一对应，不然缩进来的形状是歪的');
      /* 第一个点：外轮廓在 7px，内轮廓应该正好缩进 1.15px 左右 */
      const f = t => parseFloat(t.split(',')[0].match(/([\d.]+)px/)[1]);
      const d = Math.abs(f(inn[1]) - f(out[1]));
      assert.ok(d > 0.6 && d < 2, `描边应该只有一条细线的宽度，现在是 ${d}px`);
    }
  }
});
test('高光跟着背景变颜色，不是只有白色', () => {
  /* 描边那层自己带 backdrop-filter：把背景提亮、提饱和吸上来，所以背景暖它就暖、
     背景蓝它就蓝。上面再叠一条 140° 渐变让它有虚有实。 */
  for (const s of shells) {
    const rim = s.match(/\.imsg\.hasbg \.imsg-rb,[^{]*\.imsg\.hasbg \.imsg-field\{[^}]*\}/)[0];
    assert.match(rim, /backdrop-filter:brightness\(1\.\d+\) saturate\(1\.\d+\)/, '描边要靠 brightness+saturate 把背景的颜色吸上来');
    assert.equal(/backdrop-filter:[^;]*blur/.test(rim), false, '描边那层不能糊，糊了就吸不到颜色了');
    assert.match(rim, /background:linear-gradient\(140deg/, '白色那层渐变还要在，高光才有虚有实');
    for (const who of ['them', 'me']) {
      const b = s.match(new RegExp(`\\.imsg\\.hasbg \\.imsg-row\\.${who} \\.imsg-b\\{[^}]*\\}`))[0];
      assert.match(b, /backdrop-filter:brightness\(1\.\d+\) saturate\(1\.\d+\)/, `${who} 的描边也要跟着背景走`);
    }
  }
});
test('没换背景的时候也有高光，不能什么都没有', () => {
  for (const s of shells) {
    const base = s.match(/\n\.imsg-b\{[^}]*\}/)[0];
    assert.match(base, /background:linear-gradient\(140deg,rgba\(255,255,255,\.\d+\)/, '基础样式里就该有那条高光渐变');
    const btn = s.match(/\n\.imsg-rb\{[^}]*\}/);
    assert.ok(btn, '找不到返回键的基础样式');
    assert.match(s, /\.imsg-rb:before,\.imsg-name:before,\.imsg-plus:before,\.imsg-send:before,\.imsg-field:before\{[^}]*inset:1px/, '按钮也是两层，里面那层缩 1px');
  }
});
test('小尾巴改瘦了：伸得短、也矮', () => {
  for (const s of shells) {
    const out = s.match(/\.imsg-row\.them \.imsg-b\{[^}]*clip-path:polygon\(([\s\S]*?)\);/)[1];
    const pts = out.split(',');
    /* 尖端那个点：x 最小的那一个 */
    const tip = Math.min(...pts.map(p => {
      const m = p.trim().match(/^([\d.]+)px /);
      return m ? parseFloat(m[1]) : 99;
    }));
    const body = parseFloat(pts[0].match(/([\d.]+)px/)[1]);
    assert.ok(body <= 7.5, `气泡身子的左边缘该在 7px 上下，现在 ${body}px`);
    assert.ok(body - tip < 6.5, `尾巴伸出去 ${(body - tip).toFixed(1)}px，太长了，她说要瘦一点小一点`);
    const tall = Math.max(...pts.map(p => {
      const m = p.trim().match(/^[\d.]+px calc\(100% - ([\d.]+)px\)$/);
      return m ? parseFloat(m[1]) : 0;
    }));
    assert.ok(tall <= 11, `尾巴高 ${tall}px，上一版 15px 太粗了`);
  }
});
test('气泡里的字压在里面那层玻璃上面，不会被盖住', () => {
  for (const s of shells) {
    assert.match(s, /\.imsg-b>i\{font-style:normal;position:relative;z-index:1;/);
    assert.match(s, /\.imsg-rb>i,\.imsg-name>i,\.imsg-plus>i,\.imsg-send>i\{[^}]*z-index:1/);
    assert.match(s, /\.imsg-field>\*\{position:relative;z-index:1;\}/);
  }
  assert.match(source('renderPhoneIMsg'), /<i>\$\{pic\?/, '气泡内容要包一层 <i>');
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
    assert.match(s, /\.imsg-row\.them \.imsg-b\{padding:8px 14px 8px 21px;clip-path:polygon\(/);
    assert.match(s, /\.imsg-row\.me \.imsg-b\{padding:8px 21px 8px 14px;clip-path:polygon\(/);
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

/* ===== ＋ 就是相册 ===== */
test('＋ 点一下直接开相册，不再弹菜单', () => {
  assert.match(source('renderPhoneIMsg'), /class="imsg-plus" onclick="phSmsPic\('\$\{esc\(num\)\}','\$\{esc\(sk\)\}'\)"/);
  const fn = source('phSmsPic');
  assert.match(fn, /pickFile\('image\/\*'/, '得真的调相册');
  assert.match(fn, /compress\(f,900,\.74\)/);
  assert.match(fn, /phSendSmsImage\(num,sk,src\)/);
  assert.match(fn, /toast\('这张图读不出来，换一张'\)/, '读不出来要说一声');
});
test('发出去的图片真的存下来、也真的显示出来', () => {
  const ctx = {
    S: { me: { name: '北北' } }, save: () => {}, render: () => {}, toast: () => {},
    uid: () => 'm' + (ctx.n = (ctx.n || 0) + 1),
    phDigits: n => String(n), phNorm: n => String(n), phSmsIsAliasKey: () => false,
    phFind: () => ({ num: '138', name: '小宝', kind: 'role', id: 'c1' }),
    getC: () => ({ id: 'c1', name: '小宝' }), phMirrorSMS: (...a) => ctx.mirror.push(a),
    phRoleSmsReply: () => {}, setTimeout: () => {}, Math,
  };
  ctx.mirror = [];
  const store = {};
  ctx.phState = () => ({ blocked: {}, line: 'main', aliasThreads: {}, sms: store });
  ctx.phSmsArr = (num, sk) => (store[sk || num] = store[sk || num] || []);
  vm.createContext(ctx);
  vm.runInContext(source('phSendSmsImage'), ctx);
  vm.runInContext("phSendSmsImage('138','138','data:image/png;base64,AAA')", ctx);
  const arr = store['138'];
  assert.equal(arr.length, 1);
  assert.equal(arr[0].img, 'data:image/png;base64,AAA', '图片得存进这条消息里');
  assert.equal(arr[0].text, '[图片]', '正文写成 [图片]，模型才知道她发了张照片');
  assert.equal(arr[0].from, 'me');
  assert.deepEqual(ctx.mirror[0].slice(1), ['me', '（发了一张照片）'], '微信那边也要留一条');
  /* 两套气泡都得认图片，不能只显示一行 [图片] */
  assert.match(source('renderPhoneIMsg'), /m\.img\?storedImageDisplaySource\(m\.img\):''/);
  assert.match(source('renderPhoneSMS'), /m\.img\?`<img src="\$\{storedImageDisplaySource\(m\.img\)\}"/, '陌生号那条老线也要显示图片');
});

/* ===== 角色把照片换成聊天背景 ===== */
test('角色回一行 [换背景]，短信背景就真的换掉了', () => {
  const ctx = { save: () => {}, render: () => {}, toast: m => ctx.said.push(m), phDigits: n => String(n), phNorm: n => String(n) };
  ctx.said = [];
  const p = { smsBg: {} };
  ctx.phState = () => p;
  const rows = [
    { id: 'a', from: 'me', text: '你好' },
    { id: 'b', from: 'me', text: '[图片]', img: 'data:old' },
    { id: 'c', from: 'them', text: '好看' },
    { id: 'd', from: 'me', text: '[图片]', img: 'data:new' },
    { id: 'e', from: 'me', text: '把这张换成背景' },
  ];
  ctx.phSmsArr = () => rows;
  vm.createContext(ctx);
  vm.runInContext([source('phSmsBgMap'), source('phSmsBg'), source('phSmsBgSet'), source('phRoleSetSmsBg')].join('\n'), ctx);
  assert.equal(vm.runInContext("phRoleSetSmsBg('138','138')", ctx), true);
  assert.equal(vm.runInContext("phSmsBg('138')", ctx), 'data:new', '要拿最近那张，不是第一张');
  ctx.said = [];
  rows.length = 0;
  assert.equal(vm.runInContext("phRoleSetSmsBg('138','138')", ctx), false, '一张图都没有就不能瞎换');
});
test('[换背景] 这个标签不会被当成正文发出来', () => {
  const fn = source('phRoleSmsReply');
  assert.match(fn, /const wantBg=\/\[\\\[【\]\\s\*换背景\\s\*\[\\\]】\]\/\.test\(r\)/, '先认出来');
  assert.match(fn, /r=r\.replace\(\/\[\\\[【\]\\s\*换背景\\s\*\[\\\]】\]\/g,' '\)/, '再从正文里抹掉');
  assert.match(fn, /if\(wantBg&&!phRoleSetSmsBg\(num,sk\)\)/, '没找到图要有话说，不能默默没反应');
  assert.match(fn, /就在回复最后【单独一行】写 \[换背景\]/, '得告诉模型有这么一条');
  assert.match(fn, /m\.img\?'\[图片\]':m\.text/, '记录里要让模型看见她发过图');
});
test('微信里角色也能把她发的照片换成聊天背景', () => {
  for (const x of [app, priv]) {
    assert.match(x, /if\(\/\^\[\\\[【\]\\s\*换背景\\s\*\[\\\]】\]\$\/\.test\(line\)\)\{/, '微信回复里要认这一行');
    assert.match(x, /reverse\(\)\.find\(m=>m&&m\.role==='user'&&m\.type==='image'&&m\.src\)/, '要找她最近发的那张真照片');
    assert.match(x, /c\.chatBg=last\.src;save\(\);/);
    assert.match(x, /就【单独一行】写 \[换背景\]/, '系统提示里要写清楚');
    assert.match(x, /const TAGWORDS='心情值\|心情\|内心\|换背景\|/, '不写进标签表会被当成漏掉的指令');
  }
  /* 网页版还有一张「已处理标签」表，私人版没有这个函数 */
  assert.match(app, /return \/\^\(\?:内心\|心情\|心情值\|换背景\|/);
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
