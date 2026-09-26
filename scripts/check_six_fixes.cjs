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

  const changes=await page.evaluate(()=>{
   const c=getC(testId);c.deleted=false;c.blocked=false;
   const root=cohabRoot();root.enabled=true;root.paused=false;root.cid=c.id;cohabEnter(c.id);
   const stage=document.querySelector('.offstage');if(!stage)throw Error('no cohab stage');
   const before=stage;offAppearance(c.id);offThemeSet(c.id,'me','#ff0000');offThemeSet(c.id,'them','#00ff00');
   const live=stage===document.querySelector('.offstage')&&getComputedStyle(stage).getPropertyValue('--offc-me-soft').includes('255,0,0')&&getComputedStyle(stage).getPropertyValue('--offc-them-soft').includes('0,255,0');
   closeModal();editContact(c.id);
   const field=document.getElementById('c_callprob');if(!field)throw Error('missing role call field');field.value='0';saveContact(c.id,false);
   const roleZero=effCallProb(getC(c.id))===0,otherDefault=effCallProb({id:'other'})===35;
   go('couple');const taskDefault=taskC()===null&&!!document.getElementById('cou_tasks');coupleTasksToggle();const taskOn=taskC()===c;coupleTasksToggle();
   const p=phoneFriendState();p.id='ME';p.messages={FRIEND:[{id:'m1',from:'ME',to:'FRIEND',time:100,received:true,receivedAt:200,text:pfPack({type:'transfer',amount:52,note:'fixture'})}]};
   const html=renderPhoneFriendChat('FRIEND'),cards=(html.match(/class="wx-transfer-card /g)||[]).length;
   const hit=transferMessageFind('pf:FRIEND','pf-receipt:m1');const receipt=!!hit&&hit.m._transferReceipt&&hit.m.role==='assistant';
   const budgets=chatMainCopy({});save();return {live,roleZero,otherDefault,taskDefault,taskOn,cards,receipt,budgets,editorTaskRemoved:!renderContactEditor(c.id,false).includes('c_taskoff')};
  });
  assert.equal(changes.live,true);assert.equal(changes.roleZero,true);assert.equal(changes.otherDefault,true);assert.equal(changes.taskDefault,true);assert.equal(changes.taskOn,true);assert.equal(changes.cards,2);assert.equal(changes.receipt,true);assert.equal(changes.editorTaskRemoved,true);
  for(const key of ['maxTokens','offlineMaxTokens','letterMaxTokens','callMaxTokens'])assert.equal(changes.budgets[key],4096);
  console.log(JSON.stringify({privateApp,...changes,pageErrors:errors}));assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
