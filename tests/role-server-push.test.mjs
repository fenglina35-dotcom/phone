import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
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
const nativeBridge = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'PhoneNativeBridge.swift'), 'utf8');

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
  profile.recent_context = '2026/8/27 09:03:00 [微信]North：你问我咋了？\n2026/8/27 09:03:08 [微信]小北：现在是早上九点零三分。';
  assert.deepEqual(recent(profile), ['现在是早上九点零三分。'],'channel labels must not hide foreground replies from server repetition checks');
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
  const recent = functionSource('roleServerPushRecentContext');
  assert.match(profile, /roleName/);
  assert.match(profile, /persona/);
  assert.match(profile, /slice\(0,1200\)/);
  assert.match(profile, /recentContext:roleServerPushRecentContext\(c\)/);
  assert.match(profile, /memoryContext:roleServerPushMemoryContext\(c\)/);
  assert.match(profile, /lastUserAt:roleServerPushLastActivityAt\(c\)\|\|roleServerPushLastUserAt\(c\)/);
  assert.match(profile, /enabled:roleServerPushEffectiveEnabled\(c\)/);
  assert.match(profile, /messageMin:min,messageMax:max/);
  assert.match(recent, /filter\(x=>x\.channel==='online'\)\.slice\(-40\)/,'the forty-message limit applies after non-WeChat rows are separated');
  assert.match(recent, /filter\(x=>x\.channel==='cohab'\)\.slice\(-12\)/);
  assert.match(recent, /\[电话连续性\]/);
  assert.match(recent, /\[共同生活连续性\]/);
  assert.match(recent, /\[最新用户发言渠道\]/);
  assert.match(recent, /slice\(-8000\)/);
  assert.match(recent, /roleOnlineLiveStateText\(c\)/);
  assert.doesNotMatch(functionSource('roleServerPushEffectiveEnabled'), /roleOnlineProactiveBlocked/,'temporary live states must not persistently disable the server profile');
  assert.match(functionSource('roleServerAutomationConfig'), /suspended/,'temporary non-cohabitation live states remain a reversible server-side suspension');
  assert.match(functionSource('roleServerAutomationConfig'), /roleServerPushDeliveryBlocked\(c\.id\)/);
  assert.doesNotMatch(functionSource('roleServerAutomationConfig'), /cohabOnlineQuiet/,'cohabitation must not suspend companion background generation');
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
  assert.match(edgeFunctionSource('roleRecentTurnBoundary'), /微信\|共同生活\|电话/,'the server must parse the channel-qualified boundary emitted by the current client');
  assert.match(edge, /turnBoundary\.pending \?/);
});

test('scheduled proactive contact never calls a model for a genuinely pending user turn', () => {
  const source = edgeFunctionSource('roleMessage');
  const preflight = source.indexOf('if (ordinaryProactive && turnBoundary.pending) return { kind: "silent", body: "" };');
  const providerLoop = source.indexOf('for (const provider of providers)');
  assert.ok(preflight >= 0 && preflight < providerLoop, 'the pending-turn guard must run before every paid provider request');
});

