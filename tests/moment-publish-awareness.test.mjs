import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const starts = [`async function ${name}(`, `function ${name}(`]
    .map(marker => source.indexOf(marker)).filter(index => index >= 0).sort((a, b) => a - b);
  assert.ok(starts.length, `missing ${name}`);
  const start = starts[0], brace = source.indexOf('{', start);
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

test('publishing a Moment shows the real role comment immediately and sends the post body', async () => {
  const role = { id: 'role-a', name: '先生', remark: '先生', model: 'main', chatRouteIndex: 2 };
  const post = { id: 'post-1', authorId: 'me', text: '今天终于把小猫接回家了。', images: [], photoCards: [{ desc: '小猫趴在新的软垫上' }], likes: [], comments: [], acct: 'main', time: Date.now() };
  const renders = [];
  const context = vm.createContext({
    S: { me: { name: 'North' }, contacts: [role], messages: {}, moments: [post] },
    Date, String, Array, Object, Promise,
    momentVisibleTo: () => true,
    recordVisit: () => {},
    msgs: () => [{ role: 'user', text: '等会儿给你看猫' }],
    msgToText: msg => msg.text || '',
    momentPhotoCards: value => value || [],
    chatAPI: async (messages, options) => { context.request = messages; context.options = options; return '它看起来已经把这里当家了。'; },
    buildSystem: () => 'role-system',
    cleanMomentText: text => String(text || ''),
    cleanReply: text => String(text || '').trim(),
    replyDedupNorm: text => String(text || '').replace(/\s|[，。！？、,.!?]/g, ''),
    replyBigramScore: (a, b) => a === b ? 1 : 0,
    roleChatRouteIndex: c => c.chatRouteIndex,
    save: () => { context.saves = (context.saves || 0) + 1; },
    cur: () => ({ p: 'wxmoment' }),
    wxTab: 'chat',
    momentRenderKeepScroll: id => renders.push(id),
  });
  vm.runInContext(functionSource('momentRoleCommentRepeated'), context);
  vm.runInContext(functionSource('reactToMyMoment'), context);
  await context.reactToMyMoment(post);
  assert.equal(post.comments.length, 1);
  assert.equal(post.comments[0].text, '它看起来已经把这里当家了。');
  assert.deepEqual(renders, ['post-1'], 'the live Moments page must refresh as soon as the role comment is stored');
  assert.equal(context.options.routeIndex, 2);
  assert.match(context.request[1].content, /今天终于把小猫接回家了/);
  assert.match(context.request[1].content, /小猫趴在新的软垫上/);
  assert.match(context.request[1].content, /不是评论区回复/);
});

test('multi-role Moment reactions keep each real persona output and retry one duplicate once', async () => {
  const roles = [
    { id: 'role-a', name: '先生', remark: '先生', persona: '冷静克制', model: 'main', chatRouteIndex: 1 },
    { id: 'role-b', name: '哥哥', remark: '哥哥', persona: '温柔活泼', model: 'main', chatRouteIndex: 3 },
  ];
  const post = { id: 'post-multi', authorId: 'me', text: '先生就是个小气鬼', images: [], photoCards: [], likes: [], comments: [], acct: 'main', time: Date.now() };
  const calls = [];
  const outputs = ['小气鬼现在就在书房坐着，有本事当面说。', '小气鬼现在就在书房坐着，有本事当面说。', '谁欺负你了，哥哥先听你告状。'];
  const context = vm.createContext({
    S: { me: { name: 'North' }, contacts: roles, messages: {}, moments: [post] },
    Date, String, Array, Object, Promise, Math, Set,
    momentVisibleTo: () => true,
    recordVisit: () => {},
    msgs: () => [],
    msgToText: msg => msg.text || '',
    momentPhotoCards: value => value || [],
    chatAPI: async (messages, options) => { calls.push({ messages, options }); return outputs[calls.length - 1]; },
    buildSystem: role => `角色=${role.name};人设=${role.persona}`,
    cleanMomentText: text => String(text || ''),
    cleanReply: text => String(text || '').trim(),
    replyDedupNorm: text => String(text || '').replace(/\s|[，。！？、,.!?]/g, ''),
    replyBigramScore: (a, b) => a === b ? 1 : 0,
    roleChatRouteIndex: role => role.chatRouteIndex,
    save: () => {},
    cur: () => ({ p: 'home' }),
    wxTab: 'chat',
    momentRenderKeepScroll: () => {},
  });
  vm.runInContext(functionSource('momentRoleCommentRepeated'), context);
  vm.runInContext(functionSource('reactToMyMoment'), context);
  await context.reactToMyMoment(post);
  assert.deepEqual(post.comments.map(comment => comment.text), [
    '小气鬼现在就在书房坐着，有本事当面说。',
    '谁欺负你了，哥哥先听你告状。',
  ]);
  assert.equal(calls.length, 3, 'only the duplicate role gets one bounded genuine-model retry');
  assert.match(calls[0].messages[0].content, /角色=先生;人设=冷静克制/);
  assert.match(calls[1].messages[0].content, /角色=哥哥;人设=温柔活泼/);
  assert.equal(calls[1].options.routeIndex, 3);
  assert.match(calls[1].messages[1].content, /先生：小气鬼现在就在书房坐着/);
  assert.match(calls[1].messages[1].content, /不能复述、套用或只改几个字模仿/);
  assert.match(calls[2].messages.at(-1).content, /与其他角色已有评论重复/);
});

