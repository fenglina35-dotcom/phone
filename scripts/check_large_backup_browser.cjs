// Real file chooser/download and reload; desktop Edge with Huawei UA is not a physical Huawei test.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');fs.createReadStream(file).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{for(const privateApp of [false,true]){
  const contexts=[],errors=[];const count=privateApp?96:520;
  async function fresh(){const context=await browser.newContext({acceptDownloads:true,userAgent:'Mozilla/5.0 (Linux; Android 12; Huawei) AppleWebKit/537.36 Chrome/134.0.0.0 Mobile Safari/537.36 EdgA/134.0.0.0',viewport:{width:412,height:915}});contexts.push(context);const page=await context.newPage();
   if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'fixture-native-unavailable'})};});
   page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);return page;}
  const source=await fresh();
  await source.evaluate(async count=>{S.me.locked=false;S.settings.backupFixture='完整恢复😀汉字\\"\n';S._backupImages=Array(count).fill('idb:fixture_shared');await imgPut('fixture_shared','data:image/jpeg;base64,'+'A'.repeat(1024*1024));openSettings('data');closeModal();},count);
  const at=Date.now();const [download]=await Promise.all([source.waitForEvent('download',{timeout:180000}),source.locator('button[onclick="exportData()"]').click()]);assert.equal(await download.failure(),null);const file=await download.path();const size=fs.statSync(file).size;assert(size>=count*1024*1024);
  const target=await fresh();assert.equal(await target.evaluate(()=>S._backupImages),undefined);
  await target.evaluate(()=>{S.me.locked=false;S.settings.backupFixture='before';openSettings('data');closeModal();window.backupTicks=0;window.backupMaxGap=0;let last=performance.now();window.backupTimer=setInterval(()=>{backupTicks++;backupMaxGap=Math.max(backupMaxGap,performance.now()-last);last=performance.now();},20);});
  const [chooser]=await Promise.all([target.waitForEvent('filechooser'),target.locator('button[onclick="importData()"]').click()]);await chooser.setFiles(file);
  await target.waitForFunction(()=>!!S._backupImages&&!_fullBackupImportBusy,null,{timeout:240000});
  const imported=await target.evaluate(()=>{clearInterval(backupTimer);return{count:S._backupImages.length,unique:new Set(S._backupImages).size,compact:S._backupImages.every(x=>x.startsWith('idb:')),ticks:backupTicks,maxGap:Math.round(backupMaxGap),cacheChars:Object.values(_imgCache).reduce((n,v)=>n+(typeof v==='string'?v.length:0),0),setting:S.settings.backupFixture};});
  assert.equal(imported.count,count);assert.equal(imported.unique,1);assert(imported.compact);assert(imported.ticks>10);assert(imported.cacheChars<8*1024*1024);assert.equal(imported.setting,'完整恢复😀汉字\\"\n');
  await target.evaluate(()=>{S.me.locked=false;openSettings('data');closeModal();window.importNotices=[];const realToast=toast;toast=s=>{importNotices.push(s);return realToast(s);};window.beforeLayout=JSON.stringify(beautyLayoutSnapshot(S.me));});
  await target.waitForTimeout(300);await target.evaluate(()=>closeModal());
  const beauty={type:'north-beauty-pack',ver:1,me:{homeBg:'data:image/png;base64,'+'B'.repeat(10000),appLayout:['should-not-replace']}};
  const [beautyChooser]=await Promise.all([target.waitForEvent('filechooser'),target.locator('button[onclick="importBeautyData()"]').click()]);await beautyChooser.setFiles({name:'beauty.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(beauty))});
  await target.waitForFunction(()=>importNotices.some(s=>s.startsWith('已导入美化包')));
  assert(await target.evaluate(()=>S.me.homeBg.startsWith('idb:')&&JSON.stringify(beautyLayoutSnapshot(S.me))===beforeLayout));assert.equal(await target.evaluate(()=>S._backupImages.length),count);
  const [badChooser]=await Promise.all([target.waitForEvent('filechooser'),target.locator('button[onclick="importData()"]').click()]);await badChooser.setFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"settings":{},"broken":')});await target.waitForFunction(()=>importNotices.some(s=>s.startsWith('导入失败')));assert.equal(await target.evaluate(()=>S.settings.backupFixture),imported.setting);assert.deepEqual(errors,[]);
  await target.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html'));await target.waitForFunction(()=>window.__northBootReady);
  const restored=await target.evaluate(async()=>({count:S._backupImages.length,media:await imgGet(S._backupImages[0].slice(4)),setting:S.settings.backupFixture}));assert.equal(restored.count,count);assert.equal(restored.media,'data:image/jpeg;base64,'+'A'.repeat(1024*1024));assert.equal(restored.setting,imported.setting);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({privateApp,bytes:size,realDownloadAndFileChooser:true,freshStorageImport:true,reload:true,elapsedMs:Date.now()-at,...imported}));
  for(const context of contexts)await context.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
