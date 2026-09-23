import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const PRIVATE = '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const priv = readFileSync(new URL(PRIVATE + 'app.js', import.meta.url), 'utf8');
const lines = app.split('\n');
const source = name => {
  const i = lines.findIndex(x => x.startsWith(`function ${name}(`) || x.startsWith(`async function ${name}(`));
  assert.ok(i >= 0, `找不到 ${name}`);
  let depth = 0; const out = [];
  for (let j = i; j < lines.length; j++) {
    out.push(lines[j]);
    for (const ch of lines[j]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth <= 0 && j > i) break;
    if (depth <= 0 && j === i && /\}$/.test(lines[j])) break;
  }
  return out.join('\n');
};

test('真人好友发表情包：包里必须是真图，不能是只有本机认识的 idb: 引用', () => {
  /* 她说「私人版本的真人好友发表情包显示不出来，我自己的显示不出来，网页版本的确实可以」。
     根子在存档回填：保存时大图会被换成 'idb:xxxx' 短引用，而 lazyStoredImagesOn()
     （私人 App、安卓、iOS 网页都算）读档时不回填，所以 S.me.stickers[i].img 就是
     'idb:xxxx' 这个字符串本身。桌面网页会完整回填，所以一直看不出问题。
     真人好友的消息要发到服务器，包必须自带真图。 */
  const img = source('pfStickerImage');
  assert.match(img, /if\(!isStoredImgRef\(raw\)\)return raw;/, '本来就是真图就直接用');
  assert.match(img, /if\(_imgCache\[key\]\)return _imgCache\[key\];/, '内存里有就别再读一次库');
  assert.match(img, /await imgGet\(key\)/, '内存里没有就去图库读出来');
  assert.match(img, /_imgCache\[key\]=src;_imgRev\.set\(src,key\);_imgReady\.add\(key\)/, '读出来要回填进缓存');

  const body = source('pfStickerBody');
  assert.match(body, /if\(!img\)return \{body:'',why:'这个表情图读不出来/, '读不出来要吭一声，不能默默什么都不发');
  assert.match(body, /pfPack\(\{type:'sticker',img,meaning:/, '包里塞的是读出来的真图');
  assert.equal(/img:s\.img/.test(body), false, '又把原始字段直接塞进去了，idb: 引用会漏出去');
  /* 真图比引用大得多，大小必须在读出真图【之后】再判一次 */
  const order = body.indexOf('await pfStickerImage') < body.indexOf('PHONE_FRIEND_BODY_MAX');
  assert.ok(order, '得先读出真图再判大小，不然量的是引用的长度，等于没判');

  for (const fn of ['phoneFriendSendSticker', 'phoneFriendGroupSendSticker']) {
    const s = source(fn);
    assert.match(s, /^async function/, fn + ' 得是 async，读图是异步的');
    assert.match(s, /const r=await pfStickerBody\(s\);if\(!r\.body\)\{toast\(r\.why\);return;\}/, fn + ' 要走同一条路');
    assert.equal(/pfPack\(\{type:'sticker',img:s\.img/.test(s), false, fn + ' 还在直接塞原始字段');
  }
  /* 渲染这边兜一层：修复之前已经发坏的那些，在她自己机器上也能显示 */
  assert.match(source('pfBubblePart'), /const stk=storedImageDisplaySource\(p\.img\)/, '老消息里的 idb: 引用也要认');
  for (const x of [app, priv]) assert.ok(x.includes('async function pfStickerImage('), '私人版少了这个修复');
});

test('抖音群里被角色禁言，他会带着这件事来微信找她', () => {
  /* 她说「如果当时角色在抖音群给我禁言，他可以按照发生的事情和自己的性格来给我微信发来消息」 */
  const f = source('dyGMuteWechatFollowup');
  assert.match(f, /const actor=dyGFind\(g,actorKey\),cid=actor&&actor\.cid,c=cid\?getC\(cid\):null;/, '动手的得是个真角色');
  assert.match(f, /if\(!c\|\|c\.deleted\|\|c\.blocked\)return false;/, '删了或拉黑了的角色不该来');
  assert.match(f, /if\(typeof _call!=='undefined'&&_call\)return false;/, '正在通话就别插一脚');
  /* 「按照发生的事情」：禁言前群里真的说了什么，必须原样给他 */
  assert.match(f, /const ctx=dyGMuteContext\(g,10\)/, '要把禁言前那几句取出来');
  assert.match(f, /\+\(ctx\|\|'（群里没留下什么记录）'\)\+/,
    '取出来还得真的拼进那段提示里——只调用不使用，等于什么都没带过去');
  assert.match(f, /这是你自己动的手/, '得讲清是他干的，不是系统随机事件');
  assert.match(f, /不能凭空编造群里没发生过的事/, '不许编没发生的事');
  /* 「自己的性格」：态度不能写死 */
  assert.match(f, /按你自己的性格和你们此刻的关系决定态度/, '态度要交给他的人设');
  assert.match(f, /scheduleReply\(c\.id,note\)/, '走的是正常那条微信回复线');

  const ctx = source('dyGMuteContext');
  assert.match(ctx, /m\.k==='me'\?'【'\+who\+'】':who/, '她自己说的话要单独标出来，不然他分不清谁说的');
  assert.match(ctx, /m\.kind==='voice'\?\('\[语音\]'\+String\(m\.text\|\|''\)\)/, '群里的语音也要能看懂');

  /* 只有「她被禁 + 动手的不是她自己」才触发 */
  const apply = source('dyGCmdApply');
  assert.match(apply, /if\(target\.k==='me'&&actorKey!=='me'\)wx=dyGMuteWechatFollowup\(g,actorKey,mins\);/,
    '禁的是别人、或者她自己动的手，都不该触发');

  /* 他想通了写 [解禁]，要真的解掉，而且只能解自己下的那道 */
  const ungag = source('dyGUngagFromWechat');
  assert.match(ungag, /if\(!by\|\|by\.cid!==cid\)continue;/, '只能解他自己下的那道禁');
  assert.match(ungag, /me\.mutedUntil=0;me\.mutedBy='';/, '要真的解掉');
  assert.match(ungag, /dyGSys\(g,dyGMemberName\(by\)\+' 解除了 '/, '群里要留下系统提示');
  const consume = source('consumeDouyinUngag');
  assert.match(consume, /return content\.replace\(DY_UNGAG_RE,'\$1'\)/, '标签本身不能显示出来');
  for (const x of [app, priv]) {
    assert.ok(x.includes('function dyGMuteWechatFollowup('), '私人版少了这个功能');
    assert.ok(x.includes('content=consumeDouyinUngag(content,c,'), '私人版没把 [解禁] 接进回复线');
  }
});
