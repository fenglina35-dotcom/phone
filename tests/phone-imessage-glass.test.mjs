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
  assert.match(source('phSmsBgPick'), /compressChatBackground\(f\)/, '聊天背景是贴着整块屏幕看的，得走专门那档，不能跟普通背景一样压');
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
test('玻璃糊一点，但不能糊成一片磨砂', () => {
  /* 两头都踩过：26px 是磨砂、背景全没了；3.6px 又太高清，她说「不用这么高清地
     透过整个背景，稍微改的模糊一点点就行」。现在卡在中间这一段。 */
  for (const s of shells) {
    const rules = s.match(/\.imsg\.hasbg [^{]*\{[^}]*backdrop-filter:blur\((\d*\.?\d+)px\)[^}]*\}/g) || [];
    assert.ok(rules.length >= 3, '玻璃规则太少，正则可能失效了');
    for (const r of rules) {
      const px = parseFloat(r.match(/backdrop-filter:blur\((\d*\.?\d+)px\)/)[1]);
      assert.ok(px >= 7, `模糊 ${px}px 太清楚了，背景一眼看到底：${r.slice(0, 50)}`);
      assert.ok(px <= 14, `模糊 ${px}px 又回到磨砂了：${r.slice(0, 50)}`);
    }
  }
});
test('输入框那圈单独调轻，字和小话筒浮得出来', () => {
  /* 她说「输入框两边白色的晕染太多，上面的字都看不清，那个小话筒也看不清」。
     输入框那一圈的白和提亮都要比别处轻。 */
  const top = r => parseFloat(r.match(/linear-gradient\(140deg,rgba\(255,255,255,(\.\d+)\)/)[1]);
  const up = r => parseFloat(r.match(/backdrop-filter:brightness\((1\.\d+)\)/)[1]);
  for (const s of shells) {
    const btn = s.match(/\.imsg\.hasbg \.imsg-rb:before,[^{]*\{[^}]*\}/)[0];
    const field = s.match(/\.imsg\.hasbg \.imsg-field:before\{[^}]*\}/)[0];
    assert.ok(top(field) < top(btn), `输入框那圈的白(${top(field)})必须比别处(${top(btn)})淡，不然把字都压没了`);
    assert.ok(up(field) < up(btn), `输入框那圈的提亮(${up(field)})也要比别处(${up(btn)})轻`);
    assert.match(s, /\.imsg\.hasbg \.imsg-field textarea::placeholder\{color:rgba\(255,255,255,\.8\d\);\}/, 'placeholder 要提亮');
    assert.match(s, /\.imsg\.hasbg \.imsg-wave\{opacity:1;filter:drop-shadow/, '小话筒要提亮、加投影才看得清');
  }
});
test('发出去的图片就是原图，没有任何气泡包边', () => {
  for (const s of shells) {
    const pic = s.match(/\.imsg-row \.imsg-b\.pic\{[^}]*\}/)[0];
    assert.match(pic, /clip-path:none!important/, '不能再按气泡轮廓剪，也就没有尾巴');
    assert.match(pic, /background:none!important/, '不能有描边');
    assert.match(pic, /box-shadow:none!important/);
    assert.match(s, /\.imsg-row \.imsg-b\.pic:before\{display:none!important;\}/, '里面那层玻璃也要撤掉');
    assert.match(s, /\.imsg-b\.pic img\{[^}]*border-radius:0/, '原模原样就不该有圆角');
  }
});
test('高光是沿着轮廓描的一条细线，不是有宽度的包边', () => {
  /* 她看到最早那一版说「为什么会有这种很明显的分界线包边」。那时候是拿 mask 挖了个
     6px 的圈，圈的内沿就是一道台阶。现在描边层被剪成一个真正的「环」：同一条轮廓
     正着走一圈、再往里缩 0.75px 倒着走一圈，nonzero 规则下中间就是个洞。
     环有多宽，高光就有多细，而且中间是透空的，底下磨砂的身子露得干干净净。 */
  for (const s of shells) {
    for (const who of ['them', 'me']) {
      const out = s.match(new RegExp(`\\.imsg-row\\.${who} \\.imsg-b\\{[^}]*clip-path:polygon\\(([^;]*)\\);`));
      const ring = s.match(new RegExp(`\\.imsg-row\\.${who} \\.imsg-b:before\\{clip-path:polygon\\(([^;]*)\\);`));
      assert.ok(out && ring, `${who} 少了外轮廓或者描边环`);
      const no = out[1].split(',').length, nr = ring[1].split(',').length;
      assert.equal(nr, no * 2 + 2, `环应该是外圈 ${no} 点＋内圈 ${no} 点＋两个接缝点，现在 ${nr} 个`);
      const pts = ring[1].split(',');
      /* 外圈第一个点和内圈第一个点隔多远，高光就有多细 */
      const f = t => parseFloat(t.trim().match(/([\d.]+)px/)[1]);
      const d = Math.abs(f(pts[no + 1]) - f(pts[0]));
      assert.ok(d > 0.6 && d < 1.3, `描边应该只有一条细线的宽度，现在是 ${d}px`);
      /* 接缝那两条桥要完全重合，不然环上会豁一个口子 */
      assert.equal(pts[no].trim(), pts[0].trim(), '外圈没有回到起点，环会豁口');
      assert.equal(pts[nr - 1].trim(), pts[no + 1].trim(), '内圈没有回到起点，环会豁口');
    }
    /* 按钮是圆角矩形，用 padding + 遮罩挖空，一样是环；但只许挖一条细线 */
    const btn = s.match(/\.imsg-rb:before,[^{]*\.imsg-field:before\{[^}]*\}/)[0];
    assert.match(btn, /mask-composite:exclude/, '按钮那圈也要挖空，中间不能糊着白');
    const pad = parseFloat(btn.match(/padding:(\.?\d*\.?\d+)px/)[1]);
    assert.ok(pad > 0 && pad <= 1.2, `按钮的描边 ${pad}px，她要的是细的`);
  }
});
test('高光跟着背景变颜色，不是只有白色', () => {
  /* 描边那一层自己带 brightness + saturate：把底下的背景提亮、提饱和吸上来，
     背景暖它就暖、背景蓝它就蓝，再叠一条 140° 的白渐变让它有虚有实。
     这一层已经被剪成一条细环了，所以提亮只落在那一条上，糊不出白雾。 */
  const rims = s => [
    /\.imsg\.hasbg \.imsg-rb:before,[^{]*\{[^}]*\}/,
    /\.imsg\.hasbg \.imsg-row\.them \.imsg-b:before\{[^}]*\}/,
    /\.imsg\.hasbg \.imsg-row\.me \.imsg-b:before\{[^}]*\}/,
  ].map(re => { const m = s.match(re); assert.ok(m, '找不到描边层：' + re); return m[0]; });
  for (const s of shells) {
    for (const rim of rims(s)) {
      assert.match(rim, /backdrop-filter:brightness\(1\.\d+\) saturate\(1\.\d+\)/, '描边要把背景的颜色吸上来：' + rim.slice(0, 60));
      assert.equal(/backdrop-filter:[^;]*blur/.test(rim), false, '描边那层不能糊，糊了就吸不到颜色了');
      assert.match(rim, /background:linear-gradient\(140deg,rgba\(255,255,255/, '白渐变也要在，高光才有虚有实');
    }
  }
});
test('没换背景的时候也有高光，不能什么都没有', () => {
  for (const s of shells) {
    const rim = s.match(/\n\.imsg-b:before\{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient\(140deg,rgba\(255,255,255,\.\d+\)[^}]*\}/);
    assert.ok(rim, '基础样式里气泡就该有那条高光渐变');
    assert.match(s, /\.imsg-rb:before,\.imsg-name:before,\.imsg-plus:before,\.imsg-send:before,\.imsg-field:before\{[^}]*background:linear-gradient\(140deg,rgba\(255,255,255/, '按钮基础样式里也要有');
    /* 身子那一层也要磨砂，不然没换背景时点开还是一块死色 */
    assert.match(s, /\n\.imsg-b\{[^}]*backdrop-filter:blur\(\d+px\)/, '没换背景时气泡也得是磨砂的');
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
  assert.match(source('renderPhoneIMsg'), /oninput="phSmsTyping\(\);phFxSync\(\)"/);
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

/* ===== 主号／匿名号那条不压在键盘上面 ===== */
test('主号／匿名号的切换不出现在聊天页，拨号键盘那页本来就有', () => {
  const fn = source('renderPhoneIMsg');
  assert.equal(/smslinebar/.test(fn), false, '那条又压回输入框上面了');
  assert.equal(/phLineSwitchHTML/.test(fn), false);
  assert.equal(/roleChat/.test(fn), false, 'roleChat 只为那条服务，跟着一起撤掉');
  /* 但入口本身不能没了：拨号键盘那页还得有 */
  assert.match(source('phKeypadHTML'), /\$\{phLineSwitchHTML\(\)\}/, '拨号键盘那页的切换不能一起删掉');
  for (const x of [app, priv]) assert.match(x, /function phLineSwitchHTML\(\)/);
  /* 陌生号那条老线只在匿名线程里显示，本来就是对的，别动 */
  assert.match(source('renderPhoneSMS'), /roleChat&&alias\?phLineSwitchHTML\(\):''/);
  for (const s of shells) assert.equal(/\.imsg\.hasbg \.smslinebar/.test(s), false, '跟着撤掉的样式又回来了');
});

/* ===== 白雾去掉，只留磨砂＋高光 ===== */
test('气泡和按钮里面不再蒙一层白雾，只有磨砂', () => {
  /* 她说「里面那种白色的雾感我不想要，要磨砂的质感，高光保留」。
     白雾只会在「白铺满了整块形状」的时候出现——所以规矩是：
     白只许画在描边层，而描边层一定是个被挖空的环；身子那一层一点白都不许画。 */
  const body = s => [
    /\n\.imsg-b\{[^}]*\}/,
    /\.imsg\.hasbg \.imsg-row\.them \.imsg-b\{[^}]*\}/,
    /\.imsg\.hasbg \.imsg-row\.me \.imsg-b\{[^}]*\}/,
    /\.imsg\.hasbg \.imsg-rb,[^{]*\.imsg\.hasbg \.imsg-field\{[^}]*\}/,
    /\.imsg\.hasbg \.imsg-field\{background:[^}]*\}/,
  ].map(re => { const m = s.match(re); assert.ok(m, '找不到身子那一层：' + re); return m[0]; });
  for (const s of shells) {
    for (const rule of body(s)) {
      assert.equal(/rgba\(255,255,255/.test(rule.replace(/box-shadow:[^;}]*/g, '')), false,
        '身子那一层画白了，整块就会蒙一层雾：' + rule.slice(0, 70));
      assert.match(rule, /backdrop-filter:blur\(\d+(?:\.\d+)?px\)/, '磨砂还得在：' + rule.slice(0, 70));
    }
  }
});
test('效果是按字存的，连着一样的合成一段', () => {
  const ctx = { PH_FX_ALL: ['big', 'small', 'shake', 'nod', 'wave', 'bloom', 'jitter', 'b', 'i', 'u', 's'] };
  vm.createContext(ctx);
  vm.runInContext([source('phFxSig'), source('phFxRuns')].join('\n'), ctx);
  const runs = (t, ch) => JSON.parse(vm.runInContext(`JSON.stringify(phFxRuns(${JSON.stringify(t)},${JSON.stringify(ch)}))`, ctx));
  assert.deepEqual(runs('好想你呀', [{ wave: 1 }, { wave: 1 }, { wave: 1 }, { bloom: 1, b: 1 }]),
    [{ t: '好想你', e: ['wave'] }, { t: '呀', e: ['bloom', 'b'] }], '连着的合成一段，换了效果就断开');
  assert.deepEqual(runs('abc', null), [{ t: 'abc', e: [] }], '一个效果都没有就是一整段');
  assert.deepEqual(runs('', []), []);
  assert.deepEqual(runs('ab', [null, { big: 1 }]), [{ t: 'a', e: [] }, { t: 'b', e: ['big'] }]);
});
test('她改字的时候，效果跟着那几个字走', () => {
  const ctx = { _phFx: { ch: [{ big: 1 }, { big: 1 }, null], prev: '你好吗' } };
  ctx.$ = () => ({ value: ctx.val, selectionStart: 0, selectionEnd: 0 });
  ctx.phFxSelSync = () => {};
  vm.createContext(ctx);
  vm.runInContext(source('phFxSync'), ctx);
  ctx.val = '嗯你好吗';                       /* 前面插了一个字 */
  vm.runInContext('phFxSync()', ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._phFx.ch)), [null, { big: 1 }, { big: 1 }, null], '效果要跟着往后挪');
  ctx.val = '嗯好吗';                          /* 把「你」删了 */
  vm.runInContext('phFxSync()', ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._phFx.ch)), [null, { big: 1 }, null], '删掉那个字，它的效果也跟着没');
});
test('动的字一个一个错开，整段动的不拆字', () => {
  const ctx = { esc: t => String(t), PH_FX_ALL: ['big', 'wave', 'b'], PH_FX_PERCHAR: ['shake', 'nod', 'wave', 'bloom', 'jitter'] };
  vm.createContext(ctx);
  vm.runInContext(source('phFxRunHTML'), ctx);
  const html = o => vm.runInContext(`phFxRunHTML(${o})`, ctx);
  assert.equal(html("{t:'abc',e:[]}"), 'abc', '没效果就别包标签');
  const wave = html("{t:'好想你',e:['wave']}");
  assert.match(wave, /class="imfx imfx-wave"/);
  assert.match(wave, /<b class="imfxc" style="--i:0">好<\/b><b class="imfxc" style="--i:1">想<\/b>/, '一个字一个字排延迟');
  const big = html("{t:'爱你',e:['big']}");
  assert.match(big, /class="imfx imfx-big">爱你</, '放大是整段一起，不拆字');
  assert.equal(/imfxc/.test(big), false);
  assert.equal(html("{t:'x',e:['drop database']}"), 'x', '不认识的效果名直接丢掉，不能往 class 里塞');
});
test('每个效果循环一次的长短是按她的要求定的', () => {
  /* 放大缩小要「持续久一点才缩回去」所以放到 4.2 秒，抖动要「久一点」放到 3.4 秒，
     爆发要在外面待满五秒所以是 8 秒，其余照旧 3 秒。 */
  const want = { big: '4.2s', small: '4.2s', shake: '3s', nod: '3s', wave: '3s', bloom: '3s', jitter: '3.4s' };
  for (const s of shells) {
    for (const [k, dur] of Object.entries(want)) {
      assert.match(s, new RegExp(`@keyframes imfx-${k}\\{`), `少了 ${k} 的动画`);
      assert.match(s, new RegExp(`animation:imfx-${k} ${dur.replace('.', '\\.')} infinite`), `${k} 应该是 ${dur} 一轮`);
    }
    assert.match(s, /\.imfx-wave \.imfxc\{[^}]*animation-delay:calc\(var\(--i\)\*/, '一个字一个字要错开');
  }
});
test('摇晃只左右、点头只上下，一点倾斜都不许有', () => {
  /* 她说「摇晃的话是左右摇晃，不是上下」「点头是上下摇晃不是字体倾斜」 */
  for (const s of shells) {
    const shake = s.match(/@keyframes imfx-shake\{[\s\S]*?\}\n/)[0];
    const nod = s.match(/@keyframes imfx-nod\{[\s\S]*?\}\n/)[0];
    assert.equal(/rotate\(/.test(shake), false, '摇晃又歪了，她要的是左右平移');
    assert.equal(/rotate\(/.test(nod), false, '点头又歪了，她说「不是字体倾斜」');
    assert.equal(/translateY/.test(shake), false, '摇晃不许上下动');
    assert.equal(/translateX/.test(nod), false, '点头不许左右动');
    assert.match(shake, /translateX\(-?\.\d+em\)/, '摇晃得真的左右挪');
    assert.match(nod, /translateY\(-?\.\d+em\)/, '点头得真的上下挪');
  }
});
test('抖动是频率变高，不是幅度变大', () => {
  /* 她说「抖动的话可以抖动的久一点、厉害一点，不是幅度是频率」 */
  for (const s of shells) {
    const jit = s.match(/@keyframes imfx-jitter\{[\s\S]*?\n  \d[\d.]*%\{transform:translate\([-\d.]+px,[-\d.]+px\)\}\}/)[0];
    const steps = [...jit.matchAll(/(\d[\d.]*)%\{transform:translate\((-?[\d.]+)px/g)];
    assert.ok(steps.length >= 40, `只有 ${steps.length} 步，频率提不上去（老版只有 5 步）`);
    const amp = Math.max(...steps.map(m => Math.abs(+m[2])));
    assert.ok(amp <= 2, `幅度涨到 ${amp}px 了，她明说「不是幅度」`);
    const span = +steps[steps.length - 1][1] - +steps[0][1];
    const perStep = 3.4 * span / 100 / (steps.length - 1);
    assert.ok(perStep <= 0.05, `每步 ${(perStep * 1000).toFixed(0)}ms 太慢，抖不「厉害」`);
  }
});
test('字撑不开气泡才撑，撑开了气泡跟着鼓', () => {
  /* 她说「字体放大一般气泡就会不够用了，所以气泡也可以跟着像被里面的字撑了一样，
     就跟一个皮球被撑大了一点，然后缩回去了……如果是比较小的就不会」 */
  const fn = source('phFxSwell');
  assert.match(fn, /const grow=w\*\(peak-1\)/, '撑多少要按真实宽度量，不能拍脑袋写死');
  assert.match(fn, /if\(Math\.abs\(grow\)<8\|\|Math\.abs\(grow\)\/bw<\.12\)return;/,
    '「比较小的就不会」：既要够多个像素，也要占到气泡宽度的一成二');
  assert.match(fn, /Math\.max\(\.9,Math\.min\(1\.16,/, '只能鼓「一点」，不许鼓成球');
  assert.match(fn, /node\.classList\.add\('imb-swell'\)/);
  assert.match(source('phFxPlay'), /if\(node\)phFxSwell\(node\)/, '放效果的时候要量一次');
  assert.match(source('render'), /requestAnimationFrame\(phFxSwellAll\)/, '重绘之后要重新量');
  for (const s of shells) {
    /* 气泡和字必须是同一个节拍，差一点就不像「被里面的字撑大」了 */
    assert.match(s, /\.imsg-b\.imb-swell\{animation:imb-swell 4\.2s infinite;\}/);
    const swell = s.match(/@keyframes imb-swell\{[\s\S]*?\n  78%,100%\{transform:scale\(1\)\}\}/)[0];
    const big = s.match(/@keyframes imfx-big\{[\s\S]*?\n  18%,52%[\s\S]*?78%,100%\{transform:scale\(1\)\}\}/)[0];
    const pct = t => [...t.matchAll(/(\d[\d.]*)%/g)].map(m => m[1]).join(',');
    assert.equal(pct(swell), pct(big), '气泡和字的关键帧位置对不上，鼓的时机就错开了');
    /* 一次性的发送动画和鼓气泡抢同一个 animation，必须同权重且写在后面才压得住 */
    assert.match(s, /\.imsg-b\.imbfx-slam\{animation:imbfx-slam/);
    assert.ok(s.indexOf('.imsg-b.imbfx-slam{') > s.indexOf('@keyframes imb-swell{'),
      '一次性动画要写在鼓气泡后面，不然发出去那一下会被盖掉');
  }
  assert.match(source('phFxPlay'), /node\.classList\.remove\('imbfx-slam','imbfx-loud','imbfx-gentle'\);\n\s*node\.removeEventListener/,
    '一次性动画放完要把类摘掉，不然这条气泡以后永远鼓不起来');
});
test('发出去的效果存进这条消息，正文还是干净的', () => {
  const fn = source('phSendSms');
  assert.match(fn, /const _fxRuns=phFxRuns\(text,\(_phFx\.ch\|\|\[\]\)\.slice\(0,text\.length\)\)/, '按当前这段字重新算一遍');
  assert.match(fn, /if\(_fxOn\)_m\.fx=_fxRuns;if\(_bfx\)_m\.bfx=_bfx;if\(_sfx\)_m\.sfx=_sfx;/);
  assert.match(fn, /phFxReset\(\)/, '发完要把待发的效果清掉，不然下一条还带着');
  assert.match(fn, /phMirrorSMS\(num,'me',text\)/, '同步进微信的还是干净正文，不带标签');
  assert.match(source('openPhoneSMS'), /phFxReset\(\)/, '换一条线也要清掉，不能串到别人那条');
});
test('带效果的那条底下有重播，普通的没有', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(source('phMsgHasFx'), ctx);
  const has = o => vm.runInContext(`!!phMsgHasFx(${o})`, ctx);
  assert.equal(has("{text:'在'}"), false);
  assert.equal(has("{text:'在',fx:[{t:'在',e:[]}]}"), false, '只是分了段但没效果，不该有重播');
  assert.equal(has("{text:'在',fx:[{t:'在',e:['big']}]}"), true);
  assert.equal(has("{text:'在',bfx:'slam'}"), true);
  assert.equal(has("{text:'在',sfx:'echo'}"), true);
  assert.match(source('renderPhoneIMsg'), /fx\?`<span class="imsg-fxrp" onclick="phFxReplay\(/);
});

/* ===== 带效果发送 ===== */
test('长按发送键才弹「带效果发送」，短按就是直接发', () => {
  assert.match(source('phFxHoldStart'), /setTimeout\(\(\)=>\{_phFxHold=0;phFxSendHold\(num,sk\);\},420\)/);
  assert.match(source('phFxHoldStop'), /clearTimeout\(_phFxHold\)/);
  assert.match(source('renderPhoneIMsg'), /onpointerdown="phFxHoldStart\(/);
  assert.match(source('renderPhoneIMsg'), /onpointerup="phFxHoldStop\(\)" onpointerleave="phFxHoldStop\(\)"/, '手指挪开要取消，不然误弹');
  for (const x of [app, priv]) {
    assert.match(x, /const PH_FX_BUBBLE=\[\['slam','震撼'\],\['loud','放大'\],\['gentle','缩小'\],\['invisible','隐形墨水'\]\]/);
    assert.match(x, /const PH_FX_SCREEN=\[\['echo','回声'\][\s\S]{0,180}\['star','流星'\]\]/);
  }
});
test('八个屏幕特效都真的画得出东西来', () => {
  const fn = source('phScreenFx');
  /* 只查名字在不在是不够的——把分支短路掉（if(0&&kind==='echo')）名字照样在。
     所以连 if/else if 的写法一起卡死，再由浏览器实测数一遍真的生成了多少元素。 */
  assert.ok(fn.includes("if(kind==='echo'){"), 'echo 的分支被改坏了');
  for (const k of ['balloons', 'confetti', 'love', 'fireworks', 'lasers', 'star', 'spotlight'])
    assert.ok(fn.includes(`else if(kind==='${k}'){`), `${k} 没有真的实现，只是个名字`);
  /* 聚光灯是整块渐变、不放小元素，所以是 7 不是 8 */
  assert.ok((fn.match(/add\(/g) || []).length >= 7, '至少每种都得真的往里放东西');
  assert.match(fn, /stage\.querySelectorAll\('\.imsfx'\)\.forEach\(x=>x\.remove\(\)\)/, '连着发两条不能叠一堆');
  assert.match(fn, /setTimeout\(\(\)=>\{if\(box\.parentNode\)box\.remove\(\);\}/, '放完要收掉，不能一直挂在那儿');
  for (const s of shells) for (const k of ['echo', 'balloons', 'confetti', 'love', 'fireworks', 'lasers', 'star', 'spotlight'])
    assert.match(s, new RegExp(`\\.imsfx-${k}`), `外壳里少了 ${k} 的样式`);
});
test('隐形墨水要用手指一点点划开，不是点一下全开', () => {
  /* 她说「我希望是用手指这样一点点划开的，而不是点一下，手指没有划开触碰的地方
     会被那个粒子小点覆盖」。所以盖着的是一块 canvas，不是 CSS 噪点。 */
  for (const s of shells) {
    assert.match(s, /\.iminv-cv\{position:absolute;inset:0;/, '要有盖在气泡上的那块 canvas');
    assert.match(s, /\.imsg-b\.iminv\{touch-action:none;\}/, '划的时候不能顺带把聊天滚走');
    assert.equal(/@keyframes iminv\{/.test(s), false, '老那套 CSS 噪点应该撤掉了');
    assert.equal(/\.imsg-b\.iminv>i\{visibility:hidden/.test(s), false, '字不该整条藏起来，要能一点点露');
  }
  assert.equal(/phInvToggle/.test(app), false, '点一下全开的那个撤掉了');
  const mount = source('phInvMount');
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click'])
    assert.match(mount, new RegExp(`addEventListener\\('${ev}'`), `没接上 ${ev}`);
  assert.match(mount, /setPointerCapture/, '手指滑出气泡也要继续算');
  assert.match(mount, /addEventListener\('click',e=>\{e\.preventDefault\(\);e\.stopPropagation\(\);\}\)/,
    '抬手补的那个 click 不能去开气泡菜单');
  assert.match(mount, /const end=\(\)=>\{st\.down=false;if\(st\.done\)phInvDrop\(st\);\};/,
    '手指抬起来才撤 canvas；提前撤，这一划剩下的就落到气泡上了');
  const scratch = source('phInvScratch');
  assert.match(scratch, /createRadialGradient/, '笔刷要是软边的，硬圆很难看');
  assert.match(scratch, /st\.grid\[i\]/, '要记下划开了多少');
  assert.match(scratch, /PH_INV_DONE/);
  const fin = source('phInvFinish');
  assert.match(fin, /if\(!st\.down\)phInvDrop\(st\)/, '手指还没抬起来就不能撤掉 canvas，不然这一划会落到气泡上');
  assert.match(app, /const PH_INV_DONE=\.\d+;/);
  const done = parseFloat(app.match(/const PH_INV_DONE=(\.\d+);/)[1]);
  assert.ok(done >= .4 && done <= .8, `划开 ${done} 就全亮，太容易或太难都不对`);
  assert.match(source('render'), /if\(c\.p==='phonesms'&&typeof phInvMountAll==='function'\)requestAnimationFrame\(phInvMountAll\)/,
    '每次重绘都要把沙子重新盖上');
  assert.match(source('phFxPlay'), /phInvReset\(node\)/, '重播要把沙子盖回去');
});
test('文字效果能单个字单个字地挑', () => {
  /* 她说「比如说我爱你这三个字，我只想要爱这个有文字效果，就是可以单选去做」。
     原来靠 textarea 的选区，可她一碰 ＋ 号 textarea 就失焦、选区塌了，
     phFxOpenText 再读一次就读到空的，于是每次都退化成整段一起动。
     现在面板里把整句话一个字一个字摆出来，点哪个是哪个。 */
  const modal = source('phFxTextModal');
  assert.match(modal, /class="imfx-pick"/, '面板里要有逐字挑的那一排');
  assert.match(modal, /Array\.from\(text\)/, '按字符拆，不是按 UTF-16 码元，不然 emoji 会被劈开');
  assert.match(modal, /onpointerdown="phFxPickDown\(\$\{i\}\)"/);
  assert.match(modal, /onpointerenter="phFxPickOver\(\$\{i\}\)"/, '按住往旁边拖要能连选');
  assert.match(modal, /phFxRuns\(text,ch\)/, '预览的是整句话，这样一眼看得出只有那个字在动');
  /* 真的跑一遍：她在输入框里选了「爱」，打开面板就该只选中「爱」 */
  const open = {
    PH_FX_TEXT: [['big', '放大']], PH_FX_ALL: ['big'], Object, Array, String, Set, Math,
    toast: () => {}, phFxTextModal: () => {},
    _phFx: { ch: [], prev: '我爱你' }, _phFxSel: { s: 1, e: 2 }, _phFxPick: [],
    $: () => ({ value: '我爱你', selectionStart: 1, selectionEnd: 2 }),
  };
  vm.createContext(open);
  vm.runInContext([source('phFxSync'), source('phFxSelSync'), source('phFxPickSet'), source('phFxOpenText')].join('\n'), open);
  vm.runInContext('phFxOpenText()', open);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(_phFxPick)', open)), [1],
    '她选中了「爱」，打开面板就该只有「爱」是选中的，不能整段全选');
  /* 她说「选文字效果默认不全选蓝色，让我自己去点，要不然文字多的话还得一个个取消」：
     没划选区的时候打开就是一个都不选，想整条都加自己点「全选」。 */
  open._phFxSel = { s: 0, e: 0 };
  open.$ = () => ({ value: '我爱你', selectionStart: 0, selectionEnd: 0 });
  open._phFxPick = [];
  vm.runInContext('phFxOpenText()', open);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(_phFxPick)', open)), [],
    '没划选区就一个字都不选，不能默认整段全选中');
  assert.match(source('phFxTextModal'), /phFxPickAll\(\)/, '得留一个「全选」按钮给她');
  /* 点一下不能翻两次：pointerdown 已经处理过的，补发的 click 要跳过 */
  assert.match(source('phFxPickDown'), /_phFxPickDone=1/);
  assert.match(source('phFxPickTap'), /if\(_phFxPickDone\)\{_phFxPickDone=0;return;\}/);
  /* 真的只给挑中的那几个字加 */
  const ctx = {
    PH_FX_TEXT: [['big', '放大'], ['burst', '爆发']], PH_FX_ALL: ['big', 'burst', 'b'],
    Object, Array, String, toast: () => {}, document: { querySelector: () => null },
    _phFx: { ch: [], prev: '我爱你' }, _phFxPick: [1],
    $: () => ({ value: '我爱你' }), phFxTextModal: () => {},
  };
  vm.createContext(ctx);
  vm.runInContext([source('phFxSig'), source('phFxSelKeys'), source('phFxPickSet'), source('phFxToggle')].join('\n'), ctx);
  vm.runInContext("phFxToggle('burst')", ctx);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(_phFx.ch)', ctx)),
    [null, { burst: 1 }, null], '「我爱你」里只有「爱」拿到效果');
  for (const s of shells) {
    assert.match(s, /\.imfx-pick b\{[^}]*cursor:pointer/, '每个字是一个可点的小格子');
    assert.match(s, /\.imfx-pick b\.on\{[^}]*#0a84ff/, '选中要看得出来');
    assert.match(s, /\.imfx-pick\{[^}]*touch-action:none/, '拖选的时候别把弹窗滚走');
  }
});
test('回声改成满屏气泡互相交替绕圈', () => {
  /* 她说「那个满屏飘字的效果，是那种我之前给你发的所有气泡，互相交替绕圈，
     意思是那个回声要改一下」 */
  const fn = source('phScreenFx');
  /* 她说「回声效果还是不对，你能不能参考一下真实的短信」。真机的 Echo 不转圈：
     副本从【这条气泡自己的位置】炸出去铺满整屏，停一会儿，再收回气泡里消失。 */
  assert.equal(/'ccw'/.test(fn), false, '逆时针那套该删干净了');
  assert.equal(/rings=\[/.test(fn), false, '还在按圈铺，说明又绕回去了');
  assert.match(fn, /document\.querySelector\(`\.imsg-b\[data-mid="\$\{m\.id\}"\]`\)[\s\S]{0,260}--ox/,
    '出发点必须是这条气泡自己的位置');
  assert.match(fn, /const a=n\*2\.399963/, '落点用黄金角铺开，才既均匀又不成行');
  assert.match(fn, /ox=Math\.max\(8,Math\.min\(92,\(r\.left\+r\.width\/2-SR\.left\)\/SW\*100\)\)/,
    '原点要按这条气泡的真实位置算，不能写死在屏幕中间');
  assert.match(fn, /oy=Math\.max\(8,Math\.min\(92,\(r\.top\+r\.height\/2-SR\.top\)\/SH\*100\)\)/);
  assert.match(fn, /--x:\$\{px\.toFixed\(0\)\}px;--y:\$\{py\.toFixed\(0\)\}px/, '每一份要有自己的落点');
  for (const s of shells) {
    for (const k of ['imsfx-orbit-cw', 'imsfx-unspin-cw', 'imsfx-orbit-ccw', 'imsfx-unspin-ccw'])
      assert.equal(new RegExp(`@keyframes ${k}\\{`).test(s), false, '绕圈那套该删干净了：' + k);
    assert.match(s, /@keyframes imsfx-echo\{/, '少了回声本身的关键帧');
    /* 从原点出发、停住、再回原点：首尾都是 translate(0,0)，中间两帧停在落点上 */
    const e = s.match(/@keyframes imsfx-echo\{[\s\S]*?\n  100%\{[^}]*\}\}/)[0];
    assert.equal((e.match(/translate\(0,0\)/g) || []).length, 2, '要从气泡出发、再收回气泡里');
    assert.equal((e.match(/translate\(var\(--x\),var\(--y\)\)/g) || []).length, 2, '中间要在落点上停一会儿');
    assert.equal(/var\(--r\)/.test(e), false, '还在按半径走，说明又绕回圈里去了');
    assert.match(s, /\.imsfx-echo i\{left:var\(--ox\);top:var\(--oy\)/, '每一份的原点就是那条气泡');
    assert.equal(/\.imsfx-echo i>b\{[^}]*animation:/.test(s), false, '不绕圈就不需要里层反着转了');
    assert.equal(/\.imsfx i\{[^}]*font-style:normal/.test(s), true,
      '粒子是 <i>，不复位的话回声气泡里的字会被浏览器弄成斜体');
    /* 飞出去要有「甩出去再稳住」的手感，所以整段挂一条 cubic-bezier；
       中间那两帧是同一个落点，所以停的那一下是真的停住，不是慢慢挪。 */
    assert.match(s, /\.imsfx-echo i\{[^}]*animation:imsfx-echo cubic-bezier/, '回声少了自己的时间函数');
  }
});
test('八个屏幕特效都重做过，不是几个色块', () => {
  const fn = source('phScreenFx');
  /* 每次重播、换台设备看到的都得一样，所以不能用 Math.random */
  assert.equal(/Math\.random\(\)/.test(fn), false, '特效不能用随机，重播就不一样了');
  assert.match(fn, /const rnd=\(a,b\)=>\{_s=\(_s\*1664525/, '要用按消息 id 算死的伪随机');
  assert.match(fn, /m&&m\.id&&document\.querySelector\(`\.imsg-b\[data-mid="\$\{m\.id\}"\]`\)/,
    '聚光灯要打在这条消息上，不是随便找个地方暗下来');
  /* 她说「我要看到那种绽放的很漂亮的五彩的烟花」：颜色要按角度绕色相环走 */
  assert.match(fn, /const hue=\(a\)=>`hsl\(/, '烟花的颜色要按色相算，不是从几个固定色里挑');
  assert.match(fn, /--c:\$\{hue\(h0\+t\*span\)\}/, '同一朵里每个碎片的颜色要跟着角度变，才是五彩的');
  const layers = fn.match(/for\(const layer of \[([\s\S]*?)\]\)\{/)[1];
  assert.equal((layers.match(/\{n:\d+/g) || []).length, 2, '要外圈一大圈、内圈一小圈套着开，只剩一圈就不「绽放」了');
  assert.match(layers, /\{n:40,r0:82/, '外圈');
  assert.match(layers, /\{n:20,r0:34/, '内圈');
  assert.match(fn, /--tail:/, '碎片要带尾巴');
  /* 她说「烟花再多一两个」 */
  const shells2 = +fn.match(/for\(let b=0;b<(\d+);b\+\+\)\{/)[1];
  assert.ok(shells2 >= 6, `只有 ${shells2} 朵，她说再多一两个（原来 4 朵）`);
  /* 她说「爱心那个最大的不要了，改成满屏的小爱心升上去」 */
  assert.equal(/'beat'/.test(fn), false, '又把最大的那几颗爱心放回来了');
  const hearts = +fn.match(/for\(let n=0;n<(\d+);n\+\+\)add\(`left:\$\{rnd\(3,97\)/)[1];
  assert.ok(hearts >= 34, `小爱心才 ${hearts} 颗，铺不满一屏（原来 18 颗）`);
  /* 她说「流星不要一开始就固定在屏幕里，他是从屏幕最外面下来的，显得有些死板」：
     起点要么在右边框外（left>100%），要么在顶边上面（top<0） */
  assert.match(fn, /const lf=side\?rnd\(10[0-9],\d+\):rnd\([\d.]+,\d+\),tp=side\?rnd\(-\d+,\d+\):rnd\(-\d+,-\d+\);/,
    '流星起点又跑回屏幕里了');
  assert.match(fn, /const SR=stage\.getBoundingClientRect\(\),SH=/, '要量这块屏幕的真实高度，不能拿 vh 当屏幕');
  assert.match(fn, /--rise:\$\{\(SH\*\(1-cy\/100\)\)\.toFixed\(0\)\}px/, '炮弹从最底下升到 cy 那个高度');
  assert.equal(/--to:/.test(fn), false, '旧的 vh 升空参数该删了');
  /* 炸开要等炮弹升到位：升空 1.05 秒，炸开的延迟得比它晚 */
  const burstAt = +fn.match(/animation-delay:\$\{\(d\+([\d.]+)\)\.toFixed\(2\)\}s`,null,'flash'/)[1];
  assert.ok(burstAt >= 1.0, `炮弹还没升到顶（1.05 秒）就在 ${burstAt} 秒炸了`);
  for (const s of shells) {
    /* 烟花：碎片要走抛物线（外层匀速、内层重力），不是直线 */
    assert.match(s, /@keyframes imsfx-gravity\{/, '烟花碎片少了重力');
    assert.match(s, /\.imsfx-fireworks i\.shell\{/, '少了升空那一下');
    assert.match(s, /\.imsfx-fireworks i\.flash\{/, '少了炸开那一下的闪光');
    /* 她说「烟花我想要的是那种从屏幕底部升上去，然后炸开的那种」。
       升多高必须按屏幕真实高度（--rise）算——写 100vh 的话，网页版的手机
       只占窗口一小块，炮弹一出手就冲出框外，整个上升过程一眼都看不见。 */
    const shell = s.match(/@keyframes imsfx-shell\{[\s\S]*?100%\{[^}]*\}\}/)[0];
    assert.equal(/vh/.test(shell), false, '升空又按 vh 算了，会直接飞出屏幕');
    assert.match(shell, /translateY\(calc\(0px - var\(--rise\)\)\)/, '要按 --rise 这个真实像素升');
    assert.match(s, /\.imsfx-fireworks i\.shell\{bottom:0;opacity:0;/,
      '没发射的炮弹会亮在屏幕最底下：animation-delay 期间走的是元素本身的样式');
    /* 这是原来烟花最要命的一处：240 片碎片在炸开之前就全亮着，
       六十片叠在同一个点，就是一团发光的球杵在半空，把升空整个盖住了。 */
    assert.match(s, /\.imsfx-fireworks i\.spark\{width:0;height:0;opacity:0;/,
      '碎片在炸开之前必须是看不见的，不然升空全被那团光盖住');
    /* 流星：有拖尾，还要有一层会眨的小星星 */
    assert.match(s, /\.imsfx-star i\.twinkle\{[^}]*animation:imsfx-twinkle/, '少了会眨的小星星');
    /* 她说「流星也可以多一点，然后让屏幕变暗一点流星变亮可以更好看」 */
    assert.match(s, /@keyframes imsfx-night\{/, '少了把屏幕压暗的那一层');
    assert.match(s, /\.imsfx-star\{animation:imsfx-night/, '压暗要挂在整层上，才盖得住整屏');
    /* 她又说「烟花我也想让屏幕暗下来，绽放可以再放的久一点点，烟花再多一两个」 */
    assert.match(s, /\.imsfx-fireworks\{animation:imsfx-night ([\d.]+)s/, '放烟花的时候屏幕也要暗下来');
    const fwLife = +s.match(/\.imsfx-fireworks\{animation:imsfx-night ([\d.]+)s/)[1];
    assert.ok(fwLife >= 6, `整场才 ${fwLife} 秒，她要「再放久一点点」`);
    /* 她说「爱心那个最大的不要了，改成满屏的小爱心升上去就可以」 */
    assert.equal(/\.imsfx-love i\.beat\{/.test(s), false, '中间那几颗最大的爱心该删干净了');
    assert.equal(/@keyframes imsfx-beat\{/.test(s), false, '大爱心的关键帧也该删干净');
    assert.match(s, /\.imsfx-star i\.shoot>b:after\{[^}]*linear-gradient/, '流星少了拖尾');
    /* 气球：高光、结、会摆的绳子 */
    assert.match(s, /\.imsfx-balloons i>b\{[^}]*radial-gradient/, '气球少了高光');
    assert.match(s, /@keyframes imsfx-string\{/, '气球绳子不会摆');
    /* 纸屑：三种形状、三轴翻滚 */
    for (const k of ['bar', 'dot', 'ribbon']) assert.match(s, new RegExp(`\\.imsfx-confetti i\\.${k}\\{`), '纸屑少了 ' + k);
    /* 她说「五彩纸屑飘下来的时候会卡顿两下」：原来一张纸同时绕 X、Y 轴翻又没有
       perspective，转到侧面就被压成一条线，看着就是卡顿。现在下落和扇动分两层，
       下落是纯 linear 的直线（不许再掺旋转），扇动最扁也留 .26。 */
    const fall = s.match(/@keyframes imsfx-fall\{[\s\S]*?\n  100%[^}]*\}\}/)[0];
    assert.equal(/rotate/.test(fall), false, '下落这一层不许再带旋转，一带就会被转成一条线');
    assert.match(fall, /translate\(var\(--drift\),var\(--drop\)\)/, '落距要按屏幕真实高度算');
    assert.match(s, /\.imsfx-confetti i>b\{[^}]*animation:imsfx-flutter linear infinite/, '扇动是里层自己的事');
    const flut = s.match(/@keyframes imsfx-flutter\{[\s\S]*?\n  100%[^}]*\}\}/)[0];
    const flat = [...flut.matchAll(/scaleX\(([\d.]+)\)/g)].map(m => +m[1]);
    assert.ok(Math.min(...flat) >= 0.2, `扇到最扁只剩 ${Math.min(...flat)}，又要被压成线了`);
    /* 爱心：一条 SVG 路径做遮罩，一整块。两个圆加一个方块那种拼法她一眼看出接缝，
       说「爱心分界线明显拼接，不合格」——所以不许再回去拼。 */
    assert.match(s, /\.imsfx-love i>b>u\{[\s\S]*?-webkit-mask:url\("data:image\/svg\+xml/,
      '心要用一条 SVG 路径做遮罩；-webkit- 那条不能少，少了 iOS 上整颗心会变成一个方块');
    assert.match(s, /\.imsfx-love i>b>u\{[\s\S]*?[^-]mask:url\("data:image\/svg\+xml/, '不带前缀的那条也要有');
    assert.equal(/\.imsfx-love i>b:before/.test(s), false, '又回去拿两个圆一个方块拼了，接缝会露出来');
    /* 她说「爱心升上去也会一卡一卡的」：ease-out 会让每一段都减速到停。
       上升这一层必须是 linear，而且关键帧里只有首尾两个 transform，中间只动透明度，
       这样整段就是一条匀速直线，中途没有任何一个停顿点。 */
    assert.match(s, /\.imsfx-love i\.up\{[^}]*animation:imsfx-heart linear forwards/,
      '上升那层又变回 ease 了，中途会停一下');
    const rise = s.match(/@keyframes imsfx-heart\{[\s\S]*?\n  100%[^}]*\}\}/)[0];
    assert.equal((rise.match(/transform:/g) || []).length, 2, '上升只许在首尾写 transform，中间写了就会变速');
    assert.equal(/vh/.test(rise), false, '别再用 vh，网页版会一下子飘出框外');
    assert.equal(/\.imsfx-love i\{[^}]*font-size:var\(--sz\)/.test(s), false, '也别用 ❤ 这个字形，放大就是马赛克');
    /* 烟花要五彩、要绽放：彩环、碎片尾巴、双层 */
    assert.match(s, /\.imsfx-fireworks i\.ring\{[\s\S]*?width:var\(--rd\)/, '炸开要推出一圈彩环');
    assert.match(s, /@keyframes imsfx-ring\{[\s\S]*?scale\(\.06\)/, '环要从很小长到最大');
    assert.equal(/--rs:/.test(s), false, '环不许再拿小圆去 scale 放大，边框和投影会糊成色块');
    assert.match(s, /\.imsfx-fireworks i\.spark>b:after\{[\s\S]*?rotate\(var\(--ta\)\)/, '碎片背后要拖一小截尾巴');
    /* 气球的线：右边框压在中心线上，从结那儿垂下来 */
    assert.match(s, /\.imsfx-balloons i>u\{[\s\S]*?border-right:1px/, '线要靠右边框画，左边框会离中心线差一截');
    assert.match(s, /\.imsfx-balloons i>u\{[\s\S]*?margin-left:-15px/, '元素右边缘要正好压在气球中心线上');
    assert.match(s, /\.imsfx-balloons i>u\{[\s\S]*?transform-origin:100% 0/, '摆动的支点在结上');
    /* 激光有光晕，聚光灯有暖光圈和浮尘 */
    assert.match(s, /\.imsfx-lasers i\{[^}]*box-shadow:0 0 12px 2px var\(--c\),0 0 34px 6px var\(--c\)/, '激光少了光晕');
    assert.match(s, /\.imsfx-spotlight i\.halo\{/, '聚光灯少了暖光圈');
    assert.match(s, /\.imsfx-spotlight i\.dust\{/, '聚光灯少了浮尘');
  }
});
test('加了效果，字体不许变', () => {
  /* 她说「我发现选有特效的字体会变，保留原来的字体不要变，只加效果不变字体」。
     效果是拿 <em> 和 <b> 包出来的，浏览器默认就是斜体和加粗，之前没复位。 */
  for (const s of shells) {
    const base = s.match(/\n\.imfx\{[^}]*\}/)[0], per = s.match(/\n\.imfxc\{[^}]*\}/)[0];
    for (const [name, rule] of [['.imfx', base], ['.imfxc', per]]) {
      assert.match(rule, /font-style:inherit/, `${name} 没把 <em> 的斜体复位`);
      assert.match(rule, /font-weight:inherit/, `${name} 没把 <b> 的加粗复位`);
      assert.match(rule, /font-family:inherit/, `${name} 字族也要跟着正文`);
    }
    /* B/I/U/S 是她自己点的，那四个还得管用——它们写在后面，优先级压得住 */
    assert.ok(s.indexOf('.imfx-b{font-weight:800;}') > s.indexOf('.imfx{display:inline-block;font-style:inherit'),
      'B 那条要写在复位后面，不然点了加粗也没用');
    assert.match(s, /\.imfx-i\{font-style:italic;\}/);
  }
});
test('角色也能发效果，他想发就发', () => {
  /* 她说「角色也是知道我发的是带文字效果的，他自己也可以发，他想发就可以发，
     告诉他有这个功能可以让他使用就行，所有的功能效果他都可以想发就可以发」 */
  const help = source('phFxTagHelp');
  for (const k of ['气泡效果', '屏幕效果', '字效']) assert.ok(help.includes(k), '提示词里少了 ' + k);
  assert.match(help, /PH_FX_BUBBLE\.map/, '四个气泡效果要列给他');
  assert.match(help, /PH_FX_SCREEN\.map/, '八个屏幕效果要列给他');
  assert.match(help, /PH_FX_TEXT\.map/, '八个文字效果要列给他');
  /* 三条短信线都要告诉他 */
  assert.equal((app.match(/\+phFxTagHelp\(\)/g) || []).length, 3, '角色短信、陌生号、伪装号三条线都要带上');
  const ctx = {
    PH_FX_TEXT: [['big', '放大'], ['burst', '爆发']],
    PH_FX_BUBBLE: [['slam', '震撼'], ['invisible', '隐形墨水']],
    PH_FX_SCREEN: [['fireworks', '烟花'], ['echo', '回声']],
    PH_FX_ALL: ['big', 'burst'], Object, Array, String,
  };
  vm.createContext(ctx);
  vm.runInContext([source('phFxSig'), source('phFxRuns'), source('phFxKeyByName'),
    app.match(/const PH_FX_TAG=[^\n]*/)[0], source('phFxParseTags')].join('\n'), ctx);
  const parse = t => JSON.parse(vm.runInContext(`JSON.stringify(phFxParseTags(${JSON.stringify(t)}))`, ctx));
  const a = parse('[气泡效果|震撼] [屏幕效果|烟花] [字效|爆发|想你]我好想你呀');
  assert.equal(a.text, '我好想你呀', '标签不能留在正文里');
  assert.equal(a.bfx, 'slam');
  assert.equal(a.sfx, 'fireworks');
  assert.deepEqual(a.fx, [{ t: '我好', e: [] }, { t: '想你', e: ['burst'] }, { t: '呀', e: [] }],
    '字效只落在他点名的那几个字上');
  assert.equal(parse('[屏幕效果|drop table]测试').sfx, '', '不认识的效果名直接丢掉，不能往 class 里塞');
  assert.equal(parse('就是普通一句话').fx, null, '没写标签就别硬塞个空 runs');
  assert.equal(parse('[字效|爆发|没这几个字]我好想你呀').fx, null, '他点的字不在这条里就当没写');
  /* 收到的时候要真的挂上去、真的放出来 */
  const recv = source('phReceiveSms');
  assert.match(recv, /phFxParseTags\(phCleanSmsText\(text\)\)/);
  assert.match(recv, /if\(tag\.fx\)m\.fx=tag\.fx;if\(tag\.bfx\)m\.bfx=tag\.bfx;if\(tag\.sfx\)m\.sfx=tag\.sfx;/);
  assert.match(recv, /if\(phMsgHasFx\(m\)\)setTimeout\(\(\)=>phFxPlay\(m,\$\('#smsbody'\)\)/, '收到就该放，不用她点重播');
  assert.match(recv, /phMirrorSMS\(num,'them',m\.voice\?\(m\.text\+\(m\.trans\?'（'\+m\.trans\+'）':''\)\):text\)/,
    '同步进微信的还是干净正文；语音就把说的话和翻译带过去');
});
test('加效果那一下重绘，输入框里的字不能被冲掉', () => {
  /* 第一版就是这么丢的：加完效果 render() 一次，textarea 是空的，字没了 */
  const fn = source('renderPhoneIMsg');
  assert.match(fn, /\$\{esc\(_phFx\.prev\|\|''\)\}<\/textarea>/, '正在打的字要带进标签里');
  assert.match(fn, /<div class="imsg-bar\$\{String\(_phFx\.prev\|\|''\)\.trim\(\)\?' typing':''\}"/, '发送键的状态也要跟着算');
});

test('白雾的根在描边层：白必须被剪成一个环，不能铺满整块', () => {
  /* 踩过两次。第一次只把里面那层改成 transparent，她说「还是有明显的白雾，
     我没有看到任何变化」——因为白是描边层画的，铺满整块，里面那层的 blur
     又把它糊开了。第二次干脆一点白都不画，她说「你现在是完全是透明的状态」。
     真正的解法是：白照画，但描边层被剪成一条环，中间是洞；而且它压在磨砂上面，
     不在磨砂下面，所以谁都糊不到它。 */
  for (const s of shells) {
    for (const who of ['them', 'me']) {
      const rim = s.match(new RegExp(`\\.imsg-row\\.${who} \\.imsg-b:before\\{clip-path:polygon`));
      assert.ok(rim, `${who} 的描边层没有被剪成环，白会铺满整块`);
    }
    /* 磨砂在身子上（父元素），描边在 :before（子元素），子元素永远画在父元素上面 */
    assert.match(s, /\n\.imsg-b\{[^}]*backdrop-filter:blur\(\d+px\)[^}]*\}/, '磨砂要在身子那一层');
    assert.match(s, /\n\.imsg-b:before\{content:'';position:absolute;inset:0;/, '描边层要盖在身子上面');
    /* 描边层自己不许再糊，一糊就会把白摊开 */
    for (const rule of s.match(/\.imsg[^{}]*:before\{[^}]*\}/g) || []) {
      if (!/rgba\(255,255,255/.test(rule)) continue;
      assert.equal(/backdrop-filter:[^;]*blur/.test(rule), false, '描边层不能糊：' + rule.slice(0, 70));
    }
  }
});
test('爆发：每个字往外蹦，方向按序号算死，不是随机', () => {
  const fn = source('phBurstPlay');
  /* 方向按序号算死，同一条消息每次重播、换台设备看到的都一样——不能用随机 */
  assert.equal(/Math\.random/.test(fn), false, '爆发不能用随机，重播就不一样了');
  assert.match(fn, /const dir=i%2\?1:-1,bx=dir\*\((\d+)\+\(\(i\*37\)%(\d+)\)\)/, '一左一右按序号分开，不能全往一边蹦');
  /* 她说「不要爆发的太远，稍微离得近一点、范围小一点，但是弹没问题」 */
  const [, bx0, bxSpan] = fn.match(/bx=dir\*\((\d+)\+\(\(i\*37\)%(\d+)\)\)/);
  assert.ok(+bx0 + +bxSpan <= 95, `最远能蹦到 ${+bx0 + +bxSpan}px，她嫌太远了`);
  const [, fy0, fySpan] = fn.match(/fy=(\d+)\+\(\(i\*53\)%(\d+)\)/);
  assert.ok(+fy0 + +fySpan <= 115, `最低能掉到 ${+fy0 + +fySpan}px，离气泡太远了`);
  assert.match(fn, /stage=document\.querySelector\('\.screen'\)/, '要贴到屏幕层上，不是气泡里');
  assert.match(fn, /em\.classList\.add\('away'\)/, '飞的时候原来那几个字要藏起来');
  assert.match(fn, /b\.textContent=ch\.textContent/, '副本是照原字复制的');
  assert.match(fn, /font-size:\$\{cs\.fontSize\};font-weight:\$\{cs\.fontWeight\};font-family:\$\{cs\.fontFamily\}/,
    '字体要照抄原来那几个字，不然飞出去就变样了');
  assert.match(fn, /PH_BURST_GONE/, '消失多久要用那个常量，别在函数里又写一个数');
  for (const x of [app, priv])
    assert.match(x, /const PH_BURST_FLY=2300,PH_BURST_GONE=5000;/, '摔完要整整五秒才回来');
  assert.match(source('phFxPlay'), /phBurstPlay\(node\)/, '放效果的时候要真的放爆发');
  for (const s of shells) {
    /* 气泡自己带 clip-path（小尾巴是剪出来的），放在气泡里的字一飞出边缘就被整块裁掉，
       所以「蹦出去」这件事在气泡里根本做不到——实测截图里气泡是空的。
       现在爆发的字是复制一份贴到屏幕层（.imburst）上飞的。 */
    assert.equal(/animation:imfx-burst/.test(s), false,
      '爆发又挂回气泡里了，会被气泡的 clip-path 裁掉，等于看不见');
    assert.match(s, /\.imburst\{position:absolute;inset:0;/, '少了屏幕层');
    assert.match(s, /\.imfx-burst\.away \.imfxc\{visibility:hidden;\}/, '飞的时候原来那几个字要藏起来');
    assert.match(s, /@keyframes imburst-back\{/, '飞完要弹回来');
    /* 她说「会在屏幕上蹦两下消失，就是像摔了两下，第一下是斜的第二下就可能是倒着的」：
       落点 --fy 要在关键帧里出现两次（两次触地），而且角度一路往上加，
       第二下落地时转过 180° 上下，正好是倒着的。 */
    const fly = s.match(/@keyframes imburst-fly\{[\s\S]*?\n  100%[^}]*\}\}/)[0];
    const lands = [...fly.matchAll(/,var\(--fy\)\) scale/g)].length;
    assert.equal(lands, 4, `贴着地面的关键帧 ${lands} 个——该是「摔两下 + 落定 + 滑出去」正好四个`);
    /* 两次真的弹起来：第一下摔完抬到 --h2，第二下摔完抬到 --h3，一次比一次低 */
    const seq = fly.replace(/\s+/g, '');
    assert.match(seq, /var\(--fy\)\)scale\(1\.3\)[\s\S]*var\(--h2\)[\s\S]*var\(--fy\)\)scale\(1\.1\)[\s\S]*var\(--h3\)[\s\S]*var\(--fy\)\)scale\(1\)/,
      '摔—弹—摔—弹—落定这个顺序被打乱了');
    assert.match(fly, /rotate\(calc\(var\(--r1\) \+ 188deg\)\)/, '第二下落地要翻到接近倒着');
    assert.match(fly, /var\(--h1\)[\s\S]*var\(--h2\)[\s\S]*var\(--h3\)/, '三次弹起的高度要一次比一次低');
  }
  for (const x of [app, priv]) {
    assert.match(x, /\['burst','爆发'\]\]/, '面板里要有「爆发」这一项');
    assert.match(x, /PH_FX_PERCHAR=\['shake','nod','wave','bloom','jitter','burst'\]/, '爆发是一个字一个字动的');
  }
});
test('整屏特效盖满整个手机屏，不是只盖聊天那一块', () => {
  /* 她说「全屏气泡一定是在全屏上面的，不是在一个位置」 */
  assert.match(source('phScreenFx'), /document\.querySelector\('\.screen'\)\|\|document\.querySelector\('\.imsg'\)/,
    '要挂在手机屏那一层，.imsg 只是聊天那一块');
  for (const s of shells) {
    assert.match(s, /\.imsfx\{position:absolute;inset:0;[^}]*z-index:2200/, '层级要压在聊天内容上面');
    assert.match(s, /\.screen\{position:relative;/, '手机屏得是定位祖先，不然 inset:0 贴错地方');
  }
});
test('信息这一片的弹窗不用粉按钮，跟气泡同一个蓝', () => {
  for (const s of shells) assert.match(s, /\.btn\.imblue\{background:#0a84ff!important/);
  for (const fn of ['phFxTextModal', 'phFxSendModal', 'phSmsPlusMenu', 'phSmsMenu']) {
    const src = source(fn);
    assert.equal(/class="btn p"/.test(src), false, `${fn} 里还有粉按钮`);
  }
});

/* ===== 正在输入 ===== */
test('角色在短信里也有「正在输入」的三个小点', () => {
  const ctx = { render: () => { ctx.drew = (ctx.drew || 0) + 1; }, phDigits: n => String(n), _phSmsTyping: {} };
  ctx.cur = () => ({ p: 'phonesms', num: '138', sk: '138' });
  vm.createContext(ctx);
  vm.runInContext([source('phSmsTypingKey'), source('phSmsTypingSet'), source('phSmsTypingOn')].join('\n'), ctx);
  assert.equal(vm.runInContext("phSmsTypingOn('138','138')", ctx), false);
  vm.runInContext("phSmsTypingSet('138','138',true)", ctx);
  assert.equal(vm.runInContext("phSmsTypingOn('138','138')", ctx), true);
  assert.equal(vm.runInContext("phSmsTypingOn('138','138:alias:9')", ctx), false, '别的线不该跟着亮');
  assert.ok(ctx.drew >= 1, '开关要顺手重画一次，不然点不出来');
  vm.runInContext("phSmsTypingSet('138','138',false)", ctx);
  assert.equal(vm.runInContext("phSmsTypingOn('138','138')", ctx), false);
  /* 两套气泡都得画得出来 */
  assert.match(source('renderPhoneIMsg'), /phSmsTypingOn\(num,sk\)\?`<div class="imsg-row them"><div class="imsg-b typing">/);
  assert.match(source('renderPhoneSMS'), /phSmsTypingOn\(num,sk\)\?'<div class="smsmsg them"><div class="smsbubble typing">/);
  for (const s of shells) assert.match(s, /\.imsg-b\.typing>i span\{[^}]*animation:bk 1\.2s infinite/, '和微信那三个点同一套动画');
  /* 回复过程中必须收得回去，不能永远挂着 */
  const fn = source('phRoleSmsReply');
  assert.match(fn, /phSmsTypingSet\(num,sk,true\)/);
  assert.match(fn, /finally\{phSmsTypingSet\(num,sk,false\);\}/, '出错也要收回去');
});

/* ===== 短信一次能发几条 ===== */
test('短信条数用通讯录里那两个设置，和微信同一个', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(source('phSmsBubbleRange'), ctx);
  const range = c => JSON.parse(vm.runInContext(`JSON.stringify(phSmsBubbleRange(${c}))`, ctx));
  assert.deepEqual(range('{msgMin:2,msgMax:5}'), { min: 2, max: 5 });
  assert.deepEqual(range('{}'), { min: 1, max: 4 }, '没设过就用微信的默认');
  assert.deepEqual(range('{msgMin:7,msgMax:3}'), { min: 7, max: 7 }, '最多不能小于最少');
  assert.deepEqual(range('{msgMin:0,msgMax:99}'), { min: 1, max: 10 }, '得夹住');
  assert.match(source('phRoleSmsReply'), /const range=phSmsBubbleRange\(c\),rows=phCtxRows\(\)/);
  assert.match(source('phRoleSmsReply'), /一次回复可以发 '\+range\.min\+' 到 '\+range\.max\+' 条短信/, '也要告诉模型');
  assert.match(source('phRoleSmsReply'), /let parts=phSmsBubbles\(r,range\.max\);/, '拆气泡时上限必须真的用这个设置，不能又写死成一条');
});
test('一段回复按换行拆成好几条，脏标签洗掉、超出的丢掉', () => {
  const ctx = {
    splitChatBubbles: (t, max) => String(t).split('\n').map(x => x.trim()).filter(Boolean).slice(0, max),
    cleanReply: t => String(t), phCleanSmsText: t => String(t).replace(/\[心情[^\]]*\]/g, '').trim(),
  };
  vm.createContext(ctx);
  vm.runInContext(source('phSmsBubbles'), ctx);
  const bubbles = (t, max) => JSON.parse(vm.runInContext(`JSON.stringify(phSmsBubbles(${JSON.stringify(t)},${max}))`, ctx));
  assert.deepEqual(bubbles('在等你\n外面下雨了[心情|想她]\n\n记得带伞\n多余的一条', 3), ['在等你', '外面下雨了', '记得带伞'],
    '空行要丢、标签要洗、超出上限要截断');
  assert.deepEqual(bubbles('', 4), []);
  assert.deepEqual(bubbles('[心情|只有标签]', 3), [], '洗完什么都不剩就一条都别发');
});
test('几条气泡是一条一条出来的，不是一次糊上去', async () => {
  const ctx = { got: [], setTimeout, Promise, Math };
  ctx.phReceiveSms = (num, text, c, sk) => ctx.got.push([num, text, sk]);
  vm.createContext(ctx);
  vm.runInContext(source('phDeliverSmsBubbles'), ctx);
  const t0 = Date.now();
  await vm.runInContext("phDeliverSmsBubbles('138','138',['一','二','三'],{})", ctx);
  assert.deepEqual(ctx.got.map(x => x[1]), ['一', '二', '三'], '顺序不能乱');
  assert.deepEqual(ctx.got[0], ['138', '一', '138']);
  assert.ok(Date.now() - t0 >= 1200, '中间要有停顿，不然三条同时蹦出来');
});

/* ===== 上下文和回复长度跟随全局 ===== */
test('上下文统一跟随设置里那个「带几个回合」', () => {
  const ctx = { S: { settings: { hist: 12 } } };
  vm.createContext(ctx);
  vm.runInContext(source('phCtxRows'), ctx);
  assert.equal(vm.runInContext('phCtxRows()', ctx), 24, '12 回合 → 24 条');
  ctx.S.settings.hist = 40;
  assert.equal(vm.runInContext('phCtxRows()', ctx), 80);
  ctx.S.settings.hist = 2;
  assert.equal(vm.runInContext('phCtxRows()', ctx), 8, '再小也得留点');
  ctx.S.settings.hist = 100;
  assert.equal(vm.runInContext('phCtxRows()', ctx), 160);
  ctx.S.settings = {};
  assert.equal(vm.runInContext('phCtxRows()', ctx), 24, '没设过就按默认 12 回合');
});
test('短信、陌生短信、X 私信都不再写死条数', () => {
  for (const x of [app, priv]) {
    assert.equal(/phSmsArr\(num,sk\)\.slice\(-20\)/.test(x), false, '角色短信还写死 20 条');
    assert.equal(/phSmsArr\(num,num\)\.slice\(-10\)/.test(x), false, '陌生短信还写死 10 条');
    assert.equal(/phSmsArr\(num,num\)\.slice\(-24\)/.test(x), false, '伪装短信还写死 24 条');
    assert.equal(/d\.msgs\.slice\(-10\)/.test(x), false, 'X 私信还写死 10 条');
    assert.match(x, /phSmsArr\(num,sk\)\.slice\(-rows\)/);
    assert.match(x, /d\.msgs\.slice\(-phCtxRows\(\)\)/, 'X 私信要跟随全局');
  }
});
test('抖音私信：单独设过就按它的，没设过跟随全局', () => {
  const ctx = { S: { settings: { hist: 12 } } };
  vm.createContext(ctx);
  vm.runInContext([source('phCtxRows'), source('dyChatCtxRows')].join('\n'), ctx);
  assert.equal(vm.runInContext('dyChatCtxRows({})', ctx), 24, '没单独设过 → 跟随全局的 24');
  assert.equal(vm.runInContext('dyChatCtxRows({ctx:8})', ctx), 8, '单独设过就听它的');
  ctx.S.settings.hist = 100;
  assert.equal(vm.runInContext('dyChatCtxRows({})', ctx), 60, '抖音自己那条上限还在');
});
test('回复长度也跟随设置里的「回复长度（线上聊天）」', () => {
  for (const x of [app, priv]) {
    assert.equal(/\{max:240,temp:\.8\}/.test(x), false, '角色短信还写死 240');
    assert.equal(/dyAuxChat\(\[\{role:'system',content:sys\},\.\.\.hist\],\{max:200\}\)/.test(x), false, 'X 私信还写死 200');
    assert.match(x, /\.\.\.hist\],\{max:dyReplyBudget\(\)\}\)/, 'X 私信要跟着路线上的回复长度走');
  }
  /* 微信本来就不写死 max，短信现在也一样 */
  assert.equal(/max:\d+,temp:\.8\}\);\n  r=String\(r\|\|''\)/.test(app), false);
  assert.match(source('phRoleSmsReply'), /\}\],\{temp:\.8\}\)/, '短信不再自己定长度');
});

/* ===== ＋ 就是相册 ===== */
test('＋ 里面收着照片和文字效果，下面那排没多按钮', () => {
  /* 她说「不要改变下面的布局，把功能放在 ＋ 号里」——Aa 那个按钮撤掉了 */
  const r = source('renderPhoneIMsg');
  assert.match(r, /class="imsg-plus\$\{phFxHas\(\)\?' on':''\}" onclick="phSmsPlusMenu\(/);
  assert.equal(/imsg-aa/.test(r), false, '下面那排又多出一个按钮了');
  const menu = source('phSmsPlusMenu');
  assert.match(menu, /onclick="closeModal\(\);phSmsPic\(/, '照片要在里面');
  assert.match(menu, /onclick="closeModal\(\);phFxOpenText\(\)"/, '文字效果也要在里面');
  assert.equal(/btn p"/.test(menu), false, '不要粉按钮');
  assert.match(menu, /class="btn imblue"/, '主按钮跟气泡同一个蓝');
  const fn = source('phSmsPic');
  assert.match(fn, /pickFile\('image\/\*'/, '得真的调相册');
  assert.match(fn, /compress\(f,1400,\.82\)/, '发出去就是原图，压到 900 一眼糊');
  assert.match(fn, /phSendSmsImage\(num,sk,src,\{hold:true\}\)/);
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
  ctx.visionConfigured = () => false;
  ctx.setTimeout = () => {}; ctx.phAutoSmsReply = () => {};
  vm.createContext(ctx);
  vm.runInContext([source('phSmsImgLine'), source('phSendSmsImage')].join('\n'), ctx);
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

/* ===== 短信里的照片，角色得真的看得见 ===== */
test('短信发的图真的走一遍识图，不是只丢一句「[图片]」过去', () => {
  const fn = source('phSmsPic');
  assert.match(fn, /phSendSmsImage\(num,sk,src,\{hold:true\}\)/, '先别让角色回，得等识图跑完');
  assert.match(fn, /await phSmsVision\(sent\.m,f\)/);
  assert.match(fn, /sent\.fire\(\)/, '看完了才放角色去回');
  const v = source('phSmsVision');
  assert.match(v, /visionAPI\(v,PH_SMS_VISION_PROMPT\)/, '得走真的识图线路');
  assert.match(v, /visionPhotoSource\(file,1280,\.76\)/, '和微信发图同一条线');
  assert.match(v, /visionDataURLSource\(storedImageDisplaySource\(m\.img\),1200,\.74\)/, '没有原文件时退回用存下来的图');
  assert.match(v, /m\.visionState='failed'/, '失败要记下来，不能装作看见了');
  for (const x of [app, priv]) assert.match(x, /const PH_SMS_VISION_PROMPT='请仔细、客观地用中文描述这张图片。/);
});
test('识出来的画面进上下文，没识出来就老实只写 [图片]', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(source('phSmsImgLine'), ctx);
  const line = o => vm.runInContext(`phSmsImgLine(${o})`, ctx);
  assert.equal(line("{img:'x',imgDesc:'一只橘猫趴在窗台上'}"), '[图片：一只橘猫趴在窗台上]');
  assert.equal(line("{img:'x',imgDesc:'   '}"), '[图片]', '空描述不能写成「[图片：]」');
  assert.equal(line("{img:'x'}"), '[图片]', '没识出来就别编');
  /* 三条短信线的记录里都要用它 */
  for (const x of [app, priv]) {
    assert.equal(/m\.img\?'\[图片\]':m\.text/.test(x), false, '还有地方只丢一句 [图片]');
    assert.equal((x.match(/m\.img\?phSmsImgLine\(m\):m\.text/g) || []).length +
      (x.match(/\+phSmsLineText\(m\)/g) || []).length, 3,
      '角色短信、陌生短信、伪装短信三条线都得带上描述');
  }
  assert.match(source('phRoleSmsReply'), /那段描述是系统真的看过这张图之后写下来的/, '也要告诉模型这段是真看过的');
});
test('发完图，非角色的联系人也有人回', () => {
  /* 发字那条线本来就有这个分支，发图这条一开始漏了——自建联系人发完图石沉大海 */
  const fn = source('phSendSmsImage');
  assert.match(fn, /else setTimeout\(\(\)=>phAutoSmsReply\(num,line\),700\+Math\.random\(\)\*900\);/);
  assert.match(fn, /phRoleSmsReply\(x\.id,num,line,sk\)/, '角色那条要拿带描述的那一行');
  assert.match(fn, /phRoleAliasReply\(alias\.cid,num,line/);
  assert.match(fn, /phRoleSpoofSmsReply\(thread\.cid,num,line\)/);
  assert.match(fn, /phMirrorSMS\(num,'me','（发了一张照片）'\+\(m\.imgDesc\?'：'\+m\.imgDesc:''\)\)/, '微信那边的记录也带上画面');
});
test('没识出来的那张能重新看一次', () => {
  const fn = source('phSmsRetryVision');
  assert.match(fn, /m\.visionState='pending';m\.imgDesc='';/);
  assert.match(fn, /phSmsVision\(m,null\)/);
  assert.match(source('phSmsMenu'), /bad\?`<button class="btn imblue" onclick="phSmsRetryVision\(/, '菜单里要有重试的入口');
  assert.match(source('phSmsMenu'), /ta看到的画面：\$\{esc\(m\.imgDesc\)\}/, '顺手让她看得到 ta 看见了什么');
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
  assert.match(fn, /if\(wantBg&&!phRoleSetSmsBg\(num,sk\)&&!parts\.length\)parts=\['我没找到你说的那张照片/, '没找到图又没话说时，得吭一声');
  assert.match(fn, /就在回复最后【单独一行】写 \[换背景\]/, '得告诉模型有这么一条');
  assert.match(fn, /phSmsLineText\(m\)/, '记录里要让模型看见她发过什么图、发过什么语音');
  assert.match(source('phSmsLineText'), /m\.img\?phSmsImgLine\(m\)/, '图还是写成 [图片：描述]');
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