test('server and client reject leaked reasoning without hiding normal proactive messages', () => {
  const serverSource = edgeFunctionSource('roleModelOutputLeak').replace('value: string', 'value');
  const serverUnsafe = Function(`${serverSource}\nreturn roleModelOutputLeak;`)();
  const clientUnsafe = Function(`const roleVisibleEnvelopeText=value=>String(value==null?'':value).trim();\n${functionSource('wechatReasoningLeak')}\n${functionSource('roleServerPushUnsafeBody')}\nreturn roleServerPushUnsafeBody;`)();
  const leaked = `I need to carefully analyze the situation:\nThe user's last message still hasn't been properly replied to?\nBut the instruction says: "用户最近一条共同生活消息尚未得到角色回复".\nThe key instruction: "本次正式随机主动联系必须保持安静".`;
  for (const guard of [serverUnsafe, clientUnsafe]) {
    assert.equal(guard(leaked), true, 'the exact screenshot-style reasoning dump is blocked');
    assert.equal(guard('<指令解析>\n用户输入：“不是！”\n结合上下文\n分析：角色应该继续追问。'), true, 'Chinese instruction analysis from weak models is blocked');
    assert.equal(guard('刚忙完，想问你现在好一点没有。'), false, 'an ordinary direct role message remains visible');
    assert.equal(guard('我认真分析了一下，还是想先听你说。'), false, 'an ordinary use of the word analysis is not over-blocked');
    assert.equal(guard('[图片|窗边的一杯热茶]'), false, 'a valid proactive image action remains available');
  }
  assert.match(edge, /roleModelOutputLeak\(text\)/);
  assert.match(functionSource('roleServerPushParts'), /roleServerPushUnsafeBody\(body\)/);
  assert.match(functionSource('roleServerPushVisibleBody'), /roleServerPushUnsafeBody\(body\)/);
});

test('a real cohabitation reply overrides a stale pending boundary marker', () => {
  const source = edgeFunctionSource('roleRecentTurnBoundary')
    .replace('profile: Record<string, unknown>', 'profile')
    .replace('const turns: Array<{ speaker: string; channel: string }> = [];', 'const turns = [];');
  const boundary = Function(`${source}\nreturn roleRecentTurnBoundary;`)();
  const answered = boundary({
    user_name: 'North', role_name: '先生^^',
    recent_context: '2026/8/29 12:21:00 [共同生活]North：主人……\n2026/8/29 15:28:00 [共同生活]先生^^：再叫一次。\n[对话边界] 用户最近一条共同生活消息尚未得到角色回复。正式随机主动联系必须保持安静。',
  });
  assert.equal(answered.pending, false, 'the transcript proves the cohabitation turn was answered');
  const pending = boundary({
    user_name: 'North', role_name: '先生^^',
    recent_context: '2026/8/29 12:21:00 [共同生活]North：主人……\n[对话边界] 用户最近一条共同生活消息尚未得到角色回复。正式随机主动联系必须保持安静。',
  });
  assert.equal(pending.pending, true, 'an actually unanswered cohabitation turn still blocks random contact');
});

test('online proactive output rejects cohabitation scene narration conservatively', () => {
  const source = edgeFunctionSource('roleOnlineNarrationInvalid')
    .replace('value: string', 'value')
    .replace('roleName = ""', 'roleName = ""');
  const invalid = Function('roleVisibleMessageText', `${source}\nreturn roleOnlineNarrationInvalid;`)((value) => String(value || ''));
  assert.equal(invalid('他没有急着开口，只是看了她几秒。', '先生^^'), true);
  assert.equal(invalid('刚忙完，想问你现在好一点没有。', '先生^^'), false);
  assert.equal(invalid('她今天又来找你了吗？', '先生^^'), false, 'a direct question about a real third party is not mistaken for scene narration');
  assert.match(edge, /本次输出只会进入线上微信/);
});

test('foreground replies cancel a racing server handoff before generation and before delivery', () => {
  const completed = edgeFunctionSource('replyHandoffAlreadyCompleted');
  assert.match(completed, /latestActivity > baseline \+ 1000/);
  assert.match(completed, /微信\|共同生活\|电话/);
  const firstGuard = edge.indexOf('task.kind === "reply_handoff" && replyHandoffAlreadyCompleted(profile, baseline)');
  const generation = edge.indexOf('const decision = await roleMessage(', firstGuard);
  const finalGuard = edge.indexOf('replyHandoffAlreadyCompleted(currentProfile, baseline)', generation);
  const delivery = edge.indexOf('const backgroundDelivered =', generation);
  assert.ok(firstGuard >= 0 && firstGuard < generation,'a completed foreground reply must cancel the fallback before it spends another model call');
  assert.ok(finalGuard > generation && finalGuard < delivery,'a foreground reply finishing during the fallback model call must still prevent duplicate delivery');
});

