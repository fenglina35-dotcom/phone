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
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');
  await page.waitForFunction(()=>window.__northBootReady);
  await page.evaluate(()=>{
   S.me.locked=false;S.me.active='main';const role=S.contacts[0];window.testId=role.id;
   S.couple={cid:role.id};role.spy={granted:true,loc:false};role.proactive={enabled:false};
   S.settings.replyDelay=0;S.settings.chat={base:'https://fake.invalid/v1',key:'fixture',model:'fixture',maxTokens:9000,temp:.7};
   aiCoreOn=()=>false;window.testCalls=[];window.fixtureRaw='[内心|想听你说话]\n我在，慢慢说。';
   fetchT=async(url,opt)=>{testCalls.push(JSON.parse(opt.body));return{ok:true,json:async()=>({choices:[{message:{content:fixtureRaw},finish_reason:'stop'}]})};};
   openChat(role.id);
  });
  for(const granted of [false,true])for(const raw of [false,true])for(const populated of [false,true]){
   const result=await page.evaluate(async({granted,raw,populated})=>{
    const role=getC(testId);role.spy={granted,loc:false};S.settings.modelOutputUnfiltered=raw;
    S.me.lifeNotes=populated?[
     {text:'旧记录保留标记',source:'manual',ts:Date.now()},
     {text:'她因为被认真倾听而感到安心 OWN_NOTE',roleId:role.id,accountId:'main',rolePerspective:true,ts:Date.now()},
     {text:'OTHER_ROLE_SECRET',roleId:'another-role',accountId:'main',rolePerspective:true,ts:Date.now()},
     {text:'OTHER_ACCOUNT_SECRET',roleId:role.id,accountId:'other-account',rolePerspective:true,ts:Date.now()}
    ]:[];
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
  await page.evaluate(()=>saveNow());await page.goto(page.url().split('?')[0]);await page.waitForFunction(()=>window.__northBootReady);
  const restored=await page.evaluate(()=>{const role=S.contacts[0];return{granted:role.spy.granted,reply:msgs(role.id).some(m=>m.content==='我在，慢慢说。'),sys:buildSystem(role).length};});
  assert(restored.granted&&restored.reply&&restored.sys>0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({privateApp,composerAndManualReply:true,automaticInspection:auto,persisted:true}));
  console.log(JSON.stringify({privateApp,refreshAndSinceAndRevocation:true,pageErrors:errors.length}));
  await page.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
