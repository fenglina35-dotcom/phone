import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const wedding=fs.readFileSync(new URL('../wedding-game.js',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift',import.meta.url),'utf8');

test('v1045 removes synchronous camera JPEG work and preserves the camera audio session',()=>{
  assert.match(app,/async function callVideoElementFrame/);
  assert.match(app,/canvas\.toBlob\(/);
  assert.match(app,/privateNativeAppOn\(\)\?480:640/);
  assert.match(app,/nativeCamera=privateNativeAppOn\(\)&&callVideoCameraOn\(\)/);
  assert.match(app,/nativeCamera\?'camera':'call'/);
  assert.match(bridge,/mixMode == "camera"/);
  assert.match(bridge,/preserveCurrentSession: mixWithMedia/);
});

test('automatic task failures stay silent and the cache identity is new',()=>{
  assert.match(app,/APP_VER='v1112 · 个人外卖电脑隔离试用版'/);
  assert.match(app,/自动布置失败只留内部退避记录，打开小手机时绝不弹失败提示/);
  assert.match(app,/if\(!automatic\)toast\('没布置成功，再点一次'\)/);
  assert.match(html,/north-sw-reloaded-1112/);
  assert.match(html,/sw\.js\?v=1112&r=v1112-personal-delivery-device-1/);
});

test('settings use an iOS-style categorized home without changing the underlying controls',()=>{
  for(const key of ['network','vision','voice','behavior','appearance','media','data'])assert.match(app,new RegExp(`${key}:\\{title:`));
  assert.match(app,/网络连接'.*聊天 API、辅助模型与联网搜索/s);
  assert.match(app,/function settingsHomeHTML/);
  assert.match(app,/function settingsCategoryApply/);
  assert.match(app,/function settingsLineIcon\(key\)/);
  assert.match(app,/<svg viewBox="0 0 24 24"/);
  assert.doesNotMatch(app,/icon:'[⌁◉◖●✦▶⌘]'/);
  assert.match(app,/ids:\['set_chat','set_aux','set_search'\]/);
  assert.match(html,/\.ios-settings-group/);
  assert.match(html,/\.ios-settings-row/);
  assert.match(html,/\.ios-settings-search/);
  assert.match(html,/\.ios-settings-icon svg/);
});

test('role WeChat removes mutual pat actions while still hiding stale model tags',()=>{
  assert.doesNotMatch(app,/function chatPatRole\(id\)/);
  assert.doesNotMatch(app,/function consumeChatPatTags/);
  assert.doesNotMatch(app,/微信支持“拍一拍”/);
  assert.doesNotMatch(app,/m\.type!==['"]sys['"]\|\|m\._rolePat/);
  assert.match(app,/TAGWORDS='[^']*拍一拍/);
  assert.ok(app.includes("replace(/[\\[【]\\s*拍一拍\\s*[\\]】]/g,'')"));
});

test('Qixi auto invitation is durable and finalizes in place while manual and calendar paths remain',()=>{
  assert.match(wedding,/autoSentDays\[WEDDING_RELEASE_DAY\]/);
  assert.match(wedding,/if\(m\.source==='auto'\)\{m\.phase='ready';m\.preparedId=ref\.id;save\(\);weddingRefreshInviteChat\(c\.id\);return m;\}/);
  assert.match(wedding,/source==='calendar'/);
  assert.match(wedding,/weddingSendInvitationPersonalized\(c,'manual'/);
  assert.match(wedding,/autoSentAt,autoSentDays/);
  assert.match(wedding,/七夕首邀不会自动重发/);
});
