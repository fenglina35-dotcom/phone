import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/* 她说「我抖音让他发了好几次，他都不发，第一次发送成功了，后面几次都没发送，
   然后图片也没配上去，而且我无法删除他的作品，选择的音乐图片也没有加载出来」。

   查下来是四件互相独立的事，四条都不是「偶尔」，是必然：
   ① 标签正则 [^\]】\n]{1,180}：文案里有一个【】就在里面那个 】 断掉；
      文案超过 180 字整条匹配不上，于是【什么都没发生】，她只看到「他不发」。
   ② 去重：模型第二次写了一样的文案，publishRoleDouyin 直接 return false，
      一句话都不说、什么都不发生。她连着让他发，当然「只有第一次成功」。
   ③ 没点名图片时只往回找半小时／六条，她隔四十分钟再说就带不上图，发出来是空场记板。
   ④ 「删除作品」只在 v.cid==='me' 时才画出来，角色发的那条根本没有删除入口。
   另外选音乐那张单子压根没画封面。 */

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const app = read('app.js');
const priv = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');
const shells = [read('小手机.html'),
  read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html'),
  read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html')];

const source = (name, src = app) => {
  const lines = src.split('\n');
  const start = lines.findIndex(l => l.startsWith(`function ${name}(`) || l.startsWith(`async function ${name}(`));
  assert.ok(start >= 0, `找不到 ${name}`);
  let end = start + 1;
  while (end < lines.length && !/^(?:async )?function |^const |^let |^\/\* /.test(lines[end])) end += 1;
  return lines.slice(start, end).join('\n');
};

test('标签正则：长文案和带【】的文案都得认', () => {
  for (const [label, src] of [['网页版', app], ['私人版', priv]]) {
    const re = src.match(/const DY_TAG_RE=(\/.*?\/g);/);
    assert.ok(re, `${label} 少了 DY_TAG_RE`);
    /* 不能再用 [^\]】\n] —— 那正是吃掉【】的元凶 */
    assert.equal(/\[\^\\\]】\\n\]/.test(re[1]), false, `${label} 又回去用会吃掉【】的字符类了`);
    const len = re[1].match(/\{1,(\d+)\}/);
    assert.ok(len && +len[1] >= 300, `${label} 文案上限 ${len && len[1]}，太短的话长文案整条丢掉`);
    const rx = new RegExp(re[1].slice(1, -2), 'g');
    const grab = t => [...t.matchAll(rx)].map(m => m[1]);
    assert.deepEqual(grab('[发抖音|今天【很开心】#日常]'), ['今天【很开心】#日常'], `${label} 带【】的文案被截断了`);
    assert.deepEqual(grab('[发抖音|' + '长'.repeat(230) + ']'), ['长'.repeat(230)], `${label} 长文案匹配不上`);
    assert.deepEqual(grab('普通一句话'), []);
  }
});

test('她连着让他发，文案一样也必须每条都发出去', () => {
  /* 这是「第一次成功、后面都没发」的正主：原来重复就 return false，静默。 */
  const ctx = { S: { dy: { feed: [] } }, String, Date, hm: () => '20:00' };
  vm.createContext(ctx);
  vm.runInContext([source('roleDouyinDuplicate'), source('roleDouyinDedupeText')].join('\n'), ctx);
  const c = { id: 'c1' };
  ctx.c = c;
  const out = [];
  for (let i = 0; i < 3; i++) {
    const t = vm.runInContext(`roleDouyinDedupeText(c,'今天也很想她')`, ctx);
    out.push(t);
    ctx.S.dy.feed.unshift({ cid: 'c1', desc: t });
  }
  assert.equal(new Set(out).size, 3, `三次都该有各自的文案，现在是 ${JSON.stringify(out)}`);
  assert.equal(out[0], '今天也很想她', '第一条原样');
  assert.match(out[1], /（2）$/, '第二条要加个序号区分开');
  /* 发布那一步必须用去重之后的文案，不能再直接 return false */
  const pub = source('publishRoleDouyin');
  assert.match(pub, /tx=cleanDouyinBody\(roleDouyinDedupeText\(c,tx\)\)/);
  assert.equal(/if\(roleDouyinDuplicate\(c,tx\)\)return false;/.test(pub), false,
    '又回去「重复就什么都不做」了，她会以为他不发');
});

