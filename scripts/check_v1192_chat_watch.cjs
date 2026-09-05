// Real browser clocks and real chatAPI parsing; only the HTTP model is mocked.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),requests=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/mock/chat/completions'){
  let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
   const data=JSON.parse(body),event=data.messages.at(-1).content;
   requests.push({at:Date.now(),event,model:data.model});
   setTimeout(()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'[心情|好奇]刚才去找朋友了呀。\n还挺投入的。\n看到什么有趣的了吗？\n也和我说说。'},finish_reason:'stop'}]}));},2500);
  });return;
 }
 const file=path.resolve(root,decodeURIComponent(url.pathname).replace(/^\/+/,''));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  await Promise.all(['chat'].map(async kind=>{
   const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   await page.goto(origin+'/小手机.html?northPreview=black-home');
   await page.waitForFunction(()=>window.__northBootReady&&typeof coupleWatchStatus==='function');
   await page.evaluate(({kind,origin})=>{
    S.couple=coupleDefaultState(S.contacts[0].id);S.me.locked=false;S.couple.chatWatch=true;S.couple.softwareWatch=true;S.couple.watchApps={douyin:true};
    const partner=getC(S.couple.cid);partner.model='main';partner.chatRouteIndex=0;
    S.settings.chatRoutes=[{base:origin+'/mock',key:'test-only',model:kind,temp:.8,maxTokens:900}];S.settings.chatRouteActive=0;
    msgsForAccount(partner.id,'main').push({id:'old-unanswered',role:'user',type:'text',content:'之前的一条用户消息',time:Date.now()-3600000});
    // These old quiet/failed-feature states must not veto an authorized event.
    roleOnlineProactiveBlocked=()=>true;_replyFeaturePending[replyStateKey(partner.id,'main')]=[{note:'old failed feature',at:Date.now()-3600000}];
    S.contacts.push({id:'watch-other',name:'测试朋友',persona:'朋友',family:{},proactive:{enabled:false}});
    window.watchTestOpen=()=>{if(kind==='chat')openChat('watch-other');else openApp('douyin');};
    window.watchTestOpen();window.watchTestStarted=Date.now();
   },{kind,origin});
   console.log(kind+': entered actual page, checking short visit');
   await page.waitForTimeout(kind==='chat'?9000:19000);
   assert.equal(requests.filter(x=>x.model===kind).length,0);
   await page.evaluate(()=>{home();window.watchTestOpen();window.watchTestStarted=Date.now();});
   console.log(kind+': reentered, waiting for actual 10–60 / 20–60 second timer');
   await page.waitForFunction(()=>coupleWatchStatus().stage==='generating',null,{timeout:65000});
   const elapsed=await page.evaluate(()=>Date.now()-window.watchTestStarted);
   assert(elapsed>=(kind==='chat'?10000:20000)&&elapsed<63000,'threshold outside expected window: '+elapsed);
   // Returning to partner chat after detection must not cancel the HTTP result.
   // Stay in the observed conversation while the partner reply arrives.
   await page.waitForFunction(()=>coupleWatchStatus().stage==='sent',null,{timeout:10000});
   const result=await page.evaluate(()=>({status:coupleWatchStatus(),messages:msgsForAccount(S.couple.cid,'main').slice(-4).map(x=>({role:x.role,content:x.content})),version:APP_VER}));
   assert.equal(requests.filter(x=>x.model===kind).length,1);
   assert.match(requests.find(x=>x.model===kind).event,/第 2 次/);
   if(kind==='douyin')assert.match(requests.find(x=>x.model===kind).event,/抖音/);
   assert(result.messages.every(x=>x.role==='assistant'));
   assert.equal(await page.evaluate(()=>cur().id),'watch-other');
   assert.equal(await page.locator('#msgBanner').evaluate(el=>el.classList.contains('show')),true);
   assert.match(await page.locator('#msgBanner').innerText(),/也和我说说/);
   assert.deepEqual(errors,[]);
   console.log(JSON.stringify({kind,elapsed,modelRequests:1,delivered:4,stayedInOtherChat:true,version:result.version,pageErrors:errors}));
   await context.close();
  }));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
