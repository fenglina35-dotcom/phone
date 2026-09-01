import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const push=fs.readFileSync(new URL('../supabase/functions/phone-role-push/index.ts',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift',import.meta.url),'utf8');
const pip=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift',import.meta.url),'utf8');
const glass=fs.readFileSync(new URL('../glass-theme.css',import.meta.url),'utf8');

assert.match(app,/1\. 角色基础人设、身份与说话习惯/);
assert.match(app,/2\. 世界书中的真实设定和明确规则/);
assert.match(app,/3\. 当前真实事件、双方实际做过的事、长期记忆/);
assert.match(app,/4\. 角色本人基于以上事实作出的自主判断与自然表达/);
assert.match(app,/5\. 具体功能的可用方式与权限边界/);
assert.match(app,/function extremeLoveOn\(\)\{return false;\}/);
assert.match(app,/function adjMood\(\)\{return false;\}/);
assert.match(app,/function currentRoleActivity\(\)\{return null;\}/);
assert.match(app,/_hlPlan=null/);
assert.match(app,/_relIntent=null/);
assert.match(app,/function roleCapabilityPrompt\(\)/);
assert.match(app,/执行后你要记得那是自己做过的真实事件/);
assert.match(app,/content=applyControlTags\(content,c,id,_statedPwd,_userText,_replyActionOutcome\)/);
assert.match(push,/必须按以下优先顺序理解：1\.角色基础人设/);
assert.match(push,/是否使用、使用哪一种、何时使用全由角色本人决定/);

assert.match(app,/function callNativeSharedMediaAudioOn\(\)\{return privateNativeAppOn\(\)&&\(cinemaNativeMediaAudioOn\(\)\|\|callScreenShareOn\(\)\);\}/);
assert.match(app,/nativeScreenShare=privateNativeAppOn\(\)&&callScreenShareOn\(\)/);
assert.match(app,/mixMode:nativeCinema\?'cinema':nativeScreenShare\?'screenShare':nativeCamera\?'camera':'call'/);
assert.match(app,/if\(!callNativeSharedMediaAudioOn\(\)&&!callNativeCameraMediaOn\(\)&&!hfAudioPaused&&_callHF&&_callSR\)/);
assert.match(app,/如果画面中有影视对白字幕、短视频字幕/,'screen-share frames must ask vision to transcribe visible burned-in captions');
assert.match(app,/这不等于提取整部视频的字幕文件/,'the fallback must state its real limitation');
assert.match(bridge,/let mixMode = arguments\["mixMode"\] as\? String \?\? "call"/);
assert.match(bridge,/mixMode == "cinema" \|\| mixMode == "screenShare" \|\| mixMode == "camera"/);
assert.match(bridge,/preserveCurrentSession: mixWithMedia/);
assert.match(pip,/if !preserveCurrentSession \{/);

assert.match(glass,/north-native-app\.north-glass-ui \.home \.home-widget-item/);
assert.match(glass,/north-native-app\.north-glass-ui \.home \.dock/);
assert.match(glass,/north-native-app\.north-glass-ui \.glass-second-portrait/);
assert.match(glass,/backdrop-filter:none!important;-webkit-backdrop-filter:none!important/);

assert.match(app,/function roleServerScheduleConfig\(c\)/);
assert.match(app,/roleSchedule:roleServerScheduleConfig\(c\)/);
assert.match(push,/roleWorkStart/);
assert.match(push,/roleWorkEnd/);
assert.match(push,/let candidate = automationCandidate\(profile, \{\}\)/,'work schedule must run before companion-device refresh');
assert.ok(push.indexOf('let candidate = automationCandidate(profile, {})')<push.indexOf('const lastRefresh = Math.max('),'work schedule must not depend on a paired device snapshot');
assert.match(push,/真实作息事件/);
assert.match(push,/由你按人设、世界书、记忆和关系自行决定/);
assert.match(app,/function currentRoleActivity\(\)\{return null;\}/);

console.log('v965 role autonomy and external screen-share audio tests passed');