test('她明确让发、可回复里没有标签 → 自己补一条，不能静默', () => {
  for (const [label, src] of [['网页版', app], ['私人版', priv]]) {
    const fn = source('ensureRequestedDouyin', src);
    assert.match(fn, /roleDouyinAskIntent\(userText\)/);
    assert.match(fn, /if\(roleDouyinCommandText\(out\)\)return out;/, '已经有标签就别再补一条');
    assert.match(fn, /\[发抖音\|/, '补的就是一条真标签');
    assert.ok(src.includes('if(!_rawOutput)content=await ensureRequestedDouyin(content,c,_userText);'),
      `${label} 没把兜底接到回复流水线上`);
  }
  const ctx = { String, DY_POST_WORD: /(?:抖音|作品|短视频)/ };
  vm.createContext(ctx);
  vm.runInContext([app.match(/const DY_ASK_RE=[^\n]+/)[0], source('roleDouyinAskIntent')].join('\n'), ctx);
  const ask = t => vm.runInContext(`roleDouyinAskIntent(${JSON.stringify(t)})`, ctx);
  for (const t of ['帮我发一条抖音吧', '发个抖音', '你去发条作品', '拍个短视频发出来', '再发一条抖音', '把这张图发抖音'])
    assert.equal(ask(t), true, `这句是在让他发：${t}`);
  for (const t of ['今天天气怎么样', '我刷抖音刷到一个好玩的', '今天先不要发抖音了', '你别发抖音'])
    assert.equal(ask(t), false, `这句不是在让他发：${t}`);
});

test('角色发的作品也删得掉', () => {
  for (const [label, src] of [['网页版', app], ['私人版', priv]]) {
    const fn = source('dyFwd', src);
    assert.match(fn, /删除作品/, `${label} 菜单里没有删除`);
    /* 删除不能再被关在 mine 那个分支里 */
    const mineBranch = fn.match(/\$\{mine\?`([\s\S]*?)`:`([\s\S]*?)`\}/);
    assert.ok(mineBranch, `${label} 找不到 mine 分支`);
    assert.equal(/删除作品/.test(mineBranch[1]), false, `${label} 删除又被关回「只有自己的作品」里了`);
    assert.match(fn, /dyDelVideo\('\$\{id\}'\)/, `${label} 角色的作品要走 dyDelVideo`);
    assert.match(source('dyDelVideo', src), /S\.dy\.feed=S\.dy\.feed\.filter\(v=>v\.id!==id\)/);
  }
});

test('选音乐和作品底下那条配乐都要看得见封面', () => {
  for (const [label, src] of [['网页版', app], ['私人版', priv]]) {
    assert.match(source('dyMusicCoverHTML', src), /background-image:url\(\$\{src\}\)/, `${label} 封面没画出来`);
    assert.match(source('dyMusicCoverHTML', src), /storedImageDisplaySource/, '存过的图要先还原');
    assert.match(source('dyPostMusicPick', src), /dyMusicCoverHTML\(s\)/, `${label} 选音乐那张单子还是没封面`);
    assert.match(source('dyWorkMusicHTML', src), /dyMusicCoverHTML\(s,'sm'\)/, `${label} 作品底下那条没封面`);
  }
  for (const s of shells) {
    assert.match(s, /\.dymu-cover\{[^}]*background:#2a2a30 center\/cover no-repeat/, '封面样式没了');
    assert.match(s, /\.dymu-cover\.sm\{/, '作品底下那条用的小尺寸没了');
  }
});