test('gag bars are red, emoji-free, and lead back to the bound role chat', () => {
  assert.doesNotMatch(source, /🔇 ta把/);
  assert.doesNotMatch(source, /去情侣空间输密码解禁|去情侣空间查看/);
  assert.equal((source.match(/去求他解锁/g) || []).length, 3);
  assert.equal((source.match(/onclick="gagAskUnlock\(\)" style="color:inherit;text-decoration:underline;cursor:pointer">去求他解锁/g) || []).length, 3);
  assert.match(functionSource('gagAskUnlock'), /openChat\(cid\)/);
  assert.match(functionSource('gagAskUnlock'), /当前没有可联系的绑定角色/);
});

test('a role remembers only user Moments visible to that role, including body and described media', () => {
  const role = { id: 'role-a', name: '先生' };
  const context = vm.createContext({
    S: {
      me: { name: 'North' },
      moments: [
        { id: 'public', authorId: 'me', acct: 'main', text: '公开正文', time: 30, images: ['real'], photoCards: [] },
        { id: 'mine', authorId: 'me', acct: 'main', text: '只给先生看的正文', time: 20, visible: ['role-a'], photoCards: [{ desc: '窗边的一束白花' }] },
        { id: 'other', authorId: 'me', acct: 'main', text: '不该让先生看到', time: 10, visible: ['role-b'], photoCards: [] },
      ],
    },
    actId: () => 'main',
    momentVisibleTo: (post, id) => !post.visible?.length || post.visible.includes(id),
    fmtDT: value => `T${value}`,
    cleanMomentText: text => String(text || ''),
    momentPhotoCards: value => (value || []).map(card => ({ desc: card.desc })),
    Math, String, Array,
  });
  vm.runInContext(functionSource('roleVisibleUserMomentsPrompt'), context);
  const prompt = context.roleVisibleUserMomentsPrompt(role, 6);
  assert.match(prompt, /公开正文/);
  assert.match(prompt, /只给先生看的正文/);
  assert.match(prompt, /窗边的一束白花/);
  assert.match(prompt, /真实照片 1 张/);
  assert.doesNotMatch(prompt, /不该让先生看到/);
  assert.match(prompt, /不是评论区回复/);
});

test('all role-speaking routes use the character route without changing cohab route settings', () => {
  assert.match(functionSource('aiReply'), /const _routeIndex=roleChatRouteIndex\(c\),_md=\{routeIndex:_routeIndex/);
  assert.match(functionSource('callAI'), /routeIndex:roleChatRouteIndex\(c\)/);
  assert.match(functionSource('roleMomentGenerate'), /routeIndex:roleChatRouteIndex\(c\)/);
  assert.match(functionSource('wxLoginSession'), /routeIndex:roleChatRouteIndex\(c\)/);
  assert.match(functionSource('wxLoginEnsureRequestedRemark'), /routeIndex:roleChatRouteIndex\(c\)/);
  assert.match(functionSource('cohabRoleChat'), /routeIndex:cohabReplyRouteIndex\(d\)/, 'cohab keeps its existing explicit route control');
  assert.match(functionSource('buildSystem'), /roleVisibleUserMomentsPrompt\(c,6\)/);
  assert.match(functionSource('offlineSystem'), /roleVisibleUserMomentsPrompt\(c,6\)/);
  assert.match(functionSource('cohabSystem'), /roleVisibleUserMomentsPrompt\(c,6\)/);
});
