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
const lines = app.split('\n');
/* 工程里绝大多数函数写在一行，但这几个页面函数带模板字面量、跨了好几行，
   所以按「下一个顶格声明」来切块，而不是只取第一行。 */
const source = name => {
  const i = lines.findIndex(x => x.startsWith(`function ${name}(`) || x.startsWith(`async function ${name}(`));
  assert.ok(i >= 0, `找不到 ${name}`);
  let j = i + 1;
  while (j < lines.length && !/^(async function |function |let |const |\/\*)/.test(lines[j])) j++;
  return lines.slice(i, j).join('\n');
};

/* 这四页是照着真实抖音做的仿真页面：编辑资料、主页访客、作品详情（漂浮弹幕）、
   底部弹出的评论区。页面里不预置任何人的文字，昵称简介一律由用户自己填。 */

test('the profile shell routes to all four new pages', () => {
  for (const f of ['dyEditView', 'dyVisitorsView', 'dyWorkView', 'dyCmSheet']) {
    assert.ok(app.includes(`function ${f}(`), `${f} 缺失`);
    assert.ok(priv.includes(`function ${f}(`), `私人版缺少 ${f}`);
  }
  const render = app.slice(app.indexOf('function renderDouyin()'), app.indexOf('function dyCmLayer()'));
  assert.match(render, /_dySub==='edit'\)return dyEditView\(\)/);
  assert.match(render, /_dySub==='visitors'\)return dyVisitorsView\(\)/);
  assert.match(render, /_dySub==='work'\)return dyWorkView\(\)/);
  assert.match(render, /dyCmLayer\(\)/, '评论区要能盖在任何一页上');
});

test('the edit page fills nothing in for her', () => {
  const src = app.slice(app.indexOf('function dyEditView()'), app.indexOf('function dyEditField('));
  assert.match(src, /资料完成度/);
  assert.match(src, /更换封面/);
  assert.match(src, /更换头像/);
  assert.doesNotMatch(src, /记录美好生活|恋人：/, '页面里不能预置任何人的简介');
  const rows = source('dyProfileRows');
  for (const label of ['名字', '简介', '性别', '生日', '所在地', '抖音号']) {
    assert.ok(rows.includes(label), `编辑页少了「${label}」这一行`);
  }
  assert.match(source('dyEditRow'), /暂不设置/, '没填的项照抖音显示「暂不设置」');
  assert.match(source('dyProfileDone'), /Math\.round\(got\/8\*100\)/);
});

test('a filled-in birthday drives the age shown on the profile', () => {
  const ctx = vm.createContext({});
  vm.runInContext(`${source('dyAgeFromBirth')};globalThis.f=dyAgeFromBirth;`, ctx);
  assert.equal(ctx.f(''), '');
  assert.equal(ctx.f('不是日期'), '');
  const y = new Date().getFullYear();
  assert.equal(ctx.f(`${y - 20}-01-01`), 20);
});

test('visitors come from her own world, never from invented names', () => {
  const src = source('dyVisitorSync');
  assert.match(src, /d\.following\|\|\[\]/, '关注过的角色会来看她的主页');
  assert.match(src, /d\.mine\|\|\[\]/, '在她作品下评论过的网友也会');
  assert.doesNotMatch(src, /chatAPI/, '访客列表不该再花一次模型调用');
  assert.match(source('dyVisitorRow'), /回关/);
  assert.match(source('dyVisitorsView'), /仅展示 30 天内已授权的访客，访客记录仅你可见/);
  assert.match(source('dyVisitorClear'), /S\.dy\.visitors=\[\]/, '访客记录可以自己清空');
});

