// PF_LOW_TRAFFIC_V1：真人好友默认省流量（2026-10-30）。
// 不在真人好友页面时不再 6～30 秒同步一次、不再每 1～2 分钟上传头像当心跳、线路探测 30 分钟一次；
// 打开「实时接收消息」恢复原来的节奏。私人版和网页版都要满足。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = process.env.PF_TEST_ROOT || new URL('..', import.meta.url).pathname;
const FILES = {
  private: ROOT + '/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',
  web: ROOT + '/app.js',
};

function grab(src, name) {
  const start = src.search(new RegExp('(async\\s+)?function\\s+' + name + '\\s*\\('));
  if (start < 0) return '';
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}

function load(file, page, opts = {}) {
  const src = fs.readFileSync(file, 'utf8');
  const names = ['pfRealtime', 'pfOnFriendPage', 'pfHasAnyFriend', 'phoneFriendPollDelay', 'pfEnsureForSync', 'pfEnsure'];
  const code = names.map(n => grab(src, n)).filter(Boolean).join('\n');
  const pf = { friends: opts.friends || [], groups: [], requests: [], _registeredAt: 1, _onlineAt: Date.now() - 10 * 60000 };
  const calls = { upload: 0, refresh: 0 };
  const ctx = {
    S: { settings: { pfRealtime: !!opts.realtime } },
    _pfIdleSyncs: 0,
    cur: () => ({ p: page }),
    phoneFriendState: () => pf,
    licenseSyncPhoneFriendIdentity: () => Promise.resolve(),
    pfProfileRefreshSoon: () => { calls.refresh++; },
    pfProfilePayload: async () => ({}),
    pfRpc: async () => { calls.upload++; },
    Math, Date, Promise,
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { ctx, calls, src };
}

for (const [label, file] of Object.entries(FILES)) {
  test(`${label}：停在微信等页面时不再频繁同步`, () => {
    const withFriend = load(file, 'wechat', { friends: [{ id: 'a' }] });
    assert.ok(withFriend.ctx.phoneFriendPollDelay() >= 300000, '有好友时其他页面至少 5 分钟一次');
    const none = load(file, 'home');
    assert.ok(none.ctx.phoneFriendPollDelay() >= 1800000, '没有好友时 30 分钟一次');
    assert.equal(load(file, 'pffriends').ctx.phoneFriendPollDelay(), 30000, '好友列表页 30 秒');
  });

  test(`${label}：聊天页和打开实时接收时保持原来的速度`, () => {
    assert.ok(load(file, 'pfchat').ctx.phoneFriendPollDelay() <= 8000);
    assert.ok(load(file, 'wechat', { realtime: true }).ctx.phoneFriendPollDelay() <= 30000);
  });

  test(`${label}：不在好友页面时不上传头像心跳`, async () => {
    const { ctx, calls } = load(file, 'wechat', { friends: [{ id: 'a' }] });
    if (typeof ctx.pfEnsureForSync === 'function') {
      assert.equal(await ctx.pfEnsureForSync(false), false);
      assert.equal(calls.refresh, 0);
    } else {
      await ctx.pfEnsure(false);
      assert.equal(calls.upload, 0);
    }
    const onPage = load(file, 'pffriends');
    if (typeof onPage.ctx.pfEnsureForSync === 'function') assert.equal(await onPage.ctx.pfEnsureForSync(false), true);
    else { await onPage.ctx.pfEnsure(false); assert.equal(onPage.calls.upload, 1); }
  });

  test(`${label}：线路探测省流量时 30 分钟一次，页面有实时接收开关`, () => {
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, /_pfTransportAt<\(typeof pfRealtime==='function'&&!pfRealtime\(\)\?1800000:60000\)/);
    assert.match(src, /onclick="phoneFriendToggleRealtime\(\)"/);
    assert.match(src, /function phoneFriendToggleRealtime\(/);
  });
}
