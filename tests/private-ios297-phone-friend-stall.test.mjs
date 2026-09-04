import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const bundle = path.join(root, 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle');
const source = fs.readFileSync(path.join(bundle, 'app.js'), 'utf8');
const overlay = fs.readFileSync(path.join(bundle, 'private-runtime-diagnostics.js'), 'utf8');
const publicSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function functionSource(name) {
  const asyncStart = source.indexOf(`async function ${name}(`);
  const plainStart = source.indexOf(`function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : plainStart;
  assert.ok(start >= 0, `${name} exists`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('immediate chat polling no longer forces profile serialization', () => {
  const calls = [];
  const context = vm.createContext({
    Date: {now: () => 100000},
    document: {hidden: false},
    northNativeMaintenancePaused: () => false,
    phoneFriendPollDelay: () => 2500,
    phoneFriendSync: (...args) => calls.push(args),
  });
  vm.runInContext(`let _pfLastAuto=0;${functionSource('phoneFriendMaybeSync')};phoneFriendMaybeSync(true);`, context);
  assert.deepEqual(calls, [[true, false]]);
  assert.doesNotMatch(functionSource('phoneFriendMaybeSync'), /phoneFriendSync\(true,!!force\)/);
});

test('registered profile refresh is deferred behind message sync', () => {
  const ensure = functionSource('pfEnsureForSync');
  const sync = functionSource('phoneFriendSync');
  assert.match(ensure, /if\(!p\._registeredAt\)\{await pfEnsure\(true,false,false\)/);
  assert.match(ensure, /pfProfileRefreshSoon\(1200\)/);
  assert.match(sync, /await pfEnsureForSync\(!!forceProfile\)/);
  assert.match(sync, /profileDeferred/);
  assert.doesNotMatch(sync, /await pfEnsure\(!!forceProfile\)/);
  assert.match(functionSource('pfProfilePayload'), /pfBounded\(rolePushAvatarData/);
  assert.match(functionSource('pfEnsure'), /profilePayload\.end/);
  assert.match(functionSource('pfEnsure'), /profileUpsert\.end/);
});

test('chat entry defers read work, serializes receipts and bounds first paint', () => {
  assert.match(source, /const _pfPayloadCache=typeof WeakMap/);
  assert.match(functionSource('pfMarkRead'), /setTimeout\(\(\)=>pfMarkReadMessages\('friend',id\),0\)/);
  assert.match(functionSource('pfMarkGroupRead'), /setTimeout\(\(\)=>pfMarkReadMessages\('group',gid\),0\)/);
  assert.match(functionSource('pfMarkReadMessages'), /pfSyncMaybeYield\(i\+1\)/);
  assert.match(functionSource('pfAckRead'), /_pfReadAckQueue\.push/);
  assert.match(functionSource('pfReadAckDrain'), /await pfRpc\('phone_friend_mark_received'/);
  assert.match(source, /const _pfFriendRenderLimit=\{\}/);
  assert.match(functionSource('openPhoneFriendChat'), /_pfFriendRenderLimit\[id\]=60/);
  assert.match(functionSource('renderPhoneFriendChat'), /all\.slice\(-limit\)/);
  assert.match(functionSource('renderPhoneFriendChat'), /查看更早消息/);
  assert.match(functionSource('phoneFriendChatShowEarlier'), /\+60/);
});

test('private diagnostics expose only stage timing and counts', () => {
  for (const token of ['profileDeferred', 'scanned', 'acked', 'rendered', 'hidden']) {
    assert.ok(overlay.includes(`'${token}'`), token);
  }
  for (const stage of ['chatOpen.end', 'chatRender.end', 'readMark.end', 'profilePayload.end', 'profileUpsert.end']) {
    assert.ok(source.includes(`'${stage}'`), stage);
  }
  assert.doesNotMatch(overlay, /messageBody|chatContent|authorizationToken/);
});

test('v1176 public candidate adds only the shared theater layer, not the private friend repair', () => {
  assert.match(publicSource, /APP_VER='v1176 · 多人剧场退场署名保留版'/);
  assert.doesNotMatch(publicSource, /function pfEnsureForSync/);
});