test('the work page floats danmu over the video and keeps the rail', () => {
  const src = app.slice(app.indexOf('function dyWorkView()'), app.indexOf('/* ===== 抖音评论区'));
  assert.match(src, /\$\{dyWorkDanmu\(v\)\}\$\{dyWorkRail\(v\)\}/);
  const rail = app.slice(app.indexOf('function dyWorkRail('), app.indexOf('function dyStar('));
  for (const call of ['dyLike(', 'dyComments(', 'dyStar(', 'dyWorkMore(']) {
    assert.ok(rail.includes(call), `右侧操作栏少了 ${call}`);
  }
  assert.match(rail, /拍同款/);
  assert.match(src, /视频分析/);
  assert.match(html, /@keyframes dydm\{/, '弹幕要慢慢浮动');
});

test('the comment sheet slides up from the bottom and supports replies', () => {
  assert.match(source('dyComments'), /_dyCmOpen=true/, '点评论不再开弹窗，而是掀起底部面板');
  const sheet = app.slice(app.indexOf('function dyCmSheet('), app.indexOf('function dyCmAt('));
  assert.match(sheet, /dycm-mask/);
  assert.match(sheet, /有爱评论，说点儿好听的/);
  for (const t of ['评论', '赞', '收藏']) assert.ok(sheet.includes(`tab('${t}'`), `少了「${t}」这一栏`);
  assert.match(source('dyCmRow'), /展开 \$\{reps\.length\} 条回复/);
  assert.match(source('dyCmSend'), /host\.replies=host\.replies\|\|\[\]/, '回复要挂到被回复的那条下面');
  assert.match(source('dyCmRow'), /dycm-author">作者/);
  assert.match(html, /@keyframes dycmup\{/);
});

test('every shell carries the styles for the four pages', () => {
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    for (const cls of ['.dyed-cover{', '.dyvi-row{', '.dywk-danmu{', '.dycm{']) {
      assert.ok(css.includes(cls), `${name} 少了 ${cls}`);
    }
  }
});

/* 第二批：把「我」页上原先按下去毫无反应的地方全部接上。真实抖音里没有一个按钮
   是点了没反应的，所以这里一个纯装饰都不留——最差也给一句提示。 */

test('nothing on the profile page is a dead button any more', () => {
  const src = source('dyProfile');
  for (const [what, call] of [
    ['添加好友', 'dyFollowList()'],
    ['求更新箭头', 'dyOpenUpdate()'],
    ['主页访客', 'dyOpenVisitors()'],
    ['主页搜索', 'dyOpenMeSearch()'],
    ['全部功能', 'dyAllFeatures()'],
    ['抖音号复制', 'dyCopyDyid()'],
    ['创作 AI 作品', 'dyCompose()'],
    ['互关', "dyOpenRel('互关')"],
    ['关注', "dyOpenRel('关注')"],
    ['粉丝', "dyOpenRel('粉丝指数')"],
    ['我的订单', 'dyGoOrders()'],
    ['观看历史', 'dyOpenHistory()'],
    ['我的钱包', 'dyGoWallet()'],
    ['私密作品', 'dyPrivateWorks()'],
    ['作品排序', 'dyWorkSortMenu()'],
  ]) {
    assert.ok(src.includes(call), `「${what}」还是点不动：缺少 ${call}`);
  }
  assert.match(src, /S\.dy\.hidePromo=true/, '「参与今天的话题」的 ✕ 要真的关得掉');
  assert.match(source('dyMeTabs'), /\['作品','收藏','喜欢'\]/, '永远空着的「日常」「推荐」要去掉');
  assert.match(source('dyMeGridRows'), /v\.starred/, '「收藏」要按真的收藏过滤，不能拿点赞充数');
  assert.match(source('dyMeGridRows'), /filter\(v=>!v\.priv\)/, '私密作品不进主页网格');
});

test('the relation list reads her own world and never fabricates people', () => {
  const src = source('dyRelPeople');
  assert.match(src, /S\.contacts\|\|\[\]/, '朋友来自角色');
  assert.match(src, /S\.dy\.visitors\|\|\[\]/, '网友来自访客池');
  assert.doesNotMatch(src, /chatAPI/, '列表不该花一次模型调用');
  assert.match(source('dyRelTabs'), /'互关','关注','粉丝指数','朋友'/);
  const view = source('dyRelView');
  assert.match(view, /搜索用户备注或名字/);
  assert.match(view, /\$\{rows\.length\} 人/);
  assert.match(source('dyRelRow'), /密友/);
});

test('the spark counter comes from real consecutive chat days', () => {
  const ctx = vm.createContext({ msgs: () => ctx.rows, rows: [] });
  vm.runInContext(`${source('dySparkDays')};globalThis.f=dySparkDays;`, ctx);
  assert.equal(ctx.f('x'), 0, '没聊过就没有火花');
  const now = Date.now();
  ctx.rows = [{ time: now }, { time: now - 86400000 }, { time: now - 2 * 86400000 }];
  assert.equal(ctx.f('x'), 3);
  ctx.rows = [{ time: now }, { time: now - 3 * 86400000 }];
  assert.equal(ctx.f('x'), 1, '断了就从头算');
});

test('watch history records what she opened and can be cleared', () => {
  assert.match(source('dyOpenWork'), /dyWatchRecord\(v\)/, '点开作品要记一笔');
  assert.match(source('dySubClose'), /dyWatchFinish\(_dyWorkId\)/, '离开作品页就算看完');
  const rec = source('dyWatchRecord');
  assert.match(rec, /d\.watched\.unshift/);
  assert.match(rec, /slice\(0,120\)/, '历史有上限，不会无限涨');
  assert.match(source('dyHistoryView'), /\['用户','视频','影视综','直播'\]/);
  assert.match(source('dyHistRows'), /_dyHistOnly==='未看完'/);
  assert.match(source('dyHistClear'), /uiConfirm/, '清空要先问一句');
});

test('profile search looks inside her own page before the whole network', () => {
  const src = source('dyMeSearchResults');
  assert.match(src, /我的作品/);
  assert.match(src, /在全网搜/);
  assert.match(source('dyMeSearchView'), /搜索主页或全网内容/);
  assert.match(source('dyMeSearchRun'), /S\.dy\.history\.unshift\(q\)/, '搜过的词进历史');
});

test('the update-request page counts only the last seven days', () => {
  assert.match(source('dyUpdateRows'), /7\*864e5/);
  const view = source('dyUpdateView');
  assert.match(view, /近 7 天收到/);
  assert.match(view, /上次发布作品/);
  assert.match(view, /发布作品/);
  assert.match(view, /去直播/);
  assert.doesNotMatch(source('dyUpdateSync'), /chatAPI/, '求更新列表也不花模型调用');
});

test('the all-features sheet routes everything somewhere real', () => {
  const src = source('dyAllGroups');
  for (const label of ['发布作品', '私密作品', '主页访客', '求更新', '观看历史', '我的订单', '我的钱包', '编辑资料', '隐私设置']) {
    assert.ok(src.includes(label), `全部功能里少了「${label}」`);
  }
  assert.match(source('dyGoOrders'), /typeof openOrders==='function'/, '订单跳到已有的淘宝订单页');
  assert.match(source('dyGoWallet'), /typeof openWallet==='function'/, '钱包跳到已有的钱包');
});

test('every shell carries the styles for the second batch too', () => {
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    for (const cls of ['.dyrel-row{', '.dyh-tabs{', '.dys-box{', '.dyu-foot{', '.dyall{']) {
      assert.ok(css.includes(cls), `${name} 少了 ${cls}`);
    }
  }
});

/* 这一条是被一个真实的疏漏逼出来的：我在重做编辑资料页时删掉了旧的 editDyProfile，
   却忘了重新定义，「编辑主页」按下去只会抛 ReferenceError——截图看不出来，1900 多条测试
   也没拦住，只有真的点一下才会暴露。所以这里把 app.js 里每一个 onclick 调用的函数名
   都对着实际定义验一遍，不再只盯着抖音那一段。 */
test('every onclick in app.js resolves to a function that exists', () => {
  const ui = readFileSync(new URL('../commerce-ui.js', import.meta.url), 'utf8');
  const pixel = readFileSync(new URL('../pixel-home.js', import.meta.url), 'utf8');
  const pet = readFileSync(new URL('../pet-game.js', import.meta.url), 'utf8');
  const defined = new Set();
  for (const src of [app, ui, pixel, pet]) {
    for (const m of src.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/gm)) defined.add(m[1]);
    for (const m of src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function/g)) defined.add(m[1]);
    for (const m of src.matchAll(/^(?:const|let|var) ([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\(|[A-Za-z_$][\w$]*\s*=>)/gm)) defined.add(m[1]);
  }
  /* 语言关键字和内建对象不是「函数没定义」。 */
  for (const w of ['Math', 'String', 'Number', 'Date', 'JSON', 'Array', 'Object', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'if', 'for', 'while', 'switch', 'return', 'typeof', 'new', 'function', 'setTimeout', 'confirm', 'alert', 'encodeURIComponent', 'decodeURIComponent']) defined.add(w);
  const missing = new Map();
  for (const m of app.matchAll(/onclick="([^"]*)"/g)) {
    for (const call of m[1].matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (defined.has(call[1]) || call[1].startsWith('_')) continue;
      if (!missing.has(call[1])) missing.set(call[1], app.slice(0, m.index).split('\n').length);
    }
  }
  assert.deepEqual(
    [...missing].map(([name, line]) => `${name} (app.js:${line})`),
    [],
    '这些 onclick 指向了不存在的函数，点下去只会报错',
  );
});
