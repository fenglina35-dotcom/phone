const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
  res.setHeader('Content-Type',mime+'; charset=utf-8');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const edge='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
 const browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
 try{
  for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){
   const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.address().port}/${prefix}小手机.html?northPreview=black-home`);
   await page.waitForFunction(()=>window.__northBootReady&&typeof coupleWatchPermissionHTML==='function');
   await page.evaluate(()=>{
    S.couple=coupleDefaultState(S.contacts[0].id);S.me.locked=false;go('couple');couTab(2);
   });
   assert.equal(await page.getByRole('switch',{name:'聊天监管',exact:true}).getAttribute('aria-checked'),'false');
   await page.getByRole('switch',{name:'聊天监管',exact:true}).click();
   await page.getByRole('switch',{name:'软件监管',exact:true}).click();
   await page.getByText('管理软件',{exact:true}).click();
   await page.getByRole('switch',{name:'游戏大厅',exact:true}).click();
   const shot=path.join(process.env.TEMP,prefix?'phone-v1190-private-permissions.png':'phone-v1190-web-permissions.png');
   await page.screenshot({path:shot});
   await page.evaluate(()=>{
    closeModal();window.__watchCalls=[];
    chatAPI=async(messages,opt)=>{window.__watchCalls.push({messages,opt});return '你又去找朋友聊天了呀。';};
    notifyIncoming=()=>{};
    const id=S.couple.cid;msgsForAccount(id,'main').push({id:'watch-test-last',role:'assistant',type:'text',content:'之前的对话已经结束',time:Date.now()});
    S.contacts.push({id:'watch-other',name:'测试朋友',persona:'朋友',family:{},proactive:{enabled:false}});
    window.__watchNow=Date.now();
    _coupleWatchEngine=CoupleWatch.create({now:()=>window.__watchNow,random:()=>0,read:coupleWatchRead,save:()=>{},ready:coupleWatchReady,react:coupleWatchReact});
    window.__advanceWatch=ms=>{for(let n=0;n<ms;n+=250){window.__watchNow+=250;coupleWatchTick();}};
    go('chat',{id:'watch-other'});window.__advanceWatch(29000);home();go('chat',{id:'watch-other'});window.__advanceWatch(29000);
   });
   assert.equal(await page.evaluate(()=>window.__watchCalls.length),0,'short visits must not call model');
   await page.evaluate(()=>window.__advanceWatch(1000));
   await page.waitForFunction(()=>window.__watchCalls.length===1);
   const request=await page.evaluate(()=>window.__watchCalls[0]);
   assert.match(request.messages.at(-1).content,/第 2 次/);
   assert.equal(request.opt.independentRoleModel,true);
   await page.evaluate(()=>{home();_gs={cid:S.couple.cid,msgs:[],kind:'test',title:'测试',t:10};stack=[{p:'home'},{p:'gs'}];coupleWatchTick();window.__advanceWatch(65000);});
   assert.equal(await page.evaluate(()=>window.__watchCalls.length),1,'partner game must not call model');
   assert.deepEqual(errors,[]);
   console.log(JSON.stringify({scope:prefix?'private':'web',buttons:true,shortVisit:true,secondVisit:true,partnerGame:true,pageErrors:errors,screenshot:shot}));
   await page.close();
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
