import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const privateApp = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');
const privateIndex = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html');
const privateAlias = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html');
const privateRepair = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/repair.html');
const diagnostics = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-runtime-diagnostics.js');
const swift = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');
const bridge = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const publicApp = read('app.js');
const publicIndex = read('小手机.html');

const nextTurn = () => new Promise(resolve => setImmediate(resolve));

function persistenceRuntime() {
  const start = privateApp.indexOf('let _persistWechatRequested=');
  const end = privateApp.indexOf('function wechatTailSafeRow', start);
  assert.ok(start >= 0 && end > start, 'private persistence coordinator source must be extractable');
  const writes = [], releases = [], traces = [];
  const context = {
    Promise,
    Date,
    performance: { now: () => Date.now() },
    window: { __smallPhoneWechatPersistTrace: row => traces.push({ ...row }) },
    S: { messages: {} },
    _heavy: {},
    _heavyStamp: {},
    _heavyReady: new Set(),
    messageArchiveStamp: store => JSON.stringify(store),
    deleteMessageArchive: async () => {},
    saveCalls: 0,
    saveNowAsync: async () => { context.saveCalls += 1; return true; }
  };
  context.writeMessageArchive = (blob, stamp) => {
    writes.push(blob);
    context._heavy.messages = blob;
    context._heavyReady.delete('messages');
    return new Promise(resolve => releases.push(() => {
      if (context._heavy.messages === blob) {
        context._heavyStamp.messages = stamp;
        context._heavyReady.add('messages');
      }
      resolve();
    }));
  };
  vm.runInNewContext(
    privateApp.slice(start, end) + ';globalThis.api={persistWechatMessagesNow};',
    context
  );
  return { context, writes, releases, traces };
}

test('private identity advances to v1230 and iOS 353 while public remains v1229', () => {
  assert.match(privateApp, /__NORTH_SHELL_BUILD__!=='1230'/);
  assert.match(privateApp, /APP_VER='v1230 · 私人空调整度步进与屏幕同步'/);
  for (const html of [privateIndex, privateAlias]) {
    assert.match(html, /window\.__NORTH_SHELL_BUILD__='1230'/);
    assert.match(html, /app\.js\?v=1230&r=v1230-private-ac-whole-degree-1/);
    assert.match(html, /private-runtime-diagnostics\.js\?v=334/);
  }
  assert.match(privateRepair, /index\.html\?repair=1&v=1230/);
  assert.match(swift, /1\.0\.353 \(353\)/);
  assert.match(bridge, /private static let build = "1\.0\.353 \(353\)"/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 353;/g) || []).length, 12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.353;/g) || []).length, 12);
  assert.match(publicApp, /APP_VER='v1229 · 语音修复与日常事件簿'/);
  assert.match(publicIndex, /window\.__NORTH_SHELL_BUILD__='1229'/);
  assert.doesNotMatch(publicApp, /persistWechatRequested|smallPhoneWechatPersistTrace/);
});

test('concurrent full chat saves keep one active write and only the latest pending snapshot', async () => {
  const { context, writes, releases, traces } = persistenceRuntime();
  context.S.messages = { role: [{ id: 'one', content: 'x'.repeat(21000) }] };
  let settled = 0;
  const first = context.api.persistWechatMessagesNow().then(value => { settled += 1; return value; });
  await nextTurn();
  assert.equal(writes.length, 1);

  context.S.messages.role.push({ id: 'two', content: 'two' });
  const second = context.api.persistWechatMessagesNow().then(value => { settled += 1; return value; });
  context.S.messages.role.push({ id: 'three', content: 'three' });
  const third = context.api.persistWechatMessagesNow().then(value => { settled += 1; return value; });
  await nextTurn();
  assert.equal(writes.length, 1, 'new saves must not start while the first full archive write is active');

  releases.shift()();
  await nextTurn();
  assert.equal(settled, 0, 'earlier callers wait until the newest requested snapshot is durable');
  assert.equal(writes.length, 2, 'two pending requests collapse into one latest follow-up write');
  assert.match(writes[1], /"three"/);

  releases.shift()();
  assert.deepEqual(await Promise.all([first, second, third]), [true, true, true]);
  assert.equal(context.saveCalls, 1, 'coalesced archive writes perform one final core save');
  assert.ok(traces.some(row => row.stage === 'coalesced'));
  assert.ok(traces.some(row => row.stage === 'end' && row.coalesced >= 1));
});

test('an unchanged durable chat snapshot skips another full archive rewrite', async () => {
  const { context, writes, releases } = persistenceRuntime();
  context.S.messages = { role: [{ id: 'one', content: 'x'.repeat(21000) }] };
  const first = context.api.persistWechatMessagesNow();
  await nextTurn();
  releases.shift()();
  assert.equal(await first, true);
  assert.equal(writes.length, 1);

  assert.equal(await context.api.persistWechatMessagesNow(), true);
  assert.equal(writes.length, 1, 'exactly unchanged content must reuse the confirmed archive');
  assert.equal(context.saveCalls, 2, 'the core still saves other non-message state safely');
});

test('diagnostics expose bounded persistence phase timing without message content', () => {
  assert.match(diagnostics, /OVERLAY_VERSION='334-wechat-persist-lane'/);
  assert.match(diagnostics, /window\.__smallPhoneWechatPersistTrace=function/);
  for (const field of ['queued', 'passes', 'coalesced', 'blobChars', 'archiveMs', 'coreMs', 'ms']) {
    assert.match(diagnostics, new RegExp(`'${field}'`));
  }
  assert.doesNotMatch(diagnostics, /messageBody|chatContent|stateJSON/);
});
