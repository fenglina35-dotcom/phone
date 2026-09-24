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

/* ===== 一、她在短信里说出关键词，他就真的把效果放出来 ===== */

const wantCtx = () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(app.match(/const PH_FX_SCREEN=\[[^\n]*\]/)[0], ctx);
  vm.runInContext(source('phFxName'), ctx);
  vm.runInContext(app.match(/const PH_FX_WANT=\[[\s\S]*?\]\];/)[0], ctx);
  vm.runInContext(app.match(/const PH_FX_WANT_CUE=\/[^\n]*\/;/)[0], ctx);
  vm.runInContext(source('phFxWantFromText'), ctx);
  return ctx;
};

test('她说「想看流星」就认出流星，随口感叹不算点单', () => {
  const ctx = wantCtx();
  const want = t => vm.runInContext(`phFxWantFromText(${JSON.stringify(t)})`, ctx);
  assert.equal(want('我想看流星')?.sfx, 'star');
  assert.equal(want('我想看流星')?.name, '流星');
  assert.equal(want('给我放个烟花呗')?.sfx, 'fireworks');
  assert.equal(want('来点爱心')?.sfx, 'love');
  assert.equal(want('能不能撒花庆祝一下')?.sfx, 'confetti');
  assert.equal(want('给我放个气球')?.sfx, 'balloons');
  /* 光有效果名不算——不然她随口聊天都会被当成点单 */
  assert.equal(want('今晚的烟花真好看'), null);
  assert.equal(want('流星划过去了'), null);
  /* 光有要求的语气、没有效果名，也不算 */
  assert.equal(want('我想看你'), null);
  assert.equal(want('在吗'), null);
  assert.equal(want(''), null);
});

test('认出来之后，这一轮的提示词里钉死「必须写这个标签」', () => {
  const ctx = wantCtx();
  vm.runInContext(source('phFxWantPrompt'), ctx);
  const p = vm.runInContext(`phFxWantPrompt(phFxWantFromText('我想看流星'))`, ctx);
  assert.match(p, /必须/);
  assert.match(p, /\[屏幕效果\|流星\]/);
  assert.equal(vm.runInContext(`phFxWantPrompt(null)`, ctx), '');
  /* 常驻那段说明也得写清楚：只答应不写标签＝什么都不会发生 */
  const help = source('phFxTagHelp');
  assert.match(help, /她开口要某个效果/);
  assert.match(help, /必须真的把标签写上/);
});

test('兜底：她要了、这一轮一条标签都没有，就把效果补到最后一条上', () => {
  const ctx = { save: () => {}, render: () => {}, cur: () => ({ p: 'wechat' }), $: () => null,
    phDigits: n => String(n), setTimeout: () => {}, phFxPlay: () => {} };
  vm.createContext(ctx);
  vm.runInContext(source('phSmsApplyWantedFx'), ctx);
  const run = (sent, want) => {
    ctx.sent = sent;
    const done = vm.runInContext(`phSmsApplyWantedFx('138','138',sent,${JSON.stringify(want)})`, ctx);
    return { done, sent: ctx.sent };
  };
  let r = run([{ id: 'a' }, { id: 'b' }], { sfx: 'star', name: '流星' });
  assert.equal(r.done, true);
  assert.equal(r.sent[1].sfx, 'star', '补在最后一条上');
  assert.equal(r.sent[0].sfx, undefined);
  /* 他自己已经写了标签就别再补第二次 */
  r = run([{ id: 'a', sfx: 'fireworks' }, { id: 'b' }], { sfx: 'star', name: '流星' });
  assert.equal(r.done, false);
  assert.equal(r.sent[1].sfx, undefined);
  /* 最后一条是语音条就往前找一条能挂的 */
  r = run([{ id: 'a' }, { id: 'b', voice: 1 }], { sfx: 'love', name: '爱心' });
  assert.equal(r.sent[0].sfx, 'love');
  /* 她根本没要，就一条都别动 */
  r = run([{ id: 'a' }], null);
  assert.equal(r.done, false);
  assert.equal(r.sent[0].sfx, undefined);
});

