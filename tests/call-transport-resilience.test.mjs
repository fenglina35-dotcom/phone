import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const PRIVATE = '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const priv = readFileSync(new URL(PRIVATE + 'app.js', import.meta.url), 'utf8');
const lines = app.split('\n');
const source = name => {
  const i = lines.findIndex(x => x.startsWith(`function ${name}(`) || x.startsWith(`async function ${name}(`));
  assert.ok(i >= 0, `找不到 ${name}`);
  let j = i + 1;
  while (j < lines.length && !/^(async function |function |let |const |\/\*)/.test(lines[j])) j++;
  return lines.slice(i, j).join('\n');
};
const load = (names, extra = {}) => {
  const ctx = vm.createContext(Object.assign({ Math, String, Number, Object, Array, JSON, Date, Error, TypeError, console }, extra));
  vm.runInContext(names.map(source).join('\n') + '\n' + names.map(n => `globalThis.${n}=${n};`).join(''), ctx);
  return ctx;
};

/* 通话失败一次就把「网络连接中断」打到字幕上，微信却会自动落副模型再发一次。
   同样的网络抖动率，微信吞掉了，通话全甩给她看——这才是「频繁出现」的来源。 */

test('a dropped connection is retried on the same route before anything is shown', async () => {
  const ctx = load(['callRetryableFailure', 'callChatWithRetry'], {
    wechatAuxConfigured: () => false,
    sleep: () => Promise.resolve(),
    wechatModelRouteNotice: () => {},
  });
  let calls = 0;
  ctx.chatAPI = async () => {
    calls++;
    if (calls === 1) { const e = new Error('网络连接失败或接口等待太久断开'); e.transportRaw = 'Failed to fetch'; throw e; }
    return '我在。';
  };
  assert.equal(await ctx.callChatWithRetry([], {}, null), '我在。');
  assert.equal(calls, 2, '掉一次要自己重发，不该让她看到提示');
});

test('two drops fall through to the configured auxiliary model, like WeChat does', async () => {
  const notices = [];
  const ctx = load(['callRetryableFailure', 'callChatWithRetry'], {
    wechatAuxConfigured: () => true,
    sleep: () => Promise.resolve(),
    wechatModelRouteNotice: (c, aux, silent) => notices.push([aux, silent]),
  });
  const seen = [];
  ctx.chatAPI = async (msgs, md) => {
    seen.push(!!md.aux);
    if (seen.length <= 2) { const e = new Error('网络连接失败'); e.transportRaw = 'Failed to fetch'; throw e; }
    return '我在（副模型）。';
  };
  assert.equal(await ctx.callChatWithRetry([], { aux: false }, { id: 'c1' }), '我在（副模型）。');
  assert.deepEqual(seen, [false, false, true], '同路线两次，然后才落副模型');
  assert.deepEqual(notices, [[true, true]], '换模型不该在通话中弹提示');
});

test('all three attempts failing still reports the first, real reason', async () => {
  const ctx = load(['callRetryableFailure', 'callChatWithRetry'], {
    wechatAuxConfigured: () => true,
    sleep: () => Promise.resolve(),
    wechatModelRouteNotice: () => {},
  });
  let calls = 0;
  ctx.chatAPI = async () => { calls++; const e = new Error('第 ' + calls + ' 次失败'); e.transportRaw = 'Failed to fetch'; throw e; };
  await assert.rejects(() => ctx.callChatWithRetry([], { aux: false }, null), /第 1 次失败/, '要报第一次的原因，不是最后一次的');
  assert.equal(calls, 3);
});

/* 重发只对「再试一次可能就好」的失败有意义。余额、密钥、模型名重发一百次也一样，
   白白多烧两次钱，还让她多等两秒。 */
test('hopeless failures are never retried', () => {
  const ctx = load(['callRetryableFailure']);
  const f = ctx.callRetryableFailure;
  for (const [label, e] of [
    ['密钥无效', { status: 401 }],
    ['没有权限', { status: 403 }],
    ['模型不存在', { status: 404 }],
    ['余额不足', { status: 402 }],
    ['参数不合法', { status: 400 }],
    ['内容被拦下', { code: 'call-output-blocked' }],
    ['模型自己拒答', { modelRefusal: true }],
    ['还没填接口', { message: '还没设置聊天 API（去 设置→API）' }],
    ['等了 190 秒的超时', { transportRaw: 'The operation was aborted', elapsedMs: 190000 }],
  ]) assert.equal(f(e), false, `${label} 不该重发`);
  for (const [label, e] of [
    ['连接被掐断', { transportRaw: 'TypeError: Failed to fetch' }],
    ['上游 502', { status: 502 }],
    ['限流', { status: 429 }],
    ['网关超时', { status: 504 }],
    ['很快就超时', { transportRaw: 'timeout', elapsedMs: 3000 }],
  ]) assert.equal(f(e), true, `${label} 该重发一次`);
});

/* 判断只能看抛出来的英文原因。那句中文提示本身带着「不是付款或密钥错误」，
   拿正则去匹配会把它当成密钥问题而放弃重试——我第一版就是这么写错的。 */
test('the Chinese hint text never decides retryability', () => {
  const ctx = load(['callRetryableFailure']);
  assert.equal(ctx.callRetryableFailure({
    message: '网络连接失败或接口等待太久断开；如果刚才是生成图片，多半是中转站上游排队/限流，不是付款或密钥错误。',
    transportRaw: 'Failed to fetch',
  }), true, '提示里出现「密钥错误」四个字，不代表真的是密钥问题');
});

