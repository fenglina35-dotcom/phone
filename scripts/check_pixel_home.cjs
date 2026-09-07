const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg'}[path.extname(file)]||'application/octet-stream'));res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const privateApp of [false,true]){
  const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await p.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');await p.waitForFunction(()=>window.__northBootReady);
  await p.evaluate(()=>{
    S.me.locked=false;S.couple={cid:null};go('gameshub');openPixelHome();window.unboundBlocked=cur().p==='gameshub';
    const c=S.contacts[0];S.couple.cid=c.id;window.testCid=c.id;window.modelCalls=0;
    const cfg={base:'https://fake.invalid/v1',key:'fixture-secret',model:'fixture-role',temp:.7,maxTokens:900};S.settings.chat=cfg;S.settings.aux={};chatRequestRoute=()=>cfg;aiCoreOn=()=>false;
    fetchT=async(url,opt)=>{window.lastPixelRequest=JSON.parse(opt.body);if(lastPixelRequest.messages[0].content.includes('正在为代表玩家的小屋少女挑选穿搭')){const o=JSON.parse(lastPixelRequest.messages[1].content),night=o.period==='evening';return{ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({setId:null,dress:night?'outfit3-dress':'outfit1-dress',shoes:night?'outfit3-shoes':'outfit1-shoes',accessory:night?'outfit3-accessory':'outfit1-accessory',hair:'hair0',reason:'测试角色选择'})},finish_reason:'stop'}]})};}if(!lastPixelRequest.messages[0].content.includes("正在照顾代表玩家的小屋少女"))return {ok:true,json:async()=>({choices:[{message:{content:"[内心|想陪你聊一会儿]\n我在。"},finish_reason:"stop"}]})};modelCalls++;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({actions:['feed','touch','ball','bath','comb','teeth','face','teddy'],looks:[0,1,0,1,0,1,0]})},finish_reason:'length'}]})};};
    openPixelHome();
  });
  assert(await p.evaluate(()=>unboundBlocked));
  const f=p.frameLocator('#pixel-home-frame');await f.locator('#loading').waitFor({state:'detached',timeout:30000});
  assert.equal(await p.evaluate(()=>modelCalls),0);assert.equal(await f.locator('#care').innerText(),'让他照顾');assert.equal(await f.locator('#light').count(),0);assert.equal(await f.locator('.side-tools [data-panel="album"]').count(),1);assert.equal(await f.locator('.dock [data-panel="album"]').count(),0);
  assert.equal(await f.locator('#fullscreen').count(),0);assert.equal(await f.locator('#help').count(),1);await f.locator('#help').click();assert(await f.locator('#drawer').isVisible());await f.locator('#close-drawer').click();await f.locator('#photo').click();await p.waitForFunction(()=>pixelHomeEntry(_pixelHome).state.photos.length===1);assert(await f.locator('#drawer').isVisible());await f.locator('#close-drawer').click();
  assert.equal(await p.evaluate(()=>curAppKey()),'games');assert.equal(await p.evaluate(()=>gameKindFromLabel('像素少女')),'pixelhome');assert.equal(await p.evaluate(()=>gameKindFromLabel('像素拼拼乐')),'beads');
  const frame=await p.locator('#pixel-home-frame').elementHandle();await p.evaluate(()=>{for(let i=0;i<3;i++)render();});assert(await frame.evaluate(e=>e.isConnected));
  await f.locator('#sleep').click();assert(await f.locator('body').evaluate(e=>e.classList.contains('lights-off')));await f.locator('#sleep').click();assert(!await f.locator('body').evaluate(e=>e.classList.contains('lights-off')));
  const state=()=>p.evaluate(()=>pixelHomeEntry(_pixelHome).state);
  let before=await state();
  await f.locator('#care').click();await f.locator('#care-progress').waitFor({state:'visible'});await p.waitForTimeout(250);await f.locator('#cancel-care').click();await p.waitForTimeout(1200);assert.deepEqual((await state()).inventory,before.inventory);assert(!await f.locator('#care-cursor').isVisible());
  await f.locator('#scene').evaluate(()=>{window.careSteps=[];document.addEventListener('rose-doll:care-step',e=>careSteps.push(e.detail));});
  await f.locator('#care').click();await f.locator('#care-progress').waitFor({state:'visible'});await f.locator('#care-progress').waitFor({state:'hidden',timeout:90000});
  const after=await state();assert.equal(before.inventory.slice(0,3).reduce((a,b)=>a+b)-after.inventory.slice(0,3).reduce((a,b)=>a+b),1);
  assert(after.diary.some(x=>x.text.includes('这次照顾：')&&x.text.includes('玩皮球')&&x.text.includes('戳脸摸头')));assert.equal((await f.locator('#scene').evaluate(()=>careSteps)).length,8);
  assert(after.clean>before.clean);assert.equal(await p.evaluate(()=>modelCalls),2);
  // A malformed candidate gets one request, no automatic retry and no fallback actions.
  await p.evaluate(()=>{_pixelHome.recent=null;fetchT=async(url,opt)=>{if(!JSON.parse(opt.body).messages[0].content.includes('正在照顾代表玩家的小屋少女'))return{ok:true,json:async()=>({choices:[{message:{content:'我在。'},finish_reason:'stop'}]})};modelCalls++;return{ok:true,json:async()=>({choices:[{message:{content:'bad format'},finish_reason:'stop'}]})};};});before=await state();await f.locator('#care').click();await p.waitForTimeout(900);assert.equal(await p.evaluate(()=>modelCalls),3);assert.deepEqual((await state()).inventory,before.inventory);assert.match(await f.locator('#feedback').innerText(),/没有自动重复请求/);
  await p.screenshot({path:path.join(root,'preview/rose-doll-p01',privateApp?'p08-private-entry.png':'p08-web-entry.png')});
  // Unbinding during a slow model response closes the game and its pending work.
  await p.evaluate(()=>{fetchT=async(url,opt)=>{if(!JSON.parse(opt.body).messages[0].content.includes('正在照顾代表玩家的小屋少女'))return{ok:true,json:async()=>({choices:[{message:{content:'我在。'},finish_reason:'stop'}]})};modelCalls++;await new Promise(r=>setTimeout(r,1600));return{ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({actions:['feed'],looks:[0,1,0,1,0,1,0]})},finish_reason:'stop'}]})};};});await f.locator('#care').click();await p.waitForTimeout(200);await p.evaluate(()=>S.couple.cid=null);await p.waitForTimeout(2200);assert.equal(await p.evaluate(()=>cur().p),'gameshub');assert.equal(await p.locator('#pixel-home-frame').count(),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({privateApp,checks:20,modelCalls:await p.evaluate(()=>modelCalls),errors}));await p.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
