import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.match(source, /showMoodTag:true/);
assert.match(source, /聊天顶部心情标签/);
assert.match(source, /关闭后隐藏聊天页最上方的角色心情，不会删除或重置心情内容/);
assert.match(source, /S\.settings\.showMoodTag=\(S\.settings\.showMoodTag===false\);save\(\);render\(\)/);
assert.match(source, /const mood=!wechatNaturalOn\(\)&&S\.settings\.showMoodTag!==false&&c\.mood\?/);

console.log('mood tag visibility tests passed');