/* 息屏或切到别的 App，正在飞的请求会被系统掐掉。以前一律说成「网络连接中断」，
   跟网络其实没关系。 */
test('a request killed by backgrounding says so instead of blaming the network', () => {
  const ctx = load(['callBackgroundInterrupted']);
  const now = 1000000;
  assert.equal(ctx.callBackgroundInterrupted({ elapsedMs: 4000 }, now - 1000, now), true, '请求进行中切了后台');
  assert.equal(ctx.callBackgroundInterrupted({ elapsedMs: 4000 }, now - 600000, now), false, '十分钟前切的后台跟这次无关');
  assert.equal(ctx.callBackgroundInterrupted({ elapsedMs: 4000 }, 0, now), false, '从来没切过后台');
  const text = source('callFailureText');
  assert.match(text, /callBackgroundInterrupted\(e,hiddenMark\)/);
  assert.match(text, /切到后台/);
  assert.ok(text.indexOf('切到后台') < text.indexOf('网络连接中断'), '切后台要排在笼统的网络提示前面');
});

/* 通话被长度上限截断时以前直接断在半句：微信的 complete 写死 true，通话写的是 !_rawOutput，
   而「模型原文输出」全局常开之后 _rawOutput 永远是 true，续写永远不会触发。 */
test('a call reply truncated by the length ceiling is completed, not left mid-sentence', () => {
  for (const [name, src] of [['app.js', app], ['私人版', priv]]) {
    assert.ok(src.includes("diagnosticChannel:'call'"), `${name} 找不到通话请求参数`);
    const md = src.slice(src.indexOf("diagnosticChannel:'call'"), src.indexOf("diagnosticChannel:'call'") + 400);
    assert.match(md, /complete:true/, `${name} 通话必须和微信一样把截断的回复补完`);
    assert.doesNotMatch(md, /complete:!_rawOutput/, `${name} 不能再把续写挂在原文输出开关上`);
    assert.match(md, /max:callReplyBudget\(c\)/, `${name} 通话要用自己那档回复长度`);
  }
});

test('the call has its own reply-length slot that falls back to the online one', () => {
  const ctx = load(['callReplyBudget'], {
    chatRequestRoute: () => null,
    roleChatRouteIndex: () => 0,
    chatMainCopy: x => x,
    S: { settings: { chat: { maxTokens: 1234, callMaxTokens: 0 } } },
  });
  assert.equal(ctx.callReplyBudget(null), 1234, '留空就跟线上聊天走');
  ctx.S.settings.chat.callMaxTokens = 456;
  assert.equal(ctx.callReplyBudget(null), 456, '填了就用自己的');
  ctx.S.settings.chat.callMaxTokens = 99999;
  assert.equal(ctx.callReplyBudget(null), 8192, '有上限');
  assert.match(app, /callMaxTokens:x\.callMaxTokens==null\?4096:x\.callMaxTokens/, '默认 4096，显式 0 仍跟随线上');
  assert.match(app, /回复长度（通话）/, '设置页要有这一格');
});

/* 续写回来的是句子碎片，不是一条独立回复。拿整段的「必须有中文翻译」去卡它，
   外语通话每次续写都会整轮失败。 */
test('the continuation fragment is not judged by the whole-reply language rule', () => {
  const text = source('chatResultText');
  assert.match(text, /roleReplyLanguageGuard:false/, '续写这一段要关掉纯英文拦截');
  assert.match(text, /roleInterceptPurpose:'length-continuation'/);
  assert.ok(text.indexOf('roleReplyLanguageGuard:false') > text.indexOf('opt.complete&&text'), '只关续写那一次，不影响正常回复');
});

/* "I've got" 接上 " you now" 以前会粘成 "gotyou"，念出来是一团乱码。 */
test('an English continuation keeps the word boundary the model sent', () => {
  const ctx = load(['joinAIContinuation']);
  const j = ctx.joinAIContinuation;
  assert.equal(j("I've got", ' you now and nothing'), "I've got you now and nothing");
  assert.equal(j('understan', 'ding'), 'understanding', '从词中间接着写不能被拆开');
  assert.equal(j('我在这', '儿。'), '我在这儿。');
  assert.equal(j('我在这', ' 儿。'), '我在这儿。', '中文两边不补空格');
  assert.equal(j('别怕，', ' I am here'), '别怕，I am here', '中文标点后面也不补');
  assert.equal(j('...nothing', 'nothing will change'), '...nothing will change', '重叠照旧去掉');
  assert.equal(j('He said', ' "hello"'), 'He said "hello"');
});

/* 「测试主模型」只发 82 字符、5 个 token、25 秒超时；通话发的是上万字符、上千 token、
   190 秒超时。差两个数量级，所以测试通过完全不代表通话打得通。 */
test('the settings page can test at the size a real call actually sends', () => {
  const src = source('testCallScale');
  assert.match(src, /190000/, '要用通话的真实超时，不是 25 秒');
  assert.match(src, /chars=18000/, '要用通话的真实上下文规模');
  assert.match(src, /uiConfirm/, '会真实花钱，先问一句');
  assert.match(src, /callScaleFiller/);
  assert.match(app, /onclick="testCallScale\(\)"/, '设置页要有这个按钮');
  assert.ok(priv.includes('function testCallScale('), '私人版也要有');
});

test('_taskBusy is declared, so the task page cannot throw before it is ever set', () => {
  for (const [name, src] of [['app.js', app], ['私人版', priv]]) {
    assert.match(src, /let _taskBusy=false;/, `${name} 缺少声明：renderTasks 在布置任务之前读它会直接抛 ReferenceError`);
  }
});
