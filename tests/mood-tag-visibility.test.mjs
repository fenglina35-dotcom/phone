import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const wechat = fs.readFileSync(new URL('../wechat-me.js', import.meta.url), 'utf8');

assert.match(source, /showMoodTag:true/);
assert.match(source, /# 角色内心想法（仅展示，不控制角色）/);
assert.match(wechat, /心情气泡/);
assert.match(wechat, /S\.settings\.showMoodTag=S\.settings\.showMoodTag===false;save\(\);render\(\)/);
assert.match(source, /naturalInnerThoughtText\(c\.innerThought\)\|\|naturalInnerThoughtText\(c\.innerThoughtLastValid\)/);
assert.doesNotMatch(source, /innerThoughtMissingAt[^\n]{0,180}\?'':/,'a failed refresh must not hide the last confirmed thought');
assert.match(source, /thought=visibleRoleThought\(c\)/);
assert.match(source, /id="chatMoodBar"/);
assert.match(source, /display:\$\{S\.settings\.showMoodTag!==false\?'flex':'none'\}/);
assert.match(source, /function refreshChatMood\(id\)/);
assert.match(source, /function initialFriendInnerThought\(c,opt\)/);
assert.match(source, /initialFriendInnerThought\(c,\{kind:r\.kind,readd:wasReadd,at:now\}\)/);
assert.match(source, /thoughtOpen=_naturalMood\?'showInnerThought':'showMood'/);
assert.match(source, /function showInnerThought\(id\)/);

console.log('mood tag visibility tests passed');
