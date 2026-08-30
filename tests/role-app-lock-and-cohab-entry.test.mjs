import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const privateApp = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');
const edge = read('supabase/functions/phone-role-push/index.ts');
const sync = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift');
const content = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/ContentView.swift');
const shield = read('native/private-small-phone/XcodeProject/PhoneCompanionShield/ShieldConfigurationExtension.swift');
const monitor = read('native/private-small-phone/XcodeProject/PhoneCompanionMonitor/DeviceActivityMonitorExtension.swift');

test('role app locking is opt-in and each observation must resolve to remind or lock', () => {
  assert.match(app, /appWatchRoleLock:false/);
  assert.match(app, /if\(c\.proactive\.appWatchRoleLock==null\)c\.proactive\.appWatchRoleLock=false/);
  assert.match(app, /允许角色自主锁定软件/);
  assert.match(edge, /\[应用处理\|提醒\]/);
  assert.match(edge, /\[应用处理\|锁定\]/);
  assert.match(edge, /不能保持安静，也不能给第三种结果/);
  assert.doesNotMatch(edge, /followupChoice: Math\.random/);
});

test('role app decision parser accepts only the two complete wire formats', () => {
  const start = edge.indexOf('function parseRoleAppDecision(');
  const end = edge.indexOf('\nasync function roleMessage(', start);
  const executable = edge.slice(start, end).replace('(value: unknown)', '(value)');
  const parse = vm.runInNewContext(`(${executable})`);
  assert.deepEqual(
    { ...parse('[应用处理|提醒]\n先歇一会儿，别一直刷。') },
    { action: 'remind', body: '先歇一会儿，别一直刷。', failureBody: '' },
  );
  assert.deepEqual(
    { ...parse('[应用处理|锁定]\n[锁定成功]\n我把它锁了，不是限额。\n[锁定失败]\n没锁上，你先自己停一下。') },
    { action: 'lock', body: '我把它锁了，不是限额。', failureBody: '没锁上，你先自己停一下。' },
  );
  assert.equal(parse('[应用处理|锁定]\n我锁了。'), null);
  assert.equal(parse('[保持安静]'), null);
});

test('a role lock message is withheld until the real device command completes', () => {
  const commandCheck = edge.indexOf('const completed = commandStatus === "completed"');
  const outcome = edge.indexOf('const outcomeBody = String(completed ? earlyInspect.body');
  const push = edge.indexOf('client, url, profile, outcomeBody');
  assert.ok(commandCheck >= 0 && outcome > commandCheck && push > outcome);
  const idleGate = edge.indexOf('if (!freshProfile.enabled || !activityQuietForThirtyMinutes');
  assert.ok(push < idleGate, 'a completed lock acknowledgement must bypass the ordinary idle gate');
  assert.match(edge, /stage: "awaiting_lock"/);
  assert.match(edge, /action: "lock"[\s\S]{0,220}by: "role-app-watch"/);
  assert.match(sync, /command\.by == "role-app-watch"/);
  assert.match(sync, /RemoteCommand\([\s\S]{0,260}actor: actor,\s*by: nil\s*\)/);
  assert.match(sync, /guard effectiveLockedTokens\(\)\.contains\(token\)/);
  assert.match(sync, /saveShieldRoleActors\(previousRoleActors\)/);
});

test('shield UI distinguishes lock sources in the title without gray subtitle text', () => {
  assert.match(shield, /\? "\\\(appName\)已被\\\(actor\)锁定"/);
  assert.match(shield, /\? "\\\(appName\) 今日限额已达到"/);
  assert.match(shield, /: "\\\(appName\) 暂时已锁定"/);
  assert.match(shield, /subtitle: nil/);
  assert.doesNotMatch(shield, /let subtitleText/);
  assert.doesNotMatch(shield, /绑定角色|某某/);
  assert.doesNotMatch(sync, /绑定角色|某某/);
  assert.match(shield, /companion\.shield\.roleActors\.v1/);
  assert.match(shield, /companion\.shield\.limitDays\.v1/);
  assert.match(monitor, /days\[externalID\] = today/);
  assert.match(sync, /forgetRoleShieldActor\(for: token\)/);
  assert.match(sync, /sharedDefaults\?\.set\(actors, forKey: shieldRoleActorsKey\)[\s\S]{0,260}sharedDefaults\?\.synchronize\(\)/);
  assert.match(content, /clearRoleLockSources\(for: \[token\]\)/);
  assert.match(content, /removeObject\(forKey: shieldLimitDaysKey\)/);
});

test('cohabitation entry paints the destination before heavy persistence', () => {
  const start = app.indexOf('function cohabEnter(');
  const end = app.indexOf('\nfunction ', start + 10);
  const fn = app.slice(start, end);
  assert.ok(fn.indexOf("go('off',{id,mode:'cohab'})") < fn.indexOf('cohabPersistAfterEnter()'));
  assert.match(app, /cohabActionTap\(event,'enter','\$\{cid\}'\)/);
  assert.match(app, /requestAnimationFrame\(\(\)=>setTimeout\(run,0\)\)/);
  assert.match(app, /function closeModal\(\)\{const m=\$\('#modal'\);if\(!m\)return false/);
});

test('root and private web logic remain byte-identical', () => {
  const hash = text => crypto.createHash('sha256').update(text).digest('hex');
  assert.equal(hash(privateApp), hash(app));
});
