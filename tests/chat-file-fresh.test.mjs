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
