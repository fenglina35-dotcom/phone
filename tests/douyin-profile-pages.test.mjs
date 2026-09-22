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
  assert.match(src, /\$\{dyWorkDanmu\(v\)\}/);
  /* 边栏挪出了 stage（overflow:hidden 会剪掉最底下那格），但还在这一页上 */
  assert.match(src, /\$\{dyWorkRail\(v\)\}/);
  /* 右边栏现在是首页和作品详情共用的 dyRailHTML，dyWorkRail 只是转调一下 */
  assert.match(app.slice(app.indexOf('function dyWorkRail('), app.indexOf('function dyWorkSame(')), /return dyRailHTML\(v\);/);
  const rail = app.slice(app.indexOf('function dyRailHTML('), app.indexOf('function dyWorkRail('));
  for (const call of ['dyLike(', 'dyComments(', 'dyStar(', 'dyFwd(']) {
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

test('the spark only grows when both of them wrote that day, and never resets', () => {
  const ctx = vm.createContext({ Date, save() {} });
  vm.runInContext(['dySparkState', 'dySparkDayKey', 'dySparkBothToday', 'dySparkTick'].map(source).join('\n') + ';globalThis.tick=dySparkTick;globalThis.key=dySparkDayKey;', ctx);
  const now = Date.now();
  const d = { id: 'd1', cid: 'c0', msgs: [{ from: 'me', text: '在吗', time: now }] };
  assert.equal(ctx.tick(d), 0, '只有我发了，不算续上');
  d.msgs.push({ from: 'them', text: '在', time: now });
  assert.equal(ctx.tick(d), 1, '双方都发了才 +1');
  assert.equal(ctx.tick(d), 1, '一天最多涨一次');
  d.spark.day = '2020-1-1';
  d.msgs = [{ from: 'me', text: '很久以前', time: now - 40 * 86400000 }];
  assert.equal(ctx.tick(d), 1, '隔很久没聊只会定格，永远不清零');
  d.msgs.push({ from: 'me', text: '回来了', time: now }, { from: 'them', text: '嗯', time: now });
  assert.equal(ctx.tick(d), 2, '回来接着往上长');
  assert.match(source('dySparkBadge'), /🔥/, '火花挂在顶部名字旁边');
  assert.match(source('dySparkTip'), /还没续|已经续上/, '点一下要说清今天续没续上');
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

/* 第三批：抖音消息页。粉丝、赞与评论、群通知、陌生人消息、和角色的私聊。 */

test('the message page carries the five circular entries and folds strangers away', () => {
  const src = source('dyDMList');
  for (const label of ['粉丝', '赞与其他', '评论弹幕', '群通知', '限时日常']) {
    assert.ok(src.includes(label), `消息页少了「${label}」入口`);
  }
  assert.match(src, /dyStrangerFolderRow\(\)\+rows\.filter\(d=>d\.cid\)/, '陌生人收进文件夹，主列表只留角色');
  assert.match(source('dyStrangersView'), /没有互关的人发来的私信都收在这里/);
  const render = app.slice(app.indexOf('function renderDouyin()'), app.indexOf('function dyCmLayer()'));
  assert.match(render, /dyTab==='dm'\)\?''/, '消息页自己有标题栏，外壳那条要去掉，否则两个「消息」叠在一起');
});

test('unread counts come from messages that actually arrived while she was away', () => {
  assert.match(app, /live\.unread=\(\+live\.unread\|\|0\)\+1/, '对方发来的私信要算未读');
  assert.match(source('renderDyDM'), /if\(d\.unread\)\{d\.unread=0/, '打开会话就清零');
  assert.match(source('dyStrangerUnread'), /reduce/, '文件夹上的数字是里面所有人加起来的');
});

test('the fan list is built from her own world and says when each one followed', () => {
  const sync = source('dyFanSync');
  assert.match(sync, /d\.following\|\|\[\]/);
  assert.match(sync, /d\.visitors\|\|\[\]/);
  assert.doesNotMatch(sync, /chatAPI/, '粉丝列表不花模型调用');
  assert.match(source('dyFanRow'), /关注了你/);
  assert.match(source('dyFanRow'), /相互关注|回关/);
});

test('interaction rows are derived from real comments, never invented', () => {
  const sync = source('dyActSync');
  assert.match(sync, /dyActWorks\(\)\.forEach/, '只看她自己的作品');
  assert.match(sync, /v\.comments\|\|\[\]/);
  assert.doesNotMatch(sync, /chatAPI/, '互动消息不花模型调用');
  assert.match(source('dyActRows'), /tab==='评论与弹幕'/);
  assert.match(source('dyActsView'), /\['赞与其他','评论与弹幕','群通知'\]/);
  assert.match(source('dyGroupNoticeBody'), /dyApplyRow/, '群通知那一栏现在装的是真实的加群申请');
});

test('the private chat stamps time only after a gap, and the spark sits in the header', () => {
  const ctx = vm.createContext({ esc: s => String(s), dyListTime: () => '18:25' });
  vm.runInContext(`${source('dyDMStamp')};globalThis.f=dyDMStamp;`, ctx);
  const t = 1700000000000;
  const rows = [{ time: t }, { time: t + 60000 }, { time: t + 40 * 60000 }];
  assert.notEqual(ctx.f(rows, 0), '', '第一条要有时间');
  assert.equal(ctx.f(rows, 1), '', '一分钟后的那条不再重复标');
  assert.notEqual(ctx.f(rows, 2), '', '隔了 40 分钟要重新标');
  assert.match(source('renderDyDM'), /dySparkBadge\(d\)/, '火花挂在顶部标题栏，不再占聊天区第一行');
  assert.match(source('renderDyDM'), /已读/);
});

test('every shell carries the styles for the message pages', () => {
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    for (const cls of ['.dymsg-ents{', '.dyfan-row{', '.dyact-row{', '.dydm-box{', '.dymsg-fold{']) {
      assert.ok(css.includes(cls), `${name} 少了 ${cls}`);
    }
  }
});

/* 第四批：抖音群聊。建群、拉角色、公开群每天一位陌生人来申请、私密群只能邀请、管理员。 */

test('a group is created with roles inside and an owner that is her', () => {
  const src = source('dyGroupCreateDone');
  assert.match(src, /k:'me',role:'owner'/, '建群的人就是群主');
  assert.match(src, /cs\.map\(c=>\(\{k:'c:'\+c\.id,cid:c\.id,role:'member'/, '角色作为成员进群');
  assert.match(src, /open:!!open/, '建群时就决定公开还是私密');
  assert.match(src, /gnum:dyGNewNum\(\)/);
  assert.match(source('dyGroupCreateHTML'), /公开群每天会有一位陌生人来申请加入，私密群只能你自己邀请/);
});

test('exactly one stranger knocks per day, and only on public groups', () => {
  const due = source('dyApplyDueGroup');
  assert.match(due, /g\.open&&g\.lastApplyDay!==dyApplyDayKey\(\)/, '只有公开群、而且今天还没来过人');
  const check = source('dyApplyCheck');
  assert.match(check, /g\.lastApplyDay=dyApplyDayKey\(\);save\(\);/, '先占住今天');
  assert.ok(check.indexOf('lastApplyDay=dyApplyDayKey') < check.indexOf('dyApplyGenerate'),
    '要在调模型之前就占住今天，否则失败会在一天里反复烧钱');
  assert.match(check, /_dyGBusy\.apply/, '同时只跑一个');
});

test('the generated stranger carries a persona of their own', () => {
  const gen = source('dyApplyGenerate');
  assert.match(gen, /昵称/);
  assert.match(gen, /人设/);
  assert.match(gen, /回答/);
  assert.match(gen, /关注/);
  assert.match(gen, /性格不要都是乖巧懂事的/, '各种性格，不然每个都一样');
  assert.match(gen, /if\(!name\)return null/, '没解析出名字就不硬造一个人');
  assert.match(source('dyApplyPass'), /dyGMemberList\(g\)\.push/, '通过之后真的进群');
  assert.match(source('dyApplyPass'), /persona:a\.persona/, '人设跟着进群，进去之后说话才是他自己');
});

test('strangers in the group speak with their own persona, roles with theirs', () => {
  const p = source('dyGroupSpeakerPrompt');
  assert.match(p, /buildSystem\(c\)\+dyGSceneBrief\(g,m\)/, '角色用角色自己的人设');
  assert.match(p, /dyGMemberPersona\(m\)/, '陌生人用他自己的人设');
  assert.match(source('dyGSceneBrief'), /别说自己是AI/);
  const run = source('dyGroupReplyRun');
  assert.match(run, /g0\.aiOn===false\)return/, '关掉群聊 AI 就没人自动说话');
  assert.match(run, /dyGCast\(g0,fromText,forceKeys\)/, '谁开口交给出场机制决定');
  assert.match(source('dyGCast'), /dyGMaxSpeak\(g\)/, '一轮的人数上限是可以设置的');
  assert.match(source('dyGCast'), /indexOf\(dyGMemberName\(m\)\)>=0/, '被点名的一定开口');
});

test('only the owner can hand out admin, and admins can manage members', () => {
  assert.match(source('dyGAdmins'), /dyGRole\(g,'me'\)!=='owner'\)return toast/, '只有群主能设管理员');
  assert.match(source('dyGRemoveMember'), /dyGCanManage\(g,'me'\)/, '群主和管理员都能移除成员');
  assert.match(source('dyGRemoveMember'), /dyGRole\(g,m\.k\)!=='owner'/, '群主不能被移除');
  assert.match(source('dyGDisband'), /dyGRole\(g,'me'\)!=='owner'\)return toast/, '只有群主能解散');
  const ctx = vm.createContext({});
  vm.runInContext(`${source('dyGBadge')};globalThis.f=dyGBadge;`, ctx);
  assert.match(ctx.f('owner'), /群主/);
  assert.match(ctx.f('admin'), /管理员/);
  assert.equal(ctx.f('member'), '', '普通成员不带牌子');
});

test('turning a group private stops the daily knocking, and back again restarts it', () => {
  const src = source('dyGOpenToggle');
  assert.match(src, /g\.open=!g\.open/);
  assert.match(src, /if\(g\.open\)g\.lastApplyDay=''/, '转回公开要让今天重新可以来人');
  assert.match(src, /私密群，只能你自己邀请/);
});

test('the group settings page carries everything the real one does', () => {
  const src = source('dyGroupInfoView');
  for (const label of ['群聊成员', '群数据', '群管理', '群名称与头像', '群简介', '群公告', '我在本群的昵称', '群聊 AI', '查找聊天内容', '消息免打扰', '折叠群聊', '置顶聊天', '清空聊天记录', '解散群聊']) {
    assert.ok(src.includes(label), `群设置少了「${label}」`);
  }
  assert.match(src, /owner\?`<div class="dyg-card">\s*<div class="dyg-row"><span>群管理/, '群管理只给群主和管理员看');
  assert.match(source('dyGroupView'), /\['聊天','公告','置顶','收藏','设置'\]/);
});

test('every shell carries the styles for the group pages', () => {
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    for (const cls of ['.dyg-tabs{', '.dyg-badge.owner{', '.dyg-card{', '.dyg-sw{', '.dygn-row{']) {
      assert.ok(css.includes(cls), `${name} 少了 ${cls}`);
    }
  }
});

/* 第五批（修）：抖音这一整片全部走副模型，而且每一处都是 catch(e){} 静默吞掉。
   副模型配错时，微信主聊天和设置页的「测试主模型」都正常，这里却全线不动——
   用户看到的就是「刷新私信、视频搜索、群聊、私信、评论全都失败，但模型测试没问题」。 */

test('every Douyin model call falls back from the auxiliary model to the main one', () => {
  const chat = source('dyAuxChat');
  assert.match(chat, /aux:true/);
  assert.match(chat, /if\(!wechatAuxConfigured\(opt\.routeIndex\)\)throw e/, '没配副模型时刚才走的就是主模型，不必再试');
  assert.match(chat, /chatAPI\(messages,Object\.assign\(\{\},opt,\{aux:false\}\)\)/, '副模型失败要回落主模型');
  assert.match(source('dyAuxGen'), /throw last/, '两次都不行要把原因抛出去，不能返回 null 了事');
});

test('no Douyin feature swallows a model failure in silence any more', () => {
  for (const [what, marker] of [
    ['刷新推荐', "dyModelFail('刷新推荐'"],
    ['刷新私信', "dyModelFail('刷新私信'"],
    ['生成网友评论', "dyModelFail('生成网友评论'"],
    ['私信回复', "dyModelFail('私信回复'"],
    ['角色回评论', "dyModelFail('角色回评论'"],
    ['角色发作品', "dyModelFail('角色发作品'"],
  ]) assert.ok(app.includes(marker), `「${what}」失败了还是不出声：缺少 ${marker}`);
  assert.ok(app.includes("dyModelFail('群里的人接话'"), '群里没人说话时要讲出原因');
  assert.match(source('dyModelFail'), /toast\(what\+'失败：'\+dyModelReason\(e\)/);
});

test('the Douyin section no longer calls the auxiliary model directly', () => {
  const start = app.indexOf('function dyInit(){');
  const end = app.indexOf('function dyGroupNoticeBody(');
  assert.ok(start > 0 && end > start, '找不到抖音那一段');
  const region = app.slice(start, end);
  const leaks = [...region.matchAll(/aux:true/g)].map(m => region.slice(Math.max(0, m.index - 90), m.index + 10));
  const offenders = leaks.filter(x => !x.includes('dyAuxChat') && !x.includes('function dyAuxChat'));
  assert.deepEqual(offenders, [], '抖音里还有直接写 aux:true 的地方，它们不会回落主模型');
});

test('the group avatar can actually be changed', () => {
  assert.match(source('changeDyGroupAvatar'), /pickFile\('image\/\*'/);
  assert.match(source('changeDyGroupAvatar'), /g\.avatar=await compress/);
  assert.match(source('dyGroupInfoView'), /changeDyGroupAvatar\(/, '群设置里要有换头像的入口');
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    assert.ok(css.includes('.dyg-avbtn{'), `${name} 少了群头像按钮的样式`);
  }
});

/* 第六批：作品从一个 emoji 变成「正文＋旁白」的文字作品；首页顶上只留关注／推荐；
   新增朋友页；评论条数随机、角色一定回她；涨粉掉粉靠发作品挣。 */

test('a work is text now, with body paragraphs and a read-more button', () => {
  const ctx = vm.createContext({});
  vm.runInContext(['dyWorkBody', 'dyWorkParas', 'dyWorkLong'].map(source).join('\n') + ';globalThis.B=dyWorkBody;globalThis.P=dyWorkParas;globalThis.L=dyWorkLong;', ctx);
  assert.deepEqual([...ctx.P({ body: '第一段\n\n第二段' })], ['第一段', '第二段']);
  assert.equal(ctx.B({ narration: '旁白：夜里的江边' }), '夜里的江边', '没写正文就退回旁白，并去掉「旁白：」');
  assert.equal(ctx.L({ body: '短' }), false);
  assert.equal(ctx.L({ body: '字'.repeat(200) }), true);
  assert.match(source('dyWorkCardHTML'), /阅读文章/);
  assert.match(source('dyWorkThumbHTML'), /dytx-thumb/, '网格缩略图显示第一句话，不再是 emoji');
  assert.match(app, /body:o\.body\|\|''/, '模型生成的作品也要带正文');
  assert.match(app, /"body":"正文：/, '给模型的格式里要有正文这一项');
});

test('the feed keeps only 关注 and 推荐 on top, and 朋友 replaces 发现 below', () => {
  const feed = source('dyFeedView');
  assert.match(feed, /关注<\/span>/);
  assert.match(feed, /推荐<\/span>/);
  assert.doesNotMatch(feed, /LIVE|团购|商城|直播/, '顶上那一排杂的不要');
  assert.match(feed, /onclick="dyBack\(\)"/, '返回键还在');
  assert.match(app, /dytb\('friend',svgIc\('users',21\),'朋友'\)/);
  assert.match(source('dyFriendView'), /限时日常/);
  assert.match(source('dyFriendList'), /fol\.includes\(v\.cid\)/, '朋友页只看关注的人和自己');
});

test('a character always answers her comment, even when she names nobody', () => {
  const ctx = vm.createContext({ S: { couple: {}, dy: { following: [] }, contacts: [] }, getC: id => ctx.S.contacts.find(c => c.id === id) || null, Math });
  vm.runInContext(`${source('dyCommentResponder')};globalThis.f=dyCommentResponder;`, ctx);
  assert.deepEqual([...ctx.f({})], [], '一个角色都没有就没人回');
  ctx.S.contacts = [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }];
  assert.equal(ctx.f({}).length, 1, '有角色就一定有人回');
  ctx.S.couple = { cid: 'b' };
  assert.equal(ctx.f({})[0].id, 'b', '有恋人就恋人回');
  assert.equal(ctx.f({ cid: 'a' })[0].id, 'a', '在别人作品下评论，是作品主人回');
  assert.match(source('dyCmSend'), /who\.forEach\(c=>dyCharReplyComment/);
  assert.match(app, /net:3\+Math\.floor\(Math\.random\(\)\*6\)/, '网友评论条数随机');
});

test('fans are earned by posting and bleed away when she stops', () => {
  const ctx = vm.createContext({ Math, Date, String });
  vm.runInContext(['dyWorkBody', 'dyWorkReach'].map(source).join('\n') + ';globalThis.R=dyWorkReach;', ctx);
  const small = ctx.R({ body: '短', desc: '' }), big = ctx.R({ body: '字'.repeat(400), desc: '很长的文案 #话题 #另一个' });
  assert.ok(big > small * 3, '写得长、带话题的作品传得更远，努力要有回报');
  const tick = source('dyGrowthTick');
  assert.match(tick, /d\.growthDay===today\)return 0/, '一天只结算一次');
  assert.match(tick, /Date\.now\(\)-\(\+v\.ts\|\|0\)<3\*864e5/, '看最近三天发过没有');
  assert.match(tick, /-Math\.max\(1,Math\.round\(\(\+p\.fans\|\|0\)\*0\.012\)\)/, '不发就慢慢掉');
  assert.match(source('dyWorkSettle'), /if\(v\.settled\)return 0/, '同一条作品只结算一次');
  assert.match(app, /dyGrowthNotice\(\);\}/, '打开抖音时结算');
  assert.match(app, /涨了 '\+gained\+' 个粉丝/, '发布的时候就看得到涨了多少');
});

test('every shell carries the styles for the text feed', () => {
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    for (const cls of ['.dytx p{', '.dyfd-tabs{', '.dyfr-top{', '.dytx-thumb{']) {
      assert.ok(css.includes(cls), `${name} 少了 ${cls}`);
    }
  }
});

/* 第七批：每个人都有独立主页；私聊我这边也有头像、等回复时有三个点；
   私聊和群聊各自能调上下文；抖音里发生的事进角色记忆；群成员页独立；
   角色回评论必须 @ 到人；陌生人统一灰底小人；全部功能删掉点了没反应的。 */

test('anybody in 抖音 has a profile page you can open', () => {
  for (const f of ['dyUserView', 'dyPersonFind', 'dyOpenUser', 'dyGMembersView']) {
    assert.ok(app.includes(`function ${f}(`), `${f} 缺失`);
    assert.ok(priv.includes(`function ${f}(`), `私人版缺少 ${f}`);
  }
  assert.match(app, /else if\(c\.p==='dyuser'\)html=dyUserView\(\);/, '主页要挂上路由');
  assert.match(app, /if\(_dySub==='gmembers'\)return dyGMembersView\(\);/, '群成员页要独立成一页');
  const find = source('dyPersonFind');
  for (const kind of ['c:', 'n:', 'visitors', 'fans']) assert.ok(find.includes(kind), `dyPersonFind 认不出 ${kind}`);
  assert.match(source('dyVideoAuthor'), /dyOpenUser\('c:'\+v\.cid\)/, '点作品作者进他主页');
  assert.match(app, /class="dyfan-row" onclick="dyOpenUser/, '粉丝行点得进去');
  assert.match(app, /class="dyrel-row" onclick="dyOpenUser/, '互关行点得进去');
});

test('the stats on a stranger page stay put instead of rerolling every render', () => {
  const ctx = vm.createContext({});
  vm.runInContext(`${source('dyKeyHash')};globalThis.H=dyKeyHash;`, ctx);
  assert.equal(ctx.H('n:阿澈', 7), ctx.H('n:阿澈', 7), '同一个人同一个数，刷新不变');
  assert.notEqual(ctx.H('n:阿澈', 999), ctx.H('n:小柚', 999), '不同的人不该一模一样');
});

test('my own avatar shows on my side of a 私信, and waiting shows three dots', () => {
  assert.match(source('renderDyDM'), /m\.from==='me'\?av\(dyAvatar\(\),'sm'\):dyFace\(d\.avatar,'sm'\)/, '我这边也要有头像');
  assert.match(source('renderDyDM'), /dyTypingShown\('dm:'\+id\)/, '私信里等回复要有三个点');
  assert.match(source('dyGroupView'), /dyTypingShown\('g:'\+g\.id\)/, '群聊里也要有');
  assert.match(app, /async function dyDMReply\(d\)\{try\{dyTypingOn\('dm:'\+d\.id\);/, '开始想回复就亮');
  assert.match(app, /finally\{dyTypingOff\('dm:'\+d\.id\);\}\}/, '回完或失败都要灭，不能一直转');
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    assert.ok(css.includes('.dydm-typing'), `${name} 少了三个点的样式`);
  }
});

test('each 私聊 and 群聊 carries its own context length, and reply length follows 设置', () => {
  /* 单独给某个会话设过就按它的；没设过就跟随设置里那个「带几个回合」 */
  const ctx = vm.createContext({ Number, Math, parseInt, S: { settings: { hist: 12 } } });
  vm.runInContext(`${source('phCtxRows')};${source('dyChatCtxRows')};globalThis.R=dyChatCtxRows;`, ctx);
  assert.equal(ctx.R(null), 24, '没单独设过就跟随全局（12 回合 → 24 条）');
  assert.equal(ctx.R({ ctx: 0 }), 24);
  ctx.S.settings.hist = 4;
  assert.equal(ctx.R(null), 8, '全局调小，这里跟着小');
  ctx.S.settings.hist = 12;
  assert.equal(ctx.R({ ctx: 2 }), 4, '低于 4 条按 4 条算');
  assert.equal(ctx.R({ ctx: 900 }), 60, '最多 60 条');
  assert.equal(ctx.R({ ctx: 25 }), 25);
  assert.match(app, /d\.msgs\.slice\(-dyChatCtxRows\(d\)\)/, '私信按这条设置取历史');
  assert.match(app, /dyGroupTranscript\(g,dyChatCtxRows\(g\)\)/, '群聊也按这条设置取历史');
  assert.match(source('dyReplyBudget'), /maxTokens/, '回复长度绑定设置里的线上聊天');
  assert.match(app, /\{max:dyReplyBudget\(\)\}/, '私信回复长度跟着设置走');
  for (const f of ['dyChatCtxEdit', 'dyChatCtxSave', 'dyChatCtxBox']) assert.ok(priv.includes(`function ${f}(`), `私人版缺少 ${f}`);
});

test('what happens on 抖音 reaches the character, the same way 共同生活 does', () => {
  assert.ok(app.includes('function dyMemoryPrompt('), 'dyMemoryPrompt 缺失');
  assert.ok(priv.includes('function dyMemoryPrompt('), '私人版缺少 dyMemoryPrompt');
  assert.match(app, /cohabMemoryAfterPrompt\(c\);s\+=\(typeof dyMemoryPrompt==='function'\?dyMemoryPrompt\(c\):''\)/, '要挂在 buildSystem 里，跟共同生活记忆一起');
  const mem = source('dyMemoryPrompt');
  for (const part of ['私信', '群', '作品']) assert.ok(mem.includes(part), `记忆里少了${part}`);
});

test('a character answering a comment always @s the person first', () => {
  assert.match(app, /async function dyCharReplyComment\(v,c,t,toName\)/, '要知道回的是谁');
  assert.match(app, /'@'\+\(toName\|\|S\.me\.name\)\+' '\+said/, '回谁就先 @ 谁');
  assert.match(app, /replace\(\/\^@\\S\+\\s\*\/,''\)/, '模型自己写的 @ 要去掉，免得 @ 两遍');
});

test('strangers all share one grey line-art face', () => {
  const face = source('dyFace');
  assert.match(face, /dyface/);
  assert.match(face, /svgIc\('user'/);
  for (const [name, src] of [['网页版', app], ['私人版', priv]]) {
    assert.doesNotMatch(src.slice(src.indexOf('function dyInit(')), /letterAv/, `${name}的抖音这边不该再拿名字首字母凑头像`);
  }
  assert.match(source('dyGMemberAvatar'), /return m\.avatar\|\|'';\}/, '群成员没头像就走灰底小人');
  assert.match(app, /return \{k:'s'\+uid\(\),name,avatar:'',/, '新生成的陌生人不自带头像');
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    assert.ok(css.includes('.avatar.dyface'), `${name} 少了灰底小人的样式`);
  }
});

test('全部功能 only lists things that actually do something', () => {
  const all = source('dyAllGroups');
  assert.doesNotMatch(all, /还没做/, '点了只会说「还没做」的，留着就是骗人');
  assert.doesNotMatch(source('dyProfile'), /我的预约/, '我的预约换成了我的收藏');
  const hits = [...all.matchAll(/"([a-zA-Z]+[^"]*)"\]/g)];
  assert.ok(hits.length >= 8, '真能用的条目不该只剩几条');
});

/* 第八批：抖音简介是简介，不是人设；点头像进主页不能只有群聊一条路。 */

test('a profile bio is a bio, never the whole persona', () => {
  const view = source('dyUserView');
  assert.doesNotMatch(view, /esc\(p\.persona\)/, '主页上不许直接把人设当简介');
  assert.match(view, /dyPersonBio\(p\)/, '简介要走单独存的那一份');
  assert.match(view, /这个人还没写简介/, '没写就留个占位，别拿人设顶上');
  for (const f of ['dyPersonBio', 'dyPersonBioSet', 'dyUserBioEdit', 'dyUserBioSave', 'dyUserBioGen']) {
    assert.ok(app.includes(`function ${f}(`) || app.includes(`async function ${f}(`), `${f} 缺失`);
    assert.ok(priv.includes(`function ${f}(`) || priv.includes(`async function ${f}(`), `私人版缺少 ${f}`);
  }
  assert.doesNotMatch(source('dyRelPeople'), /bio:String\(c\.persona/, '互关列表那一行也不许是人设');
  assert.match(source('dyRelPeople'), /bio:dyPersonBio\(/);
  assert.doesNotMatch(app, /dyGMemberPersona\(m\)\.slice\(0,22\)/, '群成员管理列表同样不露人设');
  assert.match(source('dyUserMenu'), /dyUserBioEdit\(\)/, '菜单里要能改简介');
  assert.match(source('dyUserMenu'), /dyUserBioGen\(\)/, '也要能让 TA 自己写');
  const gen = source('dyUserBioGen');
  assert.match(gen, /不超过 25 个字/, '简介要短');
  assert.match(gen, /不要写你的人设/, '明确不让模型把人设当简介写');
});

test('a profile opens from anywhere, not only from a group chat', () => {
  assert.ok(app.includes('function dyUserKey('), 'dyUserKey 缺失');
  assert.match(app, /else if\(c\.p==='dyuser'\)html=dyUserView\(\);/, '主页要有自己的路由');
  assert.doesNotMatch(app, /if\(_dySub==='user'\)return dyUserView\(\);/, '旧的子状态入口要去掉，免得两条路');
  const open = source('dyOpenUser');
  assert.match(open, /go\('dyuser',\{key:p\.k\}\)/, '要真的换页，而不是只改 _dySub');
  assert.match(open, /cur\(\)\.p==='dyuser'/, '已经在主页上就原地刷新，不叠页');
  for (const f of ['dyDMKey', 'dyOpenDMUser', 'dyUserBack']) {
    assert.ok(app.includes(`function ${f}(`), `${f} 缺失`);
    assert.ok(priv.includes(`function ${f}(`), `私人版缺少 ${f}`);
  }
  const dm = source('renderDyDM');
  assert.match(dm, /class="dydm-who" onclick="dyOpenDMUser/, '私聊页头点得进主页');
  assert.equal((dm.match(/dyOpenDMUser/g) || []).length >= 3, true, '页头、名字、气泡旁的头像都要能点');
  assert.match(source('dyDMRow'), /dymsg-face" onclick="event\.stopPropagation\(\);dyOpenDMUser/, '消息列表点头像看主页、点整行进聊天');
  assert.match(source('dyUserBack'), /back\(\)/, '返回要回到来的那一页');
  assert.match(source('openDyDMName'), /cur\(\)\.p==='dydm'&&cur\(\)\.id===d\.id/, '已经在这个聊天里就别再压一层');
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    assert.ok(css.includes('.dydm-who{'), `${name} 少了可点头像的样式`);
    assert.ok(css.includes('.dyus-nobio{'), `${name} 少了空简介占位的样式`);
  }
});

/* 第九批：红点进页面就全清；群聊按性格出场（主角＋配角）；管理员能禁言踢人，
   规矩由代码硬卡；她被禁言只能私信求解；IP 和性别跟人设走且可手动改。 */

test('a red dot clears the moment she opens the page, not one row at a time', () => {
  assert.match(source('dyOpenFans'), /dyMarkAllSeen\('fans',dyFanRows\(\)\)/, '粉丝进页面就全清');
  assert.match(source('dyOpenVisitors'), /dyMarkAllSeen\('vis',S\.dy\.visitors\|\|\[\]\)/, '访客进页面就全清');
  assert.match(source('dyActSeeTab'), /if\(tab==='群通知'\)dyMarkAllSeen\('apply',dyApplies\(\)\)/, '群通知也一样');
  assert.match(source('dyApplyUnseen'), /filter\(a=>!a\.seen\)/, '群通知的红点按看没看过算，待审批的仍然留在列表里');
  assert.match(source('dyFanRow'), /dyWasFresh\('fans',x\.k\)/, '清掉之后这一趟还看得见哪几条是新的');
  const mark = source('dyMarkAllSeen');
  assert.match(mark, /x\.seen=true/);
  assert.match(mark, /_dyFreshMark\[kind\]=fresh/);
});

test('who speaks in a group is decided by personality, and the room can stay quiet', () => {
  const cast = source('dyGCast');
  assert.match(cast, /m\.k===lover/, '恋人是主角，每次都开口');
  assert.match(cast, /!r\.hard&&!r\.soft&&r\.sc<62\)continue/, '分不够就不说话，群里可以冷场');
  assert.match(cast, /adminN>=maxAdm&&!r\.hard/, '管理员一轮最多几个是可以设置的');
  assert.match(cast, /dyGMuteLeft\(g,k\)>0/, '被禁言的人不参与出场');
  assert.match(cast, /Math\.random\(\)<\.5\?0:1/, '恋人第一第二都可能，不要每次都排第一');
  const ctx = vm.createContext({ Math, String });
  vm.runInContext(['dyGGuessTalk'].map(source).join('\n') + `;const DY_TALKY=${app.match(/const DY_TALKY=(\[[\s\S]*?\]\];)/)[1]};globalThis.T=dyGGuessTalk;`, ctx);
  assert.ok(ctx.T('很活泼的社牛，话痨') >= 80, '活泼的人话痨度要高');
  assert.ok(ctx.T('内向安静，话少') <= 30, '内向的人话痨度要低');
  assert.equal(ctx.T('什么都没写'), 55, '没写就给个中间值');
  assert.match(source('dyGCareHit'), /text\.indexOf\(w\)>=0/, '踩中在意的词');
  assert.match(source('dyGroupReply'), /round<2/, '被 @ 之后最多再接一轮，不能没完没了');
});

test('strangers share one call while characters each get their own', () => {
  const run = source('dyGroupReplyRun');
  assert.match(run, /if\(m\.cid\)\{/, '角色单独调用，带完整人设');
  assert.match(run, /if\(!crowdLines\)\{/, '网友合并成一次调用');
  assert.match(run, /第一个网友开口时才生成/, '要等前面角色说完再生成，网友才能接住他们的话');
  assert.match(source('dyGCrowdPrompt'), /一人一行/);
  const ctx = vm.createContext({ String, cleanReply: v => String(v || '').trim() });
  vm.runInContext(source('dyGCrowdParse') + ';globalThis.P=dyGCrowdParse;', ctx);
  const crowd = [{ k: 's1', name: '甲' }, { k: 's2', name: '乙' }];
  vm.runInContext('globalThis.dyGMemberName=m=>m&&m.name||"";', ctx);
  const got = ctx.P(crowd, '甲：我来啦\n乙：好饿');
  assert.equal(got.s1, '我来啦');
  assert.equal(got.s2, '好饿');
});

test('an admin can mute and kick, but never an admin or the owner', () => {
  const deny = source('dyGCmdDeny');
  assert.match(deny, /if\(!dyGCanManage\(g,actorKey\)\)return '不是管理员'/, '普通成员的指令不算数');
  assert.match(deny, /tRole==='owner'\)return '不能踢群主'/);
  assert.match(deny, /tRole==='admin'\)return '不能踢管理员'/);
  assert.match(deny, /actorM\.cid===cid\)\)return '只有恋人能禁言群主'/, '只有恋人能禁言她');
  assert.match(source('dyGRunCommands'), /DY_GCMD_RE/, '指令从话里抠出来，不显示给她看');
  assert.match(app, /const DY_GCMD_RE=.*禁言\|解禁\|踢出\|移出\|拉回\|请回/, '四种指令都认');
  for (const f of ['dyGMuteLeft', 'dyGCmdApply', 'dyGKicked', 'dyGMuteMember', 'dyGKickedList', 'dyGCastEdit', 'dyGMemberTune']) {
    assert.ok(app.includes(`function ${f}(`), `${f} 缺失`);
    assert.ok(priv.includes(`function ${f}(`), `私人版缺少 ${f}`);
  }
  const brief = source('dyGRoleBrief');
  assert.match(brief, /不能踢群主/, '要把规矩告诉他，否则他会去踢管理员然后被驳回');
  assert.match(brief, /只有你能禁言/, '恋人要知道自己有这个特权');
});

test('when she is muted the box is locked and only he can let her out', () => {
  assert.match(source('dyGroupView'), /dyGMeMuted\(g\)\?dyGMutedBarHTML\(g\)/, '被禁言就把输入框换掉');
  const bar = source('dyGMutedBarHTML');
  assert.match(bar, /还剩/, '要写还剩多久');
  assert.match(bar, /自己解不开/, '要说清她自己解不开');
  assert.match(bar, /dyGMutedBeg/, '给她一个直接去私信他的入口');
  assert.match(source('dyDMMutePrompt'), /\[解禁\|/, '私信里他能放她出来');
  assert.match(source('dyDMMutePrompt'), /完全按你的性格来/, '放不放由角色自己决定');
  assert.match(source('dyDMRunUnmute'), /dyGCmdApply\(g,by\.k,'unmute'/, '私信里的解禁要真的解开群里的禁言');
  assert.match(app, /dyRunPayCommands\(d\.msgs\|\|\[\],dyDMRunUnmute\(d\.cid,cleanReply\(r\)\)\)/, '私信回复要先过一遍解禁和收款指令');
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    assert.ok(css.includes('.dyg-muted{'), `${name} 少了禁言条的样式`);
    assert.ok(css.includes('.dyg-at{'), `${name} 少了 @ 高亮的样式`);
  }
});

test('the group wakes itself up after a long silence, within a daily budget', () => {
  const idle = source('dyGroupIdleChat');
  assert.match(idle, /g\.idleCount\|\|0\)>=dyGIdleMax\(g\)/, '一天有次数上限，不会一直烧');
  assert.match(idle, /dyGIdleHours\(g\)\*3600000/, '冷场多久才自己聊，是可以设置的');
  assert.match(idle, /if\(!last\)return/, '一句话都没有的新群先不自己聊');
  assert.match(source('dyOpenGroup'), /dyGroupIdleChat\(id\)/, '打开群的时候检查一次');
  assert.match(source('dyGCastSave'), /g\.maxSpeak=/, '这些都能在群设置里改');
});

test('an IP badge follows the persona, falls back to stable random, and can be edited', () => {
  const ip = source('dyPersonIP');
  assert.match(ip, /if\(rec&&rec\.ip\)return/, '手动改过就以手动的为准');
  assert.match(ip, /charHomeCity\(c\)/, '角色先看人设里写的城市');
  assert.match(ip, /dyKeyHash\(dyPersonKey\(p\)\+'\|ip2'\)/, '没写就按这个人固定一个，不会一刷一变');
  const ctx = vm.createContext({ String });
  vm.runInContext(`const DY_CITY_PROV=${app.match(/const DY_CITY_PROV=(\[[\s\S]*?\]\];)/)[1]}\nconst DY_PROVS=${app.match(/const DY_PROVS=(\[[^\]]*\];)/)[1]}\n${source('dyProvinceOfCity')};globalThis.P=dyProvinceOfCity;`, ctx);
  assert.equal(ctx.P('杭州'), '浙江');
  assert.equal(ctx.P('苏州'), '江苏');
  assert.equal(ctx.P('成都'), '四川');
  assert.equal(ctx.P('北京'), '北京');
  assert.equal(ctx.P(''), '');
  assert.doesNotMatch(source('dyUserView'), /'江苏','浙江','上海','广东','北京','四川'/, '不能再是写死的六个省轮着来');
  assert.match(source('dyUserView'), /dyPersonIP\(p\)/);
  assert.match(source('dyUserView'), /dyPersonGender\(p\)/);
  assert.match(source('dyUserMenu'), /dyUserIPEdit\(\)/, '菜单里能改 IP 和性别');
});

test('a 抖音 DM answers in up to four bubbles, like WeChat', () => {
  const ctx = vm.createContext({ String, cleanReply: v => String(v || '').trim() });
  vm.runInContext(source('dyDMBubbles') + ';globalThis.B=dyDMBubbles;', ctx);
  assert.equal(ctx.B('在的\n刚看到\n你怎么了').length, 3);
  assert.equal(ctx.B('a\nb\nc\nd\ne\nf').length, 4, '最多四条');
  assert.deepEqual([...ctx.B('就一句话')], ['就一句话']);
  assert.deepEqual([...ctx.B('')], []);
  assert.match(source('dyDMBubbleRule'), /1 到 4 条/);
  assert.match(app, /if\(i\)await sleep\(420\+Math\.random\(\)\*680\)/, '一条条冒出来，不要糊成一坨');
});

/* 第十批：气泡一条条出、@ 多人必须拆开、提示音、火花挪顶部、
   输入框复用微信的表情与语音、转账红包能抢、发作品重做。 */

test('an admin can send up to four bubbles, everyone else exactly one', () => {
  const ctx = vm.createContext({ String, Math });
  vm.runInContext(['dyGNum', 'dyGBubAdmin', 'dyGBubMember', 'dyGBubbleMax', 'dyGBubbleRule', 'dyGSplitAt', 'dyGBubbles'].map(source).join('\n')
    + ';globalThis.dyGRole=(g,k)=>g.roles[k]||"member";globalThis.MAX=dyGBubbleMax;globalThis.RULE=dyGBubbleRule;globalThis.SPLIT=dyGSplitAt;globalThis.B=dyGBubbles;', ctx);
  const g = { roles: { a: 'admin', o: 'owner', m: 'member' } };
  assert.equal(ctx.MAX(g, { k: 'a' }), 4);
  assert.equal(ctx.MAX(g, { k: 'o' }), 4);
  assert.equal(ctx.MAX(g, { k: 'm' }), 1, '配角刷屏就吵了');
  /* 现在这两个数每个群自己调，默认还是 4 / 1 */
  assert.equal(ctx.MAX({ roles: g.roles, bubAdmin: 2, bubMember: 3 }, { k: 'a' }), 2);
  assert.equal(ctx.MAX({ roles: g.roles, bubAdmin: 2, bubMember: 3 }, { k: 'm' }), 3);
  assert.equal(ctx.B(g, { k: 'a' }, '一\n二\n三').length, 3);
  assert.equal(ctx.B(g, { k: 'a' }, 'a\nb\nc\nd\ne').length, 4, '管理员也封顶四条');
  assert.equal(ctx.B(g, { k: 'm' }, 'a\nb\nc').length, 1);
  assert.match(ctx.RULE(g, { k: 'a' }), /一条消息只 @ 一个人/);
  assert.match(ctx.RULE(g, { k: 'm' }), /只说一句/);
});

test('one bubble never @s two people at once', () => {
  const ctx = vm.createContext({ String });
  vm.runInContext(source('dyGSplitAt') + ';globalThis.S=dyGSplitAt;', ctx);
  const two = ctx.S('@妈咪 阿姨抱歉当着您的面发脾气。@North 还要我倒数？');
  assert.equal(two.length, 2, '截图里那种一个框 @ 两个人的必须拆开');
  assert.ok(two[0].startsWith('@妈咪'));
  assert.ok(two[1].startsWith('@North'));
  assert.equal(ctx.S('@North 在吗').length, 1, '只 @ 一个人不用拆');
  assert.equal(ctx.S('大家早').length, 1);
  assert.equal(ctx.S('').length, 0);
  assert.match(app, /if\(bi\)await sleep\(380\+Math\.random\(\)\*620\)/, '群里也要一条条冒出来');
});

test('an incoming message chimes, softly, and can be switched off', () => {
  const ding = source('dyDing');
  assert.match(ding, /createOscillator/, '现合成，不带音频文件');
  assert.match(ding, /now-_dyDingAt<380/, '连着几条只响一次，不然像敲木鱼');
  assert.match(ding, /catch\(_\)\{\}/, '出不了声也不能让别的功能挂掉');
  assert.match(source('dyDingOn'), /S\.settings\.dyDing===false/, '默认开着，关了才不响');
  assert.match(app, /dyGMsgs\(g\)\.push\(\{id:uid\(\),k:m\.k,text:t\.slice\(0,300\),time:Date\.now\(\)\}\);dyDing\(\)/, '群里别人说话要响');
  assert.match(app, /live\.msgs\.push\(\{from:'them',text:parts\[i\],time:Date\.now\(\)\}\);dyDing\(\)/, '私信收到要响');
  assert.match(app, /抖音消息提示音/, '设置里要能关');
});

test('the spark rides in the header next to the name', () => {
  assert.match(source('renderDyDM'), /dySparkBadge\(d\)/);
  assert.match(source('dySparkBadge'), /🔥/);
  assert.ok(!app.includes('function dySparkLine('), '聊天区里那条撤掉了');
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    assert.ok(css.includes('.dydm-spark-badge{'), `${name} 少了火花的样式`);
  }
});

test('the 抖音 composer borrows WeChat stickers and the voice trick', () => {
  for (const f of ['dyEmojiPanelHTML', 'dyVoiceToggle', 'dySendSticker', 'dyMsgBodyHTML', 'dyMsgPlain']) {
    assert.ok(app.includes(`function ${f}(`), `${f} 缺失`);
    assert.ok(priv.includes(`function ${f}(`), `私人版缺少 ${f}`);
  }
  assert.match(source('dyEmojiPanelHTML'), /S\.me\.stickers/, '表情包跟微信共用一份');
  assert.match(source('dyEmojiPanelHTML'), /EMOJIS\.map/, '表情用的也是同一份');
  assert.match(source('renderDyDM'), /svgIc\('smile'/, '笑脸换成线条图标，不是 emoji');
  assert.doesNotMatch(source('renderDyDM'), /表情还没做/, '别再弹「还没做」');
  assert.match(app, /kind:'voice'/, '打字发出来能变成语音条');
  const plain = source('dyMsgPlain');
  assert.match(plain, /\[语音：/);
  assert.match(plain, /\[表情/);
  assert.match(plain, /\[转账 ¥/);
  assert.match(plain, /\[红包 ¥/);
  assert.match(source('dyGroupTranscript'), /dyMsgPlain\(m\)/, '群聊上下文也要说清发的是什么');
});

test('money moves through the WeChat ledger, and a group packet can be grabbed', () => {
  const send = source('dyMoneySend');
  assert.match(send, /addBill\('out'/, '走微信那套账本');
  assert.ok(!/S\.me\.balance=\+\( \(\+S\.me\.balance\|\|0\)-a \)/.test(send), 'addBill 自己会动余额，不能再扣一次');
  assert.match(send, /a>\(\+S\.me\.balance\|\|0\)\)return toast/, '余额不够不给发');
  assert.match(send, /if\(!red&&!target\)return toast/, '群里转账必须指定转给谁');
  const grab = source('dyRedGrabRun');
  assert.match(grab, /dyGreed\(m\)/, '谁抢得快看性格');
  assert.match(grab, /r\.left<=0\)return/, '抢光了就停');
  assert.match(source('dyGreed'), /爱钱\|贪\|财迷/, '小财迷手最快');
  assert.match(source('dyRedGrabMe'), /addBill\('in',take/, '她自己抢到的要进账');
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    assert.ok(css.includes('.dymo{'), `${name} 少了红包转账卡片的样式`);
    assert.ok(css.includes('.dyvo{'), `${name} 少了语音条的样式`);
  }
});

test('publishing is text-card or a real photo, and nobody pretends to see what they cannot', () => {
  const cam = source('dyPostCameraPage');
  assert.match(cam, />文字</, '底下只有文字和相机');
  assert.match(cam, />相机</);
  assert.doesNotMatch(cam, /直播/, '直播先不做，也不放一个点不动的按钮');
  assert.match(cam, /dyPostAlbum\(\)/, '相册要点得动');
  assert.match(cam, /dypg-snap/, '要有快门');
  assert.match(source('dyCompose'), /dyPostOpen\('camera'\)/, '发作品直接进相机页，不再弹窗');
  assert.match(source('dyPostImage'), /setAttribute\('capture','environment'\)/, '拍摄要真的调摄像头');
  assert.match(source('dyPostTextPage'), /dypg-quote/, '写文字页要有那个大引号');
  assert.match(source('dyPostTextPage'), /dyPostPick\('bg'/, '能选卡片颜色');
  assert.match(source('dyPostTextPage'), /dyPostPick\('fg'/, '能选文字颜色');
  assert.match(source('dyPostPublishPage'), /添加标题/);
  assert.match(source('dyPostPublishPage'), /添加作品描述/);
  assert.match(source('dyPostPublishPage'), /dyPostAtSheet\(\)/, '发布页能 @ 人');
  assert.match(app, /else if\(c\.p==='dypost'\)html=renderDyPost\(\);/, '发作品是真页面，不是弹窗');
  assert.match(source('dyPostPublish'), /visionConfigured\(\)/, '配了视觉模型才去看图');
  assert.match(source('dyPostVision'), /visionAPI\(/, '真的调视觉模型看图');
  const scene = source('dyWorkSceneText');
  assert.match(scene, /不要编造图里有什么/, '看不见就不许编');
  assert.ok(app.includes('function dyWorkDescEdit('), '看不见时她能自己补一句');
  assert.match(source('dyPostAfter'), /fans<dyAtFanThreshold\(\)/, '被 @ 的人粉丝多才会有粉丝来捧场');
  assert.match(source('dyAtFansShow'), /猜这两个人什么关系/, '粉丝要来猜关系');
  assert.match(source('dyWorkCardHTML'), /v\.img/, '照片作品要画照片');
  assert.match(source('dyWorkThumbHTML'), /dyimg-thumb/, '网格里也是照片');
  assert.match(source('dyWorkCardHTML'), /v\.cardFg/, '文字卡片按她选的字色画');
  assert.ok(!app.includes('function doDyPost('), '旧的发布流程要清掉');
});

test('nothing that the 抖音 pages call went missing', () => {
  /* 这一轮我整块替换代码时误删过 dyDMStamp、dyDMKey 这些，是爬虫先抓到的。
     这条测试直接扫：抖音这一片 onclick 里叫到的函数，必须都真的存在。 */
  const dy = app.slice(app.indexOf('function dyInit('));
  const called = new Set([...dy.matchAll(/onclick="(?:event\.stopPropagation\(\);)?([a-zA-Z_$][\w$]*)\(/g)].map(m => m[1]));
  const missing = [...called].filter(n => !new RegExp(`(?:^|\\n)(?:async )?function ${n}\\(`).test(app) && !/^(toast|render|save|back|go|closeModal|openModal|alert|\$)$/.test(n));
  assert.deepEqual(missing, [], '这些函数被点到但根本不存在：' + missing.join(', '));
});

/* 第十一批：群聊不再被弹回顶部；被踢出去的人不能再说话；发作品能选真的音乐。 */

test('the group chat keeps its scroll instead of jumping to the top', () => {
  const t = source('renderScrollTarget');
  assert.match(t, /sub==='group'\)return\{id:'\.dyg-box',stick:true\}/, '群聊要有自己的滚动目标，而且贴着底部');
  assert.match(t, /c\.p==='dy'/, '抖音这一页要按子页面分开看');
  assert.match(t, /dy:\['dyfeed',0\]/, '信息流原来那个不能动');
  assert.match(source('dyGroupView'), /class="dyg-box"/, '群聊那块得有这个 class');
  assert.match(app, /data-render-scroll-key="dyg:\$\{esc\(g\.id\)\}"/, '每个群各记各的位置');
});

test('someone kicked mid-round cannot get another word in', () => {
  const run = source('dyGroupReplyRun');
  assert.match(run, /if\(!dyGFind\(g,m\.k\)\)continue/, '出场名单是开头排好的，踢完要在循环里再拦一道');
  const i = run.indexOf('if(!dyGFind(g,m.k))continue');
  const j = run.indexOf('dyAuxChat');
  assert.ok(i >= 0 && i < j, '这一拦必须在调模型之前，不然钱都花了');
  assert.match(source('dyGCast'), /dyGMemberList\(g\)\.filter/, '排名单本来就只从现有成员里挑');
});

test('a work can carry a song she really has, and tapping it plays that song', () => {
  for (const f of ['dyMusicLib', 'dyPostMusicPick', 'dyPostMusicSet', 'dyWorkMusicHTML', 'dyWorkMusicPlay']) {
    assert.ok(app.includes(`function ${f}(`), `${f} 缺失`);
    assert.ok(priv.includes(`function ${f}(`), `私人版缺少 ${f}`);
  }
  assert.match(source('dyMusicLib'), /S\.music&&S\.music\.songs/, '读的是真的音乐库');
  assert.match(source('dyPostMusicPick'), /音乐库里还没有歌/, '库是空的要说清楚');
  assert.match(source('dyPostMusicPick'), /不配音乐/, '选过了要能取消');
  assert.match(source('dyWorkMusicPlay'), /musicPlay\(s\.id\)/, '点了真的放这首歌');
  assert.match(source('dyWorkMusicPlay'), /已经不在音乐库里了/, '歌被删了要说清楚，不能装作放了');
  assert.match(source('dyPostPublish'), /songId:p\.songId\|\|''/, '发布时要把歌带上');
  assert.match(source('dyPostPublishPage'), /dyPostMusicPick\(\)/, '发布页要有选音乐的入口');
  assert.match(source('dyPostCameraPage'), /dyPostMusicPick\(\)/, '相机页顶上也要有，跟真抖音一样');
  assert.match(source('dyWorkView'), /dyWorkMusicHTML\(v\)/, '作品页上要显示出来');
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    assert.ok(css.includes('.dymu{'), `${name} 少了配乐那一条的样式`);
  }
});

/* 第十二批：卡片复用微信的、[收款] 不再当文字显示、相册选得动、
   发作品是三个真页面、作品能转发到抖音。 */

test('the money cards are the WeChat ones, not a hand-drawn blue block', () => {
  const card = source('dyMoneyCardHTML');
  assert.match(card, /wx-transfer-card/, '转账卡直接用微信那张');
  assert.match(card, /wx-transfer-glyph/);
  assert.match(card, /cpay/, '红包卡也是微信那张');
  assert.match(card, /cfoot/);
  assert.doesNotMatch(card, /class="dymo/, '我自画的那个蓝方块要去掉');
  assert.match(card, /transferState\(m\)/, '状态判断复用微信的');
  assert.match(app, /m\.kind==='red'\|\|m\.kind==='transfer'\?' bare'/, '卡片自带底色，外面不能再套一层气泡');
  assert.match(source('dyMoneyAct'), /addBill\('in',amount/, '收下的钱要进账');
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    assert.ok(css.includes('.dydm-b.bare'), `${name} 少了不套气泡的样式`);
  }
});

test('[收款] and [拒收] are executed, never printed as text', () => {
  const ctx = vm.createContext({ String, transferState: m => (m && (m.received ? 'received' : m.declined ? 'refunded' : 'pending')), addBill() {} });
  vm.runInContext(`const DY_PAY_RE=${app.match(/const DY_PAY_RE=(\/.*?\/g);/)[1]};\n`
    + ['dyPayLast', 'dyRunPayCommands'].map(source).join('\n') + ';globalThis.R=dyRunPayCommands;', ctx);
  const rows = [{ from: 'me', kind: 'transfer', id: 'p1', amount: 2 }];
  const got = ctx.R(rows, '[收款] 两块钱？');
  assert.equal(got.text, '两块钱？', '指令不能留在气泡里');
  assert.equal(got.did, 1);
  assert.equal(rows[0].received, true, '要真的收下');
  const rows2 = [{ from: 'me', kind: 'red', id: 'p2', amount: 3 }];
  assert.equal(ctx.R(rows2, '不要[拒收]').did, 1);
  assert.equal(rows2[0].declined, true);
  assert.equal(ctx.R([], '[收款]').did, 0, '没有待收的就不乱动');
  assert.match(source('dyPayRule'), /\[收款\]/, '提示词里要教他怎么收');
  assert.match(source('dyPayRule'), /\[拒收\]/);
  assert.match(app, /dyRunPayCommands\(d\.msgs/, '私信回复要走这一步');
});

test('the album picker is attached to the page, or iOS ignores the click', () => {
  const pick = source('dyPostImage');
  assert.match(pick, /document\.body\.appendChild\(i\)/, '不挂进 DOM 的话 iOS 上点了没反应');
  assert.match(pick, /capture','environment'/, '拍摄要真的调摄像头');
  assert.match(pick, /i\.remove\(\)/, '用完要收拾干净');
  assert.match(source('pickFile'), /document\.body\.appendChild\(i\)/, '项目里现成那个本来就是这么做的');
});

test('publishing is three real pages, shaped like the screenshots she sent', () => {
  for (const f of ['renderDyPost', 'dyPostCameraPage', 'dyPostTextPage', 'dyPostPublishPage', 'dyPostOpen', 'dyPostClose']) {
    assert.ok(app.includes(`function ${f}(`), `${f} 缺失`);
    assert.ok(priv.includes(`function ${f}(`), `私人版缺少 ${f}`);
  }
  assert.match(app, /else if\(c\.p==='dypost'\)html=renderDyPost\(\);/, '要有自己的路由，不是弹窗');
  const cam = source('dyPostCameraPage');
  assert.match(cam, /选择音乐/, '相机页顶上是「♫ 选择音乐」，跟参考图一样');
  assert.match(cam, /dypg-snap/, '中间一个大快门');
  assert.match(cam, /dyPostAlbum\(\)/, '左边进相册');
  const txt = source('dyPostTextPage');
  assert.match(txt, /dypg-quote/, '写文字页那个大引号');
  assert.match(txt, /下一步/, '右上角「下一步」');
  const pub = source('dyPostPublishPage');
  assert.match(pub, /dypub-cover/, '发布页顶上是封面');
  assert.match(pub, /# 话题/);
  assert.match(pub, /@ 朋友/);
  assert.match(pub, /发作品/);
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    for (const cls of ['.dypg{', '.dypg-snap{', '.dypg-card{', '.dypub-go{']) {
      assert.ok(css.includes(cls), `${name} 少了 ${cls}`);
    }
  }
});

test('a work forwards into 抖音 DMs and groups, on a WeChat-looking card', () => {
  const fwd = source('dyFwd');
  assert.match(fwd, /转发到微信/);
  assert.match(fwd, /转发到抖音私信/);
  assert.match(fwd, /转发到抖音群聊/);
  const to = source('dyFwdTo');
  assert.match(to, /dyGMsgs\(g\)\.push/, '群聊收得到');
  assert.match(to, /d\.msgs\.push/, '私信收得到');
  assert.match(to, /dyGMeMuted\(g\)/, '被禁言就发不出去');
  assert.match(source('dyWorkCardHTML2'), /dywc-tag/, '卡片上要有抖音标');
  assert.match(source('dyMsgPlain'), /转发了一条抖音作品/, '上下文里要说清楚转的是什么');
  for (const [name, css] of [['小手机.html', html], ['私人壳', shell], ['index.html', index]]) {
    assert.ok(css.includes('.dywc{'), `${name} 少了作品卡的样式`);
  }
});
