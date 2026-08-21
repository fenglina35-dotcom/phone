import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');
const migration = readFileSync(join(root, 'supabase', 'migrations', '202608060003_phone_role_scheduled_push.sql'), 'utf8');
const avatarMigration = readFileSync(join(root, 'supabase', 'migrations', '202608070001_phone_role_avatar_notifications.sql'), 'utf8');
const contextMigration = readFileSync(join(root, 'supabase', 'migrations', '202608080001_phone_role_push_context_reset.sql'), 'utf8');
const naturalMigration = readFileSync(join(root, 'supabase', 'migrations', '202608090001_phone_role_push_natural_messages.sql'), 'utf8');
const allDayMigration = readFileSync(join(root, 'supabase', 'migrations', '202608110003_phone_role_push_all_day_random_idle.sql'), 'utf8');
const unifiedPushMigration = readFileSync(join(root, 'supabase', 'migrations', '202608110004_private_phone_unified_push.sql'), 'utf8');
const legacyClaimMigration = readFileSync(join(root, 'supabase', 'migrations', '202608110005_private_phone_unified_push_legacy_rpc.sql'), 'utf8');
const resetMemoryMigration = readFileSync(join(root, 'supabase', 'migrations', '202608110006_phone_role_push_reset_memory.sql'), 'utf8');
const receiptMigration = readFileSync(join(root, 'supabase', 'migrations', '202608200002_phone_role_push_receipt_reconciliation.sql'), 'utf8');
const edge = readFileSync(join(root, 'supabase', 'functions', 'phone-role-push', 'index.ts'), 'utf8');
const notificationService = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'RoleNotificationService', 'NotificationService.swift'), 'utf8');
const localPhoneWebView = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'LocalPhoneWebView.swift'), 'utf8');
const companionApp = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'PhoneCompanionTestApp.swift'), 'utf8');

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

