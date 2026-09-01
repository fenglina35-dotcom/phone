import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

assert.match(source,/function rolePriorityPrompt\(\)/);
assert.match(source,/1\. 角色基础人设、身份与说话习惯/);
assert.match(source,/2\. 世界书中的真实设定和明确规则/);
assert.match(source,/3\. 当前真实事件、双方实际做过的事、长期记忆/);
assert.match(source,/4\. 角色本人基于以上事实作出的自主判断与自然表达/);
assert.match(source,/5\. 具体功能的可用方式与权限边界/);
assert.match(source,/功能说明只告诉你“能做什么、怎样执行”，绝不规定你此刻必须生气、开心、来电、送礼/);
assert.match(source,/_relIntent=null/,'legacy forced relationship planner must not rewrite replies');
assert.match(source,/_hlPlan=null/,'legacy behavior planner must not rewrite replies');
assert.match(source,/function powerOn\(\)\{return false;\}/);
assert.match(source,/function bdsmKnowledgeOn\(\)\{return false;\}/);
assert.match(source,/function humanLikeOn\(\)\{return false;\}/);
assert.match(source,/function extremeLoveOn\(\)\{return false;\}/);
assert.match(source,/content=applyControlTags\(content,c,id,_statedPwd,_userText,_replyActionOutcome\)/,'real function execution remains connected');
assert.match(source,/role:_naturalOn&&m\.type==='sys'\?'system':m\.role/,'real events remain system facts instead of forged user speech');

console.log('role autonomy policy tests passed');
