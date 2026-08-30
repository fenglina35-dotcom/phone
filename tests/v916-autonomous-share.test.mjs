import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../app.js');
const html = read('../小手机.html');
const pet = read('../pet-game.js');
const bridge = read('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
const pip = read('../native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift');
const project = read('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');

test('v929 web and private versions are aligned', () => {
  assert.match(app, /APP_VER='v1114 · 朋友圈评论与角色独立路线版'/);
  assert.match(html, /__NORTH_SHELL_BUILD__='1114'/);
  assert.match(project, /CURRENT_PROJECT_VERSION = 235;/);
  assert.match(project, /MARKETING_VERSION = 1\.0\.235;/);
  assert.match(bridge, /contractVersion = 25/);
});

test('screen observation continues only after the role explicitly chooses it', () => {
  assert.match(app, /if\(decision!=='继续'\)\{_callScreenObserveMode='ended'/);
  assert.match(app, /observed\.decision\|\|\(content\?'提问':'结束'\)/);
  assert.doesNotMatch(app, /observed\.decision\|\|'继续'/);
  assert.match(app, /不要按固定频率扫描/);
  assert.match(app, /没有输出合法选择就视为结束/);
  assert.match(app, /\[共享观察\|等待切换\]/);
  assert.match(app, /callScreenAutonomyUserAnswered\(t,meta\)/);
  assert.match(app, /screenFrameToken:token/);
});

test('screen vision ignores the small-phone call overlay', () => {
  assert.match(app, /小手机”的悬浮通话框/);
  assert.match(app, /必须完整忽略/);
  assert.match(app, /不确定软件名称时描述可见特征/);
});

test('native call audio mixes external media with microphone and role voice', () => {
  assert.match(bridge, /allowBluetoothHFP, \.mixWithOthers/);
  assert.match(pip, /allowBluetoothHFP, \.mixWithOthers/);
});

test('subtitles reveal complete phrases naturally and speech finalization allows correction', () => {
  assert.match(html, /@keyframes csphrasein/);
  assert.match(app, /function callSubtitleEnter\(box\)/);
  assert.doesNotMatch(app, /function callSubtitleSizeClass\(text\)/);
  assert.doesNotMatch(app, /function callSubtitleChars/);
  assert.match(bridge, /schedulePartialCommit\(transcript\)/);
  assert.match(bridge, /Task\.sleep\(nanoseconds: 1_650_000_000\)/);
});

test('pet growth never reverses except explicit milk stage', () => {
  assert.match(pet, /function petThinFactor\(\)\{return 1;\}/);
  assert.match(pet, /p\.highestNaturalStage=Math\.max/);
  assert.match(pet, /p\.stageOverride===0\?0:p\.highestNaturalStage/);
  assert.match(pet, /if\(p\.neglectThin\)\{p\.neglectThin=false/);
});

test('cohabitation schedule drives state while manual state lasts through its slot', () => {
  assert.match(app, /function cohabScheduleSync/);
  assert.match(app, /cohabAdvance\(id\);if\(await cohabPhoneFactRetryMaybe\(id\)\)return;if\(await cohabDailyRequiredMaybe/);
  assert.match(app, /d\.stateSource==='owner-manual'/);
  assert.match(app, /当前生活状态已按新时间同步/);
  assert.match(app, /作息表会按真实钟点自动把共同生活状态推进/);
});

test('mainstream search includes Apple China previews without login', () => {
  assert.match(app, /https:\/\/itunes\.apple\.com\/search/);
  assert.match(app, /country=cn&media=music&entity=song/);
  assert.match(app, /Apple 官方试听/);
  assert.match(app, /iTunes 提供/);
  assert.match(app, /trackViewUrl/);
});
