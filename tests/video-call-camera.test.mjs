import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const webView=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift',import.meta.url),'utf8');
const project=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const next=app.indexOf('\nfunction ',start+10);
  return app.slice(start,next<0?app.length:next).trim();
}

test('video call exposes a small real camera control and front/back switching',()=>{
  const render=functionSource('renderCall');
  assert.match(render,/call-camera-tools/);
  assert.match(render,/callVisionStatus/);
  assert.match(render,/call-camera-vision/);
  assert.match(render,/callVideoCameraToggle\(\)/);
  assert.match(render,/callVideoCameraFlip\(\)/);
  assert.match(functionSource('callVideoCameraStart'),/getUserMedia\(\{video:/);
  assert.match(functionSource('callVideoCameraStart'),/facingMode/);
  assert.match(functionSource('callVideoCameraFlip'),/environment/);
  assert.match(html,/\.call-camera-tools\{position:absolute;right:max\(12px,env\(safe-area-inset-right\)\);bottom:max\(14px,env\(safe-area-inset-bottom\)\)/);
  assert.match(html,/\.call-camera-tools button,\.call-screen-tools button\{width:32px;height:32px/,'the camera button remains intentionally small');
  assert.match(html,/\.call-camera-vision\.working\{display:flex;border:2px/);
  assert.match(html,/@keyframes callVisionSpin/);
  assert.match(html,/\.call-camera-vision\.failed/);
});

test('camera frames use the existing vision route and feed a natural in-call reply',()=>{
  const analyze=functionSource('callVideoVisionAnalyze');
  assert.match(analyze,/visionAPI\(data/);
  assert.match(analyze,/callAI\(note,\{videoVision:true,videoVisionScene:desc/);
  assert.match(analyze,/videoVisionMaxPerCall\(\)/);
  assert.match(functionSource('callVideoVisionArm'),/videoVisionIntervalMin\(\)/);
  assert.match(functionSource('callVideoVisionArm'),/if\(!videoVisionIntervalMin\(\)/,'a timer that was armed before saving 0 must stop on its next tick');
  assert.match(functionSource('callVideoVisionArm'),/min\*60000/);
  assert.match(analyze,/if\(!manual&&!live&&!videoVisionIntervalMin\(\)\)return false/,'0 must block minute-timer callbacks while the independent live-share mode remains available');
  assert.match(functionSource('callOnUserSay'),/callVideoVisionAsked\(t\)&&callVideoVisionCanAnalyze\('voice'\)/);
  assert.match(functionSource('callVideoVisionCanAnalyze'),/callVideoSourceOn\(\)/);
  assert.match(functionSource('callVideoVisionCanAnalyze'),/manual\|\|/,'spoken requests bypass the automatic limit');
  assert.match(functionSource('callVideoVisionAsked'),/你\\s\*\(\?:看\|瞧\)/);
  assert.match(functionSource('callVideoCameraStop'),/getTracks\(\)\.forEach\(t=>t\.stop\(\)\)/);
  assert.match(functionSource('endCallTimers'),/callVideoCameraStop\('call-ended'\)/);
  assert.doesNotMatch(analyze,/msgs\([^)]*\)\.push\([^)]*data/,'raw camera images must not enter chat history');
  assert.doesNotMatch(analyze,/_call\.sub=\{who:'me',text:'正在/,'recognition progress must not enter the main subtitle');
  assert.match(analyze,/callVideoVisionStatus\('working'\)/);
  assert.match(analyze,/callVideoVisionStatus\('failed'\)/);
  const callAI=functionSource('callAI');
  assert.match(callAI,/const hist=\(_videoVisionAutomatic\|\|_screenShareEvent\)\?\[\]:chatHistoryWithDateBoundaries/,'automatic vision replies must not receive stale chat turns');
  assert.match(callAI,/if\(sysNote&&!_videoVisionAutomatic\)hist\.push/,'the proven spoken vision path keeps its existing event-note structure');
  assert.match(callAI,/_videoVisionTurn=sysNote/,'the current frame remains the only active vision event');
  assert.match(callAI,/if\(_videoVisionAutomatic\)/,'only automatic vision uses the cinema-style synthetic user event');
  assert.match(callAI,/else rows\.push\(\{role:'user',content:_videoVisionTurn\}\)/,'automatic vision providers receive a real user turn');
  assert.match(callAI,/content:String\(last\.content\|\|''\)\+'\\n\\n'\+_videoVisionTurn/,'automatic vision retries also end with the current frame');
  assert.match(callAI,/if\(_videoVision&&!systemText\)\{_call\.sub=null;updateCallSub\(\);callVideoVisionStatus\('failed'\);\}/,'ordinary vision transport failures stay out of the central subtitle');
  assert.match(callAI,/_call\.sub=\{who:systemText\?'system':'them',text:systemText\|\|callFailureText\(e\)\}/,'guarded model failures may show an explicit non-spoken system notice');
  assert.match(callAI,/_callVisionPend\.push/,'vision replies use a dedicated priority queue');
  assert.match(callAI,/callVideoVisionReplyGrounded/,'vision replies must mention a concrete scene detail');
});

test('preferences expose minute interval and an automatic-only per-call limit',()=>{
  const settings=functionSource('renderSettings');
  const save=functionSource('saveSettings');
  assert.match(settings,/s_vvision_interval/);
  assert.match(settings,/自动识别间隔（分钟）/);
  assert.doesNotMatch(settings,/自动识图间隔（秒）/);
  assert.match(settings,/s_vvision_max/);
  assert.match(settings,/只限制定时自动识别/);
  assert.match(save,/videoVisionIntervalMin/);
  assert.doesNotMatch(save,/S\.settings\.videoVisionIntervalSec=/);
  assert.match(save,/videoVisionMaxPerCall/);
  assert.match(save,/oldVideoVisionInterval!==videoVisionIntervalMin\(\)/,'saving the preference must immediately re-arm or clear the live-call timer');
  assert.match(functionSource('videoVisionIntervalMin'),/:0;/,'missing interval settings default to oral-only recognition');
});

test('private iOS app grants bundled camera capture and declares privacy usage',()=>{
  assert.match(webView,/type == \.camera/);
  assert.match(webView,/type == \.cameraAndMicrophone/);
  assert.match(webView,/bundledPage && supportedCapture \? \.grant : \.deny/);
  assert.match(project,/INFOPLIST_KEY_NSCameraUsageDescription/);
  assert.match(project,/CURRENT_PROJECT_VERSION = 169/);
  assert.match(project,/MARKETING_VERSION = 1\.0\.169/);
});

test('private iOS camera preview keeps one media session across recognized sentences',()=>{
  const keep=functionSource('callNativeCameraMediaOn'),callAI=functionSource('callAI');
  assert.match(keep,/privateNativeAppOn\(\)&&callVideoCameraOn\(\)/);
  assert.match(callAI,/!callNativeSharedMediaAudioOn\(\)&&!callNativeCameraMediaOn\(\)&&!hfAudioPaused/);
  assert.match(callAI,/_callBusy 会丢弃角色回声/);
  assert.doesNotMatch(functionSource('callVideoCameraOn'),/pause\(|stop\(/);
});