test('短信那一轮真的把这两件事接上了（网页和私人两端一致）', () => {
  for (const x of both) {
    const fn = grab(x, 'phRoleSmsReply');
    assert.match(fn, /_want=phFxWantFromText\(userText\)/, '先读她那句话');
    assert.match(fn, /phFxTagHelp\(\)\+phFxWantPrompt\(_want\)/, '钉进这一轮的系统提示');
    assert.match(fn, /const _sent=await phDeliverSmsBubbles\(num,sk,parts,c\);\n\s*phSmsApplyWantedFx\(num,sk,_sent,_want\)/, '发完要兜底');
    assert.match(grab(x, 'phDeliverSmsBubbles'), /return out;/, '得把发出去的那几条交回来');
    assert.match(grab(x, 'phReceiveSms'), /\n  return m;\}/, '收下的那条要交回来，不然兜底拿不到');
  }
});

/* ===== 二、＋ 号里的多选删除 ===== */

test('＋ 号里有「多选删除信息」，进去之后气泡前面冒出圆圈', () => {
  for (const x of both) {
    assert.match(grab(x, 'phSmsPlusMenu'), /phSmsSelEnter\('\$\{esc\(num\)\}','\$\{esc\(sk\)\}'\)/);
    assert.match(grab(x, 'phSmsPlusMenu'), /多选删除信息/);
    const r = grab(x, 'renderPhoneIMsg');
    assert.match(r, /sel=phSmsSelOn\(sk\)/);
    assert.match(r, /class="imsg-tick\$\{phSmsSelHas\(m\.id\)\?' on':''\}"/);
    assert.match(r, /tap=sel\?`phSmsSelToggle\('\$\{m\.id\}'\)`/, '多选时点气泡是选中，不是弹菜单');
    assert.match(r, /class="imsg-body\$\{sel\?' selmode':''\}"/);
    assert.match(r, /\$\{sel\?phSmsSelBarHTML\(\):phFxBarHTML\(\)\+phSmsComposerHTML\(num,sk\)\}/, '多选时底下换成删除条');
    assert.match(grab(x, 'openPhoneSMS'), /_phSmsSel=null/, '换一条线要退出多选');
  }
});

