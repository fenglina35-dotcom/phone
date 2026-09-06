// Isolated file:// fixture: no user account, API calls or browser profile.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'games/pixel-home'),qa=path.join(root,'.qa');
fs.mkdirSync(qa,{recursive:true});
let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
html=html.replace('<head>','<head><base href="'+pathToFileURL(dir+path.sep).href+'">');
html=html.replace('<script src="bridge.js"></script>',`<script>
window.fixtureState=null;
window.PixelHomeBridge={request:async(method,state)=>{
 if(method==='hello')return{state:null,scope:'file-fixture',name:'测试伴侣',morning:{look:0}};
 if(method==='save'){window.fixtureState=JSON.parse(JSON.stringify(state));return{saved:true};}
 if(method==='morning')return{look:0};
 if(method==='care')return{actions:['feed','touch']};return{};
}};
const originalDraw=CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage=function(...args){if(args.length===9&&args[3]===338&&args[4]===512)window.sleepRect={w:args[7],h:args[8]};return originalDraw.apply(this,args);};
</script>`);
const fixture=path.join(qa,'pixel-home-file.html');fs.writeFileSync(fixture,html);
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(pathToFileURL(fixture).href);await p.locator('#loading').waitFor({state:'detached',timeout:45000});
  assert.equal(await p.locator('#fullscreen').count(),0);assert.equal(await p.locator('#help').count(),1);
  assert.equal(await p.locator('#help canvas').count(),1);await p.locator('#help').click();assert.match(await p.locator('#drawer-title').innerText(),/玩法|怎么玩|玩/);await p.locator('#close-drawer').click();
  const arrow=await p.locator('#next-room').evaluate(e=>{const s=getComputedStyle(e);return{background:s.backgroundImage,color:s.backgroundColor,border:s.borderWidth,width:e.clientWidth};});
  assert.equal(arrow.background,'none');assert.equal(arrow.color,'rgba(0, 0, 0, 0)');assert.equal(arrow.border,'0px');assert(arrow.width>=44);
  for(let room=0;room<3;room++){
   await p.locator('#photo').click();
   await p.waitForFunction(n=>fixtureState.photos.length===n,room+1);
   assert(await p.locator('#drawer').isVisible());assert.match(await p.locator('#drawer-content').innerHTML(),/data:image\/jpeg;base64,/);
   await p.locator('#close-drawer').click();await p.locator('#next-room').click();
  }
  await p.locator('#sleep').click();await p.waitForFunction(()=>window.sleepRect?.h>0);
  const ratio=await p.evaluate(()=>sleepRect.w/sleepRect.h);assert(Math.abs(ratio-338/512)<1e-9);
  await p.waitForTimeout(1400);await p.screenshot({path:path.join(qa,'pixel-home-sleep-v1203.png')});
  await p.locator('#photo').click();await p.waitForFunction(()=>fixtureState.photos.length===4);await p.locator('#close-drawer').click();
  await p.locator('#sleep').click();
  // A future export failure must produce visible feedback and leave photos intact.
  await p.evaluate(()=>{window.originalExport=HTMLCanvasElement.prototype.toDataURL;HTMLCanvasElement.prototype.toDataURL=function(){throw new DOMException('fixture','SecurityError');};});
  await p.locator('#photo').click();await p.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('无法生成照片'));
  assert.equal(await p.evaluate(()=>fixtureState.photos.length),4);assert(!await p.locator('#photo').isDisabled());
  await p.evaluate(()=>HTMLCanvasElement.prototype.toDataURL=originalExport);
  await p.locator('#photo').click();await p.waitForFunction(()=>fixtureState.photos.length===5);await p.locator('#close-drawer').click();
  await p.screenshot({path:path.join(qa,'pixel-home-awake-v1203.png')});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({fileOrigin:true,checks:14,photos:5,sleepRatio:ratio,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
