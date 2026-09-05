import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function functionSource(name){
  const fnStart=source.indexOf('function '+name+'(');assert.ok(fnStart>=0,'missing '+name);
  const start=source.slice(Math.max(0,fnStart-6),fnStart)==='async '?fnStart-6:fnStart;
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

function oneLineFunctionSource(name){
  const start=source.indexOf('function '+name+'(');assert.ok(start>=0,'missing '+name);
  const end=source.indexOf('\nfunction ',start+9);
  return source.slice(start,end<0?source.length:end).trim();
}

function safetySandbox(){
  const sandbox=vm.createContext({String,RegExp});
  sandbox.roleVisibleEnvelopeText=(value)=>String(value==null?'':value).trim();
  sandbox.splitBubbles=(text)=>String(text||'').split('\n').map(x=>x.trim()).filter(Boolean);
  sandbox.stripHiddenThoughtTags=(line)=>String(line||'').replace(/[\[【]\s*(?:内心|心情)\s*[|｜:：][^\]】]*[\]】]/g,'').trim();
  sandbox.cleanRolePunct=(line)=>String(line||'');
  sandbox.wxKnownTagLine=(line)=>/^[\[【]/.test(String(line||''));
  sandbox.isOOCLine=()=>false;
  vm.runInContext('this.normalizeHiddenThoughtFormats='+oneLineFunctionSource('normalizeHiddenThoughtFormats'),sandbox);
  vm.runInContext('this.wechatReasoningLeak='+oneLineFunctionSource('wechatReasoningLeak'),sandbox);
  for(const name of ['wxEscRe','wechatNarrationLeakLine','wechatNarrationFiltered','wechatHasDirectVisibleLine','wechatInnerThoughtValue','wechatInnerThoughtOnlyValue'])vm.runInContext('this.'+name+'='+oneLineFunctionSource(name),sandbox);
  vm.runInContext('this.wxNarrationNameRe='+functionSource('wxNarrationNameRe'),sandbox);
  return sandbox;
}

test('reasoning gate blocks high-confidence dumps and leaves ordinary role text untouched',()=>{
  const s=safetySandbox();
  const normal='我认真分析了一下，还是想先听你说。\n[图片|桌上的热牛奶]';
  assert.equal(s.wechatReasoningLeak(normal),false);
  assert.equal(String(normal),normal,'normal output is byte-identical because the gate is observational');
  assert.equal(s.wechatReasoningLeak('<指令解析>\n用户输入：“不是！”\n结合上下文\n分析：\n1. 用户在否认。'),true);
  assert.equal(s.wechatReasoningLeak('{"content":"<指令解析>\\n用户输入：不是\\n分析：继续追问"}'),true,'reasoning inside a response envelope is still blocked');
  assert.equal(s.wechatReasoningLeak('{broken <指令解析> 用户输入：不是 分析：继续追问'),true,'malformed envelopes fall back to raw-text inspection');
  assert.equal(s.wechatReasoningLeak('用户输入：不是\n结合上下文\n回复策略：继续追问'),true);
  assert.equal(s.wechatReasoningLeak('分析：这件事我确实做错了。'),false,'one natural-looking marker alone is not enough');
});

test('mixed narration removes only the definite narration line and preserves dialogue and tags',()=>{
  const s=safetySandbox(),role={name:'先生',remark:'先生'};
  const mixed='[内心|有点吃醋]\n动作顿了顿，眼神沉了几分。\n先生？\n[图片|办公桌上的文件]';
  const filtered=s.wechatNarrationFiltered(mixed,role);
  assert.equal(filtered,'[内心|有点吃醋]\n先生？\n[图片|办公桌上的文件]');
  assert.equal(s.wechatHasDirectVisibleLine(filtered),true);
  assert.equal(s.wechatNarrationFiltered('我现在还在门诊，等会儿回你。',role),'我现在还在门诊，等会儿回你。');
});

test('inner-thought recovery accepts only one valid hidden tag',()=>{
  const s=safetySandbox();
  assert.equal(s.wechatInnerThoughtValue('[内心|其实很担心你]\n到家告诉我。'),'其实很担心你');
  assert.equal(s.wechatInnerThoughtOnlyValue('[内心|嘴硬，但还是想哄你]'),'嘴硬，但还是想哄你');
  assert.equal(s.wechatInnerThoughtOnlyValue('[内心|担心你]\n我来分析一下'),'');
  assert.equal(s.wechatInnerThoughtOnlyValue('<指令解析>\n[内心|担心你]'),'');
});

test('foreground repair is anomaly-only and never rewrites a normal reply just to repair mood',()=>{
  const ai=functionSource('aiReply');
  assert.match(ai,/if\(wechatReasoningLeak\(content\)\)/);
  assert.match(ai,/const kept=wechatNarrationFiltered\(content,c\);if\(wechatHasDirectVisibleLine\(kept\)\)content=kept/);
  assert.match(ai,/thought\)content='\[内心\|'/);
  assert.match(ai,/else\{c\.innerThoughtMissingAt=Date\.now\(\);save\(\);refreshChatMood\(id\);\}/);
});
