const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+'/小手机.html?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  await page.evaluate(()=>{S.me.locked=false;S.settings.showMoodTag=true;const c=getC('preview_1');c.innerThought='上一条真实内心';c.innerThoughtAt=123;openChat(c.id);});
  assert.equal(await page.locator('#chatMoodBar').isVisible(),true);
  // Exercise the production parser with malformed nested tags, not a fake renderer.
  await page.evaluate(()=>{const c=getC('preview_1');stripHiddenThoughtTags('[内心|[转账|100]]',c);refreshChatMood(c.id);});
  assert.equal(await page.locator('#chatMoodText').innerText(),'上一条真实内心');
  await page.evaluate(async()=>{const c=getC('preview_1');c.innerThought='';c.innerThoughtMissingAt=Date.now();refreshChatMood(c.id);await saveNowAsync();});
  assert.equal(await page.locator('#chatMoodBar').isVisible(),true);
  // Leave preview mode and load actual persisted state through the normal boot path.
  await page.goto(origin+'/小手机.html');await page.waitForFunction(()=>window.__northBootReady);
  await page.evaluate(()=>{S.me.locked=false;renderLockScreen(true);openChat('preview_1');});
  assert.equal(await page.locator('#chatMoodBar').isVisible(),true);
  assert.equal(await page.locator('#chatMoodText').innerText(),'上一条真实内心');
  await page.evaluate(()=>showInnerThought('preview_1'));
  assert.match(await page.locator('#modal').innerText(),/上一条真实内心/);
  await page.evaluate(()=>{closeModal();S.settings.showMoodTag=false;render();});
  assert.equal(await page.locator('#chatMoodBar').isVisible(),false);
  await page.evaluate(()=>{S.settings.showMoodTag=true;render();});
  assert.equal(await page.locator('#chatMoodBar').isVisible(),true);
  await page.evaluate(()=>{setNaturalInnerThought(getC('preview_1'),'下一条真实内心');refreshChatMood('preview_1');});
  assert.equal(await page.locator('#chatMoodText').innerText(),'下一条真实内心');
  await page.evaluate(()=>{const c=getC('preview_1');delete c.innerThought;delete c.innerThoughtLastValid;render();});
  assert.equal(await page.locator('#chatMoodBar').isVisible(),true);
  assert.equal(await page.locator('#chatMoodText').innerText(),'…');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({version:await page.evaluate(()=>APP_VER),malformedPreserved:true,emptyFieldPreserved:true,persistedReload:true,detailConsistent:true,toggleRestored:true,validUpdate:true,pageErrors:errors}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