test('foreground chat hands off quickly only after the app actually backgrounds', () => {
  const prepare = functionSource('roleBackgroundPrepare');
  const flush = functionSource('roleBackgroundFlush');
  const resume = functionSource('roleBackgroundResumeForeground');
  const localActive = functionSource('roleBackgroundLocalReplyActive');
  assert.match(prepare, /kind!=='reply_handoff'/,'ordinary visible chat keeps only a local fallback marker');
  assert.match(prepare, /document\.hidden[\s\S]{0,180}Date\.now\(\)\+5000/,'an already hidden page may hand off immediately');
  assert.match(flush, /Date\.now\(\)\+5000/,'a real background transition activates the fast server handoff');
  assert.match(localActive, /replyGenerationBusy\(id\)/,'a genuinely live local generation can take ownership again');
  assert.match(localActive, /_replyTimers&&_replyTimers\[key\]/,'a queued local foreground reply also counts as live');
  assert.match(localActive, /role==='assistant'[\s\S]{0,180}baseline\+1000/,'an already persisted foreground answer can safely cancel the handoff');
  assert.match(resume, /!roleBackgroundLocalReplyActive\(id,row\)\)return/,'a dead local reply must leave the only server handoff alive');
  assert.match(resume, /phone_role_background_cancel/,'a live or persisted local reply cancels the remote fallback before it can spend another call');
  assert.match(app, /visibilitychange[\s\S]{0,1200}else\{roleBackgroundResumeForeground\(\)/);
});

