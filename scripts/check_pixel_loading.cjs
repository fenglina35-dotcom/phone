// Isolated browser fixtures: no account, external network or model calls.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(file)]||'application/octet-stream'));res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const privateApp of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message);});let fail=true;
  await page.addInitScript(()=>{window.OffscreenCanvas=undefined;HTMLImageElement.prototype.decode=undefined;});
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();if(fail&&r.request().frame().parentFrame()&&u.pathname.endsWith('/wardrobe/data.js'))return r.abort();return r.continue();});
  await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  await page.evaluate(()=>{
   S.me.locked=false;S.couple={cid:S.contacts[0].id};
   const cfg={base:'https://fake.invalid/v1',key:'fixture-only',model:'fixture-role',temp:.7,maxTokens:900};S.settings.chat=cfg;S.settings.aux={};chatRequestRoute=()=>cfg;aiCoreOn=()=>false;
   fetchT=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({setId:null,dress:'outfit1-dress',shoes:'outfit1-shoes',accessory:'outfit1-accessory',hair:'hair0',reason:'测试穿搭'})},finish_reason:'stop'}]})});
   go('gameshub');openPixelHome();
  });
  console.log('opened',privateApp);const f=page.frameLocator('#pixel-home-frame');
  try{await f.getByRole('button',{name:'重新加载游戏'}).waitFor({timeout:45000});}catch(e){console.error('FRAME',await f.locator('body').innerText({timeout:2000}).catch(()=>page.locator('body').innerText()));throw e;}
  assert.match(await f.locator('#loading').innerText(),/wardrobe\/data.js/);
  // A failed iframe may already have sent saves (for example on pagehide).
  await page.evaluate(()=>{_pixelHome.revision=50;});
  fail=false;await f.getByRole('button',{name:'重新加载游戏'}).click();await f.locator('#loading').waitFor({state:'detached',timeout:60000});
  const before=await f.locator('body').evaluate(()=>RoseWardrobe.getState());
  await f.locator('[data-panel=wardrobe]').click();const wardrobe=f.frameLocator('#wardrobe-frame');await wardrobe.locator('#loading').waitFor({state:'hidden',timeout:60000});
  assert.match(await wardrobe.locator('#counts').innerText(),/11 套服装/);
  const after=await wardrobe.locator('body').evaluate(()=>window.wardrobe.getState());assert.deepEqual(after,before);
  await wardrobe.getByRole('link',{name:'返回小屋'}).click();await f.locator('#wardrobe-overlay').waitFor({state:'hidden'});
  await f.locator('#photo').click();await f.locator('#drawer').waitFor({state:'visible'});
  await page.waitForFunction(()=>pixelHomeEntry(_pixelHome).state?.photos?.length===1,null,{timeout:5000});
  assert.deepEqual(errors,[]);console.log(`PASS ${privateApp?'private':'web'}: failed catalog recovery, no decode/OffscreenCanvas, wardrobe state, return and photo`);await page.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
