import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

test('the four WeChat-style role pages have independent clickable routes',()=>{
  for(const name of ['renderContactInfo','renderFriendInfo','renderContactSettings','renderRoleMoments'])assert.match(app,new RegExp(`function ${name}\\(id\\)`));
  for(const route of ['friendInfo','contactSettings','roleMoments','roleFeatures'])assert.match(app,new RegExp(`c\\.p==='${route}'`));
  for(const preview of ['wechat-profile','wechat-friend-info','wechat-contact-settings','wechat-role-moments'])assert.match(app,new RegExp(preview));
  assert.match(html,/\.wx-real-profile/);
  assert.match(html,/\.wx-subpage/);
  assert.match(html,/\.wx-role-moments/);
});

test('proactive interval is stored and scheduled per role instead of globally',()=>{
  assert.match(app,/proactiveIdlePerRoleV1/);
  assert.match(app,/c\.proactive\.idleMin/);
  assert.match(app,/id="pa_idle"/);
  assert.match(app,/function saveProactiveIdle\(id\)/);
  assert.match(app,/initiativeConfiguredIntervalMs\(c\)/);
  assert.match(app,/idleMinutes:configured/);
  assert.doesNotMatch(app,/id="s_pidle"/);
});

test('an explicit arrival updates common-life status during the same chat turn',()=>{
  assert.match(app,/doorOpened=.*faceToFace=/);
  assert.match(app,/arrived=explicit\|\|doorOpened&&faceToFace/);
  assert.match(app,/source:'wechat-natural-arrival'/);
  assert.match(app,/activity:'在家',place:'玄关'/);
  assert.match(app,/stateSource&&d\.stateSource!=='schedule-auto'/);
});

test('remote facts distinguish the controlling role from the phone owner',()=>{
  assert.match(app,/你（'\+actorName\+'本人）/);
  assert.match(app,/手机主人「'\+S\.me\.name\+'」（不是你）/);
  assert.match(app,/actorOwn:x\.authorId===actorId/);
  assert.match(app,/actorOwn:x\.who===actorId/);
  assert.match(app,/本次远程操控的原始目标，执行中不得忘记/);
});

test('role profile visuals use centered vector gender and the latest three image-or-text previews',()=>{
  assert.match(app,/function contactGenderIcon\(gender\)/);
  assert.match(app,/contactGenderIcon\(c\.gender\)/);
  assert.match(app,/function contactMomentThumbs\(c\)[^\n]*contactRoleMoments\(c\.id\)\.slice\(0,3\)/);
  assert.match(app,/return\{image,text\}/);
  assert.match(app,/item\.image\?`<i><img[^`]+`:`<i class="text"><span>/);
  assert.match(html,/\.wx-profile-thumbs i\.text span/);
  assert.doesNotMatch(app,/moment-text-art/);
  assert.match(html,/\.wx-profile-hero\{[^}]*padding:34px 22px 30px/);
  assert.match(html,/\.wx-role-cover \.avatar\.lg\{[^}]*aspect-ratio:1\/1/);
});

test('role settings expose five direct independent pages without nested horizontal tabs',()=>{
  assert.match(app,/function renderRoleManagementAll\(id\)/);
  assert.match(app,/function renderRoleManagement\(id,group\)/);
  for(const group of ['profile','chat','calls','social','privacy'])assert.match(app,new RegExp(`group:'${group}'`));
  for(const label of ['资料与记忆','聊天与主动','通话记录','朋友圈与 X','隐私、查岗与数据'])assert.match(app,new RegExp(label));
  assert.doesNotMatch(app,/function roleFeatureTabs\(/);
  assert.doesNotMatch(app,/roleFeatureTabs\(id,active\)/);
  assert.match(app,/parts\[active\]\+suffix/);
  assert.match(app,/placeCall\('\$\{id\}','voice'\)/);
  assert.match(app,/placeCall\('\$\{id\}','video'\)/);
  assert.match(app,/go\('calllog',\{id:'\$\{id\}'\}\)/);
  for(const control of ['editMemory','saveProactiveIdle','saveSpy','clearHistory'])assert.match(app,new RegExp(control));
  assert.match(html,/\.wx-feature-category-list/);
});

test('friend added date follows couple date or a stable editable fallback',()=>{
  assert.match(app,/function contactAddedDateKey\(c\)/);
  assert.match(app,/S\.couple&&S\.couple\.cid===c\.id/);
  assert.match(app,/c\.friendAddedDate/);
  assert.match(app,/function contactAddedDateEdit\(id\)/);
  assert.match(app,/相恋日期/);
});

test('role moments use a dated timeline, full detail route, and can inherit the requested chat image',()=>{
  assert.match(app,/c\.p==='roleMomentDetail'/);
  assert.match(app,/function renderRoleMomentDetail\(id,pid\)/);
  assert.match(app,/function roleMomentTimeline\(c,rows\)/);
  assert.match(app,/发布于 \$\{fmtDT\(p\.time\)\}/);
  assert.match(app,/function roleMomentRequestedUserImage\(c,opt\)/);
  assert.match(app,/opt\.images=\[src\]/);
  assert.match(app,/consumeMomentCommands\(content,c,\{toast:true,userText:_userText\},_replyActionOutcome\)/);
  assert.match(html,/\.wx-role-detail\{/);
  assert.match(html,/\.wx-role-moment-card \.moment-main>img/);
});
