// Actual private page + real IndexedDB and canvas; only remote RPC is isolated.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\//,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false})};});
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await page.goto(origin+'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
 const result=await page.evaluate(async()=>{
  const c=S.contacts[0];c.proactive={enabled:true,serverPush:true};gateOK=()=>true;roleServerPushCheckStatus=()=>{};
  const sent=[];companionRpc=async(name,args)=>{sent.push(args.p_profile);return true};
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#ee1111';ctx.fillRect(0,0,96,96);
  await imgPut('notification-test-photo',canvas.toDataURL('image/png'));c.avatar='idb:notification-test-photo';delete _imgCache['notification-test-photo'];
  await roleServerPushSync(c,true);const first=sent.pop();
  const img=new Image();img.src=first.avatarData;await img.decode();ctx.drawImage(img,0,0);const pixel=Array.from(ctx.getImageData(48,48,1,1).data);
  c.avatar='https://fixture.invalid/missing.jpg';await roleServerPushSync(c,true);const failed=sent.pop();
  c.avatar='idb:notification-test-photo';await roleServerPushSync(c,true);const recovered=sent.pop();
  c.proactive.enabled=false;c.avatar='idb:missing-image';await roleServerPushSync(c,true);const disabled=sent.pop();
  return {pixel,photo:first.avatarData.startsWith('data:image/jpeg;'),failed:failed.avatarData,recovered:recovered.avatarData===first.avatarData,disabled:disabled.enabled,marker:failed.automationConfig.notificationAvatarPreserve,version:APP_VER,chatAvatar:c.avatar};
 });
 assert.equal(result.photo,true);assert(result.pixel[0]>220&&result.pixel[1]<40);assert.equal(result.failed,'');assert.equal(result.recovered,true);assert.equal(result.disabled,false);assert.equal(result.marker,true);assert.deepEqual(errors,[]);
 console.log(JSON.stringify(result));console.log('PASS: real IndexedDB photo / canvas pixel, broken image, recovery, disable sync, no page errors');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
