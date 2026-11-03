import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {read,BUNDLES} from './_helpers.mjs';

// MAIL_REPLY_LOOSE_V1（2026-11-03）：网页用户的回信「成功」却收不到——模型在信里直接写了英文引号，JSON 坏了，
// 程序读不出就丢掉，并且无限自动重试（每次 17 万 token）。现在信照常送到；读不出最多试 3 次就停，写明原因并能「再试一次」。
test('letter replies survive raw quotes and stop after three failed tries on both runtimes',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright'),path=require('node:path');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const priv of [false,true]){
  const label=priv?'private':'web',page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:8778')return route.abort();const f=path.resolve(decodeURIComponent(u.pathname.slice(1)));const ok=f.startsWith(process.cwd()+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile();return route.fulfill({status:ok?200:404,body:ok?(/\.(?:js|css|html)$/.test(f)?read(path.relative(process.cwd(),f)):fs.readFileSync(f)):'',contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});});
  await page.goto('http://127.0.0.1:8778/'+(priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady&&window.__mailOutbox,{},{timeout:8000});
  const r=await page.evaluate(async()=>{const c=S.contacts[0];c.blocked=false;c.deleted=false;window.__calls=0;
   const letter=id=>({id,cid:c.id,acct:String(actId()||'main'),toName:c.name,fromName:'我',subject:'想你',body:'最近好吗',status:'delivered',sentAt:Date.now()-600000,deliverAt:Date.now()-60000});
   S.mailOutbox=[letter('L1'),letter('L2')];
   window.chatAPI=async()=>{__calls++;return '{"reply":true,"subject":"回你的信","body":"你说"别担心"，我记住了。\\n第二段","wechat":"信写好了，你说的"别担心"我收到了[表情|笑]"}';};
   const ok=await __mailOutbox.reply(S.mailOutbox[0]);const got=(S.mail||[]).find(x=>x.replyTo==='L1');
   window.chatAPI=async()=>{__calls++;return '我不想按格式写';};const l2=S.mailOutbox[1],tries=[];
   for(let i=0;i<4;i++){l2.replyNextAt=0;tries.push(await __mailOutbox.reply(l2));}
   const before=__calls;l2.replyNextAt=0;await __mailOutbox.reply(l2);const after=__calls;
   mailOutboxOpen('L2');const modal=document.querySelector('#modal').innerText;
   window.chatAPI=async()=>{__calls++;return '{"reply":true,"subject":"重写","body":"这次写好了","wechat":"回信了"}';};mailReplyRetry('L2');await new Promise(r=>setTimeout(r,300));
   return {ok,body:got&&got.body,wechat:got&&got.wechat,state:l2.replyState,error:l2.replyError,extra:after-before,modal,retried:!!(S.mail||[]).find(x=>x.replyTo==='L2'),attempts:tries.length};});
  assert.equal(r.ok,true,label+': quoted reply is delivered');assert.equal(r.body,'你说"别担心"，我记住了。\n第二段');assert(r.wechat&&!/[\[\]]/.test(r.wechat),label+': wechat line has no tags');
  assert.equal(r.state,'done',label+': retry button makes a new attempt that succeeds');assert.equal(r.extra,0,label+': no automatic attempt after three failures');
  assert(r.modal.includes('再试一次')&&r.modal.includes('3 次'),label+': failed letter explains and offers retry');assert(r.retried);
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

for(const [label,file] of BUNDLES)test(label+': internal lock/unlock confirmation answers stay out of the intercept list',()=>{
 const src=read(file);assert(src.includes('CONTROL_CONFIRM_NO_AUDIT_V1'));
 assert.doesNotMatch(src,/\{role:'user',content:p\}\],_repairMd\)\}\);/,'confirmation must not reuse the audited correction options');
});
