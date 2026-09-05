import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const theater=read('cohab-theater.js');
const bundleTheater=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/cohab-theater.js');
const webHtml=read('小手机.html');
const privateHtml=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html');
const privateAlias=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html');
const privateApp=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');

test('v1178 shared theater asset is byte-identical and loaded after app core',()=>{
  assert.equal(bundleTheater,theater);
  assert.match(webHtml,/app\.js\?v=1179[^\n]*<\/script>\s*<script src="cohab-theater\.js\?v=1179&r=v1179-format-bead-fix-1"/);
  for(const html of [privateHtml,privateAlias])assert.match(html,/app\.js\?v=1179[^\n]*<\/script>\s*<script src="private-reply-intercept\.js\?v=1179[^\n]*<\/script>\s*<script src="cohab-theater\.js\?v=1179&r=v1179-format-bead-fix-1"/);
  assert.match(read('sw.js'),/cohab-theater\.js\?v='\+BUILD\+'\&r=v1179-format-bead-fix-1',kind:'theater'/);
});

test('cast storage has exactly one host guest slot and one temporary-extra slot',()=>{
  assert.match(theater,/t\.guest&&\(!t\.guest\.contactId/);
  assert.match(theater,/if\(t\.extra\)\{/);
  assert.doesNotMatch(theater,/guests\s*=|extras\s*=/);
  assert.match(theater,/filter\(x=>x&&!x\.deleted&&!x\.blocked&&x\.id!==id\)/);
  assert.match(theater,/最多一名微信来客和一名临时路人/);
});

test('speaker identity survives repair, rendering, timeline and memory context',()=>{
  assert.match(theater,/\['me','ta','guest','extra','旁白','日期'\]/);
  assert.match(theater,/row\.who==='guest'\)row\.actorType='guest'/);
  assert.match(theater,/displayNameSnapshot/);
  assert.match(theater,/speaker=actor==='me'\?'user':actor==='host'\?'assistant':'event'/);
  assert.match(theater,/每个署名都是独立人物，不能把来客台词归给主角/);
  assert.match(theater,/theaterBubbleLabel\(theaterSpeaker\(o,m,c\)\)/);
});

test('pair relationships remain configurable while original bubble templates stay untouched',()=>{
  for(const field of ['ct_host_rel','ct_guest_me','ct_guest_host','ct_extra_me','ct_extra_host'])assert.ok(theater.includes(field));
  assert.doesNotMatch(theater,/theaterColorField|type="color"|cohab-theater-colors|cohab-theater-color/);
  assert.doesNotMatch(theater,/THEATER_COLORS|colorSnapshot|t\.colors/);
  assert.doesNotMatch(theater,/style="background:\$\{esc\(color\)\}/);
  assert.match(theater,/<div class="bubble offbubble">\$\{cb\}/);
});

test('every theater bubble and actor action shows only the saved remark',()=>{
  assert.match(theater,/function theaterBubbleLabel\(name\)\{return `<small class="cohab-speaker">\$\{esc\(name\)\}<\/small>`;\}/);
  assert.match(theater,/const actor=keepCastName\?theaterSpeaker\(o,m,c\):''/);
  assert.match(theater,/cohab-narrator-name">\$\{esc\(actor\)\}<\/small>/);
  assert.doesNotMatch(theater,/theaterBubbleLabel\([^)]*,role\)/);
  assert.doesNotMatch(theater,/theaterSpeaker\(o,m,c\)\+' · 动作'/);
  assert.doesNotMatch(theater,/\$\{esc\(name\)\} · \$\{esc\(role\)\}/);
});

test('disabled theater preserves only historical support attribution',()=>{
  assert.match(theater,/castHistory=messages\.some\(m=>\/\^\(guest\|extra\)\$\/\.test\(theaterActorKind\(m\)\)\)/);
  assert.match(theater,/if\(!t\.enabled&&!castHistory\)return baseRenderCohab\(id\)/);
  assert.match(theater,/keepCastName=active\|\|kind==='guest'\|\|kind==='extra'/);
  assert.match(theater,/label=active\?theaterBubbleLabel\(who\):''/);
});

test('host and support use separate generations in selected addressee order',()=>{
  assert.match(theater,/const baseOffAI=offAI/);
  assert.doesNotMatch(theater,/baseCohabReplyCore|cohabReplyCore=async/);
  assert.match(theater,/supportFirst=kind&&\(target==='guest'\|\|target==='extra'\)/);
  assert.match(theater,/addressTo:t\.addressTo,addressNameSnapshot:theaterAudienceName\(o,t\.addressTo\)/);
  assert.match(theater,/const turn=theaterTurnTarget\(d,t,note\),target=turn\.target/);
  assert.match(theater,/_theaterTurnTargets\.set\(id,target\)/);
  assert.match(theater,/_theaterTurnTargets\.delete\(id\)/);
  assert.match(theater,/if\(lead\)_theaterHostLead\.set\(id,lead\)/);
  assert.match(theater,/await baseOffAI\(note\)/);
  assert.match(theater,/if\(!hostRows\.length\)\{t\.activeActor='';offRender\(\);return;\}/);
  assert.match(theater,/await theaterRevealActorItems\(id,d,t,actor\)/);
  assert.doesNotMatch(theater,/result\.items=.*actor\.items/);
  assert.doesNotMatch(theater,/hostSupportTurns%3/);
  assert.match(theater,/supportBubbleLimit=Math\.max\(1,Math\.min\(6/);
  assert.match(theater,/items:items\.slice\(0,t\.supportBubbleLimit\)/);
  assert.match(theater,/台词总字数不能超过主角/);
  assert.match(theater,/动作和台词合计最多/);
  assert.match(theater,/本次请求只生成你自己/);
  assert.match(theater,/这次请求只生成主角/);
  assert.match(read('app.js'),/const item=items\[i\],timing=offRevealTiming\(item\)/);
  assert.doesNotMatch(theater,/cohabPushMessage\(d,\{id:uid\(\),who:kind/);
});

test('compact addressee pill sits right of manual reply and shows only the current target',()=>{
  assert.match(theater,/cohab-debug-reply cohab-theater-reply/);
  assert.match(theater,/right:124px/);
  assert.match(theater,/\.cohab-theater-target\{[^}]*right:11px/);
  assert.doesNotMatch(theater,/<span>对谁说<\/span>/);
});

test('a cast member configured while disabled is only pending and cannot absorb two-person history',()=>{
  assert.match(theater,/joinedSeq:t\.enabled\?\(\+d\.msgSeq\|\|0\)\+1:0,joinedAt/);
  assert.match(theater,/if\(!g\.joinedSeq\|\|!g\.joinedAt\)\{save\(\)/);
  assert.match(theater,/if\(t\.guest&&!t\.guest\.joinedSeq\)\{/);
  assert.match(theater,/if\(!t\.enabled&&!castHistory\)return baseRenderCohab\(id\)/);
  assert.match(theater,/if\(!t\.enabled\)return baseOffSay\(\)/);
});

test('guest exit summary is idempotent, first-person and saved only to that guest',()=>{
  assert.match(theater,/summaryList\(guest\)\.find\(x=>x&&x\.cohabGuestEpisodeId===episode\.episodeId\)/);
  assert.match(theater,/summaryList\(guest\)\.push\(item\)/);
  assert.match(theater,/“我”只能指你自己/);
  assert.match(theater,/主角是你的“'\+hostCall\+'”/);
  assert.match(theater,/界面昵称“'\+hostName\+'”只用于识别人/);
  assert.match(theater,/不能写入你入场前或离场后的事/);
  assert.match(theater,/_guestSummaryRetryTimers=new Map\(\)/);
  assert.doesNotMatch(theater,/summaryList\(host\)\.push/);
});

test('guest exit sends exactly one genuine memory-grounded WeChat message',()=>{
  assert.match(theater,/async function cohabTheaterGuestWechat\(id,episode,memory\)/);
  assert.match(theater,/_cohabGuestExitEpisodeId===episode\.episodeId/);
  assert.match(theater,/主动发一条自然的普通文字消息/);
  assert.match(theater,/只写你本人会发送的一条微信/);
  assert.match(theater,/await chatAPI\(request,opt\)/);
  assert.match(theater,/_cohabGuestExitEpisodeId:episode\.episodeId/);
  assert.match(theater,/await persistWechatMessagesNow\(\)/);
  assert.match(theater,/episode\.status==='done'&&episode\.wechatStatus==='pending'/);
  assert.doesNotMatch(theater,/content:\s*['"](?:我回来了|我都记得)/);
});

test('private artifact identity is v1179 and iOS 1.0.305 (305)',()=>{
  assert.match(privateApp,/const APP_VER='v1179 · 格式与拼图修正版'/);
  assert.match(privateHtml,/private-runtime-diagnostics\.js\?v=305/);
  assert.match(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'),/1\.0\.305 \(305\)/);
  const project=read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
  assert.ok((project.match(/CURRENT_PROJECT_VERSION = 305;/g)||[]).length>=12);
  assert.ok((project.match(/MARKETING_VERSION = 1\.0\.305;/g)||[]).length>=12);
});

test('v1170 private friend-entry fix remains present in the v1179 private superset',()=>{
  assert.match(privateApp,/function pfEnsureForSync\(/);
  assert.match(privateApp,/profileDeferred=await pfEnsureForSync/);
  assert.doesNotMatch(read('app.js'),/function pfEnsureForSync\(/);
});
