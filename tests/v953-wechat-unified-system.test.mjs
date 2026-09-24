import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const project=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj',import.meta.url),'utf8');

assert.match(source,/APP_VER='v1316 · 全新手机第一次打开就套上默认美化'/);
assert.match(html,/__NORTH_SHELL_BUILD__='1316'/);
assert.match(sw,/BUILD='1316'/);
assert.equal((project.match(/CURRENT_PROJECT_VERSION = 392;/g)||[]).length,12);
assert.equal((project.match(/MARKETING_VERSION = 1.0.392;/g)||[]).length,12);

assert.match(source,/const WECHAT_UNIFIED_SYSTEM=true/);
assert.match(source,/function wechatNaturalOn\(\)\{return WECHAT_UNIFIED_SYSTEM;\}/);
assert.doesNotMatch(source,/wechatNatural:false/);
assert.doesNotMatch(source,/微信自然模式（测试）/);
assert.doesNotMatch(source,/settings\.wechatNatural/);
assert.doesNotMatch(source,/id="s_natural"/);

assert.match(source,/function dialogueEmotion\(\)\{return null;\}/);
assert.match(source,/function adjMood\(\)\{return false;\}/);
assert.match(source,/const plan=wechatNaturalInitiativePlan\(c\)/);

// 她说「记仇本他不太会用」：查出来统一模式把 [记仇]/[消气] 整段抹掉扔了，
// 微信和通话里一次都没落过地。现在统一模式下也真的记账、真的划账。
assert.doesNotMatch(source,/if\(!wechatNaturalOn\(\)\)maybeGrudgeResolve/);
assert.doesNotMatch(source,/if\(!_naturalOn\)maybeGrudgeResolve/);
assert.match(source,/maybeCollarIntent\(content,c\);maybeGrudgeResolve\(content,c,id\);/);
assert.match(source,/maybeCollarIntent\(content,c\);maybeGrudgeResolve\(content,c,_call\.id\);/);
// 心情条那一套仍然留在统一模式外。
assert.match(source,/function powerOn\(\)\{return false;\}/);

console.log('v965 WeChat unified system tests passed');
