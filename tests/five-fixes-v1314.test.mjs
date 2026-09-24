import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const PRIVATE = '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const priv = readFileSync(new URL(PRIVATE + 'app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../glass-theme.css', import.meta.url), 'utf8');
const privCss = readFileSync(new URL(PRIVATE + 'glass-theme.css', import.meta.url), 'utf8');
const shells = [
  readFileSync(new URL('../小手机.html', import.meta.url), 'utf8'),
  readFileSync(new URL(PRIVATE + '小手机.html', import.meta.url), 'utf8'),
  readFileSync(new URL(PRIVATE + 'index.html', import.meta.url), 'utf8'),
];
const both = [app, priv];
const grab = (src, name) => {
  const lines = src.split('\n');
  const i = lines.findIndex(x => x.startsWith(`function ${name}(`) || x.startsWith(`async function ${name}(`));
  assert.ok(i >= 0, `找不到 ${name}`);
  let j = i + 1;
  while (j < lines.length && !/^(async function |function |let |const |\/\*)/.test(lines[j])) j++;
  return lines.slice(i, j).join('\n');
};
const source = name => grab(app, name);

/* ===== 一、微信换背景：他说换上了，其实没换 ===== */

test('「换背景」那条说明不再挂在表情包的 if 里面', () => {
  for (const x of both) {
    /* 原来整句写在 if(!c.noSticker&&stkFreq>0){…} 里，她一关表情包角色就不知道有这个标签 */
    assert.match(x, /\n {2}s\+='\\n- 聊天背景：'\+S\.me\.name\+'让你把某张照片换成你们的聊天背景/, '必须是独立一条 s+=');
    assert.doesNotMatch(x, /表情包：你也能像真人一样发表情包[\s\S]{0,4000}?让你把ta刚发的某张照片设成你们的聊天背景/);
    assert.match(x, /只在嘴上说「换好了」是没有用的/, '得把「光说没用」写死在提示词里');
  }
});

test('她开口要换背景就认出来，随口提到背景不算', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(source('wechatBgRequest'), ctx);
  const ask = t => vm.runInContext(`wechatBgRequest(${JSON.stringify(t)})`, ctx);
  assert.equal(ask('把这张换成背景'), true);
  assert.equal(ask('拿这张当背景吧'), true);
  assert.equal(ask('帮我换个聊天背景'), true);
  assert.equal(ask('背景换成刚刚那张'), true);
  assert.equal(ask('这个背景音乐好好听'), false);
  assert.equal(ask('我当时在看背景里那朵云'), false, '「当时…背景」不能被当成要换背景');
  assert.equal(ask('别换背景了'), false, '说了别换就不能换');
  assert.equal(ask('在吗'), false);
  assert.equal(ask(''), false);
});

test('他忘了写标签也兜底换上，没照片就不动', () => {
  const rows = [];
  const ctx = { msgs: () => rows, save: () => {}, toast: () => {}, render: () => {}, cur: () => ({ p: 'wechat' }) };
  vm.createContext(ctx);
  vm.runInContext(source('wechatBgSourceMsg') + '\n' + source('wechatApplyBgRequest'), ctx);
  const c = { id: 'c1', chatBg: '' };
  ctx.c = c;
  assert.equal(vm.runInContext(`wechatApplyBgRequest(c,'c1')`, ctx), false, '一张照片都没有就别乱换');
  rows.push({ id: 'a', type: 'image', src: 'data:image/png;base64,AAA', role: 'user' });
  rows.push({ id: 'b', type: 'image', src: '', textCard: true, role: 'assistant' });
  assert.equal(vm.runInContext(`wechatApplyBgRequest(c,'c1')`, ctx), true);
  assert.equal(c.chatBg, 'data:image/png;base64,AAA', '图文卡片没有真图，不能拿它当背景');
  assert.equal(vm.runInContext(`wechatApplyBgRequest(c,'c1')`, ctx), false, '已经是这张了就别重复换');
  /* 他自己发的照片也能当背景 */
  rows.push({ id: 'c', type: 'image', src: 'data:image/png;base64,BBB', role: 'assistant' });
  assert.equal(vm.runInContext(`wechatApplyBgRequest(c,'c1')`, ctx), true);
  assert.equal(c.chatBg, 'data:image/png;base64,BBB');
});

