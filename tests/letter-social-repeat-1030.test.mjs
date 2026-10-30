// LETTER_NO_REPEAT_V1 / SOCIAL_NOT_CHAT_V1（2026-10-30 群里用户反馈）：
// 角色每天往信箱发同一封 10 月 16 日的信、删了还发；情侣角色把微信里的话发到朋友圈和 X。两版都要满足。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = process.env.FIX_TEST_ROOT || new URL('..', import.meta.url).pathname;
const FILES = {
  private: ROOT + '/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',
  web: ROOT + '/app.js',
};

function grab(src, name) {
  const m = src.match(new RegExp('\\n((?:async\\s+)?function\\s+' + name + '\\s*\\()'));
  if (!m) return '';
  const start = m.index + 1;
  const re = /\n(?=(?:async\s+)?function\s|let\s|const\s|\/\*|if\(|setInterval|setTimeout|document\.|window\.)/g;
  re.lastIndex = start + 1;
  const n = re.exec(src);
  return src.slice(start, n ? n.index : src.length);
}
const HELPERS = ['letterNorm', 'letterGrams', 'letterSimilar', 'letterPastByRole', 'letterRepeatOf', 'letterTodayText', 'letterPastPrompt'];
const OLD = '你哥今天想跟你说，这段时间你辛苦了。每次看你熬夜写题，我都心疼，但也为你骄傲。别总一个人扛着，累了就靠过来，我一直在。——你哥 2026年10月16日';

function letterCtx(src, replies, extra = {}) {
  const S = Object.assign({ me: { name: '她' }, mail: [], mailOutbox: [{ cid: 'r1', acct: 'main', originalLetter: { cid: 'r1', subject: '给你的信', body: OLD, time: 1 } }] }, extra);
  const prompts = [];
  const ctx = {
    S, Date, Math, Set,
    getC: () => ({ id: 'r1', name: '你哥' }), actId: () => 'main', msgs: () => [], msgToText: () => '',
    buildSystem: () => '人设', letterReplyBudget: () => 900, uid: () => 'new1', save() {}, notifyMail() {}, cur: () => ({ p: 'x' }), render() {},
    chatAPI: async rows => { prompts.push(rows.map(r => r.content).join('\n')); return replies.shift(); },
  };
  vm.createContext(ctx);
  vm.runInContext([...HELPERS, 'genLetter'].map(n => grab(src, n)).join('\n'), ctx);
  return { ctx, S, prompts };
}

for (const [label, file] of Object.entries(FILES)) {
  const src = fs.readFileSync(file, 'utf8');

  test(`${label}：角色照抄旧信两次，这封不发（收件箱里删掉的旧信也认得出来）`, async () => {
    const copy = '主题:::给你的信\n正文:::' + OLD;
    const { ctx, S, prompts } = letterCtx(src, [copy, copy]);
    assert.equal(await ctx.genLetter('r1'), false);
    assert.equal(S.mail.length, 0, '不能再塞进一封一模一样的信');
    assert.equal(prompts.length, 2, '先重写一次');
    assert.match(prompts[0], /今天是\d{4}年\d{1,2}月\d{1,2}日/, '写信时告诉他今天的日期');
    assert.match(prompts[1], /太像了/);
  });

  test(`${label}：重写后是新信就正常发`, async () => {
    const copy = '主题:::给你的信\n正文:::' + OLD;
    const fresh = '主题:::下雨那天\n正文:::今天楼下的桂花被雨打落了一地，我捡了两朵夹进书里，想等你回来给你看。你最近说想去海边，等考完我们就去，票我来订。';
    const { ctx, S } = letterCtx(src, [copy, fresh]);
    assert.equal(await ctx.genLetter('r1'), true);
    assert.equal(S.mail.length, 1);
    assert.equal(S.mail[0].subject, '下雨那天');
  });

  test(`${label}：按心情拆信写不出来时不再塞固定的话`, () => {
    assert.ok(!src.includes("body='我看到你现在有点'+m[1]"), '固定兜底文字应已去掉');
    assert.match(grab(src, 'genMoodLetter'), /letterPastPrompt\(id\)/);
  });

  test(`${label}：朋友圈/X 写成他刚在微信里说的话会被认出来`, () => {
    const chat = ['宝宝，读到这里就差不多了', '你现在去洗漱，洗完早点睡', '明天醒来继续做题，老公陪着你', '晚安'];
    const ctx = { S: { me: { name: '她' } }, Set, msgToText: m => m.content, msgs: () => chat.map(t => ({ role: 'assistant', type: 'text', content: t })) };
    vm.createContext(ctx);
    vm.runInContext(['letterNorm', 'letterGrams', 'letterSimilar', 'roleSocialChatEcho'].map(n => grab(src, n)).join('\n'), ctx);
    assert.equal(ctx.roleSocialChatEcho({ id: 'r1' }, chat.join('\n')), true);
    assert.equal(ctx.roleSocialChatEcho({ id: 'r1' }, '加班到深夜，路过便利店买了两罐热咖啡，一罐留给明天的自己。'), false);
  });

  test(`${label}：自动发朋友圈遇到聊天原话会重写，提示里写明是公开动态`, async () => {
    const chat = ['宝宝，读到这里就差不多了', '你现在去洗漱，洗完早点睡', '明天醒来继续做题，老公陪着你', '晚安'];
    const outs = [chat.join('\n'), '加班到深夜，路过便利店买了两罐热咖啡，一罐留给明天的自己。'];
    let firstPrompt = '';
    const ctx = {
      S: { me: { name: '她' } }, Set, Math,
      msgToText: m => m.content, msgs: () => chat.map(t => ({ role: 'assistant', type: 'text', content: t })),
      roleTweetLifeContext: () => '', roleMomentRecentText: () => '暂无', roleSocialOpeningPrompt: () => '', roleSocialIdentityPin: () => '', buildSystem: () => '',
      roleChatRouteIndex: () => 0, cleanReply: t => t, cleanMomentText: t => t, roleMomentSimilarity: () => ({ hard: false, soft: false }),
      chatAPI: async rows => { if (!firstPrompt) firstPrompt = rows[1].content; return outs.shift(); },
    };
    vm.createContext(ctx);
    vm.runInContext(['letterNorm', 'letterGrams', 'letterSimilar', 'roleSocialPublicRule', 'roleSocialChatEcho', 'roleMomentGenerate'].map(n => grab(src, n)).join('\n'), ctx);
    assert.equal(await ctx.roleMomentGenerate({ id: 'r1', name: '你哥' }), '加班到深夜，路过便利店买了两罐热咖啡，一罐留给明天的自己。');
    assert.match(firstPrompt, /这是公开动态，不是微信/);
    assert.match(grab(src, 'roleTweetGenerate'), /roleSocialPublicRule\(\)/);
    assert.match(grab(src, 'roleTweetGenerate'), /roleSocialChatEcho\(c,text\)\)\)\{/);
  });

  test(`${label}：聊天回复用的来信提示没有改`, () => {
    const mailFile = file.replace(/app\.js$/, 'mail-outbox.js');
    assert.match(fs.readFileSync(mailFile, 'utf8'), /originalLetter:l\.originalLetter\|\|null,receivedAt:fmtDate\(l\.deliverAt\),myReply:/);
  });
}
