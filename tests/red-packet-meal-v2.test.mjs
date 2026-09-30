import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const WEB = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const PRIV = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');
const CSS = fs.readFileSync(new URL('../glass-theme.css', import.meta.url), 'utf8');
const PRIV_CSS = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/glass-theme.css', import.meta.url), 'utf8');
const SERVER = fs.readFileSync(new URL('../supabase/functions/phone-role-push/index.ts', import.meta.url), 'utf8');
const both = [WEB, PRIV];

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' missing');
  const end = src.indexOf('\nfunction ', i + 9), stop = src.indexOf('\n/*', i + 9);
  return src.slice(i, stop > 0 && stop < end ? stop : end);
}
function load(src, names, extra) {
  const ctx = vm.createContext(Object.assign({}, extra || {}));
  vm.runInContext(names.map(n => grab(src, n)).join('\n') + '\n;this.__f={' + names.join(',') + '};', ctx);
  return ctx.__f;
}

/* 一、她说「吃过饭了」之后，角色（包括后台主动消息）不能再问吃饭了没有 */
test('吃过饭的各种说法都算吃完，问句和「还没吃」不算', () => {
  for (const src of both) {
    const { recentMealProgressState: st } = load(src, ['recentMealProgressState']);
    for (const t of ['我吃过饭了', '吃过饭了', '我吃过了', '吃过啦', '我吃了', '吃了', '吃饱了', '晚饭吃过了', '早就吃了', '嗯吃了', '我吃了火锅', '我吃过了，你呢？', '我吃了，你吃了吗', '我刚吃完', '已经吃了'])
      assert.equal(st(t), 'finished', t);
    for (const t of ['在吃饭', '我在吃饭呢', '我去吃饭了']) assert.equal(st(t), 'started', t);
    for (const t of ['还没吃', '没吃', '你吃了吗', '吃了吗', '你吃过饭了没有', '吃过饭了？', '我想吃火锅', '我不想吃'])
      assert.equal(st(t), '', t);
  }
});

test('「吃过饭了没有」这类回头问会被认出来（本地和后台两边）', () => {
  for (const src of both) {
    const { recentMealBaselineQuestion: q } = load(src, ['recentMealBaselineQuestion']);
    for (const t of ['吃过饭了没有', '你吃过饭了吗', '吃了吗', '吃过了没', '吃饭了没']) assert.equal(q(t), true, t);
    for (const t of ['今天吃了什么', '吃得怎么样', '好吃吗']) assert.equal(q(t), false, t);
  }
  assert.match(SERVER, /const baseline = \/\(\?:吃\|用\)过\?\(\?:饭\|早饭\|早餐\|午饭\|晚饭\)\(\?:了\)\?\(\?:吗\|么\|没\|没有\)\|\(\?:吃了没\|吃过了吗\|吃过了没\|吃了吗\|吃过没\|/);
});

test('后台主动消息的上下文太长时，先让最早的聊天让位，开头的状态和结尾的提醒都保住', () => {
  for (const src of both) {
    const fn = grab(src, 'roleServerPushRecentContext');
    assert.match(fn, /head=lines\.length,chat=selected\.map\(/);
    assert.match(fn, /const top=lines\.slice\(0,head\),tail=lines\.slice\(head\),fixed=top\.concat\(tail\)\.join\('\\n'\)\.length\+1;let room=8000-fixed;/);
    assert.match(fn, /for\(let i=chat\.length-1;i>=0;i--\)\{if\(chat\[i\]\.length\+1>room\)break;room-=chat\[i\]\.length\+1;kept\.unshift\(chat\[i\]\);\}return top\.concat\(kept,tail\)\.join\('\\n'\)\.slice\(-8000\);/);
    assert.doesNotMatch(fn, /selected\.forEach\(x=>\{[^}]*lines\.push/);
  }
});

/* 二、红包卡片：标题固定「恭喜发财，大吉大利」，自己写的祝福语放下面一行小字 */
test('红包卡片标题固定，祝福语和领取状态在下面', () => {
  for (const src of both) {
    const env = { RP_DEFAULT_NOTE: '恭喜发财，大吉大利', esc: s => String(s), rpEnvelopeSVG: () => '' };
    const { rpCardHTML } = load(src, ['rpCardHTML'], env);
    const plain = rpCardHTML({ me: true, note: '' });
    assert.match(plain, /<b>恭喜发财，大吉大利<\/b><\/span>/);
    assert.doesNotMatch(plain, /<em>/);
    assert.match(rpCardHTML({ me: false, note: '中秋快乐呀' }), /<b>恭喜发财，大吉大利<\/b><em>中秋快乐呀<\/em><\/span>/);
    assert.match(rpCardHTML({ me: false, note: '中秋快乐呀', opened: true, status: '已领取' }), /<b>恭喜发财，大吉大利<\/b><em>已领取 · 中秋快乐呀<\/em><\/span>/);
    assert.match(rpCardHTML({ me: true, note: '', opened: true, status: '已被领取' }), /<b>恭喜发财，大吉大利<\/b><em>已被领取<\/em><\/span>/);
    assert.match(src, /<circle cx="20" cy="21\.5" r="6\.4" fill="#f4c443"\/>/, '红信封金币');
  }
});

/* 三、转账卡片把备注写出来 */
test('转账卡片显示备注：待收款时备注代替「请收款」，收完后跟在状态后面', () => {
  for (const src of both) {
    const fn = grab(src, 'payCard');
    assert.match(fn, /memo=String\(m\.note\|\|''\)\.trim\(\),line=st==='pending'\?\(memo\|\|copy\):\(memo\?copy\+' · '\+memo:copy\)/);
    assert.match(fn, /<b>¥\$\{amount\}<\/b><em>\$\{esc\(line\)\}<\/em><\/span>/);
    const g = load(src, ['groupTransferCardHTML'], { esc: s => String(s), transferGlyph: () => '' }).groupTransferCardHTML;
    assert.match(g({ amount: 1, note: '我爱你', me: true }), /<em>我爱你<\/em>/);
    assert.match(g({ amount: 1, note: '我爱你', received: true }), /<em>已收款 · 我爱你<\/em>/);
    assert.match(g({ amount: 1, note: '', me: true }), /<em>你发起了一笔转账<\/em>/);
  }
  /* 字往下放一点：和真微信一样，两行字落在卡片上半部分的正中 */
  for (const css of [CSS, PRIV_CSS]) {
    assert.ok(css.includes('.wx-rp-main{min-height:60px;padding:12px 14px 6px;'));
    assert.ok(css.includes('.wx-transfer-main{min-height:60px;padding:12px 13px 6px;'));
  }
});

/* 四、白天模式：三个独立页面跟着变浅 */
test('发红包页、转账页、领取详情页都有白天模式', () => {
  for (const css of [CSS, PRIV_CSS]) {
    for (const sel of ['.wxlight .wx-pay-nav{', '.wxlight .wx-rps{background:#ededed', '.wxlight .wx-rps-row{background:#fff}', '.wxlight .wx-tfs{background:#ededed', '.wxlight .wx-tfs-panel{background:#fff}', '.wxlight .wx-tfs-keys button{background:#fff;color:#111}', '.wxlight .wx-rpd{background:#fff'])
      assert.ok(css.includes(sel), sel);
  }
  for (const src of both) assert.match(src, /c\.p==='rpSend'\|\|c\.p==='tfSend'\|\|c\.p==='rpDetail';/);
});
