import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const pip=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift',import.meta.url),'utf8');
const project=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj',import.meta.url),'utf8');

test('v1118 web source keeps private 1.0.239 compatibility',()=>{
  assert.match(app,/APP_VER='v1118 · 交互与角色锁定稳定版'/);
  assert.match(project,/CURRENT_PROJECT_VERSION = 239;/);
  assert.match(project,/MARKETING_VERSION = 1\.0\.239;/);
});

test('public music search needs no user login and reuses together-listen songs',()=>{
  assert.match(app,/MUSIC_PUBLIC_API='https:\/\/api\.audius\.co\/v1'/);
  assert.match(app,/tracks\/search\?query=/);
  assert.match(app,/MUSIC_PUBLIC_API\+'\/tracks\/\'\+encodeURIComponent\(id\)\+'\/stream\?app_name='\+encodeURIComponent\(MUSIC_PUBLIC_APP\)/);
  assert.match(app,/不用登录/);
  assert.match(app,/provider:'audius'/);
  assert.match(app,/track\.is_stream_gated!==true/);
  assert.match(app,/track\.access\.stream!==false/);
  assert.match(app,/正在为这首在线音乐切换线路/);
  assert.match(app,/function musicInviteTo\(cid\)/);
  assert.doesNotMatch(app,/musicSearch.*(?:login|password|Authorization|api[_-]?key)/i);
});

test('full call page is opaque while only native PiP is translucent',()=>{
  assert.match(html,/\.callsub\{position:absolute;bottom:190px;left:0;right:0;max-height:40%;overflow:visible;padding:0 26px/);
  assert.match(html,/\.callsub:empty\{display:none\}/);
  assert.doesNotMatch(html,/\.callsub\{[^}]*backdrop-filter/);
  assert.match(pip,/root\.backgroundColor = \.clear/);
  assert.match(pip,/root\.isOpaque = false/);
  assert.match(pip,/preferredContentSize = CGSize\(width: 360, height: 144\)/);
});

test('realtime share switch and share button visibly follow pending state',()=>{
  assert.match(app,/screenShareRealtimeVisionToggle\(this\)/);
  assert.match(app,/el\.classList\.toggle\('on',screenShareRealtimeVisionOn\(\)\)/);
  assert.match(app,/_callScreenPending=expected\?'start':'stop'/);
  assert.match(app,/call-screen-toggle\$\{callScreenShareOn\(\)\?' on':''\}\$\{_callScreenPending\?' pending':''\}/);
});
