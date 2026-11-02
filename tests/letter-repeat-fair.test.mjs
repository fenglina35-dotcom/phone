// LETTER_REPEAT_FAIR_V1（2026-11-02 群里用户：调用记录里写信成功，信箱却没收到）。
// 旧做法按「两字片段重合 ÷ 短的那封」算，他写过一封很短的信，新信就几乎都被当成重复，重写一次还像就整封扔掉。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES, PRIV_DIR } from './_helpers.mjs';

const HELPERS = ['letterNorm', 'letterGrams', 'letterSimilar', 'letterPastByRole', 'letterRepeatOf', 'letterTodayText', 'letterPastPrompt', 'genLetter'];
const LONG = '你哥今天想跟你说，这段时间你辛苦了。每次看你熬夜写题，我都心疼，但也为你骄傲。别总一个人扛着，累了就靠过来，我一直在。';

function run(src, oldBody, replies) {
  const S = { me: { name: '她' }, mail: [{ cid: 'r1', subject: '小纸条', body: oldBody, time: 1 }], mailOutbox: [] };
  const prompts = [], notes = [];
  const ctx = vm.createContext({
    S, Date, Math, Set, getC: () => ({ id: 'r1', name: '你哥' }), actId: () => 'main', msgs: () => [], msgToText: () => '',
    buildSystem: () => '人设', letterReplyBudget: () => 900, uid: () => 'new1', save() {}, notifyMail() {}, cur: () => ({ p: 'x' }), render() {},
    chatAPI: async (rows) => { prompts.push(rows.map((r) => r.content).join('\n')); return replies.shift(); },
    NorthRequestDiagnostics: { noteLatest: (k, t) => { notes.push([k, t]); return true; } },
  });
  vm.runInContext(HELPERS.map((n) => fnSource(src, n)).join('\n') + ';this.gen=genLetter;', ctx);
  return { ctx, S, prompts, notes };
}

for (const [label, file] of BUNDLES) {
  const src = read(file);

  test(label + ' a very short old letter no longer makes a new letter count as a repeat', async () => {
    const fresh = '主题:::雨后的桂花\n正文:::我们今天走过楼下，桂花被雨打落了一地，我捡了两朵夹进书里。你说想去海边，等你考完我们就去，票我来订。晚安，想你。';
    const { ctx, S, prompts } = run(src, '我们今天晚安想你', [fresh, fresh]);
    assert.equal(await ctx.gen('r1'), true);
    assert.equal(S.mail.length, 2, '新信进了信箱');
    assert.equal(prompts.length, 1, '不用重写');
  });

  test(label + ' a rewrite that is only partly like an old letter is still sent', async () => {
    const part = '主题:::又想和你说\n正文:::' + LONG.slice(0, 34) + '今天在路上看到一只小狗跟着主人跑，忽然很想带你去公园走走，晒晒太阳，什么都不想。';
    const { ctx, S, prompts, notes } = run(src, LONG, [part, part]);
    assert.equal(await ctx.gen('r1'), true, '只是有一段一样，照常发出');
    assert.equal(prompts.length, 2, '先让他重写一次');
    assert.equal(S.mail[0].subject, '又想和你说');
    assert.equal(notes.length, 0);
  });

  test(label + ' only a near copy is dropped, and the call record says why', async () => {
    const copy = '主题:::给你的信\n正文:::' + LONG;
    const { ctx, S, notes } = run(src, LONG, [copy, copy]);
    assert.equal(await ctx.gen('r1'), false);
    assert.equal(S.mail.length, 1, '照抄的那封不进信箱');
    assert.equal(notes.length, 1);
    assert.equal(notes[0][0], 'letter');
    assert.match(notes[0][1], /几乎一字不差，这封没有发出/);
  });

  test(label + ' the call record shows 成功 · 没发出 with the reason', () => {
    const ctx = vm.createContext({});
    vm.runInContext(fnSource(src, 'modelLedgerState') + ';this.st=modelLedgerState;', ctx);
    assert.equal(ctx.st({ state: 'returned', note: '没有发出' })[0], '成功 · 没发出');
    assert.equal(ctx.st({ state: 'returned' })[0], '成功');
    assert.match(fnSource(src, 'modelLedgerDetail'), /line\('说明',r\.note\|\|''\)/);
  });
}

for (const f of ['request-diagnostics.js', PRIV_DIR + 'request-diagnostics.js']) {
  test(f + ' can add a note to the latest request of a feature', () => {
    assert.match(read(f), /function noteLatest\(featureKey,text\)/);
    assert.match(read(f), /route,noteLatest\};/);
  });
}
