import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const bridge = fs.readFileSync(
  new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift', import.meta.url),
  'utf8'
);
const pip = fs.readFileSync(
  new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift', import.meta.url),
  'utf8'
);

test('web and native PiP share one subtitle motion contract', () => {
  assert.match(app, /const CALL_SUBTITLE_MOTION=\{phraseDurationMs:420,translateY:12,scale:0\.97,x1:0\.25,y1:0\.1,x2:0\.25,y2:1\}/);
  assert.match(app, /subtitleWho:s&&s\.who==='me'\?'me':'them'/);
  assert.match(app, /subtitleMotion:CALL_SUBTITLE_MOTION/);
  assert.match(bridge, /let subtitleMotion = arguments\["subtitleMotion"\]/);
  assert.match(pip, /private let subtitleLabel = UILabel\(\)/);
  assert.match(pip, /private var subtitleAnimator: UIViewPropertyAnimator\?/);
  assert.match(pip, /subtitleLabel\.alpha = 0/);
  assert.match(pip, /translationX: 0, y: 8/);
  assert.match(pip, /duration: 0\.3/);
  assert.match(pip, /length > 130 \? 9\.5 : \(length > 80 \? 11 : 14\)/);
});

test('PiP updates no longer restart PiP or reactivate the global audio session', () => {
  const updateCase = bridge.match(/case "call\.pip\.update":([\s\S]*?)case "call\.pip\.end":/)?.[1] ?? '';
  assert.match(updateCase, /CallPictureInPictureController\.shared\.update/);
  assert.doesNotMatch(updateCase, /\.start\(/);
  assert.doesNotMatch(updateCase, /AVAudioSession/);
});

test('native hands-free pauses capture while role audio plays and resumes afterwards', () => {
  assert.match(bridge, /try input\.setVoiceProcessingEnabled\(true\)/);
  assert.match(bridge, /options: \[\.defaultToSpeaker, \.allowBluetoothHFP, \.mixWithOthers\]/);
  assert.match(app, /hfAudioPaused=true;await callHFPauseForRoleAudio\(\)/);
  assert.match(app, /_hfIgnoreUntil=Math\.max\(_hfIgnoreUntil,Date\.now\(\)\+1500\)/);
  assert.doesNotMatch(app, /_callHFPending\.push\(\{text:t,meta\}\)/);
  assert.doesNotMatch(app, /const pending=_callHFPending\.shift\(\)/);
});
