import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../message-beijing-time.js',import.meta.url),'utf8');
function load(settings={}){let saves=0,renders=0;const ctx={S:{settings},save:()=>saves++,render:()=>renders++};vm.createContext(ctx);vm.runInContext(code,ctx);return{ctx,counts:()=>[saves,renders]};}
test('Beijing labels use recorded instants and fixed UTC+8 across midnight and DST dates',()=>{
 const {ctx}=load();
 for(const [time,label] of [['2026-09-08T15:59:59Z','23:59:59'],['2026-09-08T16:00:00Z','00:00:00'],['2026-03-08T10:00:00Z','18:00:00']]){
  assert.equal(ctx.NorthMessageTime.label({time:Date.parse(time)}),label);
  assert.equal(ctx.NorthMessageTime.label({ts:String(Date.parse(time))}),label);
 }
 for(const time of [undefined,null,0,NaN,Infinity,-1,'bad',8640000000000000])assert.equal(ctx.NorthMessageTime.label({time}),'时间未知');
});
test('toggle defaults off, preserves all messages and persists only its own setting',()=>{
 const w=load({modelOutputUnfiltered:true}),m={role:'user',type:'text',time:1788883200000,content:'原文'},before=JSON.stringify(m);
 assert.equal(w.ctx.messageBeijingTimeHTML(m),'');w.ctx.messageBeijingTimeToggle();
 assert.match(w.ctx.messageBeijingTimeHTML(m),/display:block!important/);
 assert.match(w.ctx.messageBeijingTimeHTML({...m,role:'assistant'}),/北京时间/);
 assert.equal(w.ctx.messageBeijingTimeHTML({...m,type:'sys'}),'');
 assert.equal(w.ctx.messageBeijingTimeHTML({...m,_silent:true}),'');
 assert.equal(JSON.stringify(m),before);assert.equal(w.ctx.S.settings.modelOutputUnfiltered,true);
 const restored=load(JSON.parse(JSON.stringify(w.ctx.S.settings)));assert.equal(restored.ctx.NorthMessageTime.enabled(),true);
 w.ctx.messageBeijingTimeToggle();assert.equal(w.ctx.messageBeijingTimeHTML(m),'');assert.deepEqual(w.counts(),[2,2]);
});
test('private time module is byte-identical and each shell loads it before the core script',()=>{
 const base='../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
 assert.equal(fs.readFileSync(new URL(base+'message-beijing-time.js',import.meta.url),'utf8'),code);
 for(const file of ['../小手机.html',base+'小手机.html',base+'index.html']){
  const html=fs.readFileSync(new URL(file,import.meta.url),'utf8');assert(html.includes('message-beijing-time.js?'));assert(html.indexOf('message-beijing-time.js?')<html.indexOf('<script src="app.js?'));
 }
});
