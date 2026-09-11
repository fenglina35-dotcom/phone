// Huawei Android Edge profile: one tap must start the complete JSON backup download.
// Only the HTTP model is simulated; never replace buildSystem or myActivity.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{for(const privateApp of [true,false]){
  const browserContext=await browser.newContext({acceptDownloads:true,userAgent:'Mozilla/5.0 (Linux; Android 12; Huawei) AppleWebKit/537.36 Chrome/134.0.0.0 Mobile Safari/537.36 EdgA/134.0.0.0',viewport:{width:412,height:915}}),page=await browserContext.newPage(),errors=[];
  if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'fixture-native-unavailable'})};});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const entry=origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html');
  await page.goto(entry+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  if(!privateApp){await page.evaluate(async()=>{await navigator.serviceWorker.register('sw.js?v=1236&r=backup-browser-test',{updateViaCache:'none'});await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:60000});}
  await page.evaluate(()=>{S.me.locked=false;S.settings.backupFixture='中文、引号"和换行\n完整保留';S._backupImages=Array.from({length:16},(_,i)=>({img:'data:image/jpeg;base64,'+String(i).padStart(3,'0')+'A'.repeat(1024*1024)}));openSettings('data');});
  await page.waitForTimeout(150);await page.evaluate(()=>closeModal());
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.locator('button[onclick="exportData()"]'+'').first().click()]);
  assert.equal(await download.failure(),null);
  assert.match(download.suggestedFilename(),/^North备份_\d{4}-\d{2}-\d{2}\.json$/);
  const data=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(data._backupImages.length,16);assert.equal(data.settings.backupFixture,'中文、引号"和换行\n完整保留');
  const result=await page.evaluate(async data=>{let ticks=0;const timer=setInterval(()=>ticks++,10),at=performance.now();try{await applyFullBackupData(data);return{ms:Math.round(performance.now()-at),ticks,compact:S._backupImages.every(x=>/^idb:/.test(x.img)),cacheChars:Object.values(_imgCache).reduce((n,v)=>n+(typeof v==='string'?v.length:0),0)};}finally{clearInterval(timer);}},data);
  assert(result.compact);assert(result.ticks>0);assert(result.cacheChars<8*1024*1024,JSON.stringify(result));
  await page.goto(entry);await page.waitForFunction(()=>window.__northBootReady);
  const restored=await page.evaluate(async()=>{const d=await fullBackupState();return{count:d._backupImages.length,first:d._backupImages[0].img,last:d._backupImages[15].img,setting:d.settings.backupFixture};});
  assert.equal(restored.first,data._backupImages[0].img);assert.equal(restored.last,data._backupImages[15].img);assert.equal(restored.setting,data.settings.backupFixture);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({privateApp,oneTapJsonDownload:true,importAndReload:true,...result,pageErrors:errors.length}));await browserContext.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
