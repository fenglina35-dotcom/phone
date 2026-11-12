import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

assert.doesNotMatch(source,/wechatNatural:false/,'the retired opt-in flag must not be recreated');
assert.doesNotMatch(source,/微信自然模式（测试）/,'the retired mode switch must not remain visible');
assert.match(source,/const WECHAT_UNIFIED_SYSTEM=true;/);
assert.match(source,/function wechatNaturalOn\(\)\{return WECHAT_UNIFIED_SYSTEM;\}/);
assert.match(source,/const _natural=!!opt\.natural,_need=\(\)=>true;/,'all capability modules must be available in the unified system');
assert.match(source,/function wechatNaturalSlimSystem\(text,opt\)\{if\(!opt\|\|!opt\.natural\)return text;const need=\(\)=>true/);
assert.match(source,/_need\('games'\)/);
assert.match(source,/_need\('shopping'\)/);
assert.match(source,/_need\('cinema'\)/);
assert.match(source,/_need\('phone'\)/);
assert.match(source,/_need\('profile'\)/);
assert.match(source,/_stableSys=_naturalOn\?buildSystem/,'fallback still needs the complete unified prompt');
assert.match(source,/natural:true,allModules:true/);
assert.match(source,/catch\(e\)\{if\(_roleSongPlan\)\{content=roleSongAttachPlan\('',id,_roleSongPlan\);toast\('[^']+'\);\}else\{if\(!_naturalOn\|\|_routeState\.fallback\)throw e;/,'an auxiliary fallback must not run twice');
assert.match(source,/wechatRoleDrift\(content\)[\s\S]{0,1600}content:_stableSys/,'role drift must retry with the stable prompt');

console.log('WeChat unified natural system tests passed');
