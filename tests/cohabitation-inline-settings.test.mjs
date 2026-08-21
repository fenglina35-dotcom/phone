import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(escaped)escaped=false;
      else if(ch==='\\')escaped=true;
      else if(ch===quote)quote='';
      continue;
    }
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('common-life settings are persisted per home with backward-compatible defaults',()=>{
  const sandbox={S:{settings:{offHist:42,offSummaryModel:'aux',offSummaryMode:'split'}}};
  vm.createContext(sandbox);
  vm.runInContext(`${functionSource('cohabSettings')};globalThis.read=cohabSettings`,sandbox);
  const first={},second={};
  assert.deepEqual({...sandbox.read(first)},{contextLimit:42,summaryRounds:6,summaryMemoryLimit:8,summaryMode:'split',replyModel:'role',replyApiRoute:'follow',summaryModel:'aux',summaryApiRoute:'reply'});
  first.settings.contextLimit=77;
  first.settings.summaryRounds=0;
  first.settings.summaryMemoryLimit=18;
  first.settings.summaryMode='single';
  first.settings.replyModel='main';
  first.settings.replyApiRoute='2';
  first.settings.summaryModel='reply';
  first.settings.summaryApiRoute='follow';
  assert.deepEqual({...sandbox.read(first)},{contextLimit:77,summaryRounds:0,summaryMemoryLimit:18,summaryMode:'single',replyModel:'main',replyApiRoute:'2',summaryModel:'reply',summaryApiRoute:'follow'});
  assert.equal(sandbox.read(second).contextLimit,42,'another role home must keep its own defaults');
});

test('all common-life controls are inline above the chat and save without a page render',()=>{
  const panel=functionSource('cohabSettingsPanel');
  const render=functionSource('renderCohab');
  const setter=functionSource('cohabSettingSet');
  assert.match(panel,/summaryMode/);
  assert.match(panel,/cohabSummarizeNow/);
  assert.match(panel,/cohabMemoryOpen/);
  assert.match(panel,/共同生活设置/);
  assert.match(panel,/cohab-debug-actions/);
  assert.match(panel,/cohab-debug-reply/);
  assert.match(panel,/onclick="offReply\(\)"/);
  assert.match(panel,/最近上下文/);
  assert.match(panel,/自动总结/);
  assert.match(panel,/旧总结引用/);
  assert.match(panel,/replyModel/);
  assert.match(panel,/replyApiRoute/);
  assert.match(panel,/summaryModel/);
  assert.match(panel,/summaryApiRoute/);
  assert.ok(render.indexOf('cohabSettingsPanel(id,o)')<render.indexOf('id="offbg"'),'settings must stay above the scrollable chat');
  assert.match(setter,/save\(\)/);
  assert.doesNotMatch(setter,/render\(/,'changing a select must not replace the current chat composer');
  assert.match(html,/\.cohab-settings-grid\{display:grid/);
  assert.match(html,/\.cohab-debug-reply\{[^}]*background:#1b1813/,'manual reply must be opaque inside expanded debug settings');
  assert.doesNotMatch(render,/\$\{replyTop\}/,'common-life top bar must not contain the manual reply chip');
});

test('context, reply route and summary route feed the real common-life model chain',()=>{
  assert.match(functionSource('cohabReplyCore'),/offlineHistoryMessages\(o,cohabContextLimit\(o\)/);
  assert.match(functionSource('cohabRepairMessages'),/offlineHistoryMessages\(o,cohabContextLimit\(o\)/);
  assert.match(functionSource('cohabRoleChat'),/aux:cohabReplyAux\(c,d\)/);
  assert.match(functionSource('cohabRoleChat'),/routeIndex:cohabReplyRouteIndex\(d\)/);
  assert.match(functionSource('cohabSummarize'),/aux=cohabSummaryAux\(c,d\)/);
  assert.match(functionSource('cohabSummarize'),/routeIndex=cohabSummaryRouteIndex\(d\)/);
  assert.match(functionSource('cohabMemoryPrompt'),/cohabSummaryMemoryLimit\(d\)/);
  assert.match(functionSource('cohabSystem'),/offlineUnifiedTimelinePrompt\(c,o,contextLimit\)/);
});

test('common-life summaries stay in their own store and are only retrieved by both model paths',()=>{
  const summarize=functionSource('cohabSummarize');
  const wechat=functionSource('cohabWechatPrompt');
  const faceToFace=functionSource('cohabReplyCore');
  assert.match(summarize,/d\.summaries\.push/);
  assert.doesNotMatch(summarize,/c\.summaries|summaryList\(|offData\(|S\.messages/,'summary output must not be copied into WeChat or one-time date storage');
  assert.match(wechat,/cohabMemoryPrompt\(d,/,'WeChat may retrieve from the common-life store when sync is enabled');
  assert.match(faceToFace,/cohabMemoryPrompt\(o,query\)/,'common-life replies must retrieve from the same store');
  assert.match(functionSource('cohabMemoryOpen'),/d\.summaries/);
});
