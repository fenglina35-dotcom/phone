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

const context=vm.createContext({S:{settings:{wechatNatural:true}},String});
vm.runInContext([
  functionSource('wechatNaturalOn'),
  functionSource('wechatNaturalModuleNeeded'),
  functionSource('wechatNaturalCallEventNote'),
  functionSource('wechatNaturalAutonomyNoteActive'),
  functionSource('wechatNaturalCallEventActive'),
  functionSource('wechatNaturalSilentDecision'),
  functionSource('wechatNaturalInitiativePlan'),
  functionSource('wechatNaturalSlimSystem'),
  ';globalThis.need=wechatNaturalModuleNeeded;globalThis.note=wechatNaturalCallEventNote;globalThis.silent=wechatNaturalSilentDecision;globalThis.slim=wechatNaturalSlimSystem;',
].join('\n'),context);

assert.equal(context.need('control','把游戏锁定'),true,'explicit lock requests must restore control capability rules');
assert.equal(context.need('control','早上好'),false);
assert.equal(context.need('finance','给我转账'),true);
assert.equal(context.need('social','看看朋友圈'),true);
assert.equal(context.need('tasks','看看今天的任务便签'),true);
assert.equal(context.need('tasks','普通聊天'),false);

const sample='基础人设\n\n# 申请远程操控小手机\n远控规则\n\n# 你对玩家手机App的管控权\n锁软件规则\n\n# 微信聊天规则\n基本格式';
assert.doesNotMatch(context.slim(sample,{natural:true,query:'早上好'}),/远控规则|锁软件规则/);
assert.match(context.slim(sample,{natural:true,query:'把游戏锁定'}),/锁软件规则/,'lock rules must remain available when requested');
const forcedMood='基础\n\n# 微信聊天规则\n- 【每次回复都要更新一行】 [心情|你此刻的心情和内心想法]：必须更新。\n- 记忆：保留真实记忆。\n- 情绪被追问时：必须透露原因，不能一直说没事。\n- 表情包：按自己意愿。';
const naturalMood=context.slim(forcedMood,{natural:true,query:'早上好'});
assert.doesNotMatch(naturalMood,/每次回复都要更新|情绪被追问时/);
assert.match(naturalMood,/记忆：保留真实记忆|表情包：按自己意愿/);
assert.doesNotMatch(context.slim(forcedMood,{natural:true,allModules:true,query:'早上好'}),/每次回复都要更新|情绪被追问时/,'fallback may restore capabilities but never the mood controller');
assert.match(context.note(),/自主决定下一步/);
assert.match(context.note(),/\[保持安静\]/);
assert.equal(context.silent('[心情|有点闷]\n[保持安静]',context.note()),true);

const initiativePlan=vm.runInContext('wechatNaturalInitiativePlan()',context);
assert.equal(initiativePlan.kind,'autonomy');
assert.match(initiativePlan.note,/主动联系自主决策/);
assert.match(initiativePlan.note,/\[保持安静\]/);

assert.match(source,/_hlPlan=humanLikeOn\(\)&&!_naturalOn\?/,'behavior planner must not decide natural-mode replies');
assert.match(source,/_relIntent=_naturalOn\?null:relationshipIntent/,'numeric relationship policy must be absent in natural mode');
assert.match(source,/if\(!_naturalOn\)maybeAffectionShift/,'affection must not auto-shift in natural mode');
assert.match(source,/if\(!_naturalOn\)syncVisibleMood/,'mood must not auto-normalize in natural mode');
assert.match(source,/if\(!_naturalOn&&moodProbeText/,'mood-driven rewrite must be disabled in natural mode');
assert.match(source,/if\(_main&&!_natural\)\{const mv=moodNow/,'current mood prompt must stay out of natural mode');
assert.match(source,/if\(_main&&!_natural&&c\.emotionTailUntil/,'emotion tail must stay out of natural mode');
assert.match(source,/if\(_main&&!_natural\)\{const gd=\(c\.grudges/,'grudge and task pressure must stay out of natural mode');
assert.match(source,/if\(_main&&!_natural&&!opt\.selectiveMemory\)/,'power and behavior prompts must stay out of natural mode');
assert.match(source,/if\(!_natural\)\{const _ap=currentActivityPrompt/,'system-selected activities must stay out of natural mode');
assert.match(source,/# 日常自主性/,'natural mode should explicitly leave daily state to the role');
assert.match(source,/role:_naturalOn&&m\.type==='sys'\?'system':m\.role/,'system events must not masquerade as user speech');
assert.match(source,/role:_naturalOn\?'system':'user'/,'all natural-mode event notes must be system facts, never fake user speech');
assert.match(source,/\(_natural\?traitSpeechDesc\(c\):traitDesc\(c\)\)/,'numeric personality sliders must stay out of natural mode');
assert.match(source,/function adjMood\(id,d\)\{if\(wechatNaturalOn\(\)\)return;/,'mood value changes must be inert in natural mode');
assert.match(source,/function checkIgnore\(\)\{if\(wechatNaturalOn\(\)\|\|/,'legacy no-reply escalation must be disabled in natural mode');
assert.match(source,/function checkFollowups\(\)\{if\(wechatNaturalOn\(\)\|\|/,'scheduled follow-up prompts must not force a natural-mode message');
assert.match(source,/async function recordTaMood\(cid\)\{if\(wechatNaturalOn\(\)\)return false;/,'the system must not invent a daily mood for the role in natural mode');
assert.match(source,/if\(!wechatNaturalOn\(\)&&hol&&F\['hol_'\+c\.id\]/,'holiday greetings and red packets must not be forced in natural mode');
assert.match(source,/if\(!wechatNaturalOn\(\)&&S\.couple&&S\.couple\.cid&&h>=14/,'the daily mood scheduler must be disabled in natural mode');
assert.match(source,/微信自然模式：不把久未打开解释为冷落/,'phone-idle events must not force a natural-mode reply');
assert.match(source,/if\(!wechatNaturalOn\(\)\)cf\+='\\n- 【你很黏ta、舍不得挂电话】/,'the fixed clingy call policy must be stable-mode only');
assert.match(source,/if\(!wechatNaturalOn\(\)\)maybeAffectionShift\(_call\.id/,'calls must not shift affection in natural mode');
assert.match(source,/content=_naturalOn\?content\.replace\([^\n]+\):applyGrudgeTags\(content,c\)/,'natural-mode WeChat replies must not write to the grudge ledger');
assert.match(source,/if\(!_naturalOn\)maybeGrudgeResolve\(content,c,id\)/,'natural-mode WeChat replies must not auto-resolve grudges');
assert.match(source,/if\(!wechatNaturalOn\(\)\)maybeGrudgeResolve\(content,c,_call\.id\)/,'natural-mode calls must not auto-resolve grudges');
assert.match(source,/if\(c&&!wechatNaturalOn\(\)\)\{const mood=honestMoodText/,'inline call mood tags must not write visible mood in natural mode');
assert.match(source,/wechatCallEventReplyNote\(/,'call lifecycle must route through the autonomous test-mode note');
assert.match(source,/content=applyControlTags\(content,c,id,_statedPwd\)/,'lock/control execution must remain connected');
assert.match(source,/extractControl\(content,c,_statedPwd\)/,'natural-language lock execution must remain connected');

console.log('WeChat autonomy mode tests passed');