test('多选删除真的只删选中的那几条', async () => {
  const p = { sms: { '138': [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } };
  const ctx = { _phSmsSel: null, phSmsArr: () => p.sms['138'], save: () => {}, render: () => {},
    toast: () => {}, uiConfirm: async () => true, $: () => null };
  vm.createContext(ctx);
  for (const n of ['phSmsSelOn', 'phSmsSelHas', 'phSmsSelToggle', 'phSmsSelSync', 'phSmsSelAllOn', 'phSmsSelAll', 'phSmsSelDelete'])
    vm.runInContext(source(n), ctx);
  vm.runInContext(`_phSmsSel={num:'138',sk:'138',ids:['a','c']}`, ctx);
  assert.equal(vm.runInContext(`phSmsSelOn('138')`, ctx), true);
  assert.equal(vm.runInContext(`phSmsSelOn('139')`, ctx), false, '别的线不该跟着进多选');
  assert.equal(vm.runInContext(`phSmsSelHas('a')`, ctx), true);
  await vm.runInContext(`phSmsSelDelete()`, ctx);
  assert.deepEqual(p.sms['138'].map(m => m.id), ['b'], '选中的删掉，没选的留着');
  assert.equal(vm.runInContext(`_phSmsSel`, ctx), null, '删完退出多选');
});

test('一条都没选就点删除，什么都不该发生', async () => {
  const p = { sms: { '138': [{ id: 'a' }] } };
  let asked = false;
  const ctx = { _phSmsSel: null, phSmsArr: () => p.sms['138'], save: () => {}, render: () => {},
    toast: () => {}, uiConfirm: async () => { asked = true; return true; }, $: () => null };
  vm.createContext(ctx);
  for (const n of ['phSmsSelAllOn', 'phSmsSelDelete']) vm.runInContext(source(n), ctx);
  vm.runInContext(`_phSmsSel={num:'138',sk:'138',ids:[]}`, ctx);
  await vm.runInContext(`phSmsSelDelete()`, ctx);
  assert.equal(asked, false, '空选不该弹确认');
  assert.deepEqual(p.sms['138'].map(m => m.id), ['a']);
});

test('多选那身衣服三个壳子里都有', () => {
  for (const s of shells) {
    assert.match(s, /\.imsg-body\.selmode \.imsg-row\{justify-content:flex-start;/);
    assert.match(s, /\.imsg-body\.selmode \.imsg-row\.me \.imsg-col\{margin-left:auto;\}/, '我这边的气泡照样靠右');
    assert.match(s, /\.imsg-tick\{[^}]*border-radius:50%/);
    assert.match(s, /\.imsg-tick\.on\{background:#0a84ff;/);
    assert.match(s, /\.imsg-selbar\{/);
    assert.match(s, /\.imsg-selbar button\.del\[disabled\]\{/, '没选中的时候删除键要是灰的');
  }
});

/* ===== 三、联系人页的一键清空 ===== */

test('联系人页有「一键清空全部聊天」，右边写着现在有多少条', () => {
  for (const x of both) {
    const r = grab(x, 'renderPhoneContact');
    assert.match(r, /phClearContactChat\('\$\{esc\(num\)\}'\)/);
    assert.match(r, /一键清空全部聊天/);
    assert.match(r, /\$\{phContactSmsCount\(num\)\|\|''\}/);
  }
});

test('一键清空只清这个人的几条线，别人和微信都不动', async () => {
  const p = {
    sms: { '13800000001': [{ id: 'a' }, { id: 'b' }],
      'alias:18600000000:13800000001': [{ id: 'c' }],
      '13900000002': [{ id: 'd' }] },
    read: { '13800000001': 1, 'alias:18600000000:13800000001': 2, '13900000002': 3 },
    aliasThreads: { '13800000001': { kind: 'sms' }, '13900000002': { kind: 'sms' } }
  };
  const role = { id: 'c1', phoneAliasHistory: [{ x: 1 }], phoneSpoofSmsHistory: [{ x: 1 }] };
  const S = { contacts: [role], spy: { c1: { calls: [{ type: '短信' }, { type: '电话' }] } },
    messages: { c1: [{ id: 'wx' }] } };
  const ctx = { S, phState: () => p, getC: () => role, save: () => {}, render: () => {}, toast: () => {},
    uiConfirm: async () => true, phName: () => '他', phFind: () => ({ kind: 'role', id: 'c1' }), _phSmsSel: 1 };
  vm.createContext(ctx);
  for (const n of ['phDigits', 'phNorm', 'phSmsDisplayNum', 'phContactSmsKeys', 'phContactSmsCount', 'phClearContactChat'])
    vm.runInContext(source(n), ctx);
  assert.equal(vm.runInContext(`phContactSmsCount('13800000001')`, ctx), 3, '主号两条＋匿名号一条');
  await vm.runInContext(`phClearContactChat('13800000001')`, ctx);
  assert.deepEqual(Object.keys(p.sms), ['13900000002'], '只留下别人那条线');
  assert.deepEqual(Object.keys(p.read), ['13900000002']);
  assert.deepEqual(Object.keys(p.aliasThreads), ['13900000002']);
  assert.equal(role.phoneAliasHistory, undefined, '角色的隐藏短信记录也要抹掉');
  assert.equal(role.phoneSpoofSmsHistory, undefined);
  assert.deepEqual(S.spy.c1.calls, [{ type: '电话' }], '只清短信，电话记录留着');
  assert.deepEqual(S.messages.c1, [{ id: 'wx' }], '微信聊天绝对不能被这个按钮清掉');
  assert.equal(vm.runInContext(`_phSmsSel`, ctx), null);
});

test('本来就没记录的时候不弹确认框', async () => {
  let asked = false;
  const p = { sms: {}, read: {}, aliasThreads: {} };
  const ctx = { S: {}, phState: () => p, getC: () => null, save: () => {}, render: () => {}, toast: () => {},
    uiConfirm: async () => { asked = true; return true; }, phName: () => '他', phFind: () => null, _phSmsSel: null };
  vm.createContext(ctx);
  for (const n of ['phDigits', 'phNorm', 'phSmsDisplayNum', 'phContactSmsKeys', 'phContactSmsCount', 'phClearContactChat'])
    vm.runInContext(source(n), ctx);
  await vm.runInContext(`phClearContactChat('138')`, ctx);
  assert.equal(asked, false);
});

/* ===== 四、记仇本 ===== */

test('统一模式下记仇本真的发给角色，也真的落地', () => {
  for (const x of both) {
    /* 以前是 if(_main&&!_natural)，统一模式永远为真，等于这段提示词从来没发出去过 */
    assert.match(x, /if\(_main\)\{const gd=\(c\.grudges\|\|\[\]\);const gund=gd\.filter\(x=>!x\.done\);/);
    assert.doesNotMatch(x, /if\(_main&&!_natural\)\{const gd=/);
    /* 标签不能再被当垃圾扔掉 */
    assert.doesNotMatch(x, /_naturalOn\?content\.replace\(\/\[\\\[【\]\\s\*\(\?:记仇\|消气\)/);
    assert.doesNotMatch(x, /wechatNaturalOn\(\)\?content\.replace\(\/\[\\\[【\]\\s\*\(\?:记仇\|消气\)/);
    assert.match(x, /maybeCollarIntent\(content,c\);maybeGrudgeResolve\(content,c,id\);/);
    assert.match(x, /maybeCollarIntent\(content,c\);maybeGrudgeResolve\(content,c,_call\.id\);/);
    /* 旧账满 8 笔自动关小黑屋是另一码事，她没提，不该顺手打开 */
    assert.match(x, /if\(!_natural&&_gn>=8&&S\.couple&&S\.couple\.jailAuth/);
  }
});

test('「什么事值得记」写清楚了，人设爱记仇的要更勤快', () => {
  for (const x of both) {
    assert.match(x, /这本子只有你自己看得见/);
    assert.match(x, /不用等到大吵一架/);
    assert.match(x, /被敷衍被忽略被晾着/);
    assert.match(x, /爱记仇、小心眼、记性好、爱翻旧账/);
  }
});

/* ===== 五、抖音图片按原图比例 ===== */

test('抖音图片不再被裁，方图上下留黑底', () => {
  for (const s of shells) {
    assert.match(s, /\.dyfd-card\.photo \.dyimg img\{[^}]*object-fit:contain/);
    assert.match(s, /\.dywk-frame\.photo \.dyimg img\{[^}]*object-fit:contain/);
    assert.doesNotMatch(s, /\.dyfd-card\.photo \.dyimg img\{[^}]*object-fit:cover/);
    assert.doesNotMatch(s, /\.dywk-frame\.photo \.dyimg img\{[^}]*object-fit:cover/);
    assert.match(s, /\.dyfd-card\.photo \.dyimg\{[^}]*background:#000;/);
    assert.match(s, /\.dywk-frame\.photo \.dyimg\{[^}]*background:#000;/);
  }
  /* 她发的和角色发的走的是同一条路：dyVideoCard 不分是谁发的 */
  assert.match(source('dyVideoCard'), /const photo=v&&v\.img\?storedImageDisplaySource\(v\.img\):''/);
});