test('这一轮她要了、他没写标签，收尾时补上', () => {
  for (const x of both) {
    assert.match(x, /const _wantBg=!note&&wechatBgRequest\(_userText\)&&!!wechatBgSourceMsg\(id\);let _bgApplied=false;/);
    assert.match(x, /if\(_wantBg&&!_bgApplied\)wechatApplyBgRequest\(c,id\);/);
    assert.match(x, /if\(wechatApplyBgRequest\(c,id\)\)_bgApplied=true;else _replyAuditPartial=true;continue;\}/);
  }
});

/* ===== 二、线下改成磨砂高光玻璃 ===== */

test('线下气泡走的是信息页同一套轮廓和环', () => {
  for (const s of shells) {
    assert.match(s, /\.offmsg\.them \.offbubble\{padding:9px 15px 9px 22px;background:var\(--offc-them\);color:var\(--offc-them-ink\);clip-path:polygon\(/);
    assert.match(s, /\.offmsg\.me \.offbubble\{padding:9px 22px 9px 15px;background:var\(--offc-me\);color:var\(--offc-me-ink\);clip-path:polygon\(/);
    assert.match(s, /\.offmsg\.them \.offbubble:before\{clip-path:polygon\(/);
    assert.match(s, /\.offmsg\.me \.offbubble:before\{clip-path:polygon\(/);
    /* 身子磨砂、环提亮不带 blur —— 做法文档里那条铁律 */
    assert.match(s, /\.offmsg \.offbubble\{[^}]*backdrop-filter:blur\(14px\) saturate\(1\.32\)/);
    const ring = s.match(/\.offstage \.offmsg \.offbubble:before\{[^}]*\}/)[0];
    assert.match(ring, /brightness\(1\.72\) saturate\(1\.68\)/);
    assert.doesNotMatch(ring, /backdrop-filter:blur/);
    assert.match(ring, /rgba\(255,255,255,\.72\)/);
    /* 身子上一点白都不许画，否则磨砂会把它糊成一片白雾 */
    const body = s.match(/\.offmsg \.offbubble\{[^}]*\}/)[0];
    assert.doesNotMatch(body, /255,255,255/);
  }
});

test('线下的颜色全部走变量，默认是蓝／深灰', () => {
  for (const s of shells) {
    assert.match(s, /\.offstage\{--offc-me:#0a84ff;--offc-me-ink:#ffffff;--offc-them:#26262a;--offc-them-ink:#ffffff;--offc-nar:#c9c2b6;/);
    assert.match(s, /\.offnar\{[^}]*color:var\(--offc-nar\)/);
    assert.match(s, /\.offstage\.hasbg:before\{/, '换了背景要压一层上下渐晕，不然字看不清');
    assert.match(s, /\.off-field\{[^}]*backdrop-filter:blur\(14px\) saturate\(1\.32\)/, '输入框也要是磨砂的');
    assert.match(s, /\.off-field:before,\.offinput \.send:before\{[^}]*mask-composite:exclude/, '输入框和按钮那圈是挖空的环');
  }
});

test('外观里能改五种颜色，也能换背景，而且不压画质', () => {
  for (const x of both) {
    assert.match(x, /const OFF_THEME_DEF=\{me:'#0a84ff',meInk:'#ffffff',them:'#26262a',themInk:'#ffffff',nar:'#c9c2b6'\}/);
    assert.match(x, /function offAppearance\(id\)/);
    assert.match(x, /function offThemeSet\(id,key,val\)/);
    assert.match(x, /function offBgPick\(id\)/);
    assert.match(grab(x, 'offBgPick'), /compressChatBackground\(f\)/, '背景要走不压画质那条');
    assert.match(grab(x, 'renderOff'), /offAppearance\('\$\{id\}'\)/, '单次约会的 meta 里要有入口');
    assert.match(x, /<button type="button" onclick="offAppearance\('\$\{id\}'\)">外观<\/button>/, '共同生活里也要有入口');
    assert.match(grab(x, 'renderOff'), /const _st=offStageAttrs\(c\);/);
    assert.match(x, /class="offstage cohab-stage\$\{_st\.cls\}" style="\$\{_st\.style\}"/, '共同生活也套同一套外观');
  }
});

test('颜色只认 #rrggbb，别的都退回默认', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(source('offColorOk'), ctx);
  const ok = (v, d) => vm.runInContext(`offColorOk(${JSON.stringify(v)},${JSON.stringify(d)})`, ctx);
  assert.equal(ok('#FF8FAB', '#000000'), '#ff8fab');
  assert.equal(ok('red', '#000000'), '#000000');
  assert.equal(ok('#fff', '#000000'), '#000000');
  assert.equal(ok('javascript:x', '#000000'), '#000000');
  assert.equal(ok('', '#0a84ff'), '#0a84ff');
});

test('私人版进线下页会把背景图捞回来', () => {
  for (const x of both) {
    assert.match(grab(x, 'routeCriticalStoredImageKeys'), /route\.p==='off'\)\{const c=getC\(route\.id\);if\(c\)\{add\(offTheme\(c\)\.bg\)/);
  }
});

/* ===== 三、新的朋友里的一键生成 ===== */

test('「一键生成」的入口回来了（函数一直都在，只是没人调）', () => {
  for (const x of both) {
    assert.match(x, /function genCharPrompt\(\)/);
    assert.match(x, /onclick="genCharPrompt\(\)">✨ 一键生成<\/button>/, '入口没接上等于功能不存在');
    assert.match(grab(x, 'renderNewFriends'), /nf-create-acts/);
    assert.match(grab(x, 'renderNewFriends'), /＋ 添加角色/, '手动新建也要留着');
  }
  for (const s of [css, privCss]) assert.match(s, /\.nf-create-acts\{display:flex;align-items:center;gap:4px\}/);
});

/* ===== 四、真人好友转账走角色那一套 ===== */

test('真人好友的 1v1 转账用角色那张卡，点开是同一个详情页', () => {
  for (const x of both) {
    assert.match(x, /const PF_CID_PREFIX='pf:'/);
    assert.match(x, /if\(p\.type==='transfer'&&m&&m\.to\)\{const view=pfTransferView\(m\);\n\s*if\(view\)return payCard\('t',view,pfMsgIsMine\(m\),PF_CID_PREFIX\+pfMsgFriendId\(m\)\);\}/);
    assert.match(grab(x, 'transferMessageFind'), /String\(cid\|\|''\)\.indexOf\(PF_CID_PREFIX\)===0/);
    assert.match(grab(x, 'transferDetailAction'), /return pfTransferDetailAction\(String\(cid\)\.slice\(PF_CID_PREFIX\.length\),mid,action\)/);
    assert.match(x, /function pfTransferDetailAction\(fid,mid,action\)/);
    /* 群里的红包还是老的抢法，别一起改了 */
    assert.match(x, /if\(p\.type==='transfer'\|\|p\.type==='redpacket'\)\{const red=p\.type==='redpacket'/);
  }
});

test('收款和退还都落地：钱、状态、给对方的通知', () => {
  const p = { id: 'ME', secret: 's', messages: { F1: [
    { id: 'in1', from: 'F1', to: 'ME', text: '', time: 10 },
    { id: 'out1', from: 'ME', to: 'F1', text: '', time: 20 }] } };
  const bills = [], sent = [];
  const ctx = {
    phoneFriendState: () => p,
    pfMsgList: (store, k) => store[k] || [],
    pfMsgPayload: m => ({ in1: { type: 'transfer', amount: 20, note: '' }, out1: { type: 'transfer', amount: 7, note: '' } })[m.id] || null,
    phoneFriendById: () => ({ phone_id: 'F1', display_name: '小鱼' }),
    pfFriendDisplayName: f => f.display_name,
    addBill: (dir, amt, note) => bills.push({ dir, amt, note }),
    sendPhoneFriendBody: (fid, body) => sent.push({ fid, body }),
    pfPack: o => JSON.stringify(o),
    pfRpc: () => Promise.resolve(),
    phoneFriendSync: () => {}, save: () => {}, toast: () => {}, transferDetailBack: () => {},
  };
  vm.createContext(ctx);
  for (const n of ['pfMineId', 'pfMsgIsMine', 'pfMsgFriendId', 'pfTransferView', 'pfTransferFind', 'pfHandleTransferRefund', 'pfTransferDetailAction'])
    vm.runInContext(source(n), ctx);

  /* 收款 */
  vm.runInContext(`pfTransferDetailAction('F1','in1','receive')`, ctx);
  const got = p.messages.F1[0];
  assert.equal(got.payState, 'received');
  assert.deepEqual(bills.pop(), { dir: 'in', amt: 20, note: '收到 小鱼 的转账' });

  /* 自己发出去的不能自己收 */
  vm.runInContext(`pfTransferDetailAction('F1','out1','receive')`, ctx);
  assert.equal(p.messages.F1[1].payState, undefined, '自己发的那笔不该被自己收掉');

  /* 退还：状态变了，而且真的给对方发了一条退还消息 */
  p.messages.F1.push({ id: 'in2', from: 'F1', to: 'ME', text: '', time: 30 });
  ctx.pfMsgPayload = m => m.id === 'in2' ? { type: 'transfer', amount: 5, note: '' } : null;
  vm.runInContext(`pfTransferDetailAction('F1','in2','refund')`, ctx);
  assert.equal(p.messages.F1[2].payState, 'refunded');
  assert.equal(sent.length, 1);
  assert.deepEqual(JSON.parse(sent[0].body), { type: 'transfer_refund', of: 'in2', amount: 5 });
});

test('对方退还之后，我发出去的那笔自动变已退还、钱也退回来', () => {
  const p = { id: 'ME', messages: { F1: [{ id: 'out1', from: 'ME', to: 'F1', text: '', time: 20 }] } };
  const bills = [];
  const ctx = {
    phoneFriendState: () => p,
    pfMsgList: (store, k) => store[k] || [],
    pfMsgPayload: m => m.id === 'out1' ? { type: 'transfer', amount: 7, note: '' }
      : { type: 'transfer_refund', of: 'out1', amount: 7 },
    phoneFriendById: () => ({ display_name: '小鱼' }),
    pfFriendDisplayName: f => f.display_name,
    addBill: (dir, amt, note) => bills.push({ dir, amt, note }),
  };
  vm.createContext(ctx);
  for (const n of ['pfMineId', 'pfMsgIsMine', 'pfTransferFind', 'pfHandleTransferRefund'])
    vm.runInContext(source(n), ctx);
  ctx.msg = { id: 'r1', from: 'F1', to: 'ME', text: '', time: 40 };
  assert.equal(vm.runInContext(`pfHandleTransferRefund(msg)`, ctx), true);
  assert.equal(p.messages.F1[0].payState, 'refunded');
  assert.deepEqual(bills.pop(), { dir: 'in', amt: 7, note: '小鱼 退还了转账' });
  /* 再来一条重复的退还，钱不能退两次 */
  assert.equal(vm.runInContext(`pfHandleTransferRefund(msg)`, ctx), false);
  assert.equal(bills.length, 0);
});

test('退还那条消息是隐藏的，不当气泡显示', () => {
  for (const x of both) {
    assert.match(x, /function pfIsHiddenTransport\(m\)\{const p=pfMsgPayload\(m\);return !!\(p&&\(p\.type==='style_update'\|\|p\.type==='transfer_refund'\)\);\}/);
    assert.match(grab(x, 'pfStoreMessage'), /if\(pfHandleTransferRefund\(kept\)\)return true;/);
  }
});

/* ===== 五、真人好友：绿色发送键 + 面板在下面 ===== */

test('真人好友 1v1 的输入框终于被绑上了', () => {
  for (const x of both) {
    assert.match(x, /const id=c\.p==='pfgroup'\?'pfg_input':c\.p==='pfchat'\?'pf_input':'ginput'/);
    assert.match(x, /else if\(c\.p==='pfchat'\)sendPhoneFriend\(c\.id\)/);
    assert.match(x, /if\(c\.p==='group'\|\|c\.p==='pfgroup'\|\|c\.p==='pfchat'\)afterGroupComposer\(c\);/);
  }
  /* 样式本来就写好了：有字就把 ＋ 收起来、露出绿色发送键 */
  assert.match(css, /\.chat-inputbar\.has-text \.chat-function-toggle\{display:none\}/);
  assert.match(css, /\.chat-inputbar\.has-text \.chat-send\{display:block\}/);
  assert.match(css, /\.chat-inputbar \.chat-send\{display:none;[^}]*background:#07c160/);
});

test('功能面板排在输入框后面（也就是键盘那个位置）', () => {
  for (const x of both) {
    const chat = grab(x, 'renderPhoneFriendChat'), group = grab(x, 'renderPhoneFriendGroup');
    assert.match(chat, /'pfpanel'\)\}\n\s*\$\{pfPanelHTML\(id\)\}`;\}/, '面板要排在 composer 后面');
    assert.match(group, /'pfgpanel'\)\}\n\s*\$\{pfGroupPanelHTML\(gid\)\}`;\}/);
    assert.doesNotMatch(chat, /<\/div>\n\s*\$\{pfPanelHTML\(id\)\}\n\s*\$\{gag\?/, '别又排回聊天记录和输入框中间');
  }
});

/* ===== 六、她看完第一版之后提的四件事 ===== */

test('圆角改成 5° 采样，不再有看得出来的平切面', () => {
  const gen = readFileSync(new URL('../scripts/glass_ring_polygon.py', import.meta.url), 'utf8');
  assert.match(gen, /^STEP = 5\.0/m, '她说「气泡最左边前端有点缺一块儿的感觉」——15° 的平切面在 18px 圆角上看得出来');
  assert.match(gen, /def _steps\(\):[\s\S]{0,240}?n = int\(round\(90\.0 \/ STEP\)\)[\s\S]{0,40}?return range\(n \+ 1\)/, '取点数必须从 STEP 算出来，不能写死');
  assert.doesNotMatch(gen, /for k in range\(7\)/, '别又退回 7 个点');
  for (const s of shells) {
    /* 外圈点数 = 三个圆角 × 19 + 尾巴那 6 个 = 63 */
    const out = s.match(/\.offmsg\.them \.offbubble\{[^}]*clip-path:polygon\(([^)]*(?:\([^)]*\)[^)]*)*)\);\}/);
    assert.ok(out, '找不到线下 them 的轮廓');
    const pts = out[1].split(/,(?![^(]*\))/).length;
    assert.equal(pts, 63, `外圈点数应该是 63，现在是 ${pts}`);
  }
});

test('线下顶栏的昵称按整条栏居中，不被右边按钮挤偏', () => {
  for (const s of shells) {
    assert.match(s, /\.off-date-nav\{position:relative;/);
    assert.match(s, /\.off-date-nav>\.t\{position:absolute!important;left:50%!important;top:50%!important;transform:translate\(-50%,-50%\)!important;/);
    assert.match(s, /\.off-date-nav>\.t\{[^}]*pointer-events:none/, '标题盖在上面就别挡住按钮');
    assert.doesNotMatch(s, /\.off-date-nav>\.t\{position:static!important/);
  }
});

test('「让TA回」是偏灰的磨砂玻璃，原来那套主题里还是老样子', () => {
  for (const s of shells) {
    assert.match(s, /\.off-reply-top\{position:relative;height:27px;[^}]*border:0;[^}]*background:rgba\(120,122,132,\.34\);[^}]*backdrop-filter:blur\(14px\) saturate\(1\.32\)/);
    assert.match(s, /\.off-reply-top:before\{[^}]*mask-composite:exclude[^}]*brightness\(1\.5\) saturate\(1\.4\)/);
    assert.match(s, /\.offstage\.off-classic \.off-reply-top\{[^}]*linear-gradient\(145deg,rgba\(70,64,55,\.72\)/, '切回原来的主题，这颗按钮也要变回去');
    assert.match(s, /\.offstage\.off-classic \.off-reply-top:before\{display:none!important;\}/);
  }
});

test('两套主题都留着，切换存在角色身上', () => {
  for (const x of both) {
    assert.match(x, /t\.skin=t\.skin==='classic'\?'classic':'glass';/);
    assert.match(x, /function offSkinSet\(id,skin\)/);
    assert.match(grab(x, 'offStageAttrs'), /classic=t\.skin==='classic'/);
    assert.match(grab(x, 'offStageAttrs'), /cls:\(classic\?' off-classic':''\)\+\(bg\?' hasbg':''\)/);
    assert.match(grab(x, 'offStageAttrs'), /bg=\(!classic&&t\.bg\)\?storedImageDisplaySource\(t\.bg\):''/, '原来那套本来就没有背景图');
    assert.match(x, /offSkinSet\('\$\{id\}','\$\{k\}'\)/, '外观里要能点');
  }
  for (const s of shells) {
    /* 原来那套的关键几条：方一点的气泡、没有玻璃、没有那圈高光 */
    assert.match(s, /\.offstage\.off-classic \.offmsg \.offbubble\{clip-path:none!important;border-radius:5px!important;/);
    assert.match(s, /\.offstage\.off-classic \.offmsg \.offbubble:before\{display:none!important;\}/);
    assert.match(s, /\.offstage\.off-classic \.offmsg\.me \.offbubble\{background:#d2c9ba!important;color:#181614!important;/);
    assert.match(s, /\.offstage\.off-classic \.offscroll\{background:#050505!important;\}/);
    assert.match(s, /\.offstage\.off-classic:before\{display:none!important;\}/, '压暗那一层也不要');
  }
});

test('主题只认这两个，别的都退回玻璃', () => {
  const ctx = { save: () => {} };
  vm.createContext(ctx);
  vm.runInContext(source('offColorOk') + '\n' + app.match(/const OFF_THEME_DEF=\{[^\n]*\}/)[0] + '\n' + source('offTheme'), ctx);
  const skin = v => { ctx.c = { offTheme: { skin: v } }; return vm.runInContext('offTheme(c).skin', ctx); };
  assert.equal(skin('classic'), 'classic');
  assert.equal(skin('glass'), 'glass');
  assert.equal(skin('neon'), 'glass');
  assert.equal(skin(undefined), 'glass', '没设过就是新的玻璃');
});

test('小手机群聊的功能面板也排在输入框后面', () => {
  for (const x of both) {
    assert.match(grab(x, 'renderPhoneFriendGroup'), /'pfgpanel'\)\}\n\s*\$\{pfGroupPanelHTML\(gid\)\}`;\}/);
  }
});

/* ===== 七、共同生活：壁纸铺满、那几条实心的也改玻璃 ===== */

test('壁纸按 cover 铺满全屏 —— .cohab-stage 的 background 简写会把它冲掉', () => {
  for (const sh of shells) {
    assert.match(sh, /\.offstage\.hasbg\{background-size:cover;background-position:center;background-repeat:no-repeat;\}/);
    /* 这条必须排在 .cohab-stage 后面，否则又被简写覆盖回去 */
    assert.ok(sh.indexOf('.offstage.hasbg{background-size:cover') > sh.indexOf('.cohab-stage{background:radial-gradient'),
      '.offstage.hasbg 要排在 .cohab-stage 后面才压得住');
    assert.match(sh, /\.offstage\.cohab-stage\.hasbg\{background-color:transparent;\}/);
  }
});

test('共同生活那几条实心的，换了壁纸之后都变磨砂', () => {
  for (const sh of shells) {
    for (const sel of ['\\.cohab-meta', '\\.cohab-settings', '\\.cohab-status-chip', '\\.cohab-debug-reply',
                       '\\.cohab-away-panel', '\\.cohab-return-banner', '\\.cohab-memory-open', '\\.cohab-settings-grid label']) {
      const re = new RegExp('\\.offstage\\.hasbg:not\\(\\.off-classic\\) ' + sel + '\\{[^}]*backdrop-filter:blur');
      assert.match(sh, re, sel + ' 还是实心的');
    }
    /* 状态那颗和让TA回还要有那圈挖空的细高光 */
    assert.match(sh, /\.offstage\.hasbg:not\(\.off-classic\) \.cohab-status-chip\{position:relative;border:0;/);
    assert.match(sh, /\.offstage\.hasbg:not\(\.off-classic\) \.cohab-status-chip:before\{[^}]*mask-composite:exclude/);
    assert.match(sh, /\.offstage\.hasbg:not\(\.off-classic\) \.cohab-debug-reply:before\{[^}]*mask-composite:exclude/);
    /* 原来那套主题一个都不许被带上 */
    assert.doesNotMatch(sh, /\.offstage\.off-classic[^{]*\.cohab-settings\{[^}]*backdrop-filter:blur/);
  }
});
