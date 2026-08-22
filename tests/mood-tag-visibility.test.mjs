import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.match(source, /showMoodTag:true/);
assert.match(source, /聊天顶部内心想法/);
assert.match(source, /关闭后只隐藏角色自己写下的内心想法，不控制情绪、关系、权限或任何选择/);
assert.match(source, /S\.settings\.showMoodTag=\(S\.settings\.showMoodTag===false\);save\(\);render\(\)/);
assert.match(source, /const thought=wechatNaturalOn\(\)\?String\(c\.innerThought\|\|''\):String\(c\.mood\|\|''\)/);
assert.match(source, /id="chatMoodBar"/);
assert.match(source, /display:\$\{S\.settings\.showMoodTag!==false&&thought\?'flex':'none'\}/);
assert.match(source, /function refreshChatMood\(id\)/);
assert.match(source, /thoughtOpen=wechatNaturalOn\(\)\?'showInnerThought':'showMood'/);
assert.match(source, /function showInnerThought\(id\)/);

console.log('mood tag visibility tests passed');
