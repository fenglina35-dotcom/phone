import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(
  new URL(
    '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',
    import.meta.url
  ),
  'utf8'
);

function functionSource(name) {
  const asyncStart = app.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const brace = app.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = brace; i < app.length; i += 1) {
    const ch = app[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

function recoveryContext() {
  const context = vm.createContext({
    JSON,
    Set,
    Map,
    Date,
    Number,
    String,
    Object,
    Array,
    Math
  });
  const names = [
    'recoveryCloneJSON',
    'recoveryRoleMessageStats',
    'recoveryAllowedMessageKeys',
    'recoveryStableJSON',
    'recoveryMessageFingerprint',
    'recoveryMessageTime',
    'recoveryFillMissingMessage',
    'recoveryMergeRoleMessageState',
    'recoveryMergeRoleMessageStoreInto',
    'recoveryMergeBucketsStats',
    'recoveryFinishRoleMessageMerge',
    'recoveryMergeRoleMessageStores',
    'recoveryStateWithMergedMessages'
  ];
  vm.runInContext(
    names.map(functionSource).join('\n') +
      ';globalThis.api={' + names.join(',') + '};',
    context
  );
  return context.api;
}

test('role-message statistics separate chat rows and call sessions per role key', () => {
  const { recoveryRoleMessageStats } = recoveryContext();
  const stats = recoveryRoleMessageStats(
    {
      roleA: [
        { id: 'a', role: 'user', content: '你好' },
        { id: 'b', _call: true, _cs: 'same' },
        { id: 'c', _call: true, _cs: 'same' },
        { id: 'd', _call: true }
      ],
      roleB: [{ id: 'e', _call: true, _cs: 'same' }],
      ignored: [{ id: 'f' }]
    },
    new Set(['roleA', 'roleB'])
  );
  assert.deepEqual(JSON.parse(JSON.stringify(stats)), {
    rows: 5,
    chatRows: 1,
    callRows: 4,
    callSessions: 2,
    legacyCallRows: 1,
    threads: 2
  });
});

test('allowed keys require an exact current role and account id match', () => {
  const { recoveryAllowedMessageKeys } = recoveryContext();
  const keys = recoveryAllowedMessageKeys({
    contacts: [
      { id: 'roleA' },
      { id: 'roleB' },
      { id: 'deleted', deleted: true }
    ],
    me: { accounts: [{ id: 'main' }, { id: 'alt' }] }
  });
  assert.equal(keys.has('roleA'), true);
  assert.equal(keys.has('roleA#alt'), true);
  assert.equal(keys.has('roleB'), true);
  assert.equal(keys.has('roleA#unknown'), false);
  assert.equal(keys.has('deleted'), false);
});

test('safe merge preserves priority, fills missing fields and conservatively deduplicates', () => {
  const { recoveryMessageFingerprint, recoveryMergeRoleMessageStores } = recoveryContext();
  const repeated = { role: 'user', type: 'text', content: '一样', time: 20 };
  const current = {
    roleA: [
      { id: 'a', role: 'assistant', content: '当前', time: 10 },
      { ...repeated },
      { ...repeated },
      { id: 'call', role: 'user', content: '通话', time: 30, _call: true, _cs: 's1' }
    ]
  };
  const base = {
    roleA: [
      { id: 'a', role: 'assistant', content: '旧内容', audio: 'idb:voice-a', time: 10 },
      { id: 'b', role: 'assistant', content: '基底', time: 15 }
    ],
    oldRole: [{ id: 'skip', content: '不能导入', time: 1 }]
  };
  const donor = {
    roleA: [
      { id: 'b', role: 'assistant', content: '重复基底', time: 15 },
      { id: 'd', role: 'assistant', content: '旧聊天找回', time: 40 },
      { ...repeated },
      { ...repeated },
      { ...repeated }
    ]
  };
  const before = JSON.stringify({ current, base, donor });
  const result = recoveryMergeRoleMessageStores(
    [{ store: current }, { store: base }, { store: donor }],
    new Set(['roleA'])
  );
  assert.equal(result.messages.roleA.length, 7);
  assert.equal(result.messages.roleA.find(row => row.id === 'a').content, '当前');
  assert.equal(result.messages.roleA.find(row => row.id === 'a').audio, 'idb:voice-a');
  assert.equal(result.messages.roleA.filter(row => !row.id && row.content === '一样').length, 3);
  assert.equal(result.messages.roleA.find(row => row.id === 'd').content, '旧聊天找回');
  assert.equal(result.stats.callRows, 1);
  assert.equal(result.skippedRows, 1);
  assert.ok(result.dedupedRows >= 4);
  assert.equal(JSON.stringify({ current, base, donor }), before);

  const collisionA = { content: '08tpipb4uinp', role: 'user', time: 1 };
  const collisionB = { content: 'i808spobvm1p', role: 'user', time: 1 };
  assert.equal(JSON.stringify(collisionA).length, JSON.stringify(collisionB).length);
  assert.notEqual(recoveryMessageFingerprint(collisionA), recoveryMessageFingerprint(collisionB));
  const collisionResult = recoveryMergeRoleMessageStores(
    [{ store: { roleA: [collisionA, collisionB] } }],
    new Set(['roleA'])
  );
  assert.equal(collisionResult.messages.roleA.length, 2);
});

test('applying merged messages changes no other part of the selected base', () => {
  const { recoveryStateWithMergedMessages } = recoveryContext();
  const base = {
    settings: { theme: 'new' },
    contacts: [{ id: 'roleA' }, { id: 'roleB' }],
    groups: [{ id: 'group-new', msgs: [{ id: 'g1' }] }],
    moments: [{ id: 'moment-new' }],
    me: {
      widgets: ['dashboard', 'vinyl', 'sweetie'],
      homeLayout: [['w:dashboard']]
    },
    messages: { roleA: [{ id: 'old-base' }] }
  };
  const merged = { roleA: [{ id: 'recovered' }] };
  const result = recoveryStateWithMergedMessages(base, merged);
  assert.deepEqual(result.settings, base.settings);
  assert.deepEqual(result.contacts, base.contacts);
  assert.deepEqual(result.groups, base.groups);
  assert.deepEqual(result.moments, base.moments);
  assert.deepEqual(result.me, base.me);
  assert.deepEqual(result.messages, merged);
  assert.notEqual(result, base);
});

test('private recovery UI previews exact role rows and writes only after verified rollback', () => {
  assert.match(app, /以这份为主，安全合并全部角色聊天/);
  assert.match(app, /普通微信 \$\{m\.chatRows\} 条 · 通话行 \$\{m\.callRows\} 条/);
  assert.match(app, /不会按名字误配/);
  const build = functionSource('recoveryBuildSafeMergePlan');
  assert.match(build, /recoveryReadCandidateRaw\(row\.x\)/);
  assert.match(build, /const liveJSON=JSON\.stringify\(S&&S\.messages\|\|\{\}\),liveMessages=JSON\.parse\(liveJSON\)/);
  assert.match(build, /primary=\[liveMessages,archive,base\.messages\]/);
  assert.match(build, /JSON\.stringify\(S&&S\.messages\|\|\{\}\)!==liveJSON/);
  assert.match(build, /messages:includeMessages\?merged\.messages:null/);
  assert.doesNotMatch(build, /donors=.*\.map\(x=>\(\{name:x\.source,store:x\.raw/);
  const confirm = functionSource('emergencyRestoreSafeMergeConfirm');
  assert.match(confirm, /verified\.json!==beforeJSON/);
  assert.match(confirm, /restored\.messages=fresh\.messages\|\|\{\}/);
  assert.match(confirm, /recoveryApplyCurrentFriendStores\(restored,currentFriendStores\)/);
  assert.match(confirm, /recoveryPersistStateNow\(\)/);
  const verifyAt = confirm.indexOf('verified.json!==beforeJSON');
  const lastAwaitAt = confirm.indexOf('await recoveryCurrentFriendStores()');
  const liveCheckAt = confirm.indexOf('JSON.stringify(S.messages||{})!==fresh.liveJSON');
  const mutateAt = confirm.indexOf('S=mergeStateData(restored)');
  assert.ok(verifyAt >= 0 && lastAwaitAt > verifyAt && liveCheckAt > lastAwaitAt && mutateAt > liveCheckAt);
  assert.doesNotMatch(confirm.slice(liveCheckAt, mutateAt), /await\s/);
  const preserve = functionSource('recoveryApplyCurrentFriendStores');
  assert.match(preserve, /p\.messages=recoveryCloneJSON\(stores&&stores\.messages\)\|\|\{\}/);
  assert.match(preserve, /p\.groupMessages=recoveryCloneJSON\(stores&&stores\.groupMessages\)\|\|\{\}/);
});

test('safe merge plan aborts when a live role message arrives during donor reads', async () => {
  const selected = {
    settings: {},
    contacts: [{ id: 'roleA' }],
    me: { accounts: [] },
    messages: { roleA: [{ id: 'base', content: 'base' }] }
  };
  const donor = {
    settings: {},
    contacts: [{ id: 'roleA' }],
    me: { accounts: [] },
    messages: { roleA: [{ id: 'donor', content: 'donor' }] }
  };
  const context = vm.createContext({
    JSON,
    Set,
    Map,
    Date,
    Number,
    String,
    Object,
    Array,
    Math,
    Error,
    S: { messages: { roleA: [{ id: 'live', content: 'live' }] } },
    _recoveryCandidates: [
      { key: 'selected', savedAt: 2, jsonBytes: 100 },
      { key: 'donor', savedAt: 1, jsonBytes: 100 }
    ],
    imgGetIDB: async () => null,
    recoveryHydrateCandidate: async raw => JSON.parse(JSON.stringify(raw))
  });
  context.recoveryReadCandidateRaw = async candidate => {
    if (candidate.key === 'selected') return selected;
    context.S.messages.roleA.push({ id: 'arrived', content: 'new push' });
    return donor;
  };
  const names = [
    'recoveryCloneJSON',
    'recoveryRoleMessageStats',
    'recoveryAllowedMessageKeys',
    'recoveryStableJSON',
    'recoveryMessageFingerprint',
    'recoveryMessageTime',
    'recoveryFillMissingMessage',
    'recoveryMergeRoleMessageState',
    'recoveryMergeRoleMessageStoreInto',
    'recoveryMergeBucketsStats',
    'recoveryFinishRoleMessageMerge',
    'recoveryExactMessageStamp',
    'recoveryBuildSafeMergePlan'
  ];
  vm.runInContext(
    names.map(functionSource).join('\n') +
      ';globalThis.api={recoveryBuildSafeMergePlan};',
    context
  );
  await assert.rejects(
    context.api.recoveryBuildSafeMergePlan(0, { includeMessages: true }),
    /刚收到新的角色消息/
  );
  assert.equal(context.S.messages.roleA.at(-1).id, 'arrived');
});

test('safe merge always keeps the current friend and group message stores', async () => {
  const archives = {
    '__pf_messages_main': JSON.stringify({ friendA: [{ id: 'friend-current' }] }),
    '__pf_group_messages_main': JSON.stringify({ groupA: [{ id: 'group-current' }] })
  };
  const context = vm.createContext({
    JSON,
    Object,
    Array,
    S: {
      me: {
        phoneFriend: {
          id: 'main',
          messages: { __idb: 'phoneFriendMessages', id: 'main' },
          groupMessages: { __idb: 'phoneFriendGroupMessages', id: 'main' }
        }
      }
    },
    imgGetIDB: async key => archives[key] || null
  });
  vm.runInContext(
    [
      functionSource('recoveryCloneJSON'),
      functionSource('recoveryCurrentFriendStores'),
      functionSource('recoveryApplyCurrentFriendStores')
    ].join('\n') +
      ';globalThis.api={recoveryCurrentFriendStores,recoveryApplyCurrentFriendStores};',
    context
  );
  const stores = await context.api.recoveryCurrentFriendStores();
  const restored = {
    me: {
      phoneFriend: {
        messages: { friendOld: [{ id: 'old' }] },
        groupMessages: { groupOld: [{ id: 'old' }] }
      }
    }
  };
  context.api.recoveryApplyCurrentFriendStores(restored, stores);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.me.phoneFriend.messages)), {
    friendA: [{ id: 'friend-current' }]
  });
  assert.deepEqual(JSON.parse(JSON.stringify(restored.me.phoneFriend.groupMessages)), {
    groupA: [{ id: 'group-current' }]
  });

  context.S.me.phoneFriend.messages = { __idb: 'phoneFriendMessages', id: 'missing' };
  await assert.rejects(
    context.api.recoveryCurrentFriendStores(),
    /当前好友聊天库暂时无法读取/
  );
});

test('recovery rollback snapshots inline current messages and persists atomically', async () => {
  const context = vm.createContext({
    JSON,
    Object,
    Array,
    Error,
    S: {
      settings: { theme: 'current' },
      messages: {
        roleA: [
          { id: 'first', content: 'same' },
          { id: 'middle', content: 'current-middle' },
          { id: 'last', content: 'same' }
        ]
      },
      me: {}
    },
    imgGetIDB: async () => JSON.stringify({
      roleA: [
        { id: 'first', content: 'same' },
        { id: 'middle', content: 'stale-middle' },
        { id: 'last', content: 'same' }
      ]
    })
  });
  vm.runInContext(
    [functionSource('recoveryRollbackArchive'), functionSource('recoveryRollbackState')].join('\n') +
      ';globalThis.api={recoveryRollbackState};',
    context
  );
  const snapshot = await context.api.recoveryRollbackState();
  assert.equal(snapshot.messages.roleA[1].content, 'current-middle');

  const rollback = functionSource('recoveryRollbackState');
  assert.match(rollback, /JSON\.stringify\(S\)/);
  assert.doesNotMatch(rollback, /_imgReplacer/);
  const persist = functionSource('recoveryPersistStateNow');
  const inlineAt = persist.indexOf('recoveryInlineCoreSave()');
  const archiveAt = persist.indexOf('writeMessageArchive(');
  const finalCoreAt = persist.lastIndexOf('saveNowAsync()');
  assert.ok(inlineAt >= 0 && archiveAt > inlineAt && finalCoreAt > archiveAt);
  assert.match(functionSource('emergencyRestoreRollback'), /recoveryPersistStateNow\(\)/);
});

test('recovery inline save protects synchronous serialization without extending the flag across native IO', async () => {
  const context = vm.createContext({
    Promise,
    _recoveryInlineSave: false,
    seen: []
  });
  vm.runInContext(
    'function saveNowAsync(){seen.push(_recoveryInlineSave);return new Promise(resolve=>{globalThis.finishSave=resolve;});}' +
      functionSource('recoveryInlineCoreSave') +
      ';globalThis.api={recoveryInlineCoreSave};',
    context
  );
  const pending = context.api.recoveryInlineCoreSave();
  assert.deepEqual(context.seen, [true]);
  assert.equal(context._recoveryInlineSave, false);
  context.finishSave(true);
  assert.equal(await pending, true);
});

test('recovery persistence writes an inline core before external archives and a final compact core', async () => {
  const order = [];
  const context = vm.createContext({
    JSON,
    Error,
    S: {
      messages: { roleA: [{ id: 'large', content: 'x'.repeat(21000) }] },
      me: {
        phoneFriend: {
          messages: { friendA: [{ id: 'friend' }] },
          groupMessages: { groupA: [{ id: 'group' }] }
        }
      }
    },
    recoveryInlineCoreSave: async () => { order.push('inline-core'); return true; },
    writeMessageArchive: async () => { order.push('role-archive'); return true; },
    deleteMessageArchive: async () => { order.push('role-delete'); return true; },
    messageArchiveStamp: () => 'stamp',
    recoveryWriteAuxMessageArchive: async (store, key) => {
      order.push(key);
      return JSON.stringify(store);
    },
    pfMsgStoreKey: () => 'friend-archive',
    pfGroupMsgStoreKey: () => 'group-archive',
    saveNowAsync: async () => { order.push('final-core'); return true; }
  });
  vm.runInContext(
    functionSource('recoveryPersistStateNow') +
      ';globalThis.api={recoveryPersistStateNow};',
    context
  );
  assert.equal(await context.api.recoveryPersistStateNow(), true);
  assert.deepEqual(order, [
    'inline-core',
    'role-archive',
    'friend-archive',
    'group-archive',
    'final-core'
  ]);
});
