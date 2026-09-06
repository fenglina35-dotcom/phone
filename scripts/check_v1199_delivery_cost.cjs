const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
try{for(const privateApp of [false,true])for(const scenario of [
{label:'screenshot',user:'忘了咬你',raw:'咬。\n过来厨房，先生脖子伸好了等你。\n咬完了记得把香菜挑干净继续吃，别浪费粮食。\n先生欠你一口，下次点面亲自盯着备注写去香菜三个大字。\n[记住|小狗点牛肉拉面必须备注去香菜，她讨厌吃香菜，这次忘了备注她很不开心，下次绝对不能再忘]',expected:1},
{label:'thought-memory',user:'我讨厌吃香菜，陪我说话',raw:'[内心|下次给你点牛肉面]\n我在，慢慢说。\n[记住|小狗点牛肉拉面必须备注去香菜，她讨厌吃香菜，下次绝对不能再忘]',expected:1},
{label:'current-meal-care',user:'今天有点忙',raw:'[内心|有点担心你]\n你忙你的，我去给你点点吃的。',expected:2}
]){
 const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
 await page.evaluate(s=>{S.me.locked=false;S.couple=null;const c=S.contacts[0];window.testId=c.id;c.proactive={enabled:false};c.innerThought='之前的有效内心';S.settings.replyDelay=0;S.settings.showMoodTag=true;S.messages[c.id]=[{id:'cost-user',role:'user',type:'text',content:s.user,time:Date.now()}];S.settings.chat={base:'https://fake.invalid/v1',key:'test-key',model:'test-model',maxTokens:9000,temp:.7};aiCoreOn=()=>false;window.testCalls=[];fetchT=async(url,opt)=>{const b=JSON.parse(opt.body);testCalls.push(b.messages);const raw=testCalls.length===1?s.raw:'[内心|只是聊天，不启动外卖]\n[不启动外卖]\n我还在等你。';return{ok:true,json:async()=>({choices:[{message:{content:raw},finish_reason:'stop'}]})};};openChat(c.id);manualReply(c.id);},scenario);
 await page.waitForFunction(()=>testCalls.length>0&&!replyGenerationBusy(testId,actId()),null,{timeout:60000});
 const result=await page.evaluate(()=>({calls:testCalls.length,messages:msgs(testId).filter(m=>m.role==='assistant').map(m=>m.content),thought:visibleRoleThought(getC(testId)),mem:getC(testId).memories,version:APP_VER}));
 assert.equal(result.calls,scenario.expected,JSON.stringify({privateApp,scenario,result}));assert(result.messages.length>0);assert(result.messages.every(m=>!String(m).includes('[记住|')&&!String(m).includes('[内心|')));assert.equal(await page.locator('#chatMoodBar').isVisible(),true);
 if(scenario.label==='screenshot')assert.equal(result.thought,'之前的有效内心');
 await page.evaluate(()=>roleInterceptDiagnosticOpen(testId,'online'));const modal=await page.locator('body').innerText();
 if(scenario.expected===1)assert.match(modal,/暂时没有可查看的拦截正文/);
 else if(privateApp){assert.match(modal,/外卖动作补判/);assert.match(modal,/不是聊天格式错误/);assert.doesNotMatch(modal,/这份模型候选没有原样展示/);}
 assert.equal(await page.evaluate(()=>testCalls.length),scenario.expected);assert.deepEqual(errors,[]);console.log(JSON.stringify({privateApp,scenario:scenario.label,...result,pageErrors:errors}));await page.close();
}
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
