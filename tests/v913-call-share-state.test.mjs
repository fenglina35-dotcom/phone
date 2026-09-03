import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('小手机.html');
const pip = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift');
const bridge = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
const coordinator = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/ScreenShareCoordinator.swift');

test('screen-share state is polled and owns a protected call queue', () => {
  assert.match(app, /screenShare\.status/);
  assert.match(app, /function callScreenShareConfirmNative\(expected,session\)/);
  assert.match(app, /_callStatePend=null,_callStateEpoch=0/);
  assert.match(app, /if\(_requestedStateEvent\)_callStatePend=/);
  assert.match(app, /if\(_callStatePend&&_call&&_call\.state==='active'\)/);
});

test('optional realtime understanding is role-paced and reacts only to changed shared frames', () => {
  assert.match(app, /实时共享理解（测试）/);
  assert.match(app, /function callScreenFrameChanged\(next,prev\)/);
  assert.match(app, /_callScreenRealtimeTimer=setTimeout\(tick,wait\)/);
  assert.doesNotMatch(app, /_callScreenRealtimeTimer=setInterval\(tick,4000\)/);
  assert.match(app, /decision!=='继续'/);
  assert.match(app, /_callScreenObserveMode!=='observing'/);
  assert.match(app, /callVideoVisionAnalyze\('live'/);
  assert.match(app, /screenShare\.realtime\.frame/);
  assert.match(bridge, /case "screenShare\.realtime\.frame"/);
  assert.match(coordinator, /__smallPhoneScreenShareFrameEvent/);
  assert.match(bridge, /contractVersion = 26/);
});

test('private screen share can recognize exactly once after each completed user sentence', () => {
  assert.match(app, /screenShareSpeechVision:false/);
  assert.match(app, /说一句，看一次共享画面/);
  assert.match(app, /function screenShareSpeechVisionOn\(\)/);
  assert.match(app, /function screenShareSpeechVisionToggle\(el\)/);
  assert.match(app, /call-screen-speech/);
  assert.match(app, /<small>逐句看<\/small>/);
  assert.match(html, /\.call-screen-tools\.call-screen-speech\{left:max\(72px/);
  assert.match(app, /if\(screenShareSpeechVisionOn\(\)&&callScreenShareOn\(\)\)\{callVideoVisionAnalyze\('voice',t,meta\);return true;\}/);
  assert.match(app, /callScreenShareOn\(\)&&\(screenShareRealtimeVisionOn\(\)\|\|screenShareSpeechVisionOn\(\)\)/);
  assert.match(app, /if\(!sess\|\|screenShareSpeechVisionOn\(\)\|\|!screenShareRealtimeVisionOn\(\)/);
  assert.match(app, /已恢复原来的共享识别逻辑/);
});

test('share-start response is isolated from the previous user sentence', () => {
  assert.match(app, /本轮普通聊天历史已隔离/);
  assert.match(app, /绝对不要回答、复述、改写或延续共享状态改变前用户的最后一句话/);
  assert.match(app, /const hist=\(_videoVisionAutomatic\|\|_screenShareEvent\)\?\[\]/);
  assert.match(app, /_callStateStale=/);
  assert.doesNotMatch(app, /stopCallMediaAudio\('screen-share-state'\)/);
});

test('expanded call subtitles use natural motion without an empty glass panel', () => {
  assert.match(app, /function callSubtitleEnter\(box\)/);
  assert.match(html, /@keyframes csphrasein/);
  assert.doesNotMatch(html, /@keyframes cscharin/);
  assert.match(html, /\.callsub\{[^}]*padding:0 26px[^}]*min-height:60px/);
  assert.match(html, /\.callsub:empty\{display:none\}/);
  assert.doesNotMatch(html, /\.callsub\{[^}]*backdrop-filter/);
  assert.match(pip, /preferredContentSize = CGSize\(width: 360, height: 144\)/);
  assert.match(pip, /root\.backgroundColor = \.clear/);
  assert.match(pip, /stack\.topAnchor\.constraint\(equalTo: root\.topAnchor, constant: 10\)/);
});
