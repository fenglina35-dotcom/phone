import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

assert.match(source,/wechatNatural:false/,'natural mode must remain opt-in');
assert.match(source,/微信自然模式（测试）/);
assert.match(source,/function wechatNaturalOn\(\)/);
assert.match(source,/const _natural=!!opt\.natural,_need=kind=>!_natural\|\|!!opt\.allModules\|\|wechatNaturalModuleNeeded/);
assert.match(source,/_need\('games'\)/);
assert.match(source,/_need\('shopping'\)/);
assert.match(source,/_need\('cinema'\)/);
assert.match(source,/_need\('phone'\)/);
assert.match(source,/_need\('profile'\)/);
assert.match(source,/need\('control'\)/);
assert.match(source,/need\('finance'\)/);
assert.match(source,/need\('social'\)/);
assert.match(source,/_stableSys=_naturalOn\?buildSystem/,'natural prompts need a complete stable fallback');
assert.match(source,/natural:true,allModules:true/,'fallback may restore capability rules without restoring numeric behavior control');
assert.match(source,/catch\(e\)\{if\(!_naturalOn\)throw e;/,'stable mode errors must keep their original behavior');
assert.match(source,/wechatRoleDrift\(content\)[\s\S]{0,1600}content:_stableSys/,'role drift in natural mode must retry with the stable prompt');

console.log('WeChat natural mode safety tests passed');
