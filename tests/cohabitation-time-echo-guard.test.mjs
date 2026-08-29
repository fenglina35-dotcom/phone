import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function functionSource(name){
  const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escape=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const sandbox={String,RegExp,Set};
vm.runInNewContext([
  'function roleVisibleEnvelopeText(value){return String(value||"");}',
  'function splitBubbles(value){return String(value||"").split(/\\n+/).filter(Boolean);}',
  'function splitActions(value){return [value];}',
  functionSource('offNarrationText'),functionSource('offImplicitNarrationText'),
  functionSource('offResponsePart'),functionSource('offResponseParts'),
  functionSource('cohabTimeTopicInput'),functionSource('cohabNarrationReportsClock'),
  functionSource('cohabTimeEchoAudit'),
  'globalThis.audit=cohabTimeEchoAudit;'
].join('\n'),sandbox);

test('common-life time guard catches mechanical clock narration without banning time',()=>{
  const repeated='【现在是下午三点四十分，他把杯子放到桌上。】\n好。\n【墙上的钟显示下午三点四十分，他转身看向她。】';
  const bad=sandbox.audit(repeated,{msgs:[]},'我回来了');
  assert.ok(bad.score>0);
  assert.match(bad.fails.join('；'),/多个旁白都在重复报时/);

  const natural=sandbox.audit('【下午三点四十，他看了一眼约好的车次，拿起外套。】\n我们该出发了。',{msgs:[]},'我准备好了');
  assert.equal(natural.score,0);

  const asked=sandbox.audit(repeated,{msgs:[]},'现在几点了？');
  assert.equal(asked.score,0);
});

test('common-life time guard catches clock openers repeated across recent turns',()=>{
  const state={msgs:[
    {who:'旁白',source:'ta',text:'现在是下午三点三十分，他合上书。'},
    {who:'旁白',source:'ta',text:'墙上的钟显示下午三点三十五分，他抬起头。'},
  ]};
  const result=sandbox.audit('【此刻是下午三点四十分，他走到窗边。】\n你回来啦。',state,'我回来啦');
  assert.ok(result.score>0);
  assert.match(result.fails.join('；'),/连续多轮旁白/);
});

test('common-life prompt keeps accurate time hidden unless the scene needs it',()=>{
  assert.match(source,/时间只用于内部校准（共同生活可见输出硬规则）/);
  assert.match(source,/同一轮最多自然提一次必要的钟点/);
  assert.match(source,/允许正常谈时间，不能为了避开复述而假装不知道时间/);
});
