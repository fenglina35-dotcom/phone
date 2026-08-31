import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const app = read('app.js');
const privateApp = read(
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'
);

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing ${start}`);
  assert.notEqual(to, -1, `missing ${end}`);
  return source.slice(from, to);
}

test('all alarm entry points share exact pending-alarm idempotency', () => {
  const block = between(app, 'function alarmIdentity(', 'function alarmToggle(');
  const syncCalls = [];
  const notices = [];
  let seq = 0;
  const context = vm.createContext({
    S: { alarms: [] },
    uid: () => `alarm-${++seq}`,
    getC: id => ({ id, name: id }),
    alarmCompanionFallback: (_c, label) => `提醒:${label}`,
    save() {},
    nativeAlarmSync: value => syncCalls.push(value),
    alarmPrepareCompanionText() {},
    toast: value => notices.push(value),
    setTimeout() {},
  });
  vm.runInContext(block, context);

  const first = context.addAlarm('role-a', '7:05', ' 喝水 ', 'once');
  const duplicate = context.addAlarm('role-a', '07:05', '喝水', 'once');
  assert.equal(first.id, duplicate.id);
  assert.equal(context.S.alarms.length, 1);
  assert.equal(context.S.alarms[0].time, '07:05');
  assert.equal(context.S.alarms[0].label, '喝水');
  assert.match(notices.at(-1), /已经定好了/);
  assert.deepEqual(syncCalls, [true, false]);

  context.addAlarm('role-b', '07:05', '喝水', 'once');
  context.addAlarm('role-a', '07:06', '喝水', 'once');
  context.addAlarm('role-a', '07:05', '吃药', 'once');
  context.addAlarm('role-a', '07:05', '喝水', 'daily');
  assert.equal(context.S.alarms.length, 5);

  context.S.alarms[0].enabled = false;
  const replacement = context.addAlarm('role-a', '07:05', '喝水', 'once');
  assert.notEqual(replacement.id, first.id);
  assert.equal(context.S.alarms.length, 6);
});

test('retrieved memory carries time provenance and cannot become a fake recent quote', () => {
  const block = between(
    app,
    'function memoryPromptRecordedAt(',
    'function memoryCriticalPrompt('
  );
  const context = vm.createContext({
    Date,
    S: { me: { name: '宝宝' } },
    memoryPending: () => null,
  });
  vm.runInContext(block, context);
  const prompt = context.memoryRetrievalPrompt({}, {
    items: [{ source: '长期记忆', text: '用户以前说过不想看红果短剧', ts: 1 }],
  });
  assert.match(prompt, /记录\/确认于/);
  assert.match(prompt, /不能单独支持“刚才、刚刚、方才”/);
  assert.match(prompt, /当前明确表达作为现在的意愿/);
});

test('recent-reference guard distinguishes a genuine recent quote from old memory', () => {
  const block = between(
    app,
    'function roleRecentUserReferenceClaims(',
    'function replyLcsContainment('
  );
  let rows = [];
  const normalize = value => String(value || '').replace(/[^\p{L}\p{N}]/gu, '');
  const context = vm.createContext({
    S: { couple: null },
    LOCKABLE: {},
    Date,
    actId: () => 'main',
    msgsForAccount: () => rows,
    msgToText: row => row.content,
    replyDedupNorm: normalize,
    replyLcsContainment: (a, b) => normalize(a) === normalize(b) ? 1 : 0,
    replyBigramScore: () => 0,
    privateNativeAppOn: () => false,
  });
  vm.runInContext(block, context);

  rows = [{ role: 'user', type: 'text', content: '把红果短剧解开', time: Date.now() }];
  assert.ok(context.roleStaleRecentReferenceIssue(
    'role-a',
    'main',
    '刚才谁跟先生说不想看了来着？',
    '把红果短剧解开'
  ));

  rows.push({ role: 'user', type: 'text', content: '我不想看了', time: Date.now() });
  assert.equal(context.roleStaleRecentReferenceIssue(
    'role-a',
    'main',
    '刚才谁跟先生说不想看了来着？',
    '我不想看了'
  ), null);
});

test('confirmed available app state blocks stale still-locked claims only', () => {
  const block = between(
    app,
    'function roleRecentUserReferenceClaims(',
    'function replyLcsContainment('
  );
  const context = vm.createContext({
    S: {
      couple: {
        cid: 'role-a',
        grant: { douyin: true },
        locks: {},
      },
    },
    LOCKABLE: { douyin: '抖音' },
    Date,
    privateNativeAppOn: () => false,
    replyDedupNorm: value => String(value || ''),
  });
  vm.runInContext(block, context);
  const role = { id: 'role-a' };
  assert.deepEqual(
    Array.from(context.roleConfirmedAvailableAppNames(role)),
    ['抖音']
  );
  assert.equal(context.roleStaleLockClaimIssue(role, '抖音还没解呢').app, '抖音');
  assert.equal(context.roleStaleLockClaimIssue(role, '抖音现在可以用了'), null);
  context.S.couple.locks.douyin = { time: Date.now() };
  assert.equal(context.roleStaleLockClaimIssue(role, '抖音还没解呢'), null);
});

test('local repeat guard catches a repeated app-duration fact but keeps requested repeats', () => {
  const block = between(
    app,
    'function ordinaryReplyControlFactKeys(',
    'function initiativeRecentlyRepeated('
  );
  let prior = {
    text: '抖音给你解开，限一个小时。红果短剧这次不解。',
    repeatedUser: false,
  };
  const normalize = value => String(value || '').replace(/[^\p{L}\p{N}]/gu, '');
  const context = vm.createContext({
    S: { couple: null },
    LOCKABLE: { douyin: '抖音' },
    privateNativeAppOn: () => false,
    companionState: () => ({ apps: [] }),
    ordinaryReplyPreviousGroup: () => prior,
    initiativeVisibleText: value => String(value || ''),
    replyDedupNorm: normalize,
    replyLcsContainment: () => 0,
    replyBigramScore: () => 0,
  });
  vm.runInContext(block, context);
  const issue = context.ordinaryReplyClauseRepeatInfo(
    'role-a',
    'main',
    '开心得倒挺快。抖音一个小时，超了自动锁。',
    { id: 'role-a' },
    '耶！'
  );
  assert.equal(issue.kind, 'control-fact');
  assert.match(issue.key, /抖音\|时长\|一小时/);
  assert.equal(context.ordinaryReplyClauseRepeatInfo(
    'role-a',
    'main',
    '抖音一个小时。',
    { id: 'role-a' },
    '抖音到底限时多久？'
  ), null);
  prior = { text: '你先去睡觉，手机放下。', repeatedUser: false };
  assert.equal(
    context.ordinaryReplyClauseRepeatInfo(
      'role-a',
      'main',
      '你先去睡觉，手机放下。',
      { id: 'role-a' },
      '再说一遍'
    ),
    null
  );
});

test('web and private runtime both carry the same four protection boundaries', () => {
  for (const source of [app, privateApp]) {
    assert.match(source, /function alarmPendingDuplicate\(/);
    assert.match(source, /当前内置 App 控制台账（本轮真实状态）/);
    assert.match(source, /function companionRoleControlLedger\(/);
    assert.match(source, /function roleStaleRecentReferenceIssue\(/);
    assert.match(source, /function roleStaleLockClaimIssue\(/);
    assert.match(source, /function ordinaryReplyClauseRepeatInfo\(/);
  }
});
