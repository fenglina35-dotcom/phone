// TTS routing browser regression; provider HTTP/audio output simulated, routing is real.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{for(const privateApp of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:844}}),requests=[],errors=[];page.setDefaultTimeout(15000);
  if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'fixture-native-unavailable'})};});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();
   let body;try{body=r.request().postDataJSON();}catch(_){}
   if(u.host==='tts-fixture.invalid'){requests.push({kind:'external',url:u.href,auth:r.request().headers().authorization,body});return r.fulfill({status:200,contentType:'audio/mpeg',body:Buffer.from([1,2,3])});}
   if(u.host==='license.smallphoneapp.com'&&u.pathname==='/functions/v1/external-tts'){requests.push({kind:'external-relay',url:u.href,body});if(body&&body.provider==='minimax')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({base_resp:{status_code:0},data:{audio:'000102'}})});return r.fulfill({status:200,contentType:'audio/mpeg',body:Buffer.from([1,2,3])});}
   if(body&&['tts','external_tts'].includes(body.action))requests.push({kind:'internal',action:body.action});return r.abort();
  });
  await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  await page.evaluate(()=>{S.me.locked=false;S.me.active='main';decodeBuf=async()=>({});playBuf=async()=>true;});
  for(const relay of [false,true]){
   await page.evaluate(relay=>{S.settings.tts={relay,enabled:true,base:'',key:'',model:'',voice:'',relayVoice:'old-paid-voice'};S.settings.ttsRoutes=null;openSettings('voice');},relay);
   for(const id of ['s_tbase','s_tkey','s_tmodel','s_tvoice'])await page.locator('#'+id).fill('');
   await page.getByRole('button',{name:'测试外置语音（仅使用填写的接口）',exact:true}).click();
   assert.match(await page.locator('#testT').innerText(),/请先填写外置/);assert.equal(requests.length,0);
  }
  await page.locator('#s_tprovider').selectOption('openai');
  await page.locator('#s_tbase').fill('https://tts-fixture.invalid/v1');await page.locator('#s_tkey').fill('own-fixture-key');await page.locator('#s_tmodel').fill('tts-1');await page.locator('#s_tvoice').fill('alloy');
  const before=await page.evaluate(()=>JSON.stringify(S.settings.tts));
  await page.getByRole('button',{name:'测试外置语音（仅使用填写的接口）',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#testT').textContent.includes('已播放'));
  assert.equal(requests.length,1);assert.equal(requests[0].kind,'external');assert.equal(requests[0].auth,'Bearer own-fixture-key');assert.equal(requests[0].body.voice,'alloy');assert.equal(await page.evaluate(()=>JSON.stringify(S.settings.tts)),before);
  const fixedProviders=[
   ['minimax','https://api.minimaxi.com','speech-02-turbo','male-qn-qingse'],
   ['mossland','https://api.mosi.cn/v1','moss-tts','moss-voice'],
   ['fish','https://api.fish.audio','s2.1-pro-free','fish-voice'],
   ['elevenlabs','https://api.elevenlabs.io','eleven_v3','eleven-voice'],
   ['hume','https://api.hume.ai','octave-2','hume-voice'],
  ];
  for(const [provider,base,model,voice] of fixedProviders){const count=requests.length;await page.locator('#s_tprovider').selectOption(provider);await page.locator('#s_tbase').fill(base);await page.locator('#s_tkey').fill(provider+'-user-key');await page.locator('#s_tmodel').fill(model);await page.locator('#s_tvoice').fill(voice);await page.getByRole('button',{name:'测试外置语音（仅使用填写的接口）',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#testT').textContent.includes('已播放'));assert.equal(requests.length,count+1);assert.equal(requests.at(-1).kind,'external-relay');assert.equal(requests.at(-1).body.provider,provider);assert.equal(requests.at(-1).body.key,provider+'-user-key');assert.equal(requests.at(-1).body.voice_id,voice);}
  const afterExternal=requests.length;await page.evaluate(async()=>{S.settings.tts.relay=false;await aiTestVoice();});assert.equal(requests.length,afterExternal);
  const blocked=await page.evaluate(async()=>{try{await aiRelay('tts',{text:'test'});return false;}catch(e){return /已关闭/.test(e.message);}});assert(blocked);assert.equal(requests.length,afterExternal);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({privateApp,blankFormNoRequests:true,externalOnlyWithOwnKey:true,internalOffNoRequests:true,oldSettingsPreserved:true}));await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
