import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');
const edge = readFileSync(join(root, 'supabase/functions/phone-role-push/index.ts'), 'utf8');
const sql = readFileSync(join(root, 'supabase/migrations/202608120002_background_role_tasks.sql'), 'utf8');

test('reply and device work can be handed to the server without racing user activity', () => {
  assert.match(app, /roleBackgroundPrepare\(id,'reply_handoff'/);
  assert.match(app, /roleBackgroundPrepare\(id,'device_handoff'/);
  assert.doesNotMatch(app, /roleServerPushTouchActivity\(id,m\.time,true\);roleBackgroundCancel\(id\);roleBackgroundPrepare/);
  assert.match(sql, /kind = 'app_followup' and status = 'pending'/);
  assert.match(edge, /currentTask\?\.status === "canceled"/);
});

test('chat media settings expose an explicit real background message test', () => {
  assert.match(app, /function roleServerPushSettingsTestHTML\(\)/);
  assert.match(app, /立即模拟后台主动消息/);
  assert.match(app, /async function roleServerPushOneMinuteTest\(id\)/);
  assert.match(app, /roleBackgroundPreflight\(id,false\)/);
  assert.match(app, /roleBackgroundEnqueue\(id,'one_minute_test'/);
  assert.match(app, /roleBackgroundEnqueue\(id,'one_minute_test',[^\n]*Date\.now\(\),baseline,false\)/);
  assert.match(app, /roleBackgroundDispatchNow\(true\)/);
  assert.match(app, /request\.keepalive=true/);
  assert.match(app, /roleBackgroundDispatchNow=async function\(\.\.\.args\)/);
  assert.match(app, /roleBackgroundDispatchNowPrivateCore\(\.\.\.args\)/);
  assert.doesNotMatch(app, /setTimeout\(\(\)=>roleBackgroundDispatchNow\(\),12000\)/);
  assert.match(app, /不会生成本地假回复/);
  const begin = app.indexOf('async function roleServerPushOneMinuteTest');
  const end = app.indexOf('function roleAppWatchToggle', begin);
  assert.doesNotMatch(app.slice(begin, end), /msgs\(|pushMsg|notifyIncoming/);
  assert.match(edge, /task\.kind === "one_minute_test"/);
  assert.match(sql, /one_minute_test/);
});

test('background generation uses the role current model and reports the real task and APNs result', () => {
  assert.match(app, /function roleServerModelRoute\(c\)/);
  assert.match(app, /function roleServerModelRoutes\(c\)/);
  assert.match(app, /modelRoute:routes\[0\]\|\|null,modelRoutes:routes/);
  assert.match(app, /关闭后清除模型线路/);
  assert.match(app, /if\(!roleServerModelRoute\(c\)\)missing\.push/);
  assert.match(edge, /index === 0 \? "profile-current" : "profile-secondary"/);
  assert.match(edge, /automation\.modelRoutes/);
  assert.match(edge, /name: index === 0 \? "profile-current" : "profile-secondary"/);
  assert.ok(edge.indexOf('index === 0 ? "profile-current" : "profile-secondary"') < edge.indexOf('Deno.env.get("OPENAI_API_KEY")'));
  assert.match(app, /action:'task_status'/);
  assert.match(edge, /input\?\.action === "task_status"/);
  assert.match(edge, /providerReason:/);
  assert.match(edge, /pushStatus:/);
  assert.match(app, /APNs 已被 Apple 接受/);
});

test('an explicit background test tries each synchronized external route once and then releases the queue', () => {
  assert.match(edge, /automation\.modelRoutes\.slice\(0, 2\)/);
  assert.match(edge, /Math\.min\(27_000, remaining\)/);
  assert.match(edge, /task\.kind === "one_minute_test" \|\| task\.kind === "app_watch_test"[\s\S]{0,80}\? 1/);
  assert.doesNotMatch(edge, /task\.kind === "one_minute_test" \|\| task\.kind === "app_watch_test" \|\| task\.kind === "reply_handoff"[\s\S]{0,80}\? 2/);
});

test('app awareness is gated, limited, mutually exclusive and cooled down', () => {
  assert.match(app, /appWatchEnabled:!!\(c\.proactive&&c\.proactive\.appWatch\)/);
  assert.match(app, /Math\.max\(0,Math\.min\(5,/);
  assert.match(edge, /Math\.random\(\) < 0\.5/);
  assert.match(edge, /nextDue\(profile, 90\)/);
  assert.match(edge, /due_at: new Date\(Date\.now\(\) \+ 5 \* 60_000\)/);
  assert.match(edge, /String\(payload\.followupChoice \|\| "message"\) === "lock"/);
});

test('background automations require fresh device facts and only record delivered events', () => {
  for (const kind of ['morningSleep', 'eveningScreen', 'absenceBattery', 'criticalBattery', 'emotionCare', 'manualUnlock']) {
    assert.match(edge, new RegExp(kind));
  }
  assert.match(edge, /freshWithin\(telemetry\.generatedAt, 10 \* 60_000\)/);
  assert.match(edge, /freshWithin\(screen\.generatedAt, 20 \* 60_000\)/);
  assert.match(edge, /if \(!automationDelivered\)/);
  assert.match(sql, /attempts smallint not null default 0/);
});

test('foreground and background automations have one owner and respect occupied scenes', () => {
  assert.match(app, /roleBackgroundAvailable==='function'&&roleBackgroundAvailable\(c\.id\)\)return false/);
  assert.match(app, /localRuns:Object\.assign\(\{\},st\.automationRuns\|\|\{\}\)/);
  assert.match(app, /suspended=!!\(roleOnlineProactiveBlocked\(c\.id\)/);
  assert.match(edge, /if \(profileTemporarilySuspended\(profile\) && !pendingManualUnlock\) return null/);
  assert.match(edge, /!candidate && profileTemporarilySuspended\(profile\)/);
  assert.doesNotMatch(edge, /if \(config\.suspended === true\) return null/);
  assert.match(edge, /localRuns\.morningSleep/);
  assert.match(edge, /Math\.max\(serverCount, localCount\)/);
});

test('time awareness and cohabitation state are synchronized explicitly', () => {
  assert.match(app, /timeAware:S\.settings\.timeAware!==false/);
  assert.match(app, /if\(!S\.settings\.timeAware\)return'';const sc=/);
  assert.match(app, /timeOn\?initiativeAwayPrompt\(c\):''/);
  assert.match(app, /时间感知已关闭：不得使用或推断日期/);
  assert.match(app, /id="cohab_manual_phase"/);
  assert.match(app, /id="cohab_manual_activity"/);
  assert.match(app, /id="cohab_manual_place"/);
});
