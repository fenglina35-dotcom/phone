import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const root=process.cwd();
const privateBundle='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle';
const read=path=>fs.readFileSync(`${root}/${path}`,'utf8');
const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(`${root}/${path}`)).digest('hex');

test('modern wedding preview v9 is loaded by web and private shells',()=>{
  for(const htmlPath of ['小手机.html',`${privateBundle}/小手机.html`]){
    const html=read(htmlPath);
    assert.match(html,/wedding-game\.css\?v=wedding-dual-17/);
    assert.match(html,/wedding-game\.js\?v=wedding-dual-17/);
  }
});

test('wedding lives only inside offline date and removes its legacy home shortcut',()=>{
  const wedding=read('wedding-game.js'),app=read('app.js');
  assert.doesNotMatch(wedding,/APPDEFS\.wedding=\{/);
  assert.match(wedding,/delete APPDEFS\.wedding/);
  assert.match(wedding,/pg\.filter\(k=>k!=='wedding'\)/);
  assert.match(wedding,/S\.me\.appDock=S\.me\.appDock\.filter\(k=>k!=='wedding'\)/);
  assert.match(wedding,/function weddingOfflineEntryHTML\(\)/);
  assert.match(app,/if\(clean\[1\]\.length>12\)\{clean\[2\]=clean\[1\]\.slice\(12\)\.concat\(clean\[2\]\);clean\[1\]=clean\[1\]\.slice\(0,12\);\}/);
});

test('private bundle stages the current wedding code, shell entries, art and BGM',()=>{
  for(const file of ['wedding-game.js','wedding-game.css'])assert.equal(hash(file),hash(`${privateBundle}/${file}`));
  assert.equal(hash(`${privateBundle}/小手机.html`),hash(`${privateBundle}/index.html`));
  for(const htmlPath of [`${privateBundle}/小手机.html`,`${privateBundle}/index.html`]){
    const html=read(htmlPath);
    assert.match(html,/wedding-game\.css\?v=wedding-dual-17/);
    assert.match(html,/wedding-game\.js\?v=wedding-dual-17/);
  }
  assert.match(read(`${privateBundle}/app.js`),/预约婚礼/);
  assert.match(read(`${privateBundle}/app.js`),/weddingCalendarTick/);
  for(const file of ['welcome.webp','aisle.webp','vow.webp','kiss-hand.webp','ring.webp','embrace.webp','certificate-v2.webp','certificate-v3.webp']){
    const web=`assets/wedding/modern-v1/${file}`,native=`${privateBundle}/${web}`;
    assert.ok(fs.statSync(`${root}/${web}`).size>80_000);
    assert.equal(hash(web),hash(native));
  }
  const bgm='assets/wedding/modern-v1/modern-wedding-bgm.mp3';
  assert.ok(fs.statSync(`${root}/${bgm}`).size>2_000_000);
  assert.equal(hash(bgm),hash(`${privateBundle}/${bgm}`));
});

test('all six CGs use strict scene action contracts and role-specific identity prompts',()=>{
  const js=read('wedding-game.js');
  for(const scene of ['welcome','aisle','vow','kiss','ring','embrace'])assert.match(js,new RegExp(`${scene}:\\{title:`));
  assert.match(js,/新娘第一人称/);
  assert.match(js,/身份锚点/);
  assert.match(js,/不同角色的身份锚点不同，脸与发型设计必须随各自人设变化/);
  assert.match(js,/function weddingAppearanceProfile\(c,style\)/);
  assert.match(js,/function weddingBuildImagePrompt\(c,scene,formalwear,extra,style\)/);
  assert.match(js,/function weddingVerifyImage\(src,c,scene,formalwear,referenceNote,style\)/);
  assert.match(js,/不通过时用一句中文说清最关键错误/);
  assert.match(js,/function weddingRetryFailedScene\(c,scene,formalwear,style\)/);
  assert.match(js,/weddingIdentityReference\(scene,style\)/);
  assert.match(js,/第一幕身份摘要延续同一个新郎/);
  assert.match(js,/具体脸型、五官、发型结构、发冠和礼服必须一模一样/);
});

test('groom attire is model-chosen black or white formalwear and ignores daily clothing',()=>{
  const js=read('wedding-game.js');
  assert.match(js,/formalwear 字段只写 black 或 white/);
  assert.match(js,/整场婚礼固定这一套，不得中途换色/);
  assert.match(js,/正式黑色新郎礼服与正式象牙白新郎礼服中自行选择一种/);
  assert.match(js,/完全忽略人物设定中的日常穿搭/);
  assert.match(js,/,clothes=\/穿搭\|日常穿/);
  assert.match(js,/weddingSceneKey\(c,scene,formalwear,generationId,style\)/);
});

test('generated dialogue is guarded against image/action mismatch',()=>{
  const js=read('wedding-game.js');
  assert.match(js,/const WEDDING_FIELD_SCENES=/);
  assert.match(js,/function weddingLineMatchesScene\(field,text\)/);
  assert.match(js,/field==='kiss_narration'&&!\/手背\//);
  assert.match(js,/field==='ring_narration'/);
  assert.match(js,/field==='vow_narration'/);
  assert.match(js,/function weddingNarrationText\(v,fallback\)/);
  assert.match(js,/const WEDDING_NARRATION_MAX=44,WEDDING_DIALOGUE_MAX=48/);
  assert.match(js,/图片\|画面\|镜头\|构图\|视角\|插画\|CG\|生图\|生成图/);
  assert.match(js,/function weddingFixedNarrations\(style\)/);
  assert.match(js,/fixed=weddingFixedNarrations\('modern'\)/);
  assert.match(js,/locked=k\.includes\('narration'\)\|\|k\.includes\('prompt'\)/);
  assert.match(js,/旁白、司仪词和每一幕的问题已经固定/);
  assert.match(js,/每个对象含 text 和 response/);
  assert.match(js,/两个选项与回应不得串位/);
  assert.match(js,/不要输出 narration、prompt、officiant 或 blessing 字段/);
  assert.match(js,/function weddingLooksNarration\(text\)/);
  assert.match(js,/他的目光/);
  assert.match(js,/for\(const lineKey of roleLines\)if\(weddingLooksNarration/);
  assert.match(js,/out\[lineKey\]=f\[lineKey\]/);
  assert.match(js,/item\.text=weddingDisplayText\(item,s\.style\)/);
});

test('vow paper, hand kiss and ring actions are explicit',()=>{
  const js=read('wedding-game.js');
  assert.match(js,/正面、双手拿完整对折誓词纸/);
  assert.match(js,/不得单手拿纸，不得拿狭长纸条/);
  assert.match(js,/嘴唇接触手背，明确不是手腕或手臂/);
  assert.match(js,/把戒指戴到新娘左手无名指/);
});

test('script contains narrator, ceremony lines and three choices',()=>{
  const js=read('wedding-game.js');
  assert.match(js,/chatAPI\(\[\{role:'system',content:buildSystem\(c\)\}/);
  assert.match(js,/kind:'narrator'/);
  assert.match(js,/kind:'choice'/);
  assert.match(js,/kind:'ceremony'/);
  assert.match(js,/id:'hand'/);
  assert.match(js,/id:'vow'/);
  assert.match(js,/id:'ring'/);
});

test('all scenes are prepared before entry and the mounted stage only crossfades cached art',()=>{
  const js=read('wedding-game.js'),css=read('wedding-game.css');
  assert.match(js,/if\(W\.scene===scene\)return/);
  assert.match(js,/data-layer="0".*data-layer="1"/);
  assert.match(js,/for\(let i=0;i<order\.length;i\+\+\)/);
  assert.match(js,/weddingLoadPreparedScenes/);
  assert.doesNotMatch(js,/next\.scene!==item\.scene&&!W\.sceneImages\[next\.scene\]/);
  assert.match(css,/\.wedding-art\{[^}]*opacity:0[^}]*transition:opacity 1\.15s/);
  assert.match(css,/\.wedding-art\.active\{opacity:1/);
  assert.doesNotMatch(css,/\.wedding-scene-loading/);
});

test('modern BGM is wedding-only, loops, and stops on close',()=>{
  const js=read('wedding-game.js');
  assert.match(js,/const WEDDING_BGM=WEDDING_ASSET_BASE\+'modern-wedding-bgm\.mp3'/);
  assert.match(js,/a\.loop=true/);
  assert.match(js,/weddingMusicPlay\(true\)/);
  assert.match(js,/function weddingClose\(\).*weddingMusicStop\(\)/);
});

test('wedding is pure click-through subtitles with no role voice playback',()=>{
  const js=read('wedding-game.js');
  assert.match(js,/全程纯点击字幕/);
  assert.match(js,/纯字幕 · 点击继续/);
  assert.doesNotMatch(js,/weddingAutoSpeak|weddingVoiceReady|ttsArr\(/);
  assert.doesNotMatch(js,/weddingVoiceButton|weddingToggleMute/);
});

test('August 19 invitation is automatic once, then manual requests may resend',()=>{
  const js=read('wedding-game.js'),app=read('app.js'),css=read('wedding-game.css');
  assert.match(js,/const WEDDING_RELEASE_DAY='2026-08-19'/);
  assert.match(js,/sent\|\|weddingLocalDay\(at\)!==WEDDING_RELEASE_DAY/);
  assert.match(js,/source==='auto'\)\{st\.invitation\.autoSentAt/);
  assert.match(js,/autoSentDays\[WEDDING_RELEASE_DAY\]/);
  assert.match(js,/function weddingResetQixiInvitationOnce\(\)/);
  assert.match(js,/v997-qixi-auto-once/);
  assert.match(js,/if\(m\.source==='auto'\)\{m\.phase='ready'/);
  assert.match(js,/七夕自动首邀一生只发一次/);
  assert.match(js,/function weddingHandleInviteRequest\(c,text\)/);
  assert.match(app,/window\.weddingHandleInviteRequest\(c,t\)/);
  assert.match(app,/m\.type==='weddinginvite'/);
  assert.match(css,/\.wedding-invite-mini\{/);
  assert.match(css,/PRIVATE WEDDING INVITATION|wedding-invite small/);
  assert.match(js,/function weddingChooseInvitationStyle\(cid,mid,style\)/);
});

test('invitation shows background preparation progress, then sends role line and ready card',()=>{
  const js=read('wedding-game.js'),css=read('wedding-game.css'),app=read('app.js');
  assert.match(js,/phase:'style'/);
  assert.match(js,/现代婚礼/);
  assert.doesNotMatch(js,/中式婚礼入口已经为你保留，将在下一阶段开放/);
  assert.match(js,/weddingChooseInvitationStyle\([^}]*m\.style=weddingStyleKey\(style\)/);
  assert.match(js,/function weddingCountdownText\(at\)/);
  assert.match(js,/距离婚礼还有/);
  assert.match(js,/data-wedding-countdown/);
  assert.match(js,/function weddingPrepareInvitation\(c,m\)/);
  assert.match(js,/WEDDING_PREP_DEFAULT_MS=11\*60\*1000/);
  assert.match(js,/WEDDING_READY_DELAY_MS=10\*1000/);
  assert.match(js,/data-wedding-preparing/);
  assert.match(js,/预计还需约/);
  assert.match(js,/请勿退出小手机或锁屏/);
  assert.doesNotMatch(js,/可以先离开聊天，准备会在小手机内继续/);
  assert.match(js,/for\(let i=0;i<order\.length;i\+\+\)/);
  assert.match(js,/function weddingArrivalLine\(c,style,script\)/);
  assert.match(js,/function weddingGenerateArrivalLine\(c,style\)/);
  assert.match(js,/像你平时私下对她说话/);
  assert.match(js,/不是订婚宴/);
  assert.match(js,/script\.arrival_line=await weddingGenerateArrivalLine/);
  assert.match(js,/ref=weddingResolvePreparedInvite\(c,m\)/);
  assert.match(js,/text=weddingArrivalLine\(c,style,ref\.prepared\.script\)/);
  assert.doesNotMatch(js,/const text=await weddingArrivalLine/);
  assert.match(js,/婚礼已准备就绪，新郎正在向你走来/);
  assert.match(js,/styleName\+'婚礼已准备就绪/);
  assert.doesNotMatch(js,/画面已全部生成 · 正在完成最后复核|婚礼已全部生成，开放倒计时/);
  assert.doesNotMatch(js,/约一分钟后可以进入/);
  assert.match(js,/for\(let attempt=1;attempt<=2;attempt\+\+\)/);
  assert.match(js,/两次请求均未返回图片/);
  assert.match(js,/m\.eventAt=m\.preparedAt\+WEDDING_READY_DELAY_MS/);
  assert.match(js,/phase:'ready'/);
  assert.match(js,/function weddingOpenReadyInvite\(cid,mid\)/);
  assert.match(js,/function weddingEnsureInviteFormat\(m\)/);
  assert.match(js,/m\.schema=2/);
  assert.match(js,/preparedAt/);
  assert.match(js,/只输出一条普通微信正文/);
  assert.match(js,/function weddingInvitationIntroLine\(c,opt\)/);
  assert.match(js,/function weddingSendInvitationPersonalized\(c,source,opt\)/);
  assert.match(js,/按你本人的人设、关系、记忆和日常说话习惯/);
  assert.match(app,/这是我本人主动发出的现实婚礼形式选择卡/);
  assert.match(app,/这是我本人发出的现实/);
  assert.match(js,/role\|type\|content\|phase\|json/);
  assert.match(css,/\.wedding-mini-actions/);
  assert.match(css,/\.wedding-mini-countdown/);
  assert.doesNotMatch(css,/invitation-card-v1/);
  assert.match(app,/m\.phase==='style'/);
});

test('wedding reference generation uses one ordinary image request and never silently starts chat image generation',()=>{
  const js=read('wedding-game.js');
  assert.match(js,/function weddingReferenceNoteKey\(ref,formalwear,style\)/);
  assert.match(js,/Object\.prototype\.hasOwnProperty\.call\(W\.referenceNotes,cacheKey\)/);
  const identityNote=js.slice(js.indexOf('async function weddingReferenceIdentityNote'),js.indexOf('async function weddingGenerateWithReference'));
  assert.doesNotMatch(identityNote,/visionAPI|fetchT|chatAPI/);
  assert.match(js,/imageGenerateExternal\(base,key,model,identityPrompt,'1024x1536','high',\{allowChatFallback:false,timeoutMs:300000\}\)/);
  assert.match(js,/imageGenerateExternal\(base,key,model,prompt,'1024x1536','high',\{allowChatFallback:false,timeoutMs:300000\}\)/);
  assert.match(js,/identitySummaryOnly=!!referenceSrc/);
  assert.doesNotMatch(js,/WEDDING_REFERENCE_TIMEOUT_MS|WEDDING_REFERENCE_COOLDOWN_MS|blockedUntil/);
  const reference=js.slice(js.indexOf('async function weddingGenerateWithReference'),js.indexOf('async function weddingGenerateScene'));
  assert.doesNotMatch(reference,/chat\/completions|imagePostCompat/);
});

test('private simulation runs the full ceremony but exits before every persistent wedding effect',()=>{
  const js=read('wedding-game.js'),css=read('wedding-game.css');
  assert.match(js,/function weddingPrivateApp\(\)/);
  assert.match(js,/function weddingStartSimulation\(cid,mid,style\)/);
  assert.match(js,/weddingEnterPrepared\(c,invite,prepared,true\)/);
  assert.match(js,/simulation:\!\!W\.session\.simulation/);
  assert.match(js,/模拟一次 · 不保存/);
  assert.match(js,/if\(s\.simulation\)\{s\.saved=true;return weddingShowCertificate/);
  const finish=js.slice(js.indexOf('function weddingFinish()'),js.indexOf('function weddingReplay()'));
  assert.ok(finish.indexOf('if(s.simulation)')<finish.indexOf('weddingState()'));
  assert.match(js,/模拟模式：本次不会收藏婚书、写入记忆、改变关系或发送婚后消息/);
  assert.match(css,/\.wedding-simulate-start/);
  assert.match(css,/\.wedding-mini-simulate/);
  assert.match(css,/\.wedding-simulation-badge/);
});

test('app and browser offline-date menu expose couple-only background preparation and ready entry',()=>{
  const js=read('wedding-game.js'),app=read('app.js'),css=read('wedding-game.css');
  const entry=js.slice(js.indexOf('function weddingOfflineStyleHTML('),js.indexOf('function weddingInvitationRole('));
  assert.match(app,/window\.weddingOfflineEntryHTML\(\)/);
  assert.match(js,/function weddingOfflineEntryHTML\(\)/);
  assert.doesNotMatch(js,/function weddingOfflineEntryHTML\(\)\{if\(!weddingPrivateApp\(\)\)return''/);
  assert.match(js,/const c=weddingInvitationRole\(\)/);
  assert.match(js,/婚礼只对情侣空间绑定的角色开放/);
  assert.match(entry,/weddingOpenReadyInvite/);
  assert.match(entry,/模拟一次 · 不保存/);
  assert.match(entry,/单独重做某一章/);
  assert.match(entry,/weddingOpenSceneRegenerator/);
  assert.match(entry,/weddingRegenerate/);
  assert.match(entry,/后台准备'\+label\+'婚礼/);
  assert.match(entry,/完成后由他发来邀请/);
  assert.match(entry,/等待他发来邀请/);
  assert.match(css,/\.wedding-offline-entry\{/);
  assert.match(css,/\.wedding-offline-actions\{/);
  const card=js.slice(js.indexOf('function weddingInviteCardHTML('),js.indexOf('function weddingRefreshInviteChat('));
  assert.doesNotMatch(card,/wedding-mini-ready-actions|wedding-mini-regenerate|wedding-mini-simulate/);
});

test('wedding reset is scoped and preserves the one-time Qixi ledger',()=>{
  const js=read('wedding-game.js'),css=read('wedding-game.css');
  assert.match(js,/weddingClearAll=async function\(cid\)/);
  assert.match(js,/Object\.assign\(window,\{[^}]*weddingClearAll/);
  assert.match(js,/清空所有婚礼记忆、婚书与夫妻关系/);
  assert.match(js,/st\.records=st\.records\.filter/);
  assert.match(js,/c\.summaries=.*filter\(x=>!weddingMemorySummary\(x\)\)/);
  assert.match(js,/const memories=typeof memoryList==='function'\?memoryList\(c,'main'\):\[\],removed=memories\.filter/);
  assert.match(js,/const autoSentAt=st\.invitation\.autoSentAt\|\|0/);
  assert.match(js,/autoSentDays=Object\.assign/);
  assert.match(js,/七夕首邀不会自动重发/);
  assert.match(js,/S\.calendar=.*filter\(x=>!\(x&&x\.type==='wedding'/);
  assert.match(css,/\.wedding-clear-all\{/);
});

test('returned images are delivered immediately and only missing images fall back to preview art',()=>{
  const js=read('wedding-game.js');
  assert.match(js,/check=\{pass:true,reason:'图片平台已返回，未再发起联网复核'\}/);
  assert.match(js,/if\(!src\)throw new Error\('图片平台没有返回可显示的图片'\)/);
  assert.match(js,/weddingPrepareScene\(c,scene,script\.formalwear,true,style\)/);
  assert.match(js,/if\(W\.sceneFailures\[scene\]\)/);
  assert.match(js,/weddingRetryFailedScene\(c,scene,script\.formalwear,style\)/);
  assert.match(js,/referenceScene:reference&&reference\.scene/);
  assert.match(js,/W\.sceneImages\[scene\]=weddingScenes\(style\)\[scene\]/);
  assert.match(js,/previewScenes=order\.filter/);
  assert.match(js,/previews\.has\(scene\)/);
  assert.match(js,/if\(!cached\)\{W\.sceneImages\[scene\]=scenes\[scene\]/);
});

test('all wedding chapters and retries use chapter one as the only identity reference',()=>{
  const js=read('wedding-game.js');
  const identity=js.slice(js.indexOf('function weddingIdentityReference('),js.indexOf('async function weddingReferenceIdentityNote('));
  assert.match(identity,/const first=weddingSceneOrder\(style\)\[0\]/);
  assert.match(identity,/return src\?\{scene:first,src\}:null/);
  assert.doesNotMatch(identity,/for\(const key/);
  const prepare=js.slice(js.indexOf('function weddingPrepareScene('),js.indexOf('async function weddingRetryFailedScene('));
  assert.match(prepare,/scene===first\?null:weddingIdentityReference\(scene,style\)/);
  assert.match(prepare,/referenceScene:reference&&reference\.scene/);
  assert.match(js,/第一幕身份摘要延续同一个新郎/);
  assert.match(js,/reference=\{scene:first,src:firstSrc\}/);
});

test('offline date can rebuild one selected chapter without risking the accepted image',()=>{
  const js=read('wedding-game.js'),css=read('wedding-game.css');
  assert.match(js,/function weddingOpenSceneRegenerator\(cid,mid\)/);
  assert.match(js,/async function weddingRegenerateScene\(cid,mid,scene\)/);
  assert.match(js,/单独重做现代婚礼某一章|单独重做'\+label\+'婚礼某一章/);
  assert.match(js,/本次只发起一张付费生图/);
  assert.match(js,/const first=order\[0\],firstSrc=/);
  assert.match(js,/reference=\{scene:first,src:firstSrc\}/);
  assert.match(js,/originalSrc=W\.sceneImages\[scene\]/);
  assert.match(js,/W\.sceneImages\[scene\]=originalSrc/);
  assert.match(js,/prepared\.sceneKeys\[scene\]=cacheKey/);
  assert.match(js,/referenceRule:'first-scene-identity-summary'/);
  assert.match(js,/平台已经返回图片，本次不会再自动扣费重试/);
  assert.match(js,/weddingAcceptSceneCandidate/);
  assert.match(js,/其他五章没有改变/);
  assert.match(js,/weddingOpenSceneRegenerator,weddingRegenerateScene/);
  assert.match(css,/\.wedding-scene-regenerate-grid\{/);
  assert.match(css,/@keyframes weddingSceneSpin/);
});

test('story UI has no system badge, segmented progress, or generation overlay',()=>{
  const js=read('wedding-game.js'),css=read('wedding-game.css');
  assert.doesNotMatch(js,/现代婚礼 · 角色专属演出/);
  assert.doesNotMatch(js,/class="wedding-progress"/);
  assert.doesNotMatch(js,/weddingLoading\(/);
  assert.doesNotMatch(js,/weddingSceneLoading\(/);
  assert.doesNotMatch(css,/\.wedding-preview-badge|\.wedding-progress|\.wedding-scene-loading/);
  assert.match(css,/\.wedding-dialog\{[^}]*height:168px/);
  assert.match(css,/\.wedding-choice\{grid-template-columns:repeat\(2/);
  const stage=js.slice(js.indexOf('function weddingEnsureStage('),js.indexOf('function weddingSetScene('));
  assert.doesNotMatch(stage,/weddingExitAsk|aria-label="退出"|>×<\/button>/);
});

test('ready entry opens with a natural veil transition and regeneration is style-isolated',()=>{
  const js=read('wedding-game.js'),css=read('wedding-game.css');
  assert.match(js,/W\.opening=true/);
  assert.match(js,/wedding-opening-veil/);
  assert.match(css,/@keyframes wedding-opening-veil/);
  assert.match(js,/function weddingRegenerate\(cid,style\)/);
  assert.match(js,/\(old\.style\|\|'modern'\)===style/);
  assert.match(js,/重新生成'\+label\+'婚礼/);
});

test('calendar schedules an exact wedding time and only the couple-space role can receive it',()=>{
  const js=read('wedding-game.js'),app=read('app.js'),css=read('wedding-game.css');
  assert.match(app,/<option value="wedding">预约婚礼<\/option>/);
  assert.match(app,/id="ce_time" type="time"/);
  assert.match(app,/预约婚礼需要准确时间/);
  assert.match(app,/婚礼只能与情侣空间绑定的角色进行/);
  assert.match(app,/e\.type==='wedding'.*weddingCalendarTick\(e\)/);
  assert.match(js,/function weddingScheduleCalendarEvent\(e\)/);
  assert.match(js,/e\.contactId!==S\.couple\.cid/);
  assert.match(js,/source:'calendar'|weddingSendInvitation\(c,'calendar'/);
  assert.match(js,/weddingInviteDateLabel\(m\)/);
  assert.match(js,/ceremonyAt:m\.eventAt/);
  assert.match(js,/weddingEligibleRole\(c\)/);
  assert.match(js,/const cid=S\.couple&&S\.couple\.cid/);
  assert.match(css,/\.wedding-invite-mini-chinese/);
  assert.match(js,/data-wedding-style/);
});

test('completion writes one five-star character memory instead of a dialogue summary and sends a fresh post-wedding message each replay',()=>{
  const js=read('wedding-game.js'),app=read('app.js');
  assert.match(js,/function weddingStoreRoleMemory\(c,record\)/);
  assert.match(js,/const styles=weddingCompletedStyles\(c\),both=/);
  assert.match(js,/list=memoryList\(c,'main'\)/);
  assert.match(js,/entry\.importance=5/);
  assert.match(js,/entry\.rolePerspective=true/);
  assert.match(app,/if\(v&&typeof v==='object'&&v\.rolePerspective\)return String\(v\.text/);
  assert.match(js,/c\.summaries=.*filter\(x=>!\(x&&x\.weddingRecordId===record\.id\)\)/);
  assert.match(js,/for\(const old of weddingState\(\)\.records\)/);
  assert.match(js,/function weddingMigrateRoleMemories\(\)/);
  assert.match(js,/oldPerspective=!!\(old&&old\.rolePerspective\)/);
  assert.match(js,/function weddingRoleCity\(c\)/);
  assert.match(js,/day\+'，我在'\+place\+'和'/);
  assert.match(js,/亲吻她的手背、为她的左手无名指戴上婚戒/);
  assert.match(js,/function weddingAfterMessage\(c,s,record,memory\)/);
  assert.match(js,/之前婚礼后发过这些话/);
  assert.match(js,/这一次必须换一个细节、角度和句式/);
  assert.match(js,/temp:\.86/);
  assert.match(js,/W\.session\.saved=false/);
  assert.match(js,/_weddingAfter:record\.id/);
  assert.match(js,/现实中的\'\+styleName\+\'婚礼/);
  assert.match(js,/id:'wed_'\+style\+'_'\+weddingHash\(c\.id\)/);
  assert.match(js,/st\.records=st\.records\.filter\(x=>x&&x!==record/);
});

test('role-perspective wedding memory keeps role I and the user name distinct in the memory editor',()=>{
  const app=read('app.js'),source=app.match(/function memoryText\(v\)\{[^\n]+\}/)?.[0];
  assert.ok(source);
  const memoryText=new Function('aboutMeNoteText',source+';return memoryText;')(()=>{throw new Error('role memory must bypass user-memory rewriting');});
  assert.equal(memoryText({rolePerspective:true,text:'2026年08月19日，我在伦敦和North举行了现实中的现代婚礼。'}),'2026年08月19日，我在伦敦和North举行了现实中的现代婚礼。');
});

test('marriage state and one certificate per style are exposed in couple space',()=>{
  const js=read('wedding-game.js'),app=read('app.js'),css=read('wedding-game.css');
  assert.match(js,/cp\.relationship='夫妻'/);
  assert.match(js,/cp\.marriageStyles/);
  assert.match(js,/婚书收藏夹/);
  assert.match(js,/每种婚礼的婚书会各收藏一份/);
  assert.match(js,/function weddingOpenCertificateRecord\(cid,recordId\)/);
  assert.match(app,/cp\.married\?'已结为夫妻':'在一起'/);   // COUPLE_REDESIGN_V1: the header shows the status on its own line
  assert.match(app,/weddingCoupleCollectionHTML/);
  assert.match(css,/\.wedding-collection-row/);
});

test('certificate keeps supplied structure, original role name and fitted centered title',()=>{
  const js=read('wedding-game.js'),css=read('wedding-game.css');
  assert.match(js,/Marriage Certificate/);
  assert.match(js,/Together, we choose each other as life partners/);
  assert.match(js,/We promise to love and respect one another/);
  assert.match(js,/With family and friends as witnesses/);
  assert.match(js,/groom=record\.groomName\|\|W\.session&&W\.session\.groomName\|\|weddingRoleOriginalName\(c\)/);
  assert.match(css,/certificate-v3\.webp/);
  assert.match(css,/"Snell Roundhand"/);
  assert.match(js,/getBoundingClientRect\(\)\.width>max/);
  assert.match(css,/@keyframes wedding-cert-fall/);
  const certificate=js.slice(js.indexOf('function weddingShowCertificate('),js.indexOf('function weddingOpenCertificateRecord('));
  assert.doesNotMatch(certificate,/回到小手机|回到情侣空间|wedding-cert-actions/);
  assert.match(certificate,/wedding-cert-close/);
  assert.match(css,/\.wedding-certificate\{display:flex;align-items:center;justify-content:center/);
});

test('wedding has no standalone home app and invitation preview route still exists',()=>{
  const js=read('wedding-game.js');
  assert.doesNotMatch(js,/APPDEFS\.wedding=/);
  assert.doesNotMatch(js,/APPRUN\.wedding=\(\)=>weddingOpen\(\)/);
  assert.match(js,/delete APPDEFS\.wedding/);
  assert.match(js,/#wedding-invitation-preview/);
});
