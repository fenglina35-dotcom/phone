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
const both = (name, why) => test(`${name} · ${why}（网页和私人两端一致）`, () => {
  assert.equal(app.includes(name), true, `网页缺 ${name}`);
  assert.equal(priv.includes(name), true, `私人缺 ${name}`);
});

/* ===== 图片作品全屏 ===== */
test('图片作品在首页铺满整屏，多出来的裁掉', () => {
  const card = source('dyVideoCard');
  assert.match(card, /const photo=v&&v\.img\?storedImageDisplaySource\(v\.img\):''/);
  assert.match(card, /dybg dybg-photo/);
  assert.match(card, /dyfd-card\$\{photo\?' photo':''\}/);
  assert.match(card, /dyWorkCardHTML\(v,\{lines:4,full:!!photo\}\)/);
  for (const s of shells) {
    assert.match(s, /\.dyfd-card\.photo\{left:0;right:0;top:0;bottom:0;\}/);
    assert.match(s, /\.dyfd-card\.photo \.dyimg img\{[^}]*object-fit:cover/);
  }
});
test('铺满之后不再垫那张模糊的自己——两种画面撞出来的就是她看到的那条线', () => {
  const card = source('dyVideoCard');
  assert.equal(/dybg-photo" style="background-image:url/.test(card), false, '还在给垫图设背景，那条线就还会有机会出现');
  assert.equal(/dywk-frame\$\{v\.img\?' photo':''\}" style="background-image/.test(source('dyWorkView')), false, '作品详情页还在垫图');
  for (const s of shells) {
    assert.match(s, /\.dybg\.dybg-photo\{background:#000;background-image:none;[^}]*filter:none/);
    assert.match(s, /\.dywk-frame\.photo\{top:0;transform:none;height:100%;background:#000/);
    assert.equal(/\.dywk-frame\.photo:before/.test(s), false, '作品详情页那层 backdrop-filter 该撤掉了');
  }
});
test('作品详情页的图也是铺满', () => {
  const view = source('dyWorkView');
  assert.match(view, /dywk-frame\$\{v\.img\?' photo':''\}/);
  for (const s of shells) assert.match(s, /\.dywk-frame\.photo \.dyimg img\{[^}]*object-fit:cover/);
});

/* ===== 配乐 ===== */
test('每条作品底下都有一条配乐，没配乐的写「创作的原声」', () => {
  const fn = source('dyMusicLabel');
  assert.match(fn, /创作的原声/);
  assert.match(source('dyVideoCard'), /\$\{dyWorkMusicHTML\(v\)\}\n\s*<\/div>/);
});
test('详情页的配乐条在 .dywk-music 里，而且在 stage 外面——否则会跑到左上角', () => {
  const view = source('dyWorkView');
  assert.match(view, /<\/div>\n\s*<div class="dywk-music">\$\{dyWorkMusicHTML\(v\)\}<\/div>\n\s*<div class="dywk-bar">/);
  assert.equal(/dywk-stage[\s\S]*dywk-music[\s\S]*<\/div>\n\s*<div class="dywk-bar"/.test(view), true);
  for (const s of shells) assert.match(s, /\.dywk-music\{flex:0 0 auto/);
});
test('滑到哪条放哪条：没配乐就停，没点过屏幕不硬出声', () => {
  const fn = source('dyMusicSync');
  assert.match(fn, /if\(!want\)\{if\(_dyMusicOwned\)\{_dyMusicOwned=false;_dyMusicWant='';dyMusicPause\(\);\}return;\}/);
  assert.match(fn, /if\(!_dyGestured\)return;/);
  assert.match(fn, /musicPlay\(want,\{silent:true\}\)/);
});
test('musicPlay 接受 silent，自动播放被拦下时不弹「点一下▶播放」', () => {
  assert.match(app, /async function musicPlay\(id,opt\)\{opt=opt\|\|\{\};/);
  assert.match(app, /catch\(e\)\{if\(token===_mPlayToken&&!opt\.silent\)toast\('点一下▶播放'\);\}/);
  assert.match(priv, /async function musicPlay\(id,opt\)\{opt=opt\|\|\{\};/);
});
test('dyCurrentWork 会挑屏幕中间那条，而不是永远第一条', () => {
  const fn = source('dyCurrentWork');
  assert.match(fn, /getBoundingClientRect\(\)\.top\+box\.clientHeight\/2/);
  assert.match(fn, /if\(d<bd\)\{bd=d;best=el;\}/);
});

/* ===== 双击点赞 ===== */
test('双击才点赞，单击还是展开旁白', () => {
  const ctx = { Date, setTimeout, clearTimeout, liked: 0, narr: 0 };
  ctx.dyVid = () => ({ id: 'a', liked: false });
  ctx.dyLike = () => { ctx.liked++; };
  ctx.dyTapVideo = () => { ctx.narr++; };
  ctx.dyHeartBurst = () => {};
  vm.createContext(ctx);
  vm.runInContext(['let _dyTapAt=0,_dyTapId=\'\',_dyTapTimer=0;', source('dyCardTap'), source('dyDoubleLike')].join('\n'), ctx);
  vm.runInContext("dyCardTap('a',{});dyCardTap('a',{});", ctx);
  assert.equal(ctx.liked, 1, '双击应该点赞一次');
  assert.equal(ctx.narr, 0, '双击不该同时展开旁白');
});
test('双击只点亮，不会把已经点过的赞取消掉', () => {
  assert.match(source('dyDoubleLike'), /if\(!v\.liked\)dyLike\(id\);/);
});
both('dyHeartBurst', '双击蹦出来的那颗爱心');
test('爱心挂在 body 上，所以 render() 重画也不会被抹掉', () => {
  assert.match(source('dyHeartBurst'), /document\.body\.appendChild\(d\)/);
  for (const s of shells) assert.match(s, /\.dyheart\{position:fixed;z-index:9999/);
});

/* ===== 点亮就是实心 ===== */
test('svgIc 永远 fill="none"，所以需要一个填色版本', () => {
  assert.match(app, /return '<svg viewBox="0 0 24 24"[^\n]*fill="none"/, 'svgIc 还是描边版，前提没变');
  for (const s of [app, priv]) {
    assert.match(s, /function svgIcFill\(name,size,color,sw\)/);
    assert.match(s, /function dyIc\(name,size,on,onColor,offColor,sw\)\{return on\?svgIcFill\(name,size,onColor,sw\):svgIc\(name,size,offColor,sw\);\}/);
  }
});
test('点上去是实心，没点还是线条', () => {
  const ctx = { ICONS: { heart: '<path d="M1 1"/>' } };
  vm.createContext(ctx);
  vm.runInContext([source('svgIc'), source('svgIcFill'), source('dyIc')].join('\n'), ctx);
  assert.match(vm.runInContext("dyIc('heart',30,true,'#f5243d','#fff')", ctx), /fill="#f5243d"/);
  assert.match(vm.runInContext("dyIc('heart',30,false,'#f5243d','#fff')", ctx), /fill="none"/);
});
test('首页、作品详情、评论区三处的爱心和星星都换成了 dyIc', () => {
  for (const s of [app, priv]) {
    assert.match(s, /onclick="dyLike\('\$\{v\.id\}'\)"><span class="ic">\$\{dyIc\('heart',34,liked,'#f5243d','#fff'\)\}/);
    assert.match(s, /onclick="dyStar\('\$\{v\.id\}'\)"><span class="ic">\$\{dyIc\('star',33,starred,'#f5c518','#fff',2\)\}/);
    assert.match(s, /dywk-r" onclick="dyLike\('\$\{v\.id\}'\)">\$\{dyIc\('heart',30,liked,'#f5243d','#fff'\)\}/);
    assert.match(s, /dywk-r" onclick="dyStar\('\$\{v\.id\}'\)">\$\{dyIc\('star',29,starred,'#f5c518','#fff',2\)\}/);
    assert.match(s, /dyCmLike\('\$\{v\.id\}',\$\{ci\}\)">\$\{dyIc\('heart',19,cm\.liked,'#f5243d','#7b7b83',1\.8\)\}/);
    assert.equal(/svgIc\('heart',(?:34|30|19),/.test(s), false, '还有抖音的爱心没换成 dyIc');
    assert.equal(/svgIc\('star',(?:33|29),/.test(s), false, '还有抖音的星星没换成 dyIc');
  }
});
test('双击蹦出来的那颗也走同一个填色函数，不再两套写法', () => {
  assert.match(source('dyHeartBurst'), /d\.innerHTML=svgIcFill\('heart',98,'#f5243d',1\.2\);/);
});

test('评论那个按钮是实心白气泡，中间三个点是真的洞', () => {
  for (const x of [app, priv]) assert.match(x, /function dyCmIcon\(size,color\)/);
  const fn = source('dyCmIcon');
  assert.match(fn, /fill-rule="evenodd"/, '没有 evenodd 就挖不出洞，三个点会被填满');
  assert.match(fn, /clip-rule="evenodd"/);
  /* 小尾巴必须是另一条 path：塞进 evenodd 那条里，重叠的部分会被当成洞挖掉 */
  const paths = fn.match(/<path/g) || [];
  assert.equal(paths.length, 2, '应该是两条 path：尾巴一条、气泡带洞一条');
  assert.equal(/M8\.1 9\.4a1\.6 1\.6[\s\S]*M12 9\.4a1\.6 1\.6[\s\S]*M15\.9 9\.4a1\.6 1\.6/.test(fn), true, '三个点要在 evenodd 那条里');
  assert.equal(fn.includes('stroke'), false, '这个图标不描边，全靠填色');
});
test('两处评论按钮都换成了 dyCmIcon，没有漏网的描边版', () => {
  for (const x of [app, priv]) {
    assert.match(x, /onclick="dyComments\('\$\{v\.id\}'\)"><span class="ic">\$\{dyCmIcon\(33\)\}/);
    assert.match(x, /dywk-r" onclick="dyComments\('\$\{v\.id\}'\)">\$\{dyCmIcon\(29\)\}/);
    assert.equal(/svgIc\('chat',(?:33|29),/.test(x), false, '还有抖音的评论按钮是描边版');
  }
});

/* ===== @ 写进描述 ===== */
test('@ 朋友插在光标处，写进作品描述里，不是底下一排小标签', () => {
  assert.match(source('dyPostAt'), /dyPostInsertDesc\('@'\+q\.name\+' '\)/);
  assert.match(source('dyPostInsertDesc'), /el\.value=v\.slice\(0,a\)\+text\+v\.slice\(b\)/);
  assert.equal(/dyat">\$\{\(p\.at\|\|\[\]\)\.map/.test(source('dyPostPublishPage')), false, '发布页底下那排 @ 标签应该已经撤掉');
});
test('发布时按描述里真正留着的 @ 定名单', () => {
  const ctx = { dyPersonFind: k => ({ name: { a: '先生', b: '妈咪' }[k] }) };
  vm.createContext(ctx);
  vm.runInContext(source('dyPostAtSync'), ctx);
  const got = vm.runInContext("dyPostAtSync({title:'',desc:'今晚 @先生 一起',at:['a','b']})", ctx);
  assert.equal(Array.from(got).join(','), 'a', '她把 @妈咪 删掉了就不该再算 @ 过');
});
test('发作品时写进去的 @ 名单真的存进作品里', () => {
  assert.match(app, /const id=uid\(\),at=dyPostAtSync\(p\);/);
  assert.match(priv, /const id=uid\(\),at=dyPostAtSync\(p\);/);
});
test('作品文案里的 @ 会高亮出来', () => {
  const ctx = { esc: s => String(s) };
  vm.createContext(ctx);
  vm.runInContext(source('dyHash'), ctx);
  assert.match(vm.runInContext("dyHash('夜光海 #话题 @先生 好看')", ctx), /<b class="dyat-tx">@先生<\/b>/);
  for (const s of shells) assert.match(s, /\.dyat-tx\{color:#9ec6ff/);
});

/* ===== 角色发抖音 ===== */
both('publishRoleDouyin', '角色真的把图发到抖音');
both('consumeDouyinCommands', '[发抖音|文案] 会被执行掉');
test('[发抖音] 登记进了所有标签表，不会被当成台词念出来', () => {
  for (const s of [app, priv]) {
    assert.match(s, /联网\|发推\|发朋友圈\|发抖音\|锁定/);
    assert.match(s, /登录微信\|发朋友圈\|发推\|发抖音\|点外卖/);
    assert.match(s, /\|目标完成\|发朋友圈\|发推\|发抖音\|点外卖\|语音\|表情/);
    assert.match(s, /换头像\|发朋友圈\|发推\|发抖音\|对Ta说/);
  }
});
test('提示词里写清楚了「把这张图发抖音」是什么意思', () => {
  for (const s of [app, priv]) {
    assert.match(s, /让你发抖音时，用一行 \[发抖音\|文案\]/);
    assert.match(s, /从ta自己的音乐库里随机挑一首当配乐（库里没歌就不配乐，直接发）/);
  }
});
test('角色记得自己在抖音发过什么', () => {
  assert.match(app, /# 你自己最近发的抖音作品/);
  assert.match(priv, /# 你自己最近发的抖音作品/);
  assert.match(source('roleDouyinRecentText'), /配了一张照片/);
});
test('曲库是空的就不配乐，直接发', () => {
  const ctx = { dyMusicLib: () => [] };
  vm.createContext(ctx);
  vm.runInContext(source('roleDouyinPickSong'), ctx);
  assert.equal(vm.runInContext('roleDouyinPickSong()', ctx), null);
});
test('同一条抖音不会连发两遍', () => {
  const ctx = { S: { dy: { feed: [{ cid: 'c1', desc: '她拍的这张' }] } } };
  vm.createContext(ctx);
  vm.runInContext(source('roleDouyinDuplicate'), ctx);
  assert.equal(vm.runInContext("roleDouyinDuplicate({id:'c1'},'她拍的这张')", ctx), true);
  assert.equal(vm.runInContext("roleDouyinDuplicate({id:'c1'},'另一条')", ctx), false);
});
test('三个落点都挂上了发抖音这道', () => {
  for (const s of [app, priv]) assert.equal((s.match(/consumeDouyinCommands\(content,c,/g) || []).length, 4, '一处定义 + 三个调用点，跟朋友圈那道一样多');
});

/* ===== 群号码重名 ===== */
test('建群的号码生成函数不再和夹取范围的 dyGNum 重名', () => {
  for (const s of [app, priv]) {
    assert.equal(/function dyGNum\(\)\{/.test(s), false, '重名回来了，新建的群又会没有群号码');
    assert.match(s, /function dyGNewNum\(\)\{return String\(Math\.floor\(1e11\+Math\.random\(\)\*9e11\)\);\}/);
    assert.match(s, /gnum:dyGNewNum\(\)/);
  }
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext([source('dyGNewNum'), source('dyGNum')].join('\n'), ctx);
  assert.match(vm.runInContext('dyGNewNum()', ctx), /^\d{12}$/);
  assert.equal(vm.runInContext("dyGNum('',3,1,6)", ctx), 3);
});

/* ===== 群聊气泡条数 ===== */
test('气泡条数每个群单独调，默认还是管理员 4 条、其余 1 条', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext([source('dyGNum'), source('dyGBubAdmin'), source('dyGBubMember'), 'function dyGRole(g,k){return k===\'a\'?\'admin\':\'member\';}', source('dyGBubbleMax')].join('\n'), ctx);
  assert.equal(vm.runInContext("dyGBubbleMax({},{k:'a'})", ctx), 4);
  assert.equal(vm.runInContext("dyGBubbleMax({},{k:'b'})", ctx), 1);
  assert.equal(vm.runInContext("dyGBubbleMax({bubAdmin:2,bubMember:3},{k:'a'})", ctx), 2);
  assert.equal(vm.runInContext("dyGBubbleMax({bubAdmin:2,bubMember:3},{k:'b'})", ctx), 3);
});
test('群设置里看得到、也改得动这两个数', () => {
  assert.match(source('dyGCastEdit'), /id="dyg_buba"/);
  assert.match(source('dyGCastEdit'), /id="dyg_bubm"/);
  assert.match(source('dyGCastSave'), /g\.bubAdmin=dyGNum\(v\('dyg_buba'\),4,1,8\);g\.bubMember=dyGNum\(v\('dyg_bubm'\),1,1,8\);/);
  assert.match(source('dyGroupInfoView'), /一次几条气泡/);
});

/* ===== 我的主页恋人 / 角色主页背景 ===== */
test('绑了情侣空间，我的主页也挂恋人，点得进 TA 主页', () => {
  assert.match(source('dyMeLoverLine'), /dyOpenUser\('c:\$\{esc\(cid\)\}'\)/);
  assert.match(source('dyProfile'), /\$\{dyMeLoverLine\(\)\}/);
  assert.match(source('dyUserView'), /恋人：<em onclick="dyGoMyProfile\(\)">/);
});
test('被删掉的角色不会还挂在我主页上当恋人', () => {
  const ctx = { S: { couple: { cid: 'c1' } }, getC: () => ({ id: 'c1', deleted: true }) };
  vm.createContext(ctx);
  vm.runInContext(source('dyCoupleCid'), ctx);
  assert.equal(vm.runInContext('dyCoupleCid()', ctx), '');
});
test('角色抖音主页背景能换，换完不蒙白雾', () => {
  assert.match(source('dyUserCoverChange'), /r\.cover=await compressBackground\(f\)/);
  assert.match(source('dyUserView'), /const own=storedImageDisplaySource\(dyPersonCover\(p\)\|\|''\),ownImg=isImg\(own\)/);
  assert.match(source('dyUserView'), /dyus-cover\$\{ownImg\?' has-img':''\}/);
  assert.match(source('dyUserMenu'), /更换主页背景/);
  for (const s of shells) {
    assert.match(s, /\.dyus-cover\.has-img:after,\.dyme-cover\.has-img:after\{[^}]*backdrop-filter:none/);
    assert.match(s, /\.dyus-cover\.has-img \.dyus-top i\{background:rgba\(0,0,0,\.42\);color:#fff;\}/);
  }
});
test('换过背景后顶上的图标改成白的，不然看不见', () => {
  assert.match(source('dyUserView'), /const ink=ownImg\?'#fff':'#111';/);
  assert.match(source('dyProfile'), /const ownCover=isImg\(storedImageDisplaySource\(p\.cover\|\|''\)\),ink=ownCover\?'#fff':'#111';/);
});

/* ===== 作品详情是独立一页 ===== */
test('角色主页点作品打得开：作品详情是独立一页，不再是抖音页里的子状态', () => {
  assert.match(app, /else if\(c\.p==='dywork'\)html=dyWorkView\(\)\+dyCmLayer\(\);/);
  assert.match(source('dyOpenWork'), /if\(!c\|\|c\.p!=='dy'\)return go\('dywork',\{id\}\);/);
  assert.match(source('dyWorkView'), /const v=dyVid\(dyWorkCurId\(\)\);/);
  assert.match(source('dySubClose'), /if\(cur\(\)\.p==='dywork'\)\{[^}]*return back\(\);\}/);
  assert.match(app, /dy:'douyin',dydm:'douyin',dyuser:'douyin',dywork:'douyin'/);
});
test('抖音里所有 onclick 叫到的函数都真的存在', () => {
  const names = new Set();
  for (const m of app.matchAll(/onclick="(?:event\.stopPropagation\(\);)?(dy[A-Za-z0-9_]+)\(/g)) names.add(m[1]);
  assert.ok(names.size > 40, '抓到的抖音按钮太少，正则可能失效了');
  const missing = [...names].filter(n => !new RegExp(`(?:async )?function ${n}\\(`).test(app));
  assert.deepEqual(missing, [], '这些按钮点了会报错：' + missing.join('、'));
});

/* ===== 作者牌 ===== */
test('我在别人作品底下评论不算作者，自己作品底下才算', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(source('dyCmIsAuthor'), ctx);
  assert.equal(vm.runInContext("dyCmIsAuthor({cid:'c1'},{me:true})", ctx), false, '别人的作品，我不是作者');
  assert.equal(vm.runInContext("dyCmIsAuthor({cid:'me'},{me:true})", ctx), true, '我自己的作品，我是作者');
  assert.equal(vm.runInContext("dyCmIsAuthor({cid:'c1'},{cid:'c1'})", ctx), true, '作者本人');
  assert.equal(vm.runInContext("dyCmIsAuthor({cid:'c1'},{cid:'c2'})", ctx), false, '别的角色不是作者');
});
test('不是作者的我，挂的是「我」不是「作者」', () => {
  const row = source('dyCmRow');
  assert.match(row, /author\?'<em class="dycm-author">作者<\/em>':cm\.me\?'<em class="dycm-author"[^>]*>我<\/em>'/);
});
