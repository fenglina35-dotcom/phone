const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'.qa','pixel-loading');fs.mkdirSync(qa,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 for(const kind of ['web','private']){
  const dir=path.join(root,kind==='web'?'games/pixel-home':'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/games/pixel-home');
  let html=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace('<head>','<head><base href="'+pathToFileURL(dir+path.sep).href+'">');
  const pattern=/<script src="bridge\.js(?:\?[^\"]*)?"><\/script>/;assert(pattern.test(html));
  html=html.replace(pattern,`<script>window.fixtureState=null;window.PixelHomeBridge={request:async(method,state)=>{if(method==='hello')return{state:JSON.parse(localStorage.getItem('pixel-load-fixture-${kind}')||'null'),scope:'pixel-load-fixture-${kind}',name:'测试伴侣',morning:{look:0}};if(method==='save'){window.fixtureState=JSON.parse(JSON.stringify(state));localStorage.setItem('pixel-load-fixture-${kind}',JSON.stringify(state));return{saved:true};}if(method==='morning')return{look:0};return{};}};</script>`);
  const file=path.join(qa,kind+'.html');fs.writeFileSync(file,html);
  const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.OffscreenCanvas=undefined;HTMLImageElement.prototype.decode=undefined;});
  await p.goto(pathToFileURL(file).href);await p.locator('#loading').waitFor({state:'detached',timeout:60000});
  assert.equal(await p.evaluate(()=>RoseWardrobe.catalog.outfits.length),11);
  await p.locator('#photo').click();await p.waitForFunction(()=>fixtureState?.photos?.length===1);assert(await p.evaluate(()=>fixtureState.photos[0].image.startsWith('data:image/jpeg;base64,')));
  await p.locator('#close-drawer').click();const before=await p.evaluate(()=>RoseWardrobe.getState());
  await p.reload();await p.locator('#loading').waitFor({state:'detached',timeout:60000});assert.deepEqual(await p.evaluate(()=>RoseWardrobe.getState()),before);
  assert.deepEqual(errors,[]);console.log('PASS '+kind+': file asset-data, canvas fallback, photograph, saved wardrobe reload');await p.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
