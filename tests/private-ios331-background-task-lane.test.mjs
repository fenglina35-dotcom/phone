import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const bundle = path.join(
  root,
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle',
);
const privateApp = fs.readFileSync(path.join(bundle, 'app.js'), 'utf8');
const publicApp = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const overlay = fs.readFileSync(
  path.join(bundle, 'private-runtime-diagnostics.js'),
  'utf8',
);
const privateIndex = fs.readFileSync(path.join(bundle, 'index.html'), 'utf8');
const privateAlias = fs.readFileSync(path.join(bundle, '小手机.html'), 'utf8');
const privateRepair = fs.readFileSync(path.join(bundle, 'repair.html'), 'utf8');
const source = path.join(
  root,
  'native/private-small-phone/XcodeProject/PhoneCompanionTest',
);
const webView = fs.readFileSync(path.join(source, 'LocalPhoneWebView.swift'), 'utf8');
const bridge = fs.readFileSync(path.join(source, 'PhoneNativeBridge.swift'), 'utf8');
const project = fs.readFileSync(
  path.join(
    root,
    'native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj',
  ),
  'utf8',
);

function functionSource(source, name) {
  const marker = `function ${name}(`;
  let start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} exists`);
  if (source.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
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
    else if (char === '}' && --depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('private performance candidate has a v1236 identity while public web stays v1236', () => {
  assert.equal(privateIndex, privateAlias);
  assert.match(privateIndex, /window\.__NORTH_SHELL_BUILD__='1236'/);
  assert.match(privateIndex, /app\.js\?v=1236&r=v1236-backup-auto-download-1/);
  assert.match(privateIndex, /private-runtime-diagnostics\.js\?v=335/);
  assert.match(privateRepair, /index\.html\?repair=1&v=1236/);
  assert.match(privateApp, /APP_VER='v1236 · 恢复完整备份自动下载'/);
  assert.match(overlay, /335-resume-status-lane/);
  assert.match(webView, /1\.0\.355 \(355\)/);
  assert.match(bridge, /private static let build = "1\.0\.355 \(355\)"/);
  assert.match(bridge, /static let contractVersion = 37/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 355;/g) || []).length, 12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.355;/g) || []).length, 12);
  assert.match(publicApp, /APP_VER='v1236 · 恢复完整备份自动下载'/);
  assert.doesNotMatch(publicApp, /function northNativeBackgroundTask\(name,run\)/);
});

test('the automatic-task lane exists only in the private bundle', () => {
  assert.match(privateApp, /function northNativeBackgroundTask\(name,run\)/);
  assert.match(privateApp, /_nativeBackgroundTaskActive/);
  assert.match(privateApp, /window\.__smallPhoneBackgroundTaskSnapshot=function/);
  assert.doesNotMatch(publicApp, /function northNativeBackgroundTask\(name,run\)/);
});

test('private automatic schedulers enter one named lane while manual entrypoints stay direct', () => {
  for (const task of [
    'social-auto-post',
    'mail-auto',
    'calendar',
    'cohab-autonomy',
    'friend-request',
    'initiative',
    'companion-snapshot',
    'role-push-pull',
    'phone-friend',
    'license-session',
    'license-identities',
  ]) {
    assert.ok(privateApp.includes(`northNativeBackgroundTask('${task}'`), task);
  }
  assert.match(
    functionSource(privateApp, 'openPhoneFriends'),
    /phoneFriendMaybeSync\(true\)/,
  );
  assert.doesNotMatch(
    functionSource(privateApp, 'openPhoneFriends'),
    /northNativeBackgroundTask/,
  );
  assert.doesNotMatch(
    functionSource(privateApp, 'nativeAlarmSync'),
    /northNativeBackgroundTask/,
  );
});

test('lane refuses hidden, protected, and overlapping automatic work', async () => {
  let now = 1000;
  let paused = false;
  const traces = [];
  const context = vm.createContext({
    Date: class extends Date { static now() { return now; } },
    Math,
    Promise,
    String,
    document: { hidden: false },
    performance: { now: () => now },
    privateNativeAppOn: () => true,
    northNativeMaintenancePaused: () => paused,
    window: null,
  });
  context.window = context;
  context.__smallPhoneBackgroundTaskTrace = row => traces.push({ ...row });
  vm.runInContext(`
    let _nativeBackgroundTaskActive=null,_nativeBackgroundTaskLast=null;
    ${functionSource(privateApp, 'northNativeBackgroundTaskTrace')}
    ${functionSource(privateApp, 'northNativeBackgroundTaskFinish')}
    ${functionSource(privateApp, 'northNativeBackgroundTask')}
    ${privateApp.match(/window\.__smallPhoneBackgroundTaskSnapshot=function\(\)\{[^\n]+/)[0]}
  `, context);

  let runs = 0;
  context.document.hidden = true;
  assert.equal(context.northNativeBackgroundTask('hidden', () => ++runs), false);
  context.document.hidden = false;
  paused = true;
  assert.equal(context.northNativeBackgroundTask('paused', () => ++runs), false);
  paused = false;

  let release;
  const first = context.northNativeBackgroundTask(
    'first',
    () => new Promise(resolve => { release = resolve; }),
  );
  assert.equal(typeof first.then, 'function');
  assert.equal(context.northNativeBackgroundTask('overlap', () => ++runs), false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.__smallPhoneBackgroundTaskSnapshot())),
    { task: 'first', taskMs: 0, taskActive: true },
  );
  release('done');
  assert.equal(await first, 'done');
  now += 25;
  assert.equal(context.northNativeBackgroundTask('next', () => ++runs), 1);
  assert.equal(runs, 1);
  assert.deepEqual(
    traces.map(row => `${row.stage}:${row.task}`),
    ['begin:first', 'end:first', 'begin:next', 'end:next'],
  );
});

test('auto social posts and mail generate at most one role per scheduler pass', () => {
  const posts = functionSource(privateApp, 'scanAutoPost');
  const mail = functionSource(privateApp, 'scanMail');
  for (const source of [posts, mail]) {
    assert.match(source, /^async function/);
    assert.match(source, /for\(const c of S\.contacts\)/);
    assert.match(source, /return !!ok/);
    assert.doesNotMatch(source, /S\.contacts\.forEach/);
  }
});

test('performance guard reports the active automatic task without collecting content', () => {
  const calls = [];
  const timers = [];
  const context = vm.createContext({
    Date,
    Math,
    Map,
    Number,
    Object,
    Promise,
    String,
    performance: { now: () => 5000 },
    document: { hidden: false },
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
    clearTimeout() {},
    northNativePerformanceGuard() { return true; },
    cur: () => ({ p: 'wechat' }),
    window: null,
  });
  context.window = context;
  context.__SMALL_PHONE_PRIVATE__ = true;
  context.__smallPhoneBackgroundTaskSnapshot = () => ({
    task: 'calendar',
    taskMs: 912,
    taskActive: true,
  });
  context.__smallPhoneNativeDiag = (event, fields) => {
    calls.push({ event, fields });
    return true;
  };
  vm.runInContext(overlay, context);
  context.northNativePerformanceGuard('event-loop:900', 120000);
  const guard = calls.find(row => row.event === 'performance.guard');
  assert.ok(guard);
  assert.equal(guard.fields.task, 'calendar');
  assert.equal(guard.fields.taskMs, 912);
  assert.equal(guard.fields.taskActive, true);
  assert.equal(Object.keys(guard.fields).length, 8);
  assert.doesNotMatch(overlay, /messageBody|chatContent|authorizationToken/);
});
