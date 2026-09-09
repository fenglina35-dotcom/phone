// Actual page regression; only transport is mocked. Never touches a user's archive or model.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{for(const privateApp of [false,true]){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false})};});
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  const setup=()=>{S.me.locked=false;S.me.active='main';const c=S.contacts[0];window.testId=c.id;S.couple={cid:c.id};c.spy={granted:true};c.proactive={enabled:false};S.me.lifeNotes=[{source:'manual',text:'原有笔记保留'}];S.settings.replyDelay=0;S.settings.chat={base:'https://fake.invalid/v1',key:'fixture',model:'fixture',maxTokens:2500,temp:.7};aiCoreOn=()=>false;window.testCalls=0;window.notices=[];window.fixtureFail=false;window.fixtureWait=null;fetchT=async(url,opt)=>{let payload;try{payload=JSON.parse(opt&&opt.body||'{}');}catch(_){}if(!Array.isArray(payload&&payload.messages))return new Response('false',{status:200,headers:{'content-type':'application/json'}});testCalls++;if(fixtureWait)await fixtureWait;if(fixtureFail)throw new Error('fixture request failed');return new Response(JSON.stringify({choices:[{message:{content:'[内心|认真听着]\n我在，慢慢说。'},finish_reason:'stop'}]}),{status:200,headers:{'content-type':'application/json'}});};toast=s=>notices.push(String(s));openChat(testId);};
  await page.waitForTimeout(1500);
  await page.evaluate(setup);
  await page.evaluate(()=>{S.settings.manualReplyScenes={wechat:true,games:true,roleplay:true,offline:true};S.settings.manualReply=true;});
  for(const raw of [true,false]){
   await page.evaluate(raw=>{S.settings.modelOutputUnfiltered=raw;S.messages[testId]=[{id:uid(),role:'user',type:'text',content:'陪我说说话',time:Date.now()}];testCalls=0;notices=[];},raw);
   const initial=await page.evaluate(async()=>{await aiReply(testId);return{calls:testCalls,completed:!!msgs(testId)[0]._replyHandoffCompleted,assistant:msgs(testId).filter(x=>x.role==='assistant').length,raw:modelOutputUnfiltered()};});assert.equal(initial.calls,1);assert(initial.completed&&initial.assistant>0);
   await page.evaluate(()=>aiReply(testId));assert.equal(await page.evaluate(()=>testCalls),1,'Implicit repeat remains blocked without a runtime error');
   for(let n=0;n<3;n++){
    await page.evaluate(()=>{testCalls=0;regenMsg(testId,msgs(testId).find(x=>x.role==='assistant').id);});
    await page.waitForFunction(()=>!replyGenerationBusy(testId,actId())&&testCalls>0);
    const r=await page.evaluate(()=>({calls:testCalls,assistant:msgs(testId).filter(x=>x.role==='assistant').length,shown:document.body.innerText.includes('我在，慢慢说。'),state:NorthRequestDiagnostics.list(testId).find(x=>x.kind==='turn').state,notices,diag:NorthRequestDiagnostics.list(testId).slice(0,5)}));console.log(JSON.stringify({privateApp,raw,n,r}));assert.equal(r.calls,1);assert.equal(r.assistant,1);assert(r.shown);assert.equal(r.state,'handled');
   }
   await page.evaluate(()=>{fixtureFail=true;testCalls=0;regenMsg(testId,msgs(testId).find(x=>x.role==='assistant').id);});await page.waitForFunction(()=>!replyGenerationBusy(testId,actId())&&testCalls>0);
   assert.equal(await page.evaluate(()=>msgs(testId).filter(x=>x.role==='assistant').length),0);
   await page.evaluate(()=>{fixtureFail=false;testCalls=0;});await page.evaluate(()=>replyGenerationRun(testId,'main'));assert.equal(await page.evaluate(()=>testCalls),1);assert.equal(await page.evaluate(()=>msgs(testId).filter(x=>x.role==='assistant').length),1);
   // A second click while a regeneration is in flight must not delete or start another turn.
   await page.evaluate(()=>{window.fixtureWait=new Promise(r=>window.releaseFixture=r);testCalls=0;window.oldReplyId=msgs(testId).find(x=>x.role==='assistant').id;regenMsg(testId,oldReplyId);});await page.waitForFunction(()=>testCalls===1);
   await page.evaluate(()=>{regenMsg(testId,oldReplyId);manualReply(testId);releaseFixture();fixtureWait=null;});await page.waitForFunction(()=>!replyGenerationBusy(testId,actId()));assert.equal(await page.evaluate(()=>testCalls),1);
   console.log(JSON.stringify({privateApp,raw,repeatedRegeneration:3,failureRetry:true,concurrentClick:true}));
  }
  // Old broken archives have the completion marker but no answer and no new regeneration flag.
  await page.evaluate(async()=>{const u=msgs(testId).find(x=>x.role==='user');delete u._replyHandoffRegenerated;S.messages[testId]=[u];S.settings.modelOutputUnfiltered=true;wechatTailJournalWrite(testId,'main');await persistWechatMessagesNow();await saveNowAsync();});await page.goto(page.url().split('?')[0]);await page.waitForFunction(()=>window.__northBootReady);await page.evaluate(setup);
  await page.evaluate(()=>replyGenerationRun(testId,'main'));const restored=await page.evaluate(()=>({calls:testCalls,assistant:msgs(testId).filter(x=>x.role==='assistant').length,note:S.me.lifeNotes[0].text}));assert.equal(restored.calls,1);assert.equal(restored.assistant,1);assert.equal(restored.note,'原有笔记保留');assert.deepEqual(errors,[]);console.log(JSON.stringify({privateApp,oldArchiveRecovery:true,pageErrors:errors.length}));await page.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
