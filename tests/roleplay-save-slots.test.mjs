import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {read} from './_helpers.mjs';

// 2026-11-03 用户：角色扮演要像游戏一样有多个存档。以前「开新局」会把正在玩的那局结束并清空，接不回去。
// 现在：新开一局时旧局先自动存档（只存上次存档之后的新内容），整局原文留在存档列表里；读取后接着玩；可删除。
// 记忆位置不变：存档记录仍进 d.memory 和角色记忆总结。
test('roleplay keeps several unfinished games per role and resumes any of them on both runtimes',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright'),path=require('node:path');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const priv of [false,true]){
  const label=priv?'private':'web',page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];let fixtureText='阿澈：我在。';page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname.endsWith('slot-fixture.invalid'))return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify({choices:[{message:{content:fixtureText}}]})});if(u.origin!=='http://127.0.0.1:8778')return route.abort();const f=path.resolve(decodeURIComponent(u.pathname.slice(1)));const ok=f.startsWith(process.cwd()+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile();return route.fulfill({status:ok?200:404,body:ok?(/\.(?:js|css|html)$/.test(f)?read(path.relative(process.cwd(),f)):fs.readFileSync(f)):'',contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});});
  await page.goto('http://127.0.0.1:8778/'+(priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady,{},{timeout:8000});
  await page.evaluate(()=>{S.me.locked=false;S.me.active='main';S.settings.sound=false;S.contacts.forEach(c=>c.proactive={enabled:false});const c=S.contacts[0];c.name='阿澈';c.remark='';c.chatRouteIndex=0;c.model='main';S.settings.offAux=false;S.settings.chatStreaming=false;S.settings.chat={base:'https://slot-fixture.invalid/v1',key:'fixture',model:'slot-model'};S.settings.chatRoutes=[chatRouteCopy(S.settings.chat)];window.slotId=c.id;S.roleplay={};_rp=null;stack=[{p:'home'},{p:'rphub'}];render();});
  const idle=()=>page.waitForFunction(()=>_rp&&!_rp.busy,{},{timeout:8000});
  // 第一局：古风
  await page.evaluate(()=>go('rpset',{id:slotId}));await page.fill('#rp_title','古风那局');await page.fill('#rp_me_role','郡主');await page.evaluate(()=>rpSaveSetup(slotId,'direct'));await idle();
  await page.evaluate(()=>{rpData(slotId).msgs.push({id:'a-user',who:'me',source:'me',text:'古风里我说的话',time:Date.now()});save();});
  const firstCount=await page.evaluate(()=>rpData(slotId).msgs.length);
  // 新开一局：第一局不能被结束或清空
  fixtureText='阿澈：校园这边开始了。';
  await page.evaluate(()=>go('rpset',{id:slotId,fresh:true}));
  assert.equal(await page.inputValue('#rp_title'),'',label+': a new game starts from an empty form');
  await page.fill('#rp_title','校园那局');await page.evaluate(()=>rpSaveSetup(slotId,'direct'));await idle();
  const afterNew=await page.evaluate(()=>{const d=rpData(slotId);return {title:d.title,active:d.active,saves:(d.saves||[]).map(s=>({title:s.title,active:s.active,n:s.msgs.length,role:s.myRole,cursor:s.summaryCursor,hasUser:s.msgs.some(m=>m.text==='古风里我说的话')})),memory:(d.memory||[]).map(m=>m.id)};});
  assert.equal(afterNew.title,'校园那局');assert.equal(afterNew.active,true);
  assert.deepEqual(afterNew.saves,[{title:'古风那局',active:true,n:firstCount,role:'郡主',cursor:firstCount,hasUser:true}],label+': the first game stays whole in the save list');
  assert(afterNew.memory.length===1&&/_part_/.test(afterNew.memory[0])&&!afterNew.memory.some(x=>/_end$/.test(x)),label+': switching auto-saves progress without ending the first game');
  // 存档列表和读取
  await page.evaluate(()=>rpSaveList(slotId));const listText=await page.locator('#modal').innerText();
  assert(listText.includes('古风那局')&&listText.includes('校园那局')&&listText.includes('正在玩')&&listText.includes('已暂停'),label+': the list shows both games');
  await page.evaluate(()=>{rpData(slotId).msgs.push({id:'b-user',who:'me',source:'me',text:'校园里我说的话',time:Date.now()});});
  const saveId=await page.evaluate(()=>rpData(slotId).saves[0].saveId);await page.evaluate(id=>rpLoadSave(slotId,id),saveId);
  await page.waitForFunction(()=>cur().p==='rp'&&rpData(slotId).title==='古风那局');
  const loaded=await page.evaluate(()=>{const d=rpData(slotId);return {active:d.active,mine:d.msgs.some(m=>m.text==='古风里我说的话'),other:d.msgs.some(m=>m.text==='校园里我说的话'),saves:d.saves.map(s=>s.title),visible:document.querySelector('#rpbg').innerText,memory:d.memory.length};});
  assert.equal(loaded.active,true);assert(loaded.mine&&!loaded.other,label+': loading brings back only that game');
  assert(loaded.visible.includes('古风里我说的话'),label+': the old chat bubbles are visible again');
  assert.deepEqual(loaded.saves,['校园那局'],label+': the game that was playing becomes a save');
  assert.equal(loaded.memory,2,label+': each switch stores only the new part once');
  // 删除存档
  const delId=await page.evaluate(()=>rpData(slotId).saves[0].saveId);await page.evaluate(id=>{window.uiConfirm=async()=>true;return rpDeleteSave(slotId,id);},delId);
  assert.deepEqual(await page.evaluate(()=>rpData(slotId).saves.length),0);assert.equal(await page.evaluate(()=>rpData(slotId).memory.length),2,label+': deleting a save leaves memories alone');
  assert.equal(await page.evaluate(()=>saveNowAsync()),true,label+': saves to storage');
  assert.deepEqual(errors,[],label+' page errors');
  await page.close();
 }}finally{await browser.close();}
});
