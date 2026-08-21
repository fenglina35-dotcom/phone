import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('小手机.html');
const pip = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift');

test('ordinary voice and video calls reactivate iOS audio before role playback', () => {
  const play = pip.match(/func playAudio\([\s\S]*?func stopAudio/)?.[0] ?? '';
  assert.match(play, /stopAudio\(\)[\s\S]*?activateCallAudio\(mixWithMedia: mixWithMedia\)[\s\S]*?AVAudioPlayer/);
  assert.match(play, /guard player\.play\(\)/);
});

test('the v800-v850 hands-free noise filter is restored without touching subtitle animation', () => {
  assert.doesNotMatch(app, /function callHFLooksLikePlayback/);
  assert.doesNotMatch(app, /callHFRememberRoleSpeech/);
  assert.match(app, /if\(!_callHF\|\|_callHFBusy\|\|_callBusy\|\|Date\.now\(\)<_hfIgnoreUntil\)return/);
  assert.doesNotMatch(app, /_callHFPending\.push\(\{text:t,meta\}\)/);
  assert.match(app, /Date\.now\(\)\+1200/);
  assert.match(app, /Date\.now\(\)\+1500/);
  assert.match(app, /const CALL_SUBTITLE_MOTION=\{phraseDurationMs:300,translateY:8,scale:0\.98,x1:0\.25,y1:0\.1,x2:0\.25,y2:1\}/);
  assert.match(app, /function callSubtitleEnter\(box\)/);
  assert.match(html, /@keyframes csphrasein/);
});

test('foreground calls keep the web player except private Bilibili cinema, which uses mixed native audio', () => {
  const play = app.match(/async function playCallMediaWait[\s\S]*?async function prepareCallSpeech/)?.[0] ?? '';
  assert.match(play, /const nativeBackground=privateNativeAppOn\(\).*document\.hidden/);
  assert.match(app, /function cinemaNativeMediaAudioOn\(\)\{return privateNativeAppOn\(\)[\s\S]*?_cin\.provider==='bilibili'/);
  assert.match(play, /nativeCinema=cinemaNativeMediaAudioOn\(\),nativeScreenShare=privateNativeAppOn\(\)&&callScreenShareOn\(\),nativeCamera=privateNativeAppOn\(\)&&callVideoCameraOn\(\)/);
  assert.match(play, /if\(nativeBackground\|\|nativeSharedMedia\)[\s\S]*?call\.audio\.play/);
  assert.match(play, /mixMode:nativeCinema\?'cinema':nativeScreenShare\?'screenShare':nativeCamera\?'camera':'call'/);
  assert.match(play, /const a=callMediaElement\(\)/);
});

test('role audio uses the proven v907 pause and rebuild handoff with bounded waits', () => {
  assert.match(app, /hfAudioPaused=true;await callHFPauseForRoleAudio\(\)/);
  assert.match(app, /await sleep\(760\)/);
  assert.match(app, /typeof _callSR\.rebuild==='function'/);
  assert.match(app, /Promise\.race\(\[Promise\.resolve\(_callSR\.pause\(\)\)/);
  assert.match(app, /if\(hfAudioPaused\)await callHFResumeAfterRoleAudio\(sess\)/);
});

test('chat composer stays above the sticker panel and iOS does not zoom a 15px textarea', () => {
  assert.match(html, /\.inputbar textarea\{[^}]*box-sizing:border-box;[^}]*font-size:16px;[^}]*min-height:36px/);
  assert.match(html, /#panel\{order:2;flex:0 0 auto;\}/);
  assert.match(app, /function chatPanelKeyboardDismiss\(\)/);
  assert.match(app, /function chatPanelOpen\(page\)/);
  assert.match(app, /function chatPanelToggle\(page\)/);
  assert.match(app, /onclick="chatPanelToggle\('emoji'\)"/);
  assert.match(app, /onclick="chatPanelToggle\('fn'\)"/);
  assert.doesNotMatch(app.match(/function chatPanelOpen\(page\)[\s\S]*?function chatPanelToggle/)?.[0] ?? '', /render\(\)/);
});