function edgeFunctionSource(name) {
  const start = edge.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing edge ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < edge.length; i += 1) {
    if (edge[i] === '{') { depth += 1; opened = true; }
    if (edge[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return edge.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated edge ${name}`);
}

test('server scheduler persists profiles and an idempotent outbox', () => {
  assert.match(migration, /create table if not exists public\.phone_role_push_profiles/);
  assert.match(migration, /create table if not exists public\.phone_role_push_outbox/);
  assert.match(migration, /dedupe_key text not null unique/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /phone_role_push_upsert_profile/);
  assert.match(migration, /phone_role_push_pull/);
  assert.match(migration, /phone_role_push_ack/);
  assert.match(migration, /phone-role-push-every-minute/);
});

test('edge dispatcher writes the message first and then attempts APNs', () => {
  assert.match(edge, /phone_role_push_claim_due/);
  assert.match(edge, /phone_role_push_outbox/);
  assert.match(edge, /ignoreDuplicates: true/);
  assert.match(edge, /eq\("dedupe_key", dedupe\)/);
  assert.match(edge, /outboxRow\?\.push_status !== "sent"/);
  assert.match(edge, /apns-push-type": "alert"/);
  assert.match(edge, /rolePush: \{[\s\S]{0,120}outboxId, roleId, roleName, avatarURL/);
  assert.match(edge, /OPENAI_API_KEY/);
  assert.match(edge, /DASHSCOPE_API_KEY/);
  assert.match(edge, /https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\/v1/);
  assert.match(edge, /ROLE_PUSH_DASHSCOPE_MODEL/);
  assert.match(edge, /qwen-plus/);
  assert.match(edge, /for \(const provider of providers\)/);
  assert.match(edge, /role-message-provider-failed/);
  assert.doesNotMatch(edge, /fallbackMessage/);
  assert.doesNotMatch(edge, /醒了没有|这么晚了还没睡|在忙什么|有空回我一下|手放哪儿了|手还放那儿/);
  assert.match(edge, /kind: "unavailable", body: ""/);
  assert.match(edge, /kind: "silent", body: ""/);
  assert.match(edge, /只输出 \[保持安静\]/);
  assert.match(edge, /repeatCandidates\.some\(\(old\) => roleMessageRepeated\(body, old\)\)/);
  assert.match(edge, /const min = Math\.min\(a\.length, b\.length\)/);
  assert.match(edge, /if \(length < 8\) return \(length - 1\) \/ length/);
  assert.match(edge, /if \(length < 12\) return 0\.72/);
  assert.match(edge, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(edge, /与近期已经发过的话过于相似/);
  assert.match(edge, /不要只改几个字重复原意/);
  assert.match(edge, /sawGeneratedCandidate\s*[\s\S]{0,80}\? \{ kind: "silent"/);
  assert.match(edge, /phone_role_push_outbox[\s\S]{0,300}select\("body"\)/);
  assert.match(edge, /profile\.recent_context/);
  assert.match(edge, /profile\.memory_context/);
  assert.match(edge, /最近的真实聊天/);
  assert.match(edge, /长期记忆、对话总结与世界设定/);
  assert.match(edge, /真实恋人的日常聊天/);
  assert.match(edge, /严禁使用破折号或横杠字符/);
  assert.match(edge, /roleMessageStyleInvalid\(body, messageMax\)/);
  assert.match(edge, /select\("enabled,next_due_at,last_user_at,quiet_until_at,recent_context,memory_context,automation_config"\)/);
  assert.match(edge, /!profileQuietPeriodEnded\(freshProfile\)/);
  assert.match(edge, /!profileQuietPeriodEnded\(latestProfile\)/);
  assert.match(edge, /!activityQuietForThirtyMinutes\(freshProfile\)/);
  assert.match(edge, /!activityQuietForThirtyMinutes\(latestProfile\)/);
  assert.match(edge, /Date\.parse\(String\(latestProfile\.next_due_at/);
  assert.match(edge, /roleUserFactUnsupported\(body/);
  assert.match(edge, /roleNormalizeGeneratedText\(text\.slice\(0, 1200\)/);
  assert.match(edge, /roleMessageParts\(normalizedText, messageMax\)/);
  assert.match(edge, /roleNotificationPreview\(part\)/);
});

test('short proactive messages reject one-word rewrites without blocking different topics', () => {
  const keySource = edgeFunctionSource('roleTextKey').replace('value: unknown', 'value');
  const thresholdSource = edgeFunctionSource('roleRepeatThreshold').replace('length: number', 'length');
  const repeatedSource = edgeFunctionSource('roleTextRepeated')
    .replace('current: string', 'current')
    .replace('previous: string', 'previous');
  const repeated = Function(`${keySource}\n${thresholdSource}\n${repeatedSource}\nreturn roleTextRepeated;`)();
  assert.equal(repeated('North，手还放那儿？', 'North，手放哪儿了？'), true);
  assert.equal(repeated('嗯，去吧宝宝。', '嗯，去吧宝宝。'), true);
  assert.equal(repeated('嗯，去吧宝贝。', '嗯，去吧宝宝。'), true);
  assert.equal(repeated('North，今晚想吃什么？', 'North，外面下雨了。'), false);
  assert.equal(repeated('刚下班，路上买了束花。', '嗯，去吧宝宝。'), false);
});

test('server proactive contact compares ordinary role replies and starts a new event', () => {
  const recentSource = edgeFunctionSource('roleRecentAssistantMessages');
  const recent = Function(`${recentSource}\nreturn roleRecentAssistantMessages;`)();
  const profile = {
    role_name: '小北',
    recent_context: '2026/8/9 21:20:00 North：我先去洗澡\n2026/8/9 21:20:08 小北：嗯，去吧宝宝。',
  };
  assert.deepEqual(recent(profile), ['嗯，去吧宝宝。']);
  assert.match(edge, /repeatCandidates\.some\(\(old\) => roleMessageRepeated\(body, old\)\)/);
  assert.match(edge, /这是与上一轮分开的独立主动联系事件/);
  assert.match(edge, /禁止再次回答用户最后一句/);
  assert.match(edge, /用户最后一条消息仍在等待正常回复/);
});

test('role notification avatars use bounded thumbnails and unguessable fetch URLs', () => {
  assert.match(avatarMigration, /avatar_data text not null default ''/);
  assert.match(avatarMigration, /avatar_token uuid not null default gen_random_uuid\(\)/);
  assert.match(avatarMigration, /length\(v_avatar\) > 50000/);
  assert.match(functionSource('rolePushAvatarData'), /canvas\.width=96/);
  assert.match(functionSource('rolePushAvatarSourceReady'), /await imgGet\(key\)/,'an evicted IndexedDB avatar must be loaded before profile sync');
  assert.match(functionSource('rolePushAvatarData'), /await rolePushAvatarSourceReady\(c\)/);
  assert.match(functionSource('rolePushAvatarData'), /toDataURL\('image\/jpeg',\.78\)/);
  assert.match(functionSource('roleServerPushSync'), /profile\.avatarData=await rolePushAvatarData\(c\)/);
  assert.match(edge, /eq\("avatar_token", token\)/);
  assert.match(edge, /Date\.now\(\) - 7 \* 86400_000/);
  assert.match(edge, /"mutable-content": 1/);
  assert.match(edge, /avatarURL: roleAvatarURL/);
});

test('iOS notification service upgrades role pushes to communication notifications', () => {
  assert.match(notificationService, /final class NotificationService: UNNotificationServiceExtension/);
  assert.match(notificationService, /INImage\(imageData:/);
  assert.match(notificationService, /INPerson\(/);
  assert.match(notificationService, /INSendMessageIntent\(/);
  assert.match(notificationService, /interaction\.direction = \.incoming/);
  assert.match(notificationService, /content\.updating\(from: intent\)/);
  assert.match(notificationService, /interaction\.donate \{ \[weak self\]/,'the content update waits for the interaction donation');
  assert.match(notificationService, /avatarURL\.scheme == "https"/);
  assert.match(notificationService, /data\?\.count \?\? 0\) <= 64_000/);
  assert.match(edge, /"thread-id": `role-\$\{roleId\}-\$\{outboxId\}-\$\{index\}`/,'each message bubble remains a separate notification card');
  assert.match(notificationService, /content\.threadIdentifier = notificationID/);
  assert.match(notificationService, /content\.title = displayName/);
});

test('web client opt-in sends bounded memory and recent context', () => {
  const profile = functionSource('roleServerPushProfile');
  assert.match(profile, /roleName/);
  assert.match(profile, /persona/);
  assert.match(profile, /slice\(0,1200\)/);
  assert.match(profile, /recentContext:roleServerPushRecentContext\(c\)/);
  assert.match(profile, /memoryContext:roleServerPushMemoryContext\(c\)/);
  assert.match(profile, /lastUserAt:roleServerPushLastUserAt\(c\)/);
  assert.match(profile, /enabled:roleServerPushEffectiveEnabled\(c\)/);
  assert.match(profile, /messageMin:min,messageMax:max/);
  assert.match(functionSource('roleServerPushRecentContext'), /slice\(-8000\)/);
  assert.match(functionSource('roleServerPushRecentContext'), /roleOnlineLiveStateText\(c\)/);
  assert.doesNotMatch(functionSource('roleServerPushEffectiveEnabled'), /roleOnlineProactiveBlocked/,'temporary live states must not persistently disable the server profile');
  assert.match(functionSource('roleServerAutomationConfig'), /suspended/,'temporary live states remain a reversible server-side suspension');
  assert.match(functionSource('roleServerAutomationConfig'), /return base/,'suspension must be synchronized even without role data access');
  assert.match(functionSource('roleServerPushMemoryContext'), /slice\(0,16000\)/);
  assert.match(functionSource('roleServerPushMemoryContext'), /memoryList\(c,scope\)/);
  assert.match(functionSource('roleServerPushMemoryContext'), /summaryList\(c,scope\)/);
  assert.match(functionSource('roleServerPushMemoryContext'), /aiMemoryDocs\(c\)/);
  assert.match(functionSource('roleServerPushMemoryContext'), /S\.worldbook/);
  assert.match(functionSource('roleServerPushMemoryContext'), /lifeNotes\(\)/);
  assert.match(app, /关闭小手机后仍可主动联系/);
  assert.match(app, /会同步该角色的长期记忆、对话总结和最近聊天上下文/);
  assert.match(functionSource('roleServerPushToggle'), /phone_role_push_upsert_profile|roleServerPushSync/);
  assert.match(functionSource('roleServerPushSyncEnabled'), /600000/);
  assert.match(app, /phone_role_push_status/);
  assert.match(app, /后台链路已接通/);
});

test('completed chat turns are marked before scheduled proactive generation', () => {
  assert.match(functionSource('roleServerPushRecentContext'), /roleServerPushConversationBoundary\(c\)/);
  assert.match(functionSource('roleServerPushConversationBoundary'), /上一轮已经结束/);
  assert.match(functionSource('roleServerPushConversationBoundary'), /正式随机主动联系必须保持安静/);
  assert.match(edgeFunctionSource('roleRecentTurnBoundary'), /上一轮已经结束/);
  assert.match(edge, /turnBoundary\.pending \?/);
});

test('temporary offline or face-to-face states suspend without disabling background contact', () => {
  assert.match(edgeFunctionSource('profileTemporarilySuspended'), /automation_config/);
  assert.match(edgeFunctionSource('profileTemporarilySuspended'), /snapshotTime\(value\.suspendedUntil\)/);
  assert.match(edgeFunctionSource('profileTemporarilySuspended'), /until > Date\.now\(\)/);
  assert.match(functionSource('roleServerAutomationConfig'), /suspendedUntil:suspended\?Date\.now\(\)\+12\*60000:0/);
  assert.match(edge, /profileTemporarilySuspended\(freshProfile\)/);
  assert.match(edge, /profileTemporarilySuspended\(latestProfile\)/);
  assert.match(edge, /next_due_at: new Date\(Date\.now\(\) \+ 10 \* 60_000\)/);
  assert.match(edge, /!profile\.enabled \|\| profileTemporarilySuspended\(profile\)/);
  assert.match(edgeFunctionSource('automationCandidate'), /pendingManualUnlock/);
  assert.match(edgeFunctionSource('automationCandidate'), /profileTemporarilySuspended\(profile\) && !pendingManualUnlock/);
  assert.match(edge, /!candidate && profileTemporarilySuspended\(profile\)/);
});

test('unified private app registers itself and exposes end-to-end push diagnostics', () => {
  assert.match(unifiedPushMigration, /claim_private_phone_unified_controller/);
  assert.match(unifiedPushMigration, /apns_device_token/);
  assert.match(unifiedPushMigration, /phone_role_push_status/);
  assert.match(unifiedPushMigration, /phone-role-push-every-minute/);
  assert.match(unifiedPushMigration, /'cronActive'/);
  assert.match(functionSource('roleServerPushCheckStatus'), /pushRegistered/);
  assert.match(functionSource('roleServerPushStatusHTML'), /profileEnabled/);
  assert.match(functionSource('roleServerPushStatusHTML'), /cronActive/);
  assert.match(legacyClaimMigration, /p_apns_env text/);
  assert.match(legacyClaimMigration, /p_apns_environment => p_apns_env/);
});

test('a total memory wipe also clears server context and undelivered old pushes', () => {
  assert.match(resetMemoryMigration, /phone_role_push_reset_memory/);
  assert.match(resetMemoryMigration, /recent_context = ''/);
  assert.match(resetMemoryMigration, /memory_context = ''/);
  assert.match(resetMemoryMigration, /delete from public\.phone_role_push_outbox/);
  assert.match(resetMemoryMigration, /consumed_at is null/);
  assert.match(functionSource('roleServerPushResetMemory'), /p_reset_ms:resetAt/);
  assert.match(functionSource('roleServerPushSync'), /_serverMemoryResetPending/);
  assert.match(functionSource('roleServerPushPull'), /rowAt<=\+c\._memoryResetAt/);
});

test('every visible conversation message resets a random 30-60 minute server quiet period', () => {
  assert.match(contextMigration, /recent_context text not null default ''/);
  assert.match(contextMigration, /memory_context text not null default ''/);
  assert.match(contextMigration, /last_user_at timestamptz/);
  assert.match(contextMigration, /phone_role_push_touch_activity/);
  assert.match(allDayMigration, /check \(idle_minutes between 0 and 1440\)/);
  assert.match(allDayMigration, /add column if not exists quiet_until_at timestamptz/);
  assert.match(allDayMigration, /v_activity \+ make_interval\(mins => 30 \+ floor\(random\(\) \* 31\)::integer\)/);
  assert.match(allDayMigration, /claimed_until = null/);
  assert.match(allDayMigration, /grant execute on function public\.phone_role_push_touch_activity/);
  const touch = functionSource('roleServerPushTouchActivity');
  assert.match(touch, /p_recent_context:roleServerPushRecentContext\(c\)/);
  assert.match(touch, /p_memory_context:roleServerPushMemoryContext\(c\)/);
  assert.match(touch, /p_activity_ms:\+activityAt\|\|Date\.now\(\)/);
  assert.match(touch, /p_quiet_until_ms:roleServerPushQuietUntil\(c\)/);
  const push = functionSource('pushMsg');
  assert.match(push, /msgs\(id\)\.push\(m\);save\(\);if\(m\.role==='user'&&m\.type!=='sys'\)\{roleBackgroundCancel\(id,\['one_minute_test','app_watch_test'\]\);roleServerPushTouchActivity\(id,m\.time,true\);roleBackgroundPrepare\(id,'reply_handoff'/);
});

test('zero interval uses random daily scheduling while a nonzero interval is exact', () => {
  assert.match(edge, /fixed > 0 \? fixed : randomDueMinutes\(profile\)/);
  assert.match(edge, /const daily = Math\.max\(1, Math\.min\(24, Number\(profile\.daily_limit \|\| 1\)\)\)/);
  assert.match(functionSource('roleServerPushProfile'), /configured=proactiveIdleMinutes\(c\)/);
  assert.match(functionSource('proactiveIdleMinutes'), /c&&c\.proactive&&c\.proactive\.idleMin/);
  assert.match(functionSource('roleServerPushProfile'), /idleMinutes:configured/);
});

test('returned role messages are deduplicated and appended to the matching chat', () => {
  const pull = functionSource('roleServerPushPull');
  assert.match(pull, /phone_role_push_pull/);
  assert.match(pull, /getC\(row\.roleId\)/);
  assert.match(pull, /roleOnlineProactiveBlocked\(c\.id\)/);
  assert.match(pull, /roleServerPushSyncSoon\(c\.id\)/);
  assert.match(pull, /_rolePushId===row\.id/);
  assert.doesNotMatch(pull, /initiativeRecentlyRepeated\(c\.id,body/);
  assert.match(pull, /roleServerPushParts\(c,body\)/);
  assert.match(pull, /roleServerPushCallKind\(rawBody\)/);
  assert.match(pull, /incomingCall\(c\.id,callKind,\{serverPush:true\}\)/);
  assert.match(app, /window\.__smallPhoneOpenRolePush=async payload/);
  assert.match(app, /window\.__smallPhoneSyncRolePush=async\(\)=>/);
  assert.match(app, /setTimeout\(\(\)=>roleServerPushPull\(true\),6500\)/);
  assert.match(pull, /msg\._serverProactive=true/);
  assert.match(pull, /phone_role_push_ack/);
  assert.match(pull, /await persistWechatMessagesNow\(\)/);
  assert.ok(
    pull.indexOf('await persistWechatMessagesNow()') < pull.indexOf("phone_role_push_ack"),
    'server rows must be durably persisted before they are acknowledged'
  );
  assert.match(pull, /receiptPending/);
  assert.match(pull, /roleServerPushReceiptMark/);
  assert.ok(
    pull.indexOf('await persistWechatMessagesNow()') < pull.indexOf('roleServerPushReceiptMark') &&
    pull.indexOf('roleServerPushReceiptMark') < pull.indexOf('await saveNowAsync()') &&
    pull.indexOf('await saveNowAsync()') < pull.indexOf("phone_role_push_ack"),
    'chat rows and the durable receipt must both be saved before the server ack'
  );
  assert.match(app, /setInterval\(\(\)=>roleServerPushPull\(false\),60000\)/);
  assert.match(app, /function privateResumeSyncSoon\(\)[\s\S]{0,360}roleServerPushPull\(true\)/);
  assert.match(app, /visibilitychange[\s\S]{0,1600}privateResumeSyncSoon\(\)/);
});

test('native foreground and delivered role notifications wake the web inbox without requiring a tap', () => {
  assert.match(companionApp, /applicationDidBecomeActive[\s\S]{0,180}requestRolePushSync\(\)/);
  assert.match(companionApp, /didReceiveRemoteNotification[\s\S]{0,520}userInfo\["rolePush"\][\s\S]{0,100}requestRolePushSync\(\)/);
  assert.match(companionApp, /willPresent notification[\s\S]{0,260}userInfo\["rolePush"\][\s\S]{0,100}requestRolePushSync\(\)/);
  assert.match(companionApp, /smallPhone\.pendingRolePushSync\.v1/);
  assert.match(companionApp, /SmallPhoneRolePushSyncRequested/);
  assert.match(localPhoneWebView, /name: Notification\.Name\("SmallPhoneRolePushSyncRequested"\)/);
  assert.match(localPhoneWebView, /syncPendingRolePushIfReady\(\)/);
  assert.match(localPhoneWebView, /window\.__smallPhoneSyncRolePush && window\.__smallPhoneSyncRolePush\(\)/);
  assert.match(localPhoneWebView, /didFinish navigation[\s\S]{0,360}syncPendingRolePushIfReady\(\)/);
});

test('recently consumed real pushes can be reconciled without resurrecting deleted messages', () => {
  assert.match(receiptMigration, /push_status = 'sent'/);
  assert.match(receiptMigration, /consumed_at >= now\(\) - interval '24 hours'/);
  assert.match(receiptMigration, /order by \(consumed_at is not null\), created_at asc/);
  assert.match(receiptMigration, /'consumedAt', x\.consumed_at/);
  const rowsSource = functionSource('roleServerPushReceiptRows');
  const hasSource = functionSource('roleServerPushReceiptHas');
  const markSource = functionSource('roleServerPushReceiptMark');
  const forgetSource = functionSource('roleServerPushReceiptForget');
  const S = { _rolePushReceipts: [] };
  const receipts = Function('S', `${rowsSource}\n${hasSource}\n${markSource}\n${forgetSource}\nreturn {has:roleServerPushReceiptHas,mark:roleServerPushReceiptMark,forget:roleServerPushReceiptForget};`)(S);
  assert.equal(receipts.mark('push-1', Date.now()), true);
  assert.equal(receipts.mark('push-1', Date.now()), false);
  assert.equal(receipts.has('push-1'), true);
  assert.equal(S._rolePushReceipts.length, 1);
  receipts.forget(['push-1']);
  assert.equal(receipts.has('push-1'), false);
  assert.doesNotMatch(functionSource('deleteRoleMsg'), /_rolePushReceipts|roleServerPushReceiptForget/);
  const pull = functionSource('roleServerPushPull');
  assert.match(pull, /if\(roleServerPushReceiptHas\(row\.id\)\)\{queueAck\(row,false\);continue;\}/);
  assert.doesNotMatch(pull, /roleServerPushReceiptHas\(row\.id\)&&!alreadyVisible\).*roleServerPushReceiptForget/);
});

test('old transcript wrappers are removed before text and image messages are parsed', () => {
  const normalizeSource = functionSource('roleServerPushNormalizeBody');
  const normalize = Function(`${normalizeSource}; return roleServerPushNormalizeBody;`)();
  assert.equal(
    normalize({ name: '先生^^' }, '2026年8月20日 15:27 先生^^：[图片|医院办公桌旁的一杯黑咖啡]'),
    '[图片|医院办公桌旁的一杯黑咖啡]',
  );
  assert.equal(normalize({ name: '先生^^' }, '先生^^：到了。'), '到了。');
});

test('server push respects the configured 1-10 message range', () => {
  assert.match(naturalMigration, /message_min smallint not null default 1/);
  assert.match(naturalMigration, /message_max smallint not null default 4/);
});

test('deleting a role disables its server schedule', () => {
  assert.match(functionSource('c_delete'), /phone_role_push_disable_profile/);
});
