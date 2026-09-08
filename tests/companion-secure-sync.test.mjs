import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const sql = readFileSync(
  join(root, 'supabase', 'migrations', '202608050001_phone_companion_secure_sync.sql'),
  'utf8',
);
const retentionSql = readFileSync(
  join(root, 'supabase', 'migrations', '202608050002_phone_companion_three_day_audit.sql'),
  'utf8',
);
const lifecycleSql = readFileSync(
  join(root, 'supabase', 'migrations', '202608060001_phone_companion_command_lifecycle.sql'),
  'utf8',
);

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < app.length; i += 1) {
    if (app[i] === '{') { depth += 1; opened = true; }
    if (app[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return app.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

function assignmentSource(name) {
  const start = app.lastIndexOf(`${name}=function(`);
  assert.notEqual(start, -1, `missing reassignment for ${name}`);
  const end = app.indexOf('\n', start);
  return app.slice(start, end === -1 ? app.length : end);
}

test('sync tables are not exposed through permissive RLS policies', () => {
  assert.match(sql, /revoke all on table public\.phone_companion_links from anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.phone_companion_commands from anon, authenticated/i);
  assert.doesNotMatch(sql, /create policy[\s\S]+using \(true\)/i);
});

test('pairing expires and separates owner from device authentication', () => {
  assert.match(sql, /phone_companion_owner_ok\(p_target, p_owner_secret\)/i);
  assert.match(sql, /phone_companion_device_ok\(p_target, p_device_secret\)/i);
  assert.match(sql, /pair_expires_at >= now\(\)/i);
  assert.match(sql, /phone_companion_hash\(v_target \|\| ':' \|\| trim/i);
  assert.match(sql, /interval '10 minutes'/i);
});

test('real snapshot mapping reads external payload only', () => {
  const source = functionSource('companionApplyServerPayload');
  assert.match(source, /data\.snapshot/);
  assert.match(source, /screen\.totalSeconds/);
  assert.match(source, /companionSnapshotApps\(st,screen\)/);
  assert.match(source, /snapshot\.location/);
  assert.match(source, /snapshot\.footprints/);
  assert.match(source, /if\(!st\.linked\)\{[\s\S]*st\.apps=\[\][\s\S]*st\.location=null/);
  assert.doesNotMatch(source, /usedSecOf\(/);
  assert.doesNotMatch(source, /S\.me\.appUsage/);
});

test('pairing and commands use dedicated companion RPCs', () => {
  assert.match(functionSource('companionBeginPairing'), /phone_companion_begin_pairing/);
  assert.match(functionSource('companionPollSnapshot'), /phone_companion_pull_snapshot/);
  assert.match(functionSource('companionSendCommand'), /phone_companion_enqueue_command/);
  assert.match(functionSource('companionBindExternal'), /externalAppId/);
  assert.match(functionSource('renderCompanionPage'), /关联小手机 App（可选，仅同名时同步锁定）/);
  assert.match(functionSource('renderCompanionPage'), /未关联（外置仍可单独锁定或解锁）/);
  assert.match(functionSource('renderCompanionPage'), /关联内置 App 后，才能设置内外统一限额/);
  assert.doesNotMatch(functionSource('companionPollSnapshot'), /phone_external_events/);
});

test('role inspections pull a fresh external snapshot instead of trusting the couple-space cache', () => {
  assert.match(functionSource('companionRolePullLatest'), /companionRolePullServerSnapshot/);
  assert.match(functionSource('companionRolePullLatest'), /companionRoleRefreshExternal/);
  assert.doesNotMatch(functionSource('companionRolePullLatest'), /companionPollSnapshot/);
  assert.match(functionSource('companionRoleRefreshExternal'), /phone_companion_enqueue_command/);
  assert.match(functionSource('companionRoleRefreshExternal'), /companionNotifyNative/);
  assert.match(functionSource('companionRoleRefreshExternal'), /companionRoleFocusRevision\(current,focus\)>before/);
  assert.match(functionSource('companionRoleRefreshExternal'), /companionRoleSnapshotFresh/);
  assert.match(functionSource('companionRoleDataState'), /_companionRoleExternalSnapshot/);
  assert.match(functionSource('companionRoleControlOnlyPrompt'), /不得读取或复述情侣空间里的伴生缓存/);
  assert.match(functionSource('companionRolePrompt'), /companionRoleDataState/);
  assert.match(assignmentSource('companionRolePrompt'), /companionFeatureAvailable\(\)\?companionRolePromptPrivateCore/);
  assert.match(functionSource('cohabRunPhoneInspection'), /companionRolePullLatest/);
  assert.match(functionSource('doSpyView'), /companionRolePullLatest/);
  assert.match(functionSource('companionRoleScreenTimeText'), /usageGeneratedAt/);
  assert.match(functionSource('companionRoleScreenTimeText'), /readSessionId/);
  assert.match(functionSource('companionRoleHeartRateText'), /companionRoleDataState/);
});

test('roles can refresh and inspect all external iPhone facts in one pass', () => {
  assert.match(functionSource('cohabPhoneTarget'), /iPhone全部数据/);
  assert.match(functionSource('companionRoleAllDataText'), /companionRoleScreenTimeText/);
  assert.match(functionSource('companionRoleAllDataText'), /companionRoleDailyHealthText/);
  assert.match(functionSource('companionRoleAllDataText'), /companionRoleLocationText/);
  assert.match(functionSource('spyFocusData'), /companionRoleAllFocus/);
  assert.match(functionSource('cohabRunPhoneInspection'), /companionRoleProgressSteps/);
  assert.match(functionSource('doSpyViewCore'), /companionRoleAllFocus/);
});

test('a bound external action is enqueued only once', () => {
  const apply = functionSource('companionApplyAction');
  const dispatch = functionSource('companionDispatchBound');
  assert.match(apply, /!st\.demo&&!opt\.skipLog\)companionSendCommand/);
  assert.equal((dispatch.match(/companionSendCommand\(/g) || []).length, 1);
});

test('server companion command history is reduced to three days', () => {
  assert.match(retentionSql, /created_at < now\(\) - interval '3 days'/i);
  assert.doesNotMatch(retentionSql, /30 days/i);
});

test('new lock state supersedes older pending lock and unlock commands for the same stable id', () => {
  assert.match(lifecycleSql, /v_action in \('lock', 'unlock'\)/i);
  assert.match(lifecycleSql, /command->>'externalAppId'/i);
  assert.match(lifecycleSql, /'code', 'superseded'/i);
  assert.match(lifecycleSql, /row_number\(\) over/i);
});

test('pending device commands expire safely and both pull paths apply the lifecycle cleanup', () => {
  assert.match(lifecycleSql, /interval '15 minutes'/i);
  assert.match(lifecycleSql, /'code', 'expired'/i);
  assert.equal((lifecycleSql.match(/perform public\.phone_companion_expire_commands\(p_target\)/gi) || []).length, 2);
  assert.match(lifecycleSql, /create or replace function public\.phone_companion_pull_snapshot[\s\S]+volatile/i);
  assert.match(lifecycleSql, /create or replace function public\.phone_companion_pull_commands[\s\S]+volatile/i);
});