test('manual unlock messages address the current partner instead of narrating her in third person', () => {
  const guard = edgeFunctionSource('roleManualUnlockPerspectiveInvalid');
  assert.match(guard, /亲自成功解锁App/);
  assert.match(guard, /她\|他\|用户/);
  const executableGuard = guard
    .replace('value: string', 'value')
    .replace('eventInstruction: string', 'eventInstruction');
  const perspectiveInvalid = Function(`function roleVisibleMessageText(value){return String(value||'');}\n${executableGuard}\nreturn roleManualUnlockPerspectiveInvalid;`)();
  const unlockInstruction = '你收到了当前聊天对象本人亲自成功解锁App的真实记录。';
  assert.equal(perspectiveInvalid('她把抖音自己解锁了。', unlockInstruction), true, 'the screenshot narration is rejected before delivery');
  assert.equal(perspectiveInvalid('你解锁抖音了。', unlockInstruction), false, 'a direct message to the current partner remains valid');
  assert.equal(perspectiveInvalid('她刚下班。', '普通主动消息'), false, 'the guard cannot affect ordinary role messages');
  assert.match(edge, /eventPerspectiveInvalid = roleManualUnlockPerspectiveInvalid\(body, eventInstruction\)/);
  assert.match(edge, /!styleInvalid && !eventPerspectiveInvalid/);
  const fallbackSource = edgeFunctionSource('roleManualUnlockFallback')
    .replace('eventContext: string', 'eventContext')
    .replace('recent: string[]', 'recent');
  const fallback = Function('roleTextKey', `${fallbackSource}\nreturn roleManualUnlockFallback;`)((value) => String(value || '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase());
  const first = fallback('用户亲自手动解锁了抖音，成功记录2026-08-27T10:00:00Z', []);
  const second = fallback('用户亲自手动解锁了抖音，成功记录2026-08-27T11:00:00Z', [first]);
  assert.match(first, /你.*抖音|抖音.*你/);
  assert.notEqual(second, first, 'a later real unlock gets a different visible fallback if the model repeats');
  assert.match(edge, /if \(manualUnlockEvent\) return \{ kind: "message", body: roleManualUnlockFallback\(eventContext, repeatCandidates\) \};/);
  assert.ok(
    edge.indexOf('if (manualUnlockEvent) return { kind: "message", body: roleManualUnlockFallback(eventContext, repeatCandidates) };', edge.indexOf('const eventPerspectiveInvalid')) < edge.indexOf('attemptMessages = [', edge.indexOf('const eventPerspectiveInvalid')),
    'a new unlock must become a visible direct message before any paid rewrite'
  );
  assert.match(edge, /不得默认审问/);
});

test('temporary offline states suspend without disabling background contact, while cohabitation stays live', () => {
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
  assert.match(pull, /roleServerPushDeliveryBlocked\(c\.id\)/);
  assert.doesNotMatch(pull, /roleOnlineProactiveBlocked\(c\.id\)/,'already generated companion text must not queue behind cohabitation');
  const deliveryBlock=functionSource('roleServerPushDeliveryBlocked');
  assert.match(deliveryBlock,/offlineWechatLiveState\(c\)/);
  assert.match(deliveryBlock,/roleBusyActive\(c\)/);
  assert.match(deliveryBlock,/focus&&!cohabFocus/);
  assert.doesNotMatch(deliveryBlock,/cohabOnlineQuiet/,'cohabitation alone cannot block durable server text delivery');
  assert.match(pull, /roleServerPushSyncSoon\(c\.id\)/);
  assert.match(pull, /_rolePushId===row\.id/);
  assert.match(pull, /if\(roleServerPushHandoffAlreadyVisible\(c,body,rowAt\)\)\{queueAck\(row,true\);continue;\}/,'a persisted fallback that exactly matches a visible foreground reply is consumed instead of appended');
  assert.doesNotMatch(pull, /triggerKind[\s\S]{0,100}roleServerPushHandoffAlreadyVisible/,'replay protection must not depend on the server task label');
  assert.doesNotMatch(pull, /initiativeRecentlyRepeated\(c\.id,body/);
  assert.match(pull, /roleServerPushParts\(c,body\)/);
  assert.match(pull, /roleServerPushCallKind\(rawBody\)/);
  assert.match(pull, /incomingCall\(c\.id,callKind,\{serverPush:true\}\)/);
  assert.match(app, /window\.__smallPhoneOpenRolePush=async payload/);
  assert.match(app, /window\.__smallPhoneSyncRolePush=async\(\)=>/);
  assert.match(app, /const waits=\[0,900,2200,4500\]/);
  assert.match(pull, /roleServerPushInsertByTime\(list,msg\)/);
  assert.match(pull, /staleArrival/);
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
  assert.match(app, /setInterval\(\(\)=>\{if\(_appBootFinished\)roleServerPushPull\(false\);\},60000\)/);
  assert.match(app, /function privateResumeSyncSoon\(\)[\s\S]{0,360}roleServerPushWakePull\(\)/);
  assert.match(app, /visibilitychange[\s\S]{0,1600}privateResumeSyncSoon\(\)/);
});

test('an exact foreground bubble sequence consumes a late reply handoff without hiding new text', () => {
  const local = [
    { role:'assistant', type:'text', content:'你问我咋了？', time:1000 },
    { role:'assistant', type:'text', content:'现在是早上九点零三分。', time:1900 },
    { role:'assistant', type:'text', content:'你的屏幕使用时间快七个小时了。', time:2800 },
  ];
  const parse = (_c, body) => String(body).split('\n').map(content=>({type:'text',content}));
  const normalize = value => String(value||'').replace(/[\s，。！？、,.!?：:；;“”"'（）()【】\[\]]/g,'').toLowerCase();
  const alreadyVisible = Function('roleServerPushParts','msgs','msgToText','replyDedupNorm','Date',`${functionSource('roleServerPushHandoffAlreadyVisible')};return roleServerPushHandoffAlreadyVisible;`)(parse,()=>local,m=>m.content,normalize,Date);
  assert.equal(alreadyVisible({id:'c1'},local.map(m=>m.content).join('\n'),3000),true);
  assert.equal(alreadyVisible({id:'c1'},'这是此前没有说过的新内容。',3000),false);
});

test('native foreground and delivered role notifications wake the web inbox without requiring a tap', () => {
  assert.match(companionApp, /applicationDidBecomeActive[\s\S]{0,180}requestRolePushSync\(\)/);
  assert.match(companionApp, /didReceiveRemoteNotification[\s\S]{0,520}userInfo\["rolePush"\][\s\S]{0,100}requestRolePushSync\(\)/);
  assert.match(companionApp, /willPresent notification[\s\S]{0,260}userInfo\["rolePush"\][\s\S]{0,100}requestRolePushSync\(\)/);
  assert.match(companionApp, /smallPhone\.pendingRolePushSync\.v1/);
  assert.match(companionApp, /SmallPhoneRolePushSyncRequested/);
  assert.match(localPhoneWebView, /name: Notification\.Name\("SmallPhoneRolePushSyncRequested"\)/);
  assert.match(localPhoneWebView, /syncPendingRolePushIfReady\(\)/);
  assert.match(localPhoneWebView, /callAsyncJavaScript/);
  assert.match(localPhoneWebView, /return await \(window\.__smallPhoneSyncRolePush \? window\.__smallPhoneSyncRolePush\(\) : false\)/);
  assert.match(localPhoneWebView, /arguments: \[:\],[\s\S]{0,100}in: nil,[\s\S]{0,100}in: \.page,[\s\S]{0,100}completionHandler:/,'use the callback API labels already compiled elsewhere in this Xcode project');
  assert.doesNotMatch(localPhoneWebView, /contentWorld: \.page/,'contentWorld plus a trailing closure selects no compatible WebKit overload in the target Xcode toolchain');
  assert.match(localPhoneWebView, /\(value as\? Bool\) == true[\s\S]{0,420}smallPhone\.pendingRolePushSync\.v1/,'the native pending flag clears only after the web pull reports success');
  assert.match(localPhoneWebView, /let delays: \[TimeInterval\] = \[1, 3, 7, 15\]/);
  assert.match(localPhoneWebView, /didFinish navigation[\s\S]{0,520}syncPendingRolePushIfReady\(\)/);
});

test('active calls invalidate ordinary scheduled pushes and restart quiet time at hangup', () => {
  const started=functionSource('roleServerPushCallStarted');
  const ended=functionSource('roleServerPushCallEnded');
  const renew=functionSource('roleServerPushCallLeaseRenew');
  const pull=functionSource('roleServerPushPull');
  assert.match(started,/roleServerPushCallLeaseRenew\(id\)/,'starting a call immediately renews the server-side suspension lease');
  assert.match(started,/setInterval[\s\S]{0,240}4\*60000/,'long and quiet calls renew the suspension before its server lease expires');
  assert.match(renew,/roleServerPushTouchActivity\(id,Date\.now\(\),true\)/,'a live call continuously counts as real interaction');
  assert.match(renew,/roleServerPushSyncSoon\(id\)/,'the server profile continuously carries the live-call suspension state');
  assert.match(ended,/roleServerPushTouchActivity\(id,Date\.now\(\),true\)/,'hangup starts a fresh inactivity window');
  assert.match(ended,/clearInterval\(_roleServerCallLeaseTimers\[id\]\)/,'hangup stops the call lease');
  assert.doesNotMatch(ended,/roleServerPushWakePull/,'hangup must not flush old proactive rows into chat');
  assert.match(pull,/activeRoleCall[\s\S]{0,180}String\(row\.triggerKind\|\|''\)==='scheduled'[\s\S]{0,180}queueAck\(row,true\);continue/,'a scheduled row racing with the active call is consumed without becoming a chat message');
  assert.match(functionSource('restoreActiveCall'),/roleServerPushCallStarted\(p\.id\)/,'a restored background call reinstates the server suspension before normal operation resumes');
  assert.match(nativeBridge,/case "call\.pip\.start":[\s\S]{0,180}roleCallActiveDefaultsKey/);
  assert.match(nativeBridge,/case "call\.pip\.end":[\s\S]{0,180}false,[\s\S]{0,100}roleCallActiveDefaultsKey/);
  assert.match(companionApp,/willPresent notification[\s\S]{0,520}roleCallActiveDefaultsKey[\s\S]{0,300}return \[\]/,'foreground role push has no banner, list item or sound during the call');
  assert.match(companionApp,/didFinishLaunchingWithOptions[\s\S]{0,420}false,[\s\S]{0,100}roleCallActiveDefaultsKey/,'a crash or force quit cannot leave notifications permanently muted');
});

test('server suspension happens before scheduled model generation and does not block call speech', () => {
  const scheduledStart=edge.indexOf('const profiles = Array.isArray(due)');
  assert.notEqual(scheduledStart,-1);
  const scheduled=edge.slice(scheduledStart);
  const firstSuspend=scheduled.indexOf('if (profileTemporarilySuspended(freshProfile))');
  const generation=scheduled.indexOf('const decision = await roleMessage(profile');
  const latestSuspend=scheduled.indexOf('profileTemporarilySuspended(latestProfile)',generation);
  assert.ok(firstSuspend>=0&&firstSuspend<generation,'the live-call lease is checked before any scheduled model request can spend balance');
  assert.ok(latestSuspend>generation,'a call beginning during an already in-flight request still prevents an outbox row and notification');
  const silence=functionSource('checkCallSilence');
  const callReply=functionSource('callAI');
  assert.match(silence,/callAI\(/,'the role can still proactively speak inside an active call');
  assert.doesNotMatch(silence,/roleServerPushDeliveryBlocked|roleOnlineProactiveBlocked/,'server background suspension must not silence call-native proactive speech');
  assert.doesNotMatch(callReply,/roleServerPushDeliveryBlocked|roleOnlineProactiveBlocked/,'ordinary foreground call replies stay on their original model path');
});

test('a scheduled push racing with a live call is acknowledged without entering chat', async () => {
  const rpcCalls=[];
  const context=vm.createContext({
    Date,
    Set,
    String,
    Math,
    S:{couple:{cid:'c1'},_rolePushReceipts:[]},
    document:{hidden:false},
    _call:{id:'c1',session:'live-call'},
    gateOK:()=>true,
    isMain:()=>true,
    cloudId:()=>`test-target`,
    companionOwnerSecret:()=>`test-owner`,
    getC:id=>id==='c1'?{id:'c1',deleted:false}:null,
    msgs:()=>[],
    companionTime:value=>Date.parse(value)||0,
    companionRpc:async(name,args)=>{
      rpcCalls.push({name,args});
      if(name==='phone_role_push_pull')return [{id:'push-1',roleId:'c1',triggerKind:'scheduled',createdAt:new Date().toISOString(),body:'旧主动消息'}];
      if(name==='phone_role_push_ack')return true;
      throw new Error(`unexpected rpc ${name}`);
    },
    roleServerPushSyncEnabled:async()=>true,
    saveNowAsync:async()=>true,
    persistWechatMessagesNow:async()=>true,
    roleServerPushLastActivityAt:()=>0,
    roleServerPushNormalizeBody:(_c,value)=>String(value||''),
    roleServerPushCallKind:()=>'',
    roleServerPushVisibleBody:value=>value,
    splitChatBubbles:()=>[],
    roleServerPushActionTag:()=>false,
    roleServerPushParts:()=>[],
    roleServerPushInsertByTime:()=>true,
    roleServerPushDeliveryBlocked:()=>true,
    roleServerPushSyncSoon:()=>{},
    wechatTailJournalWrite:()=>{},
    save:()=>{},
    cur:()=>({p:'chat',id:'c1'}),
    refreshChatMessages:()=>{},
    render:()=>{},
    sleep:async()=>{},
    notifyIncoming:()=>{throw new Error('scheduled push must not notify during a call');},
    showMsgBanner:()=>{throw new Error('scheduled push must not show a banner during a call');},
    playMessageDing:()=>{throw new Error('scheduled push must not play a sound during a call');},
    incomingCall:()=>false,
    offlineFocusActive:()=>false,
    cinemaRoleOccupied:()=>false,
    uid:()=>`id-${Math.random()}`,
    setTimeout:fn=>{fn();return 1;},
  });
  vm.runInContext(`
    let _roleServerPushPullBusy=false,_roleServerPushPullAt=0;
    ${functionSource('roleServerPushReceiptRows')}
    ${functionSource('roleServerPushReceiptHas')}
    ${functionSource('roleServerPushReceiptMark')}
    ${functionSource('roleServerPushReceiptForget')}
    async ${functionSource('roleServerPushPull')}
    this.pull=roleServerPushPull;
  `,context);
  assert.equal(await context.pull(true),true);
  assert.equal(context.S._rolePushReceipts.some(row=>row.id==='push-1'),true,'discarded scheduled row receives a local receipt');
  const ack=rpcCalls.find(call=>call.name==='phone_role_push_ack');
  assert.deepEqual(Array.from(ack?.args?.p_ids||[]),['push-1'],'discarded row is acknowledged server-side instead of waiting for hangup');
  assert.deepEqual(context.msgs('c1'),[],'no chat message is appended');
});

test('a queued reasoning leak is consumed without a bubble, notification, or action', async () => {
  const rpcCalls=[];
  const messages=[];
  const leaked=`I need to carefully analyze the situation:\nThe user's last message still hasn't been properly replied to?\nBut the instruction says: "用户最近一条共同生活消息尚未得到角色回复".\nThe key instruction: "本次正式随机主动联系必须保持安静".`;
  const context=vm.createContext({
    Date,Set,String,Math,S:{couple:{cid:'c1'},_rolePushReceipts:[]},document:{hidden:false},_call:null,
    gateOK:()=>true,isMain:()=>true,cloudId:()=>`test-target`,companionOwnerSecret:()=>`test-owner`,
    getC:id=>id==='c1'?{id:'c1',deleted:false,msgMax:4}:null,msgs:()=>messages,
    companionTime:value=>Date.parse(value)||0,
    companionRpc:async(name,args)=>{rpcCalls.push({name,args});if(name==='phone_role_push_pull')return [{id:'push-leak',roleId:'c1',triggerKind:'scheduled',createdAt:new Date().toISOString(),body:leaked}];if(name==='phone_role_push_ack')return true;throw new Error(`unexpected rpc ${name}`);},
    roleServerPushSyncEnabled:async()=>true,saveNowAsync:async()=>true,persistWechatMessagesNow:async()=>true,
    roleServerPushLastActivityAt:()=>0,roleServerPushNormalizeBody:(_c,value)=>String(value||''),
    splitChatBubbles:value=>String(value||'').split(/\n+/).filter(Boolean),roleServerPushActionTag:()=>false,
    lineToMsgs:()=>{throw new Error('unsafe text must be empty before bubble parsing');},
    roleServerPushHandoffAlreadyVisible:()=>false,roleServerPushApplyAction:async()=>{throw new Error('unsafe text must not execute an action');},
    roleServerPushInsertByTime:()=>{throw new Error('unsafe text must not enter chat');},roleServerPushDeliveryBlocked:()=>false,
    roleServerPushSyncSoon:()=>{},wechatTailJournalWrite:()=>{},save:()=>{},cur:()=>({p:'chat',id:'c1'}),refreshChatMessages:()=>{},render:()=>{},sleep:async()=>{},
    notifyIncoming:()=>{throw new Error('unsafe text must not notify');},showMsgBanner:()=>{throw new Error('unsafe text must not show a banner');},playMessageDing:()=>{throw new Error('unsafe text must not ding');},
    incomingCall:()=>false,offlineFocusActive:()=>false,cinemaRoleOccupied:()=>false,uid:()=>`id-${Math.random()}`,setTimeout:fn=>{fn();return 1;},
  });
  vm.runInContext(`
    let _roleServerPushPullBusy=false,_roleServerPushPullAt=0;
    const roleVisibleEnvelopeText=value=>String(value==null?'':value).trim();
    ${functionSource('wechatReasoningLeak')}
    ${functionSource('roleServerPushUnsafeBody')}
    ${functionSource('roleServerPushCallKind')}
    ${functionSource('roleServerPushVisibleBody')}
    ${functionSource('roleServerPushParts')}
    ${functionSource('roleServerPushReceiptRows')}
    ${functionSource('roleServerPushReceiptHas')}
    ${functionSource('roleServerPushReceiptMark')}
    ${functionSource('roleServerPushReceiptForget')}
    async ${functionSource('roleServerPushPull')}
    this.pull=roleServerPushPull;
  `,context);
  assert.equal(await context.pull(true),true);
  assert.deepEqual(messages,[]);
  assert.equal(context.S._rolePushReceipts.some(row=>row.id==='push-leak'),true);
  const ack=rpcCalls.find(call=>call.name==='phone_role_push_ack');
  assert.deepEqual(Array.from(ack?.args?.p_ids||[]),['push-leak']);
});

test('the latest real user channel and activity include WeChat, completed calls and co-living', () => {
  const context=vm.createContext({
    S:{me:{name:'我'},cohabitation:{homes:{c1:{msgs:[{who:'me',text:'共同生活最后一句',time:400}]}}}},
    msgs:()=>[
      {role:'user',type:'text',content:'微信旧消息',time:100},
      {role:'assistant',type:'text',content:'微信回复',time:200},
      {role:'user',type:'text',content:'电话里说过',time:300,_call:true,_cs:'s1'},
    ],
    msgToText:m=>m.content||'',msgClearTime:m=>m.time||0,String,
  });
  vm.runInContext(`${functionSource('roleInteractionRows')}${functionSource('roleLatestUserChannel')}${functionSource('roleServerPushLastActivityAt')}this.latest=roleLatestUserChannel;this.activity=roleServerPushLastActivityAt;`,context);
  assert.equal(context.latest({id:'c1'},'online'),'cohab');
  assert.equal(context.activity({id:'c1'}),400);
  context.S.cohabitation.homes.c1.msgs.push({who:'ta',text:'共同生活角色回应',time:450});
  assert.equal(context.latest({id:'c1'},'online'),'cohab','a role response must not change the destination chosen from the latest user message');
  assert.equal(context.activity({id:'c1'}),450,'role replies also reset the no-interaction clock');
});

test('ordinary server contact uses the live backend clock and the 30/60-minute topic boundary', () => {
  const roleMessage=edgeFunctionSource('roleMessage');
  assert.match(roleMessage, /const clock = localClock\(String\(profile\.timezone \|\| "Asia\/Shanghai"\)\)/);
  assert.match(roleMessage, /当地时间：\$\{clock\.day\}/);
  assert.match(roleMessage, /ordinaryProactive = false/);
  assert.match(roleMessage, /silenceMinutes < 60/);
  assert.match(roleMessage, /只能自然承接最近一轮话题/);
  assert.match(roleMessage, /超过一小时，可以按角色本人意愿自然换话题/);
  assert.match(roleMessage, /除明确睡眠外，本次不允许输出 \[保持安静\]/);
  assert.match(edge, /roleMessage\(profile, recentBodies, ambientInstruction, ambientFacts, true, true\)/);
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
