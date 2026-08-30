import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers.map(marker => source.indexOf(marker)).filter(index => index >= 0).sort((a, b) => a - b)[0];
  assert.notEqual(start, undefined, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

function runtime(result, options = {}) {
  const role = { id: 'role-1', name: '先生', remark: '先生', model: 'aux', chatRouteIndex: 2 };
  const target = { id: 'comment-1', cid: 'me', name: 'North', text: '你真的会回我吗？', time: 1 };
  const post = { id: 'moment-1', authorId: 'role-1', text: '今天有点想你。', comments: [target] };
  let requests = 0, saves = 0, cancellations = 0, renders = [];
  const context = vm.createContext({
    Set, Date, String, Object, Array, Promise,
    S: { me: { name: 'North' }, moments: [post] },
    _momentReplyBusy: new Set(),
    getC: id => id === role.id ? role : null,
    msgs: () => [
      { role: 'user', text: '官宣照只许发给我看' },
      { role: 'assistant', text: '好，照片和朋友圈都先给你过目' },
    ],
    lastRounds: rows => rows,
    msgToText: msg => msg.text || '',
    cleanMomentText: text => String(text || ''),
    selectRelevantMemory: () => ({ items: [{ text: '用户重视真实回复' }] }),
    buildSystem: () => 'system',
    wechatNaturalOn: () => true,
    memoryRetrievalPrompt: () => '\nselected-memory',
    roleBackgroundCancel: async (_id, kinds) => { cancellations += 1; context.lastCanceledKinds = kinds; if (options.cancelNeverFinishes) return new Promise(() => {}); return true; },
    roleServerPushTouchActivity: () => true,
    setTimeout,
    chatAPI: async (messages, options) => { requests += 1; context.lastRequest = messages; context.lastOptions = options; if (result instanceof Error) throw result; return result; },
    roleChatRouteIndex: contact => contact.chatRouteIndex,
    cleanReply: text => String(text || '').trim(),
    roleVisibleEnvelopeText: text => String(text || ''),
    setNaturalInnerThought: (contact, value) => { contact.innerThought = String(value || '').trim(); return true; },
    honestMoodText: (_contact, value) => value,
    moodInnerMonologue: (_contact, value) => value,
    save: () => { saves += 1; },
    momentRenderKeepScroll: pid => { renders.push(pid); },
    uid: () => 'reply-1',
    cur: () => ({ p: 'roleMomentDetail' }),
    wxTab: 'moments',
  });
  vm.runInContext(functionSource('stripHiddenThoughtTags'), context);
  vm.runInContext(functionSource('momentReplySpecific'), context);
  vm.runInContext(functionSource('reactToComment'), context);
  return { context, post, target, role, stats: () => ({ requests, saves, cancellations, renders }) };
}

test('a real Moment model result is appended to the exact comment thread once', async () => {
  const run = runtime('当然会，刚才就在等你来问。');
  await run.context.reactToComment(run.post, run.role.id, run.target);
  assert.equal(run.stats().requests, 1);
  assert.equal(run.stats().cancellations, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(run.context.lastCanceledKinds)), ['one_minute_test', 'app_watch_test']);
  assert.equal(run.context.lastOptions.timeout, 70000);
  assert.equal(run.context.lastOptions.aux, true, 'Moments must use the same role-selected model route as ordinary WeChat');
  assert.equal(run.context.lastOptions.routeIndex, 2, 'Moments must use this role\'s own API route');
  assert.equal(run.context.lastOptions.complete, true);
  assert.equal(run.post.comments.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(run.post.comments[1])), {
    id: 'reply-1', name: '先生', cid: 'role-1', text: '当然会，刚才就在等你来问。',
    time: run.post.comments[1].time, replyToId: 'comment-1', replyToName: 'North',
  });
  assert.equal(run.target._roleReplyStatus, undefined);
  assert.match(run.context.lastRequest[1].content, /刚刚在评论区对你说/);
  assert.match(run.context.lastRequest[1].content, /微信私聊上下文/);
  assert.match(run.context.lastRequest[1].content, /North：官宣照只许发给我看/);
  assert.match(run.context.lastRequest[1].content, /先生：好，照片和朋友圈都先给你过目/);
  assert.match(run.context.lastRequest[0].content, /当前回复场景（最高优先级）/);
  assert.match(run.context.lastRequest[0].content, /微信朋友圈评论区回复，不是在微信私聊窗口/);
  assert.match(run.context.lastRequest[0].content, /必须第一行严格写 \[内心\|简短真实想法\]/);
  assert.deepEqual(run.stats().renders, ['moment-1'], 'a successful reply updates only its Moment social slot once');
});

test('malformed or same-line inner thoughts stay hidden in Moments and ordinary WeChat', () => {
  const run = runtime('[内心她叫我臭老登，这只小狗胆子越来越大了] 老登怎么了，老登能把你抱起来。');
  const visible = run.context.momentReplySpecific('[内心她叫我臭老登，这只小狗胆子越来越大了] 老登怎么了，老登能把你抱起来。', run.role);
  assert.equal(visible, '老登怎么了，老登能把你抱起来。');
  assert.equal(run.role.innerThought, '她叫我臭老登，这只小狗胆子越来越大了');
  assert.equal(run.context.stripHiddenThoughtTags('[内心|其实已经心软了]\n还要再哄我一句', run.role), '还要再哄我一句');
  assert.match(functionSource('cleanWechatVisibleLine'), /stripHiddenThoughtTags/);
  assert.match(source, /hadHiddenThought=hiddenThoughtTagPresent\(line\);line=stripHiddenThoughtTags\(line,c\)/);
});

test('a failed Moment model call records failure and never fabricates a role comment', async () => {
  const run = runtime(new Error('upstream timeout'));
  await run.context.reactToComment(run.post, run.role.id, run.target);
  assert.equal(run.stats().requests, 1);
  assert.equal(run.post.comments.length, 1);
  assert.equal(run.target._roleReplyStatus, 'failed');
  assert.match(run.target._roleReplyError, /upstream timeout/);
  assert.deepEqual(run.stats().renders, ['moment-1'], 'a failed reply updates only its own retry state once');
});

test('private App Moment reply does not wait for the independent-cloud cancel RPC', async () => {
  const run = runtime('我当然会回你。', { cancelNeverFinishes: true });
  await Promise.race([
    run.context.reactToComment(run.post, run.role.id, run.target),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Moment reply waited for cloud cancellation')), 100)),
  ]);
  assert.equal(run.stats().requests, 1);
  assert.equal(run.post.comments.at(-1).text, '我当然会回你。');
});
