import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const project=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj',import.meta.url),'utf8');

assert.match(source,/APP_VER='v1064 · 外卖澄清续单与网关恢复版'/);
assert.match(html,/__NORTH_SHELL_BUILD__='1064'/);
assert.match(sw,/BUILD='1064'/);
assert.equal((project.match(/CURRENT_PROJECT_VERSION = 187;/g)||[]).length,12);
assert.equal((project.match(/MARKETING_VERSION = 1\.0\.187;/g)||[]).length,12);

assert.match(source,/const WECHAT_UNIFIED_SYSTEM=true/);
assert.match(source,/function wechatNaturalOn\(\)\{return WECHAT_UNIFIED_SYSTEM;\}/);
assert.doesNotMatch(source,/wechatNatural:false/);
assert.doesNotMatch(source,/微信自然模式（测试）/);
assert.doesNotMatch(source,/settings\.wechatNatural/);
assert.doesNotMatch(source,/id="s_natural"/);

assert.match(source,/function dialogueEmotion\(\)\{return null;\}/);
assert.match(source,/function adjMood\(\)\{return false;\}/);
assert.match(source,/const plan=wechatNaturalInitiativePlan\(c\)/);

// The unified default intentionally keeps the two most mechanical systems out.
assert.match(source,/if\(!wechatNaturalOn\(\)\)maybeGrudgeResolve/);
assert.match(source,/function powerOn\(\)\{return false;\}/);

console.log('v965 WeChat unified system tests passed');
