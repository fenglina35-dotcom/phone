import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const context=vm.createContext({WECHAT_UNIFIED_SYSTEM:true,String});
vm.runInContext([
  functionSource('wechatNaturalOn'),
  functionSource('featureEventNote'),
  functionSource('wechatNaturalCallEventNote'),
  functionSource('wechatNaturalSilentDecision'),
  functionSource('wechatNaturalSlimSystem'),
  ';globalThis.enabled=wechatNaturalOn;globalThis.note=wechatNaturalCallEventNote;globalThis.silent=wechatNaturalSilentDecision;globalThis.slim=wechatNaturalSlimSystem;',
].join('\n'),context);

assert.equal(context.enabled(),true,'the unified system remains the only default');
const sample='基础人设\n\n# 申请远程操控小手机\n远控规则\n\n# 你对玩家手机App的管控权\n锁软件规则\n\n# 微信聊天规则\n基本格式';
assert.match(context.slim(sample,{natural:true,query:'早上好'}),/远控规则|锁软件规则/,'capabilities must not disappear from ordinary turns');
assert.match(context.note(),/绝不能把双方说反/);
assert.match(context.note(),/电话里已经回应过的用户话语都属于完成的旧轮次/);
assert.match(context.note(),/由你本人决定怎样自然承接/);
assert.match(context.note(),/也可以暂时不继续动作/);
assert.equal(context.silent('[保持安静]',context.note()),true,'the role may autonomously choose not to follow a call event');

assert.match(source,/function adjMood\(\)\{return false;\}/,'numeric mood updates are retired');
assert.match(source,/function dialogueEmotion\(\)\{return null;\}/,'hidden dialogue emotion controller is retired');
assert.match(source,/function currentRoleActivity\(\)\{return null;\}/,'the program no longer invents current activity');
assert.match(source,/function currentActivityPrompt\(\)\{return'';\}/);
assert.match(source,/_relIntent=null/,'forced relationship policy is retired');
assert.match(source,/_hlPlan=null/,'forced behavior planner is retired');
assert.match(source,/function checkIgnore\(\)\{if\(/);
assert.doesNotMatch(functionSource('checkIgnore'),/wechatNaturalOn/,'real events remain available after removing controllers');
assert.match(source,/# 角色内心想法（仅展示，不控制角色）/);
assert.match(source,/不是心情值，不改变任何数值、亲密度、行为权限或自主决定/);
assert.match(source,/role:_naturalOn&&m\.type==='sys'\?'system':m\.role/,'system events must not masquerade as user speech');
assert.match(source,/是否舍不得挂电话、是否挽留以及如何挽留，都由你本人的基础人设、当前关系和这通电话的真实内容决定/,'call clinginess remains character-led');
assert.match(source,/对方明确有事、很困、要停止或重复提出挂断时必须尊重/,'clinginess retains its hard stop boundary');
assert.match(source,/content=applyControlTags\(content,c,id,_statedPwd,_userText,_replyActionOutcome\)/,'lock and control execution remains connected');

console.log('WeChat role autonomy tests passed');
