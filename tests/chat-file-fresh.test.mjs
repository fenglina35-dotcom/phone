import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {read,fnSource,BUNDLES} from './_helpers.mjs';

// CHAT_FILE_FRESH_V1（2026-11-03）：她发给角色的文件，角色以前每轮只看到前 4000 字。
// 现在刚发、角色还没回过的那个文件给他看前 2 万字；之后的聊天里旧文件仍只带 4000 字；存进消息的上限 5 万字。
for(const [label,file] of BUNDLES)test(label+': the file she just sent is read much further than older files',()=>{
 const src=read(file),ctx=vm.createContext({S:{messages:{}}});
 const consts=src.slice(src.indexOf('const CHAT_FILE_MAX='),src.indexOf('function chatFileExt('));
 vm.runInContext(consts.replace(/const /g,'var ')+(src.includes('function chatFileFresh(')?fnSource(src,'chatFileFresh'):'')+fnSource(src,'chatFileContextBody'),ctx);
 assert.equal(ctx.CHAT_FILE_MAX,50000,'stored limit');
 const text='甲'.repeat(30000),m={role:'user',type:'file',name:'a.txt',text};ctx.S.messages['role|main']=[{role:'assistant',type:'text',content:'嗯'},m];
 const fresh=ctx.chatFileContextBody(m);assert(fresh.includes('甲'.repeat(20000))&&!fresh.includes('甲'.repeat(20001)),'fresh file shows 20000 chars');
 ctx.S.messages['role|main'].push({role:'assistant',type:'text',content:'看完了'});
 const old=ctx.chatFileContextBody(m);assert(old.includes('甲'.repeat(4000))&&!old.includes('甲'.repeat(4001)),'answered file back to 4000 chars');
 assert(old.includes('太长了，后面没给你'));
 const short={role:'user',type:'file',name:'b.txt',text:'短文件'};assert(ctx.chatFileContextBody(short).includes('短文件'));
});


