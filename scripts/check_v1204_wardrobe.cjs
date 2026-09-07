const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'.qa/v1204');fs.mkdirSync(qa,{recursive:true});
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 for(const kind of ['web','private']){
  const dir=path.join(root,kind==='web'?'games/pixel-home':'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/games/pixel-home');
  let html=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace('<head>','<head><base href="'+pathToFileURL(dir+path.sep).href+'">');
  html=html.replace('<script src="bridge.js?v=1204"></script>',`<script>window.fixtureState=null;window.PixelHomeBridge={request:async(method,state)=>{if(method==='hello')return{state:JSON.parse(localStorage.getItem('fixture-v1204-'+${JSON.stringify(kind)})||'null'),scope:'v1204-'+${JSON.stringify(kind)},name:'测试伴侣',morning:{look:0}};if(method==='save'){window.fixtureState=JSON.parse(JSON.stringify(state));localStorage.setItem('fixture-v1204-'+${JSON.stringify(kind)},JSON.stringify(state));return{saved:true}};if(method==='morning')return{look:0};if(method==='care')return{actions:['touch']};return{}}};</script>`);
  const file=path.join(qa,kind+'-file.html');fs.writeFileSync(file,html);
  const p=await b.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(pathToFileURL(file).href);await p.locator('#loading').waitFor({state:'detached',timeout:45000});
  assert.equal(await p.evaluate(()=>RoseWardrobe.catalog.outfits.length),11);assert.deepEqual(await p.evaluate(()=>RoseWardrobe.getState().body),{size:118,legs:94,legWidth:100});
  await p.locator('[data-panel=wardrobe]').click();const f=p.frameLocator('#wardrobe-frame');await f.locator('#loading').waitFor({state:'hidden',timeout:45000});assert.equal(await f.locator('#counts').innerText(),'11 套服装 · 8 款发型 · 5 套五官');
  await f.locator('#adjust summary').click();await f.locator('#body-legs').fill('80');await f.locator('#body-legs').dispatchEvent('input');await f.locator('#body-legWidth').fill('85');await f.locator('#body-legWidth').dispatchEvent('input');await f.locator('#save-params').click();
  await p.waitForFunction(()=>fixtureState?.wardrobe?.body.legWidth===85);await f.getByRole('link',{name:'返回小屋'}).click();await p.locator('#wardrobe-overlay').waitFor({state:'hidden'});assert.equal(await p.evaluate(()=>RoseWardrobe.getState().body.legs),80);
  await p.locator('#photo').click();await p.locator('#drawer-title').getByText('把今天收藏起来').waitFor();assert(await p.evaluate(()=>fixtureState.photos.at(-1).image.startsWith('data:image/jpeg;base64,')));await p.locator('#close-drawer').click();
  await p.reload();await p.locator('#loading').waitFor({state:'detached',timeout:45000});assert.deepEqual(await p.evaluate(()=>RoseWardrobe.getState().body),{size:118,legs:80,legWidth:85});
  await p.locator('#help').click();assert(await p.locator('#drawer-title').getByText('和她玩一会儿').isVisible());await p.locator('#close-drawer').click();assert.equal(await p.locator('#fullscreen').count(),0);
  await p.locator('#sleep').click();await p.screenshot({path:path.join(qa,kind+'-sleep.png')});await p.locator('#sleep').click();await p.screenshot({path:path.join(qa,kind+'-room.png')});
  await p.setViewportSize({width:320,height:700});await p.locator('[data-panel=wardrobe]').click();await f.locator('#loading').waitFor({state:'hidden',timeout:45000});await p.screenshot({path:path.join(qa,kind+'-wardrobe.png')});assert.deepEqual(errors,[]);
  const saved=await p.evaluate(()=>fixtureState);assert.deepEqual(require('../pixel-home-policy.js').snapshot(saved).wardrobe,saved.wardrobe);console.log('PASS '+kind+': file loading,11 outfits, saved approved fit, editor return, save/reload, photo, help, sleep,320px,0 errors');await p.close();
 }
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
