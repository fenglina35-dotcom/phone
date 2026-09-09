import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const paths=['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'];
for(const path of paths){
 const src=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const fn=name=>src.split(/\r?\n/).find(l=>l.startsWith('function '+name+'('))||'';
 const ctx=vm.createContext({uid:()=> 'id',esc:s=>s});
 vm.runInContext(['companionAllControlClauseAction','companionNaturalAllControlAction','companionAllExternalIntent','companionRequestedAllControlAction','offlineStripMoodTags','modelUnfilteredLines','modelUnfilteredOfflineItems','offRevealText'].map(fn).join('\n'),ctx);
 test(path+' refuses question and refusal all-unlock',()=>{
  for(const text of ['全部解锁？想得美，北。今天的账还挂着呢。','全部解锁? 想得美。','你说“全部解锁”。我可没同意。','全部解锁，才怪。','全部解锁，等你先把鞋摆好。']) assert.equal(ctx.companionNaturalAllControlAction(text),'',text);
  assert.equal(ctx.companionNaturalAllControlAction('全部解锁。'),'unlock');
  assert.equal(ctx.companionNaturalAllControlAction('我已经把你的所有软件都锁上了。'),'lock');
 });
 test(path+' user request never broadens role selected targets',()=>{
  assert.equal(ctx.companionRequestedAllControlAction('只给你开微信。[解锁|微信|仅内置]','全部解锁。'),'');
  assert.equal(ctx.companionRequestedAllControlAction('[解锁|全部内外 App|内外同时]',''),'unlock');
  assert.equal(ctx.companionRequestedAllControlAction('全部解锁？想得美。[解锁|全部内外 App|内外同时]','全部解锁。'),'');
 });
 test(path+' raw offline drops metadata but keeps speech and narration',()=>{
  const items=ctx.modelUnfilteredOfflineItems('[心情|这只小狗又想拿撒娇糊弄过去]\n【他站在门边。】\n过来。');
  assert.deepEqual(Array.from(items,x=>x.text),['他站在门边。','过来。']);
  assert.equal(ctx.modelUnfilteredOfflineItems('【心情｜微恼】').length,0);
 });
 test(path+' stored role mood hidden without changing user text',()=>{
  assert.equal(ctx.offRevealText({who:'ta',text:'[心情|微恼]过来。'}),'过来。');
  assert.equal(ctx.offRevealText({who:'旁白',source:'ta',text:'心情|微恼'}),'');
  assert.equal(ctx.offRevealText({who:'旁白',source:'me',text:'[心情|我自己写的]'}),'[心情|我自己写的]');
 });
}
