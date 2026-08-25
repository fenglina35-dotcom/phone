import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const edge = readFileSync(new URL('../supabase/functions/phone-role-push/index.ts', import.meta.url), 'utf8');
const nativeContent = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/ContentView.swift', import.meta.url), 'utf8');

function functionSource(source, name) {
  const markers = [`function ${name}(`, `async function ${name}(`];
  const start = markers.map(marker => source.indexOf(marker)).filter(index => index >= 0).sort((a, b) => a - b)[0];
  assert.notEqual(start, undefined, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('server automation treats suspension as a lease and does not flood refresh commands', () => {
  const candidate = functionSource(edge, 'automationCandidate');
  assert.match(candidate, /profileTemporarilySuspended\(profile\)/);
  assert.doesNotMatch(candidate, /config\.suspended === true/);
  const latest = functionSource(edge, 'latestAutomationRefreshCommand');
  assert.match(latest, /phone_companion_commands/);
  assert.match(latest, /requestedFocus: "后台自动规则所需的已授权数据"/);
  assert.match(edge, /Math\.max\(\s*snapshotTime\(autoState\.backgroundRefreshAt\),\s*snapshotTime\(recentRefresh\?\.created_at\)/);
});

test('daily checks use the phone timezone and proactive heart-rate care first requests a fresh read', () => {
  const config = functionSource(app, 'roleServerAutomationConfig');
  assert.match(config, /timezone:deviceTimeZone\(\)/);
  const candidate = functionSource(edge, 'automationCandidate');
  assert.match(candidate, /config\.timezone \|\| profile\.timezone/);
  assert.match(candidate, /freshWithin\(health\.generatedAt, 20 \* 60_000\)/);
  const localCare = functionSource(app, 'companionEmotionCareSchedule');
  assert.match(localCare, /queueNativeInspection\(c\.id,lastUser,'iPhone心率'/);
  assert.match(localCare, /onComplete/);
  assert.doesNotMatch(localCare, /companionAutomationFresh\(health\.ts/);
  assert.match(functionSource(app, 'companionHeartCareSignal'), /我没骗你/);
  assert.ok(edge.indexOf('candidate = automationCandidate(profile, (currentLink?.snapshot || {})') < edge.indexOf('const recentRefresh = await latestAutomationRefreshCommand'), 'fresh facts and explicit unlock events must be consumed before requesting another refresh');
});

test('absence checks must visibly contact the user and manual unlock uploads immediately', () => {
  assert.match(edge, /absenceBattery: "[^"]*必须马上采取一种对方可见的行动/);
  assert.match(edge, /禁止保持安静/);
  assert.match(nativeContent, /synchronizeManualUnlockEvent\(\)/);
  assert.match(nativeContent, /CompanionSyncService\.shared\.synchronize/);
  assert.match(nativeContent, /if !lockedAppTokens\.contains\(token\) \{\s*synchronizeManualUnlockEvent\(\)/);
});

test('Moment comment repair keeps the July 30 contextual reply behavior without fake fallbacks', () => {
  const submit = functionSource(app, 'momentCommentSubmit');
  const reply = functionSource(app, 'reactToComment');
  assert.match(submit, /reactToComment\(p,targetCid\|\|'',comment\)/);
  assert.match(reply, /最近的微信私聊上下文/);
  assert.match(reply, /朋友圈下面的评论（按先后顺序）/);
  assert.match(reply, /刚刚在评论区对你说/);
  assert.match(reply, /selectRelevantMemory\(c,query,3\)/);
  assert.match(reply, /selectiveMemory:true/);
  assert.match(reply, /roleBackgroundCancel\(c\.id,\['one_minute_test','app_watch_test'\]\)/);
  assert.match(reply, /modelOptions=\{aux:c\.model==='aux',complete:true,timeout:70000\}/);
  assert.match(reply, /chatAPI\(request,modelOptions\)/);
  assert.match(reply, /\+e\.status===503/);
  assert.doesNotMatch(reply, /看到了|我看到了|收到|知道了|好的|让我想想/);
  assert.equal((reply.match(/await chatAPI\(/g) || []).length, 1, 'July 30 behavior is restored to one direct real reply request');
  assert.match(reply, /_roleReplyStatus='failed'/);
  assert.match(reply, /if\(!txt\).*return;/s);
  assert.ok(reply.indexOf("if(!txt)") < reply.indexOf('live.comments.push'), 'failure must return before any role comment is appended');
  assert.match(functionSource(app, 'momentReplyStatusHTML'), /角色未回复 · 点此重试/);
  assert.doesNotMatch(functionSource(app, 'momentReplyStatusHTML'), /正在回复|正在真实回复/);
  assert.doesNotMatch(functionSource(app, 'momentReplySpecific'), /看到了|收到|知道了|好的|让我想想/);
});

test('the newest role Moment is always the single pinned card', () => {
  assert.match(functionSource(app, 'contactRoleMoments'), /sort\(\(a,b\)=>\(\+b\.time\|\|0\)-\(\+a\.time\|\|0\)\)/);
  const render = functionSource(app, 'renderRoleMoments');
  assert.match(render, /pinned=ms\[0\]\|\|null/);
  assert.match(render, /rest=ms\.slice\(1\)/);
  assert.match(render, /roleMomentCard\(c,pinned,true\)/);
  assert.doesNotMatch(render, /\.pinned|p\.pinned/);
});

test('role avatar opens Chat Details while the bubble keeps the message menu', () => {
  assert.match(app, /else if\(c\.p==='chatDetails'\)html=renderChatDetails\(c\.id\)/);
  const chat = functionSource(app, 'renderChat');
  assert.match(chat, /go\('contactInfo',\{id:'\$\{id\}'\}\)\">⋯/);
  assert.doesNotMatch(chat, /go\('chatDetails',\{id:'\$\{id\}'\}\)\">⋯/);
  const row = functionSource(app, 'bubbleRow');
  assert.match(row, /me\?h:`onclick="event\.stopPropagation\(\);go\('chatDetails'/);
  assert.match(row, /<div class="col" \$\{h\}/);
  assert.match(row, /msgMenu\('\$\{c\.id\}','\$\{m\.id\}'\)/);
});

test('Chat Details reuses the working chat settings and scoped search', () => {
  const details = functionSource(app, 'renderChatDetails');
  for (const action of ['openChatSearch', 'c_mute', 'c_pin', 'setChatBg', 'clearHistory', 'contactReport']) {
    assert.match(details, new RegExp(action));
  }
  assert.match(details, /createGroupWithRole/);
  assert.match(functionSource(app, 'wxSearchRun'), /!scopeId\|\|c\.id===scopeId/);
  assert.match(html, /\.wx-chat-details/);
  assert.match(app, /'wechat','chat','chatDetails','contactInfo'/);
});

test('role WeChat no longer exposes or consumes pat actions', () => {
  const chat = functionSource(app, 'renderChat');
  const system = functionSource(app, 'buildSystem');
  assert.doesNotMatch(chat, /拍一拍|chatPatRole/);
  assert.doesNotMatch(system, /微信支持“拍一拍”|\[拍一拍\]/);
  assert.doesNotMatch(app, /function chatPatRole|function consumeChatPatTags/);
  assert.ok(app.includes("content=String(content||'').replace(/[\\[【]\\s*拍一拍\\s*[\\]】]/g,'')"));
  assert.match(app, /TAGWORDS='[^']*拍一拍/, 'old model tags must remain hidden instead of leaking into chat');
});

test('an explicit request to post the previous announcement photo cannot silently become text-only', () => {
  const referenced = functionSource(app, 'roleMomentReferencedChatImage');
  assert.match(referenced, /上次\|之前\|前面\|刚才\|刚刚\|那张/);
  assert.match(referenced, /官宣照\|图\|图片\|照片/);
  assert.match(referenced, /m\.type==='image'&&m\.src/);
  const explicit = functionSource(app, 'roleMomentExplicitPhotoIntent');
  assert.match(explicit, /朋友圈\|动态\|官宣/);
  assert.match(explicit, /配图\|带图\|照片\|图片\|官宣照\|生图\|生成/);
  const generate = functionSource(app, 'roleMomentGenerateRequestedImage');
  assert.match(generate, /for\(let attempt=0;attempt<2;attempt\+\+\)/);
  assert.match(generate, /await genImage\(prompt,\{roleId:c\.id\}\)/);
  const post = functionSource(app, 'postRoleMoment');
  assert.match(post, /roleMomentReferencedChatImage\(c,opt\)/);
  assert.match(post, /roleMomentGenerateRequestedImage\(c,tx,opt\)\.then/);
  assert.ok(post.indexOf('roleMomentGenerateRequestedImage') < post.indexOf('publishRoleMoment(c,tx,Object.assign'), 'publication must wait for the real image attempt');
  assert.match(app, /function consumeMomentCommands\(content,c,opt\)[\s\S]*?postRoleMoment\(c,body,opt\)[\s\S]*?return stripPostedMomentEcho\(out,posted\);\s*\}/);
  assert.match(app, /consumeMomentCommands\(content,c,\{toast:true,userText:_userText\}\)/);
});

test('remote control visibly enters each exact target instead of tapping one unchanged page', () => {
  const navigate = functionSource(app, 'remoteControlNavigate');
  assert.match(navigate, /app==='moments'.*remoteControlFindMoment\(a\)/s);
  assert.match(navigate, /remoteControlSetPage\('roleMomentDetail',\{id:p\.authorId,pid:p\.id\}\)/);
  assert.match(navigate, /remoteControlSetPage\('xtweet',\{id:a\.targetId\}\)/);
  assert.match(navigate, /remoteControlSetPage\('chat',\{id:role\.id\}\)/);
  const scene = functionSource(app, 'remoteControlScene');
  assert.match(scene, /step=total>0\?/);
  assert.match(scene, /a&&a\.op!=='view'/, 'generic tap animation must not pretend to open view-only targets');
  const focus = functionSource(app, 'remoteControlFocusViewedTarget');
  assert.match(focus, /a\.app==='moments'&&a\.targetType==='moment'/);
  assert.match(focus, /\[data-moment-id\]/);
  assert.match(focus, /a\.app==='douyin'&&a\.targetType==='dyVideo'/);
  assert.match(focus, /scrollIntoView/);
  const run = functionSource(app, 'remoteControlRun');
  assert.match(run, /remoteControlScene\(r,remoteControlStageCaption\(a,r\),i,required\.length,a\);await remoteControlFocusViewedTarget\(a\)/);
});

test('completed Screen Time reading closes its banner and never auto-replays a failed model request', () => {
  const run = functionSource(app, 'cohabRunPhoneInspection');
  const deliver = functionSource(app, 'cohabPhoneDeliverFact');
  const preserve = functionSource(app, 'cohabPhoneFactRetrySchedule');
  const retry = functionSource(app, 'cohabPhoneFactRetryMaybe');
  const tick = functionSource(app, 'cohabPhoneAutonomyTick');
  assert.ok(
    run.indexOf("cohabPhoneProgress(id,'','',false)") < run.indexOf('await cohabPhoneDeliverFact'),
    'the completed banner must close before model reply generation can wait or fail',
  );
  assert.match(deliver, /cohabPhoneFactRetrySchedule\(id,focus,fd,opt\)/);
  assert.match(deliver, /if\(!playback\.length\)/);
  assert.match(preserve, /status:'manual'/);
  assert.doesNotMatch(preserve, /retryAt/);
  assert.doesNotMatch(retry, /cohabPhoneDeliverFact|rolePhoneInspectionAcquire|chatAPI/);
  assert.match(retry, /delete p\.retryAt/);
  assert.match(tick, /await cohabPhoneFactRetryMaybe\(id\)/);
  assert.doesNotMatch(deliver, /假回复|默认回复|随便说|fallback/i);
});
