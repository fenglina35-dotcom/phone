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
  for (const s of shells) {
    const rim = s.match(/\.imsg\.hasbg \.imsg-rb,[^{]*\.imsg\.hasbg \.imsg-field\{[^}]*\}/)[0];
    const strong = parseFloat(rim.match(/linear-gradient\(140deg,rgba\(255,255,255,(\.\d+)\)/)[1]);
    const field = s.match(/\.imsg\.hasbg \.imsg-field\{background:linear-gradient\(140deg,rgba\(255,255,255,(\.\d+)\)[^}]*!important/);
    assert.ok(field, '输入框没有单独那条调轻的规则');
    const light = parseFloat(field[1]);
    assert.ok(light < strong, `输入框那圈(${light})必须比别处(${strong})轻，不然把字和话筒都压没了`);
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
  /* 她说「里面那种白色的雾感我不想要，要磨砂的质感，高光保留」 */
  for (const s of shells) {
    for (const sel of [
      '\\.imsg\\.hasbg \\.imsg-row\\.them \\.imsg-b:before',
      '\\.imsg\\.hasbg \\.imsg-rb:before',
      '\\.imsg\\.hasbg \\.imsg-field:before',
    ]) {
      const hit = s.match(new RegExp(sel + '[^{]*\\{[^}]*\\}'));
      assert.ok(hit, '找不到规则：' + sel);
      const rule = hit[0];
      assert.match(rule, /background:transparent/, '里面那层不能再垫白色：' + rule.slice(0, 60));
      assert.match(rule, /backdrop-filter:blur\(9px\)/, '磨砂还得在');
      assert.equal(/background:linear-gradient\([^)]*rgba\(255,255,255/.test(rule), false, '白雾又回来了');
    }
    /* 高光（描边）不许跟着一起删 */
    assert.match(s, /\.imsg\.hasbg \.imsg-rb,[^{]*\{[^}]*backdrop-filter:brightness\(1\.62\) saturate\(1\.75\)/);
  }
});

/* ===== 文字特效 ===== */
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
test('每个效果 3 秒一个循环，动作都压在前面一段', () => {
  for (const s of shells) {
    for (const k of ['big', 'small', 'shake', 'nod', 'wave', 'bloom', 'jitter']) {
      assert.match(s, new RegExp(`@keyframes imfx-${k}\\{`), `少了 ${k} 的动画`);
      assert.match(s, new RegExp(`animation:imfx-${k} 3s infinite`), `${k} 不是 3 秒循环`);
    }
    assert.match(s, /\.imfx-wave \.imfxc\{[^}]*animation-delay:calc\(var\(--i\)\*/, '一个字一个字要错开');
  }
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
test('隐形墨水盖着，点一下才看得见', () => {
  for (const s of shells) {
    assert.match(s, /\.imsg-b\.iminv>i\{visibility:hidden;\}/);
    assert.match(s, /\.imsg-b\.iminv\.shown>i\{visibility:visible;\}/);
    assert.match(s, /\.imsg-b\.iminv:after\{[^}]*animation:iminv/, '要有会动的噪点盖着');
  }
  assert.match(source('renderPhoneIMsg'), /inv\?`phInvToggle\('\$\{m\.id\}'\)`/, '这条的点击要换成揭开，不是弹菜单');
  assert.match(source('phInvToggle'), /classList\.toggle\('shown'\)/);
});
test('加效果那一下重绘，输入框里的字不能被冲掉', () => {
  /* 第一版就是这么丢的：加完效果 render() 一次，textarea 是空的，字没了 */
  const fn = source('renderPhoneIMsg');
  assert.match(fn, /\$\{esc\(_phFx\.prev\|\|''\)\}<\/textarea>/, '正在打的字要带进标签里');
  assert.match(fn, /<div class="imsg-bar\$\{String\(_phFx\.prev\|\|''\)\.trim\(\)\?' typing':''\}"/, '发送键的状态也要跟着算');
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
test('＋ 点一下直接开相册，不再弹菜单', () => {
  assert.match(source('renderPhoneIMsg'), /class="imsg-plus" onclick="phSmsPic\('\$\{esc\(num\)\}','\$\{esc\(sk\)\}'\)"/);
  const fn = source('phSmsPic');
  assert.match(fn, /pickFile\('image\/\*'/, '得真的调相册');
  assert.match(fn, /compress\(f,900,\.74\)/);
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
    assert.equal((x.match(/m\.img\?phSmsImgLine\(m\):m\.text/g) || []).length, 3,
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
  assert.match(source('phSmsMenu'), /bad\?`<button class="btn p" onclick="phSmsRetryVision\(/, '菜单里要有重试的入口');
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
  assert.match(fn, /m\.img\?phSmsImgLine\(m\):m\.text/, '记录里要让模型看见她发过什么图');
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
