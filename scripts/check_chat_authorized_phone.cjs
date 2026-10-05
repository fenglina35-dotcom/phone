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
  // Exercise actual notification handlers and nearby permission controls in both HTML runtimes.
  const controls=await page.evaluate(()=>{
   const role=getC(testId);home();showMsgBanner(role,{type:'text',content:'手势测试消息'});
   const b=document.getElementById('msgBanner'),event=(type,x,y)=>b.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:17,isPrimary:true,pointerType:'touch',clientX:x,clientY:y}));
   const before=JSON.stringify(msgs(testId));event('pointerdown',100,80);event('pointermove',101,45);event('pointerup',101,45);b.click();
   const dismissed=!b.classList.contains('show')&&cur().p==='home'&&JSON.stringify(msgs(testId))===before;
   showMsgBanner(role,{type:'text',content:'新的横幅'});event('pointerdown',100,80);event('pointermove',145,75);event('pointerup',145,75);b.click();
   const horizontal=b.classList.contains('show')&&cur().p==='home';
   _msgBannerNoClickUntil=0;event('pointerdown',100,80);event('pointerup',100,80);b.click();const tap=cur().p==='chat'&&cur().id===role.id;
   home();showMsgBanner(role,{type:'text',content:'旧通知'});event('pointerdown',100,80);showMsgBanner(role,{type:'text',content:'后到的新通知'});event('pointermove',100,30);
   const newNoticeSafe=b.classList.contains('show');b.className='msgbanner';clearTimeout(_bannerT);
   S.couple={cid:role.id,grant:{},locks:{}};
   applyControlTags('[锁定|附近的人]',role,role.id,'','');const defaultDenied=!appLocked('nearby');
   coupleGrant('nearby');const permission=!!S.couple.grant.nearby;
   applyControlTags('[锁定|附近的人]',{id:'other-role'},'other-role','','');const otherDenied=!appLocked('nearby');
   applyControlTags('[锁定|附近的人]',role,role.id,'','');const locked=appLocked('nearby');
   home();wxDiscoverOpen('nearby');const discoverBlocked=cur().p!=='wxnearby';home();go('wxnearby');const routeBlocked=cur().p!=='wxnearby';
   const callsBefore=testCalls.length;wxNearbyRefresh();const refreshBlocked=testCalls.length===callsBefore&&!_wxNearbyBusy;const beforeRequests=wxNearbyState().requests.length;wxNearbyAdd('missing');const addBlocked=wxNearbyState().requests.length===beforeRequests;
   const lockedMarkup=renderWxNearby();const pageBlocked=lockedMarkup.includes('已被锁定')&&!lockedMarkup.includes('wx-nearby-list');
   applyControlTags('[解锁|附近的人]',role,role.id,'','');wxDiscoverOpen('nearby');const unlocked=!appLocked('nearby')&&cur().p==='wxnearby'&&curAppKey()==='nearby';
   applyControlTags('[锁定|附近的人]',role,role.id,'','');const wasBlocked=role.blocked;role.blocked=true;coupleGrant('nearby');role.blocked=wasBlocked;const revoked=!S.couple.grant.nearby&&!appLocked('nearby');
   const snapshot=remoteControlCouplePermissions().find(x=>x.key==='grant:nearby');
   S.couple={cid:role.id};openChat(role.id);
   return{dismissed,horizontal,tap,newNoticeSafe,defaultDenied,permission,otherDenied,locked,discoverBlocked,routeBlocked,refreshBlocked,addBlocked,pageBlocked,unlocked,revoked,snapshot:!!snapshot};
  });
  for(const [key,value] of Object.entries(controls))assert.equal(value,true,JSON.stringify({privateApp,key,controls}));
  console.log(JSON.stringify({privateApp,notificationSwipeAndNearbyControls:controls}));
  for(const granted of [false,true])for(const raw of [false,true])for(const populated of [false,true]){
   const result=await page.evaluate(async({granted,raw,populated})=>{
    const role=getC(testId);role.spy={granted,loc:false};S.settings.modelOutputUnfiltered=raw;
    S.me.lifeNotes=populated?[
     {text:'旧记录保留标记',source:'manual',ts:Date.now()},
     {text:'她因为被认真倾听而感到安心 OWN_NOTE',roleId:role.id,accountId:'main',rolePerspective:true,ts:Date.now()},
     {text:'OTHER_ROLE_SECRET',roleId:'another-role',accountId:'main',rolePerspective:true,ts:Date.now()},
     {text:'OTHER_ACCOUNT_SECRET',roleId:role.id,accountId:'other-account',rolePerspective:true,ts:Date.now()}
    ]:[];
    fixtureRaw='[内心|想听你说话]\n我在，慢慢说。'+(populated?'\n[应用处理|提醒]':'');
    const before=JSON.stringify(S.me.lifeNotes),sys=buildSystem(role),activity=myActivity(role.id);
    S.messages[testId]=[{id:uid(),role:'user',type:'text',content:'先生N',time:Date.now()}];testCalls.length=0;
    await aiReply(testId);
    return{sys,activity,calls:testCalls.length,rows:msgs(testId).filter(m=>m.role==='assistant').map(m=>m.content),unchanged:before===JSON.stringify(S.me.lifeNotes),busy:replyGenerationBusy(testId,actId()),visible:document.body.innerText.includes('我在，慢慢说。')};
   },{granted,raw,populated});
   assert.equal(result.calls,1,JSON.stringify(result));assert.deepEqual(result.rows,['我在，慢慢说。']);assert(result.visible);assert(result.unchanged);assert(!result.busy);
   assert(!result.sys.includes('OTHER_ROLE_SECRET'));assert(!result.sys.includes('OTHER_ACCOUNT_SECRET'));
   assert(!result.activity.includes('OTHER_ROLE_SECRET'));assert(!result.activity.includes('OTHER_ACCOUNT_SECRET'));
   if(populated){assert(result.activity.includes('OWN_NOTE'));assert(result.activity.includes('旧记录保留标记'));}
   console.log(JSON.stringify({privateApp,granted,raw,populated,delivered:true,notesPreserved:true}));
  }
  const otherPaths=await page.evaluate(()=>{
   const role=getC(testId);role.spy={granted:true,loc:false};S.spy[testId]=S.spy[testId]||{};
   spyWatchRefresh(testId);const watched=S.spy[testId].watched;
   const recent=myActivity(testId,Date.now()-60000),future=myActivity(testId,Date.now()+60000);
   role.spy.memorySince=Date.now();const cleared=buildSystem(role);role.spy.granted=false;const revoked=buildSystem(role);
   return{watched:watched.join('\n'),recent,future,cleared:cleared.includes('你的旧记忆已经被清除'),revoked:!revoked.includes('# 你能查看')};
  });
  assert(otherPaths.watched.includes('OWN_NOTE'));assert(otherPaths.recent.includes('OWN_NOTE'));assert(!otherPaths.future.includes('OWN_NOTE'));assert(otherPaths.cleared);assert(otherPaths.revoked);
  assert(!otherPaths.watched.includes('OTHER_ROLE_SECRET'));
  await page.evaluate(()=>{getC(testId).spy={granted:true,loc:false};S.settings.manualReplyScenes={wechat:true,games:true,roleplay:true,offline:true};S.settings.manualReply=true;S.messages[testId]=[];testCalls.length=0;openChat(testId);});
  await page.locator('#cinput').fill('先生N');
  await page.evaluate(()=>{sendText(testId);manualReply(testId);});
  await page.waitForFunction(()=>testCalls.length===1&&!replyGenerationBusy(testId,actId()));
  assert.deepEqual(await page.evaluate(()=>msgs(testId).map(m=>m.content)),['先生N','我在，慢慢说。']);
  const auto=await page.evaluate(async()=>{testCalls.length=0;fixtureRaw='刚才那些话我都记着呢。';S._spySeen={};const before=msgs(testId).length,oldSleep=sleep;sleep=async()=>{};try{const result=await doSpyViewCore(testId,true,{});return{result,calls:testCalls.length,delivered:msgs(testId).slice(before).some(m=>m.role==='assistant'&&m.content==='刚才那些话我都记着呢。')};}finally{sleep=oldSleep;}});
  assert.equal(auto.calls,1,JSON.stringify(auto));assert(auto.delivered,JSON.stringify(auto));
  await page.evaluate(async()=>{S.couple.grant={nearby:true};S.couple.locks={nearby:{pwd:'3456',time:Date.now()}};await saveNowAsync();});await page.goto(page.url().split('?')[0]);await page.waitForFunction(()=>window.__northBootReady);
  const restored=await page.evaluate(()=>{const role=S.contacts[0];return{granted:role.spy.granted,reply:msgs(role.id).some(m=>m.content==='我在，慢慢说。'),sys:buildSystem(role).length,nearbyPermission:!!S.couple.grant.nearby,nearbyLock:appLocked('nearby')};});
  assert(restored.granted&&restored.reply&&restored.sys>0&&restored.nearbyPermission&&restored.nearbyLock);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({privateApp,composerAndManualReply:true,automaticInspection:auto,persisted:true}));
  console.log(JSON.stringify({privateApp,refreshAndSinceAndRevocation:true,pageErrors:errors.length}));
  await page.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