for(const [label,file] of BUNDLES){
 test(label+': code files keep full body out of ordinary context',()=>{
  const src=read(file),ctx=vm.createContext({CHAT_FILE_CTX:4000});
  for(const name of ['codeTaskHistory','chatFileContextBody','roleFileHistoryText'])if(src.includes('function '+name+'('))vm.runInContext(fnSource(src,name),ctx);
  const m={id:'code-one',name:'game.html',role:'assistant',type:'file',text:'SECRET_CODE'.repeat(9000),codeTask:{status:'complete',summary:'打地鼠游戏'}};
  for(const t of [ctx.chatFileContextBody(m),ctx.roleFileHistoryText(m)]){assert(!t.includes('SECRET_CODE'));assert(t.includes('code-one'));assert(t.includes('打地鼠'));}
 });
 test(label+': code workflow generates complete long files, preserves old version and stops on foreign account',async()=>{
  const src=read(file),list=[],owner={settings:{}},contact={id:'role'},requests=[];let id=0,account='main',saved=0;
  const ctx=vm.createContext({S:owner,Map,TextEncoder,CHAT_FILE_TEXT_EXT:['html','js'],actId:()=>account,getC:()=>contact,msgs:()=>list,save(){},refreshChatMessages(){},toast(){},uid:()=>String(++id),fmtSize:n=>String(n),persistWechatMessagesNow:async()=>{saved++;return true;},codeModelConfig:()=>({base:'https://code.invalid',key:'fixture',model:'coder',maxTokens:16384})});
  vm.runInContext('const _codeJobs=new Map();',ctx);
  for(const n of ['chatFileExt','chatFileFind','chatFileSize','codeFileName','codeFileHash','codeFileEditable','codeTaskPart','codeFileComplete','codeTaskValid','codeTaskPersist','codeTaskStart','codeTaskRun'])vm.runInContext(fnSource(src,n),ctx);
  const whole='<!DOCTYPE html><html><head></head><body>'+('a'.repeat(62000))+'</body></html>';
  ctx.codeModelRequest=async messages=>{const q=JSON.parse(messages[1].content);requests.push(q);const chunk=whole.slice(q.offset,q.offset+11000);return JSON.stringify({part:q.part,offset:q.offset,chunk,done:q.offset+chunk.length===whole.length,summary:'游戏'});};
  const m=await ctx.codeTaskStart('role',{name:'game.html',request:'做游戏',baseId:'新建'},'user1');
  for(let n=0;n<100&&m.codeTask.status==='running';n++)await new Promise(r=>setImmediate(r));
  assert.equal(m.text,whole);assert.equal(m.codeTask.status,'complete');assert.equal(m.codeTask.draft,'');assert(saved>=7);assert.equal(requests[1].existingCode,whole.slice(0,11000));assert.equal(list.length,1);
  await ctx.codeTaskStart('role',{name:'game.html',request:'做游戏',baseId:'新建'},'user1');assert.equal(list.length,1,'same reply cannot duplicate paid work');
  requests.length=0;const next=await ctx.codeTaskStart('role',{name:'game.html',request:'修改颜色',baseId:m.id},'user2');
  for(let n=0;n<100&&next.codeTask.status==='running';n++)await new Promise(r=>setImmediate(r));
  assert.equal(requests[0].original,whole);assert.equal(m.text,whole);assert.equal(list.length,2);
  let unblock;ctx.codeModelRequest=()=>new Promise(r=>{unblock=r;});const interrupted=await ctx.codeTaskStart('role',{name:'next.html',request:'另一个游戏',baseId:'新建'},'user3');
  await new Promise(r=>setImmediate(r));account='other';unblock(JSON.stringify({part:1,offset:0,chunk:'<html></html>',done:true}));await new Promise(r=>setImmediate(r));assert.equal(interrupted.text,'');assert.equal(interrupted.codeTask.status,'error');
 });
 test(label+': interrupted chunk can resume and invalid chunks never become finished files',async()=>{
  const src=read(file),list=[],ctx=vm.createContext({S:{},Map,TextEncoder,CHAT_FILE_TEXT_EXT:['html'],actId:()=> 'main',getC:()=>({}),msgs:()=>list,save(){},refreshChatMessages(){},toast(){},fmtSize:n=>String(n),persistWechatMessagesNow:async()=>true,codeModelConfig:()=>({key:'fixture',maxTokens:16384})});
  vm.runInContext('const _codeJobs=new Map();',ctx);for(const n of ['chatFileExt','chatFileFind','chatFileSize','codeFileHash','codeFileEditable','codeTaskPart','codeFileComplete','codeTaskValid','codeTaskPersist','codeTaskRun'])vm.runInContext(fnSource(src,n),ctx);
  const m={id:'j',name:'x.html',type:'file',text:'',codeTask:{status:'pending',parts:0,draft:'',request:'做网页'}};list.push(m);
  let count=0;ctx.codeModelRequest=async()=>{if(count++===0)return JSON.stringify({part:1,offset:0,chunk:'<html><body>',done:false});throw Error('网络中断');};
  await ctx.codeTaskRun('role','j');assert.equal(m.text,'');assert.equal(m.codeTask.draft,'<html><body>');assert.equal(m.codeTask.parts,1);
  ctx.codeModelRequest=async messages=>{const q=JSON.parse(messages[1].content);assert.equal(q.offset,12);return JSON.stringify({part:2,offset:q.offset,chunk:'完成</body></html>',done:true});};
  await ctx.codeTaskRun('role','j');assert.equal(m.text,'<html><body>完成</body></html>');
  assert.throws(()=>ctx.codeTaskPart('{"part":1}',1,0),/不完整/);assert.throws(()=>ctx.codeTaskPart(JSON.stringify({part:2,offset:0,chunk:'x',done:true}),1,0),/序号/);
  assert.throws(()=>ctx.codeFileComplete('x.html','<html><body>半截'),/缺少/);
 });
}

for(const [label,file] of BUNDLES)test(label+': disabling code assistant during a request pauses without saving late code or calling again',async()=>{
 const src=read(file),list=[],config={base:'https://code.invalid',key:'fixture',model:'coder',maxTokens:16384,enabled:true};let unblock,calls=0;
 const ctx=vm.createContext({S:{},Map,TextEncoder,CHAT_FILE_TEXT_EXT:['html'],actId:()=> 'main',getC:()=>({id:'role'}),msgs:()=>list,save(){},refreshChatMessages(){},toast(){},uid:()=> 'one',fmtSize:n=>String(n),persistWechatMessagesNow:async()=>true,codeModelConfig:()=>({...config}),codeModelRequest:()=>{calls++;return new Promise(resolve=>{unblock=resolve;});}});
 vm.runInContext('const _codeJobs=new Map();',ctx);for(const n of ['chatFileExt','chatFileFind','chatFileSize','codeFileName','codeFileHash','codeFileEditable','codeTaskPart','codeFileComplete','codeTaskValid','codeTaskPersist','codeTaskStart','codeTaskRun'])vm.runInContext(fnSource(src,n),ctx);
 const m=await ctx.codeTaskStart('role',{name:'new.html',request:'做游戏',baseId:'新建'},'source');await new Promise(r=>setImmediate(r));config.enabled=false;unblock(JSON.stringify({part:1,offset:0,chunk:'<html></html>',done:true}));await new Promise(r=>setImmediate(r));
 assert.equal(m.text,'');assert.equal(m.codeTask.draft,'');assert.equal(m.codeTask.status,'error');assert.match(m.codeTask.error,/设置已改变/);assert.equal(calls,1);await ctx.codeTaskRun('role',m.id);assert.equal(calls,1);
});
