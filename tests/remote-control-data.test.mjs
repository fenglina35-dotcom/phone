import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

test('remote viewing reuses real stored records',()=>{
  assert.match(app,/function remoteControlPhoneSnapshot\(cid\)/);
  assert.match(app,/p\.recents\|\|\[\]/);
  assert.match(app,/Object\.keys\(p\.sms\|\|\{\}\)/);
  assert.match(app,/p\.voicemail\|\|\[\]/);
  assert.match(app,/function foodOrderRows\(\)/);
  assert.match(app,/S\.shop&&S\.shop\.orders/);
  assert.match(app,/S\.travel&&S\.travel\.trips/);
});

test('remote viewing opens real apps and stores only viewed facts',()=>{
  assert.match(app,/function remoteControlViewFact\(a,c\)/);
  assert.match(app,/function remoteControlPlanningSnapshot\(c\)/);
  assert.match(app,/if\(app==='travel'\)\{tvInit\(\);_tvTab='trips'/);
  assert.match(app,/if\(app==='shop'\)\{remoteControlSetPage\('shop'\)/);
  assert.match(app,/openOrders\(\)/);
  assert.match(app,/if\(app==='food'\)\{remoteControlSetPage\('food'\)/);
  assert.match(app,/openFoodOrders\(\)/);
  assert.match(app,/targetType==='browserHistory'[\s\S]*?brHistory\(\)/);
  assert.match(app,/targetType==='dySearchHistory'[\s\S]*?dyTab='search'/);
});

test('remote inspection is role-selected, focused by context, and compact across feeds',()=>{
  assert.match(app,/function remoteControlRequiredPlan\(c\)/);
  assert.match(app,/let required=remoteControlRequiredPlan\(c\);required=remoteControlDedupPlan\(await remoteControlAutonomousPlan\(c,required\)\)/);
  assert.match(app,/async function remoteControlAutonomousPlan\(c,candidates\)/);
  assert.match(app,/不要机械全选，不要为了展示功能而乱看/);
  assert.match(app,/通常选择3到8项/);
  assert.match(app,/direct&&\!remoteControlContextWantsBroad\(direct\)/);
  assert.match(app,/remoteControlContextCandidates\(c,direct\)/);
  assert.match(app,/function remoteControlCompactViewPlan\(list\)/);
  assert.match(app,/targetName:'朋友圈动态',targetType:'momentList'/);
  assert.match(app,/targetName:'微博 \/ X动态',targetType:'xFeed'/);
  assert.match(app,/async function remoteControlOrderPlan\(c,required\)/);
  assert.match(app,/下面列出的软件都必须查看/);
  assert.match(app,/只决定软件顺序，不能漏掉、增加或重复任何app/);
  assert.match(app,/picked\.concat\(apps\)\.forEach/);
  assert.match(app,/return order\.flatMap\(k=>required\.filter\(a=>a\.app===k\)\)/);
  assert.doesNotMatch(app,/hintApps\.length\?hintApps:apps\.slice\(0,2\)/);
  assert.match(app,/\.filter\(x=>x\.op&&x\.op!=='view'\)/);
  assert.doesNotMatch(app,/remoteProgressFill/);
  assert.equal((html.match(/class="remote-live-dot"/g)||[]).length,1);
});

test('chat and DM detail choices remain role-driven',()=>{
  assert.match(app,/function remoteControlWechatCandidates\(c\)/);
  assert.match(app,/function remoteControlWechatChoicePlan\(c\)/);
  assert.match(app,/targetType:'wechatList'/);
  assert.match(app,/remoteControlAppendChoices\(required,i\+1,choices\)/);
  assert.match(app,/function remoteControlAppendChoices\(plan,at,choices\)/);
  assert.match(app,/function remoteControlWechatEnterFromList\(a\)/);
  assert.match(app,/function remoteControlWechatExitToList\(\)/);
  assert.match(app,/function remoteControlDmChoicePlan\(c,app\)/);
  assert.match(app,/function remoteControlDmEnterFromList\(a\)/);
  assert.match(app,/function remoteControlDmExitToList\(app\)/);
  assert.match(app,/targetType:'xDmList'/);
  assert.match(app,/targetType:'dyDmList'/);
  assert.match(app,/else if\(a\.fromDmList\)await remoteControlDmExitToList\(a\.app\)/);
});

test('remote subtitles are role-generated and quiet on list pages',()=>{
  assert.match(app,/function remoteControlRoleLines\(c,a,r\)/);
  assert.match(app,/function remoteControlRoleReaction\(c,a,r\)/);
  assert.match(app,/\['wechatList','xDmList','dyDmList'\]\.includes\(a&&a\.targetType\)\)return\{lines:\[\],deleteIntent:false/);
  assert.match(app,/max:520,complete:true,temp:\.82,aux:false/);
  assert.match(app,/const reaction=await remoteControlRoleReaction\(c,a,r\)/);
  assert.match(app,/await remoteControlShowRoleLines\(await remoteControlRoleLines\(c,a,r\)\)/);
  assert.match(app,/function remoteControlStageCaption\(a,r\)/);
  assert.match(app,/remoteControlScene\(r,remoteControlStageCaption\(a,r\)/);
  assert.match(app,/function remoteControlCaption\(say\)[\s\S]*?replaceChildrenCompat\(cap,b\)/);
  assert.match(app,/function remoteControlClearCaption\(\)[\s\S]*?replaceChildrenCompat\(cap\)/);
  assert.doesNotMatch(app,/cap\.appendChild\(b\);while\(cap\.children\.length>3\)/);
  assert.match(app,/你不是操作解说员/);
  assert.match(app,/roleSpokenCount:0/);
  assert.match(app,/本轮你还没有说过话，而当前详情已经有具体真实内容/);
  assert.match(app,/角色正在理解当前内容/);
  assert.match(app,/function remoteControlCaptionMs\(t\)\{return Math\.max\(3800,Math\.min\(8000/);
  assert.match(app,/禁止说“?我先看看/);
  assert.match(app,/function remoteControlOperationalNarration\(text\)/);
  assert.match(app,/!remoteControlOperationalNarration\(x\)/);
  assert.doesNotMatch(app,/remoteControlCaption\('我先在桌面上找一下/);
  assert.doesNotMatch(app,/remoteControlCaption\('找到了，我现在打开/);
  assert.doesNotMatch(app,/remoteControlTimed/);
  assert.doesNotMatch(app,/function remoteControlSayFallback/);
});

test('remote role subtitles survive a natural-text model response without fake fallback text',()=>{
  const source=app.match(/function remoteControlRoleResponse\(raw\)\{[^\n]+\}/)?.[0]||'';
  assert.ok(source,'remote role response parser must exist');
  const parseObj=raw=>JSON.parse(raw);
  const remoteControlRoleTextLines=raw=>String(raw||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,2);
  const roleVisibleEnvelopeText=raw=>String(raw||'').trim();
  const parse=Function('parseObj','remoteControlRoleTextLines','roleVisibleEnvelopeText',`${source};return remoteControlRoleResponse;`)(parseObj,remoteControlRoleTextLines,roleVisibleEnvelopeText);
  assert.deepEqual(parse('这条聊天为什么没告诉我？').lines,['这条聊天为什么没告诉我？']);
  assert.deepEqual(parse('{"lines":["这是谁？"],"delete":false,"messageIndex":-1}').lines,['这是谁？']);
  assert.equal(parse('{"line":"你最好解释清楚。","delete":false}').lines[0],'你最好解释清楚。');
});

test('remote model timeouts abort the real request and the first detail retries only with real model output',()=>{
  assert.match(app,/function remoteControlModelCall\(messages,opt,timeoutMs\)\{const ms=Math\.max\(10000,\+timeoutMs\|\|30000\),callOpt=Object\.assign\(\{\},opt\|\|\{\},\{timeout:ms\}\);return chatAPI\(messages,callOpt\);\}/);
  assert.doesNotMatch(app,/remote-control-model-timeout/);
  assert.match(app,/if\(\(mustSpeak\|\|ownPost\)&&!response\.lines\.length\)/);
  assert.match(app,/角色正在重新组织真实反应/);
  assert.match(app,/上一版没有形成可显示的角色台词，或只说了操作过程/);
  assert.match(app,/lastRoleCaptionError='model-returned-no-visible-role-line'/);
  assert.doesNotMatch(app,/function remoteControlSayFallback/);
});

test('the first real detail retries an operational-only model answer and returns the next real role line',async()=>{
  const source=app.match(/async function remoteControlRoleReaction\(c,a,r\)\{[\s\S]*?\n\}(?=\nasync function remoteControlRoleLines)/)?.[0]||'';
  assert.ok(source,'remote role reaction function must exist');
  let calls=0;
  const remoteControlModelCall=async()=>++calls===1
    ?'{"lines":["我先看看这个页面"],"delete":false,"messageIndex":-1}'
    :'{"lines":["这条聊天为什么没告诉我？"],"delete":false,"messageIndex":-1}';
  const remoteControlRoleResponse=raw=>{
    const payload=JSON.parse(raw);
    const lines=(payload.lines||[]).filter(x=>!/^我先看看/.test(x));
    return {payload,lines};
  };
  const ctl={roleSpokenCount:0,actions:[]};
  const reaction=Function('$','remoteControlDeleteCapability','remoteControlOwnershipNote','remoteControlIntentContext','S','_remoteCtl','remoteControlProgress','remoteControlModelCall','remoteControlRoleResponse','buildSystem',`${source};return remoteControlRoleReaction;`)(
    ()=>null,()=>null,()=>'',()=>'',{me:{name:'用户'}},ctl,()=>{},remoteControlModelCall,remoteControlRoleResponse,()=>''
  );
  const out=await reaction({id:'role-1',name:'角色'},{op:'view',targetName:'聊天详情',targetType:'role'},{detail:'用户：你为什么没有告诉我',facts:['用户：你为什么没有告诉我']});
  assert.equal(calls,2);
  assert.deepEqual(out.lines,['这条聊天为什么没告诉我？']);
  assert.equal(ctl.roleSpokenCount,1);
  assert.equal(ctl.lastRoleCaptionError,undefined);
});

test('remote control never revisits the same view page in one session',()=>{
  assert.match(app,/visitedPages:\[\]/);
  assert.match(app,/function remoteControlVisitKey\(a\)/);
  assert.match(app,/function remoteControlMarkVisited\(ctl,a\)/);
  assert.match(app,/if\(!remoteControlMarkVisited\(ctl,a\)\)continue/);
});

test('the role can independently act only on allowlisted visible data',()=>{
  assert.match(app,/'delete_x_dm'/);
  assert.match(app,/'delete_douyin_dm'/);
  assert.match(app,/function removeSocialDMThread\(app,id\)/);
  assert.match(app,/function deleteSocialDMThread\(app,id\)/);
  assert.match(app,/function remoteControlPrepareVisibleDelete\(a\)/);
  assert.match(app,/visibleDelete=await remoteControlPrepareVisibleDelete\(a\)[\s\S]*?remoteControlExecute\(a,c\)/);
  assert.match(app,/reaction=await remoteControlRoleReaction\(c,a,r\)[\s\S]*?remoteControlReactionDeleteAction\(entry,reaction,c\)/);
  assert.match(app,/a\.op==='delete_phone_contact'/);
  assert.match(app,/a\.op==='delete_sms_thread'/);
});

test('Douyin inspection visibly scrolls rather than resetting one screen',()=>{
  assert.match(app,/function remoteControlFocusViewedTarget\(a\)/);
  assert.match(app,/card\.scrollIntoView\(\{behavior:'smooth',block:'center'\}\)/);
  assert.match(app,/await remoteControlFocusViewedTarget\(a\)/);
});

test('remote control restores the page the user was on',()=>{
  assert.match(app,/returnStack:stack\.map\(x=>Object\.assign\(\{\},x\)\)/);
  assert.match(app,/stack=returnStack\.length\?returnStack:\[\{p:'home'\}\];render\(\)/);
});

test('all remote reasoning stays on the primary model',()=>{
  const start=app.indexOf('let _remoteCtl=');
  const end=app.indexOf('let _wxLoginTimer=',start);
  const remote=app.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(remote,/aux:true/);
  assert.ok((remote.match(/aux:false/g)||[]).length>=5);
});

test('an active call ends before remote control requests consent',()=>{
  assert.match(app,/function remoteControlRequest\(cid\)[\s\S]*?typeof _call!=='undefined'&&_call/);
  assert.match(app,/hangupCall\(true,wantWxLogin\?'wxlogin':wantRemoteControl\?'remotecontrol':''\)/);
});
