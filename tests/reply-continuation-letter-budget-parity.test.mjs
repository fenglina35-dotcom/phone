import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// 用户报告：拦截页里出现两份内容，和聊天里的都不一样。
// 排查发现私人版的回复管线已经和网页核心分叉：私人版 _md 写死 complete:true 且没有
// unfilteredOutput，所以"截断后自动续写"那次调用完全不受原文输出控制；而续写结果又被
// 私人版自己的拦截记录当成第二份候选。用户的决定是：续写保留（防止把回复长度设短就
// 被随便截断），但要修干净；另外信件要有自己的回复长度，不再写死。

const WEB = new URL('../app.js', import.meta.url);
const PRIVATE = new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url);
const INTERCEPT = new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-reply-intercept.js', import.meta.url);
const read = u => fs.readFileSync(u, 'utf8').replace(/\r\n/g, '\n');
const web = read(WEB), priv = read(PRIVATE), intercept = read(INTERCEPT);
const one = (src, name) => {
  const found = src.split('\n').find(l => l.startsWith(`function ${name}(`) || l.startsWith(`async function ${name}(`));
  assert.ok(found, `missing ${name}`);
  return found;
};

test('截断续写排在原文直通之前，开着原文输出也会补完', async () => {
  for (const [label, src] of [['web', web], ['private', priv]]) {
    const calls = [];
    const ctx = {
      String, Object, Error, Math, Number, RegExp,
      voiceReplyCanRepairCandidate: () => false,
      roleReplyDropEnglishNarration: v => v,
      roleReplyAssertLanguage: () => {},
      joinAIContinuation: (a, b) => a + b,
      chatAPI: async (msgs, opt) => { calls.push(opt); return '后半段。'; },
    };
    vm.runInNewContext(one(src, 'chatResultText') + '\nglobalThis.f=chatResultText;', ctx);
    const data = { choices: [{ message: { content: '前半段被截断' }, finish_reason: 'length' }] };

    const out = await ctx.f([], { complete: true, unfilteredOutput: true, max: 900 }, data);
    assert.equal(out, '前半段被截断后半段。', `${label}: 原文输出下仍要续写`);
    assert.equal(calls.length, 1, `${label}: 只补一次`);
    assert.equal(calls[0].roleInterceptAudit, null, `${label}: 续写不记入候选`);
    assert.equal(calls[0].roleInterceptPurpose, 'length-continuation', `${label}: 续写要能被认出来`);
    assert.equal(calls[0].complete, false, `${label}: 续写自己不能再触发续写`);

    // 没被截断时一次都不多调
    calls.length = 0;
    const normal = await ctx.f([], { complete: true, unfilteredOutput: true }, { choices: [{ message: { content: '说完了。' }, finish_reason: 'stop' }] });
    assert.equal(normal, '说完了。');
    assert.equal(calls.length, 0, `${label}: 正常结束不能多调模型`);
  }
});

test('两边的微信请求参数必须一致，不能再各跑各的', () => {
  const md = src => (src.match(/_md=\{roleReplyLanguageGuard:true,[^}]*\}/) || [])[0];
  const w = md(web), p = md(priv);
  assert.ok(w && p, '两边都要能找到 _md');
  for (const key of ['complete:true', 'unfilteredOutput:_rawOutput']) {
    assert.ok(w.includes(key), `网页 _md 缺 ${key}`);
    assert.ok(p.includes(key), `私人 _md 缺 ${key}`);
  }
  // 私人版有自己的拦截实现，不能混用网页那套；这一项两边本来就该不同
  assert.ok(w.includes('roleInterceptAudit:_replyAudit'), '网页仍用自己的候选审计');
  assert.ok(!p.includes('roleInterceptAudit'), '私人版走 private-reply-intercept.js，不能挂网页的审计');
});

test('信件有自己的回复长度，不再写死 700／620', () => {
  for (const [label, src] of [['web', web], ['private', priv]]) {
    assert.doesNotMatch(src, /\{max:700,temp:\.85\}/, `${label}: 普通信不能再写死`);
    assert.doesNotMatch(src, /\{max:620,temp:\.86\}/, `${label}: 按心情的信不能再写死`);
    assert.match(src, /\{max:letterReplyBudget\(c\),temp:\.85\}/, `${label}: 普通信按设置`);
    assert.match(src, /\{max:letterReplyBudget\(c\),temp:\.86\}/, `${label}: 按心情的信按设置`);
    assert.match(src, /letterMaxTokens:x\.letterMaxTokens==null\?4096:x\.letterMaxTokens/, `${label}: 路线里要存得下`);
    assert.match(src, /id="s_cmax_letter"/, `${label}: 设置页要有这一格`);
    assert.match(src, /\['s_cmax_letter','letterMaxTokens'\]/, `${label}: 切路线要回填`);
  }
  const ctx = { Number, Math, String, S: { settings: { chat: {} } }, chatRequestRoute: () => null, roleChatRouteIndex: () => 0 };
  vm.runInNewContext([one(web, 'chatMainCopy'), one(web, 'letterReplyBudget')].join('\n') + '\nglobalThis.b=letterReplyBudget;', ctx);
  const c = { id: 'a' };
  assert.equal(ctx.b(c), 4096, '没设过用默认');
  ctx.S.settings.chat = { letterMaxTokens: 3000 };
  assert.equal(ctx.b(c), 3000, '设了就听设置的');
  ctx.S.settings.chat = { letterMaxTokens: 99999 };
  assert.equal(ctx.b(c), 8192, '再大也有上限');
  ctx.S.settings.chat = { letterMaxTokens: 10 };
  assert.equal(ctx.b(c), 200, '再小也有下限');
});

test('私人拦截页分得清「本机处理」和「又调了一次模型」', () => {
  assert.match(intercept, /if\(purpose==='length-continuation'\)return raw;/, '续写不记成候选');
  assert.match(intercept, /本轮模型调用/, '顶上要写明真实调用次数');
  assert.match(intercept, /没有再调用模型，只是本机拆分气泡或去掉了标签/);
  assert.match(intercept, /本轮又调用了一次模型，这一份没有被采用/);
  assert.doesNotMatch(intercept, /shown\.length\?'被后续候选或本机处理替代'/, '不能再把两件事写成同一句');
  assert.match(intercept, /不一定花了钱/, '说明里要讲清楚');
});
