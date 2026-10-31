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

test('private v1355 inherits the current web theater without dropping its private shell',()=>{
  assert.equal(bundleTheater,theater);
  assert.match(bundleTheater,/guest2|ct_wechat_enabled/);
  assert.match(webHtml,/app\.js\?v=1868[^\n]*<\/script>\s*<script src="cohab-theater\.js\?v=1868&r=v1274-web-cohab-guests-1"/);
  for(const html of [privateHtml,privateAlias])assert.match(html,/app\.js\?v=1872[^\n]*<\/script>\s*<script src="private-reply-intercept\.js\?v=1872[^\n]*<\/script>\s*<script src="cohab-theater\.js\?v=1872&r=v1274-web-cohab-guests-1"/);
  assert.match(read('sw.js'),/cohab-theater\.js\?v='\+BUILD\+'\&r=v1274-web-cohab-guests-1',kind:'theater'/);
});

test('cast storage has two distinct WeChat guest slots and one temporary-extra slot',()=>{
  assert.match(theater,/\['guest','guest2'\]/);
  assert.match(theater,/theaterGuestEntry\(t,kind\)/);
  assert.match(theater,/if\(t\.extra\)\{/);
  assert.doesNotMatch(theater,/guests\s*=|extras\s*=/);
  assert.match(theater,/filter\(x=>x&&!x\.deleted&&!x\.blocked&&x\.id!==id\)/);
  assert.match(theater,/最多两名微信来客和一名临时路人/);
  assert.match(theater,/ct_wechat_enabled/);
});

test('temporary presence is separate from permanent dismissal and reuses the original manual reply button',()=>{
  assert.match(theater,/t\.presence=\{\}/);
  assert.match(theater,/function cohabTheaterPresence\(/);
  assert.match(theater,/暂时离场保留人物/);
  assert.match(theater,/offReply=function\(\).*cohabTheaterContinue/s);
  assert.match(theater,/for\(const kind of kinds\)/);
  assert.match(theater,/主角只生成自己的一轮，完成后立即停止/);
  assert.doesNotMatch(theater,/onclick="cohabTheaterContinue\('/);
  assert.match(theater,/点上方原有“让TA回”/);
  assert.match(theater,/if\(theaterGuestKind\(leave\)\|\|leave==='extra'\)cohabTheaterPresence/);
});

test('speaker identity survives repair, rendering, timeline and memory context',()=>{
  assert.match(theater,/\['me','ta','guest','guest2','extra','旁白','日期'\]/);
  assert.match(theater,/theaterGuestKind\(row\.who\)\)row\.actorType=row\.who/);
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
  assert.match(theater,/castHistory=messages\.some\(m=>\/\^\(guest\|guest2\|extra\)\$\/\.test\(theaterActorKind\(m\)\)\)/);
  assert.match(theater,/if\(!t\.enabled&&!castHistory\)return baseRenderCohab\(id\)/);
  assert.match(theater,/keepCastName=active\|\|theaterGuestKind\(kind\)\|\|kind==='extra'/);
  assert.match(theater,/label=active\?theaterBubbleLabel\(who\):''/);
});

test('host and support use separate generations in selected addressee order',()=>{
  assert.match(theater,/const baseOffAI=offAI/);
  assert.doesNotMatch(theater,/baseCohabReplyCore|cohabReplyCore=async/);
  assert.match(theater,/supportFirst=kind&&\(theaterGuestKind\(target\)\|\|target==='extra'\)/);
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
  const activeOffAI=theater.slice(theater.lastIndexOf('offAI=async function(note){'),theater.indexOf('async function cohabTheaterContinue'));
  const supportTurn=activeOffAI.slice(activeOffAI.indexOf('if(supportFirst){'),activeOffAI.indexOf('const before=',activeOffAI.indexOf('if(supportFirst){')));
  assert.doesNotMatch(supportTurn,/t\.activeActor='host';offRender\(\);\}\}[^]*?_off\.busy=false[^]*?await baseOffAI\(note\)/,
    'support-to-host handoff must not reopen the composer before the same round finishes');
  assert.match(supportTurn,/await baseOffAI\(note\)[^]*?if\(_off&&_off\.id===id\)_off\.busy=false/,
    'the whole support-first round releases the composer only after the host continuation');
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
  assert.match(theater,/for\(const \[index,kind\] of \['guest','guest2'\]\.entries\(\)\)/);
  assert.match(theater,/if\(g&&!g\.joinedSeq\)\{/);
  assert.match(theater,/if\(!t\.enabled&&!castHistory\)return baseRenderCohab\(id\)/);
  assert.match(theater,/if\(!t\.enabled\)return baseOffSay\(e\)/);
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

test('private artifact identity advances independently to v1355 and iOS 1.0.400 (399)',()=>{
  assert.match(privateApp,/const APP_VER='v1872 · 外卖编单与电量提醒'/);
  assert.match(privateHtml,/private-runtime-diagnostics\.js\?v=339/);
  assert.match(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'),/1\.0\.518 \(518\)/);
  const project=read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
  assert.ok((project.match(/CURRENT_PROJECT_VERSION = 518;/g)||[]).length>=12);
  assert.ok((project.match(/MARKETING_VERSION = 1.0.518;/g)||[]).length>=12);
});

test('v1170 private friend-entry fix remains present in the v1184 private superset',()=>{
  assert.match(privateApp,/function pfEnsureForSync\(/);
  assert.match(privateApp,/profileDeferred=await pfEnsureForSync/);
  assert.doesNotMatch(read('app.js'),/function pfEnsureForSync\(/);
});


test('actual web/private continuation arrow follows pending taps even with theater disabled and old guest history',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const priv of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:8778')return route.abort();const f=path.resolve(decodeURIComponent(u.pathname.slice(1))),ok=f.startsWith(root+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile();return route.fulfill({status:ok?200:404,body:ok?fs.readFileSync(f):'',contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});});
  await page.goto('http://127.0.0.1:8778/'+(priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  for(const kind of ['ordinary','history-only','theater']){
   const out=await page.evaluate(async kind=>{
    cohabTapRelease();S.me.locked=false;S.me.active='main';S.contacts.forEach(c=>c.proactive={enabled:false});const id=S.contacts[0].id,r=cohabRoot();r.enabled=true;r.paused=false;r.cid=id;const d=cohabData(id);d.phase='home';d.nextAt=Date.now()+86400000;d.theater={enabled:kind==='theater'};d.settings.tapAdvance=true;
    d.msgs=(kind==='history-only'?[{id:'old-guest',who:'guest',text:'以前来过，现在已离开',time:Date.now()-86400000,displayNameSnapshot:'旧来客'}]:[]).concat([{id:'pending-host',who:'ta',text:'普通生活的较长回复。'.repeat(40),time:Date.now()}]);
    _off={id,mode:'cohab',busy:false};_offSel=null;stack=[{p:'home'},{p:'off',id,mode:'cohab'}];render();const original=JSON.stringify(d.msgs);let released=0;cohabTapWait(id,d.msgs.at(-1),{reveal:0}).then(()=>released++);await new Promise(r=>setTimeout(r,650));
    const box=document.querySelector('#offbg'),arrow=box.querySelector('.cohab-tap-next'),rect=arrow&&arrow.getBoundingClientRect(),br=box.getBoundingClientRect();const pending={exists:!!arrow,one:box.querySelectorAll('.cohab-tap-next').length===1,visible:!!rect&&rect.top>=br.top&&rect.bottom<=br.bottom,parent:arrow&&arrow.parentElement===box};
    if(arrow)arrow.remove();cohabTapIndicatorSync();const restored=box.querySelectorAll('.cohab-tap-next').length===1;_offSel=[];cohabTapIndicatorSync();const selectionHidden=!box.querySelector('.cohab-tap-next');_offSel=null;cohabTapIndicatorSync();d.phase='away';offRender();const awayHidden=!document.querySelector('.cohab-tap-next');d.phase='home';offRender();const bubble=document.querySelector('.offbubble');if(bubble)bubble.click();await new Promise(r=>setTimeout(r,30));const result={pending,restored,selectionHidden,awayHidden,released,ended:!document.querySelector('.cohab-tap-next'),unchanged:JSON.stringify(d.msgs)===original,menuIntact:!!document.querySelector('[onclick*="offMsgMenu"]')};cohabTapRelease();return result;
   },kind);
   assert.equal(out.pending.exists,true,`${priv?'private':'web'} ${kind}: missing continuation arrow`);assert.equal(out.restored,true);assert.equal(out.selectionHidden,true);assert.equal(out.awayHidden,true);assert.equal(out.pending.one,true);assert.equal(out.pending.visible,true);assert.equal(out.pending.parent,true);assert.equal(out.released,1);assert.equal(out.ended,true);assert.equal(out.unchanged,true);assert.equal(out.menuIntact,true);
  }
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});
