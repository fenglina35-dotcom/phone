// Core release gate: run actual prompt construction and reply delivery with phone permission.
// Only the HTTP model is simulated; never replace buildSystem or myActivity.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{for(const privateApp of [false,true]){
  const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];
  if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'fixture-native-unavailable'})};});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');
  await page.waitForFunction(()=>window.__northBootReady);
  await page.evaluate(()=>{
   S.me.locked=false;S.me.active='main';const role=S.contacts[0];window.testId=role.id;
   S.couple={cid:role.id};role.spy={granted:true,loc:false};role.proactive={enabled:false};
   S.settings.replyDelay=0;S.settings.chat={base:'https://fake.invalid/v1',key:'fixture',model:'fixture',maxTokens:9000,temp:.7};
   aiCoreOn=()=>false;window.testCalls=[];window.fixtureRaw='[内心|想听你说话]\n我在，慢慢说。';
   fetchT=async(url,opt)=>{if(!String(url).startsWith('https://fake.invalid/'))return{ok:true,json:async()=>false,text:async()=>'false'};testCalls.push(JSON.parse(opt.body));return{ok:true,json:async()=>({choices:[{message:{content:fixtureRaw},finish_reason:'stop'}]})};};
   openChat(role.id);
  });


  for(const width of [320,390,430]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(()=>{S.me.locked=false;go('contactInfo',{id:testId});});
   await page.getByRole('button',{name:'联系人设置',exact:true}).click();
   await page.getByRole('button',{name:'聊天与主动'}).click();
   await page.locator('.it').filter({hasText:'电话频率'}).click();
   const direct=page.locator('#role_call_probability');await direct.fill('0');
   const rect=await direct.boundingBox();assert(rect&&rect.width>100&&rect.x>=0&&rect.x+rect.width<=width,'phone input fits '+width);
   await page.locator('#modalSheet').getByRole('button',{name:'保存',exact:true}).click();
   assert.equal(await page.evaluate(()=>effCallProb(getC(testId))),0);
   await page.locator('.nav .r').filter({hasText:'编辑'}).click();
   const field=page.locator('#c_callprob');await field.scrollIntoViewIfNeeded();
   const old=await field.boundingBox();assert(old&&old.width>100&&old.x>=0&&old.x+old.width<=width,'editor input fits '+width);
   await field.fill('72');await page.locator('.wx-editor-save').click();
   assert.equal(await page.evaluate(()=>effCallProb(getC(testId))),72);
   assert.equal(await page.evaluate(()=>effCallProb({id:'other'})),35);
   console.log(JSON.stringify({privateApp,width,directInputWidth:rect.width,editorInputWidth:old.width,realClicks:true,saved:true,otherRoleUnchanged:true}));
  }
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
