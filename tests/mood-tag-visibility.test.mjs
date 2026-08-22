import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const wechat = fs.readFileSync(new URL('../wechat-me.js', import.meta.url), 'utf8');

assert.match(source, /showMoodTag:true/);
assert.match(source, /# 角色内心想法（仅展示，不控制角色）/);
assert.match(wechat, /心情气泡/);
assert.match(wechat, /S\.settings\.showMoodTag=S\.settings\.showMoodTag===false;save\(\);render\(\)/);
assert.match(source, /const thought=wechatNaturalOn\(\)\?String\(c\.innerThought\|\|''\):String\(c\.mood\|\|''\)/);
assert.match(source, /id="chatMoodBar"/);
assert.match(source, /display:\$\{S\.settings\.showMoodTag!==false&&thought\?'flex':'none'\}/);
assert.match(source, /function refreshChatMood\(id\)/);
assert.match(source, /thoughtOpen=wechatNaturalOn\(\)\?'showInnerThought':'showMood'/);
assert.match(source, /function showInnerThought\(id\)/);

console.log('mood tag visibility tests passed');
