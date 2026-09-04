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

test('v1171 shared theater asset is byte-identical and loaded after app core',()=>{
  assert.equal(bundleTheater,theater);
  for(const html of [webHtml,privateHtml,privateAlias]){
    assert.match(html,/app\.js\?v=1171[^\n]*<\/script>\s*<script src="cohab-theater\.js\?v=1171&r=v1171-cohab-theater-1"/);
  }
  assert.match(read('sw.js'),/cohab-theater\.js\?v='\+BUILD\+'\&r=v1171-cohab-theater-1',kind:'theater'/);
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
  assert.match(theater,/theaterBubbleLabel\(theaterSpeaker\(o,m,c\),role\)/);
});

test('user, protagonist, guest and extra colors plus pair relationships are configurable',()=>{
  for(const key of ['me','host','guest','extra'])assert.match(theater,new RegExp(`${key}:'#`));
  for(const field of ['ct_host_rel','ct_guest_me','ct_guest_host','ct_extra_me','ct_extra_host'])assert.ok(theater.includes(field));
  for(const field of ['ct_me_color','ct_host_color','ct_guest_color','ct_extra_color'])assert.ok(theater.includes(field));
});

test('support actor can only follow a real protagonist speech and only one actor is selected',()=>{
  assert.match(theater,/hostRows=added\.filter\(m=>theaterActorKind\(m\)==='host'&&m\.who==='ta'\)/);
  assert.match(theater,/if\(!hostRows\.length\|\|!hostChars\)return/);
  assert.match(theater,/slice\(0,Math\.max\(0,Math\.min\(80,\+maxSpeak\|\|0\)\)\)/);
  assert.match(theater,/let kind=.*namedGuest\?'guest':namedExtra\?'extra':''/);
  assert.match(theater,/if\(!kind\)return;_off\.busy=true;t\.activeActor=kind/);
  assert.match(theater,/本轮最多一句/);
  assert.doesNotMatch(theater,/Promise\.all\([^)]*cohabTheaterActorReply/);
});

test('a cast member configured while disabled is only pending and cannot absorb two-person history',()=>{
  assert.match(theater,/joinedSeq:t\.enabled\?\(\+d\.msgSeq\|\|0\)\+1:0,joinedAt/);
  assert.match(theater,/if\(!g\.joinedSeq\|\|!g\.joinedAt\)\{save\(\)/);
  assert.match(theater,/if\(t\.guest&&!t\.guest\.joinedSeq\)\{/);
  assert.match(theater,/if\(!t\.enabled&&!hasCastHistory\)\{/);
  assert.match(theater,/if\(!t\.enabled\)return baseOffSay\(\)/);
});

test('guest exit summary is idempotent, first-person and saved only to that guest',()=>{
  assert.match(theater,/summaryList\(guest\)\.find\(x=>x&&x\.cohabGuestEpisodeId===episode\.episodeId\)/);
  assert.match(theater,/summaryList\(guest\)\.push\(item\)/);
  assert.match(theater,/“我”只能指你自己/);
  assert.match(theater,/不能写入你入场前或离场后的事/);
  assert.match(theater,/_guestSummaryRetryTimers=new Map\(\)/);
  assert.doesNotMatch(theater,/summaryList\(host\)\.push/);
});

test('private artifact identity is v1171 and iOS 1.0.298 (298)',()=>{
  assert.match(privateApp,/const APP_VER='v1171 · 共同生活多人剧场版'/);
  assert.match(privateHtml,/private-runtime-diagnostics\.js\?v=298/);
  assert.match(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'),/1\.0\.298 \(298\)/);
  const project=read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
  assert.ok((project.match(/CURRENT_PROJECT_VERSION = 298;/g)||[]).length>=12);
  assert.ok((project.match(/MARKETING_VERSION = 1\.0\.298;/g)||[]).length>=12);
});

test('v1170 private friend-entry fix remains present in the v1171 private superset',()=>{
  assert.match(privateApp,/function pfEnsureForSync\(/);
  assert.match(privateApp,/profileDeferred=await pfEnsureForSync/);
  assert.doesNotMatch(read('app.js'),/function pfEnsureForSync\(/);
});
