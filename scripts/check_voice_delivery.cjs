// Real web/private aiReply -> message store -> voice bubble. Only model HTTP is a fixture.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
const valid='[语音|Go to sleep, baby. I am right here.|睡吧，宝贝。我就在这里。|语气:温柔]';
const cases=[
 {name:'screenshot-no-comma',user:'先生你发句语音',responses:[valid],expected:'voice',freq:0,calls:1},
 {name:'explicit-plain-English',user:'先生你发句语音',responses:['Go to sleep, baby. I am right here.',valid],expected:'voice',calls:2},
 {name:'explicit-plain-Chinese',user:'先生你发句语音',responses:['我在这里。','[语音|我在这里。|语气:温柔]'],expected:'voice',lang:'zh',calls:2},
 {name:'automatic-valid',user:'晚安。',responses:[valid],expected:'voice',calls:1},
 {name:'automatic-missing-translation',user:'晚安。',responses:['[语音|Go to sleep, baby. I am right here.|语气:温柔]',valid],expected:'voice',calls:2},
 {name:'automatic-no-cue-missing-translation',user:'晚安。',responses:['[语音|Go to sleep, baby. I am right here.]',valid],expected:'voice',calls:2},
 {name:'automatic-repair-not-a-voice',user:'晚安。',responses:['[语音|Go to sleep, baby.|语气:温柔]','Good night.'],expected:null,calls:2},
 {name:'automatic-disabled',user:'晚安。',responses:[valid],expected:'text',freq:0,calls:1},
 {name:'ordinary-Chinese',user:'我忙完了。',responses:['我在，慢慢说。'],expected:'text',calls:1},
 {name:'reported-voice-not-request',user:'我刚才发的语音你听到了吗',responses:['听到了。'],expected:'text',calls:1},
 {name:'decline-voice',user:'先生你不要发语音',responses:['好，我们打字。'],expected:'text',calls:1},
];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'}),failures=[];
 try{for(const privateApp of [false,true]){
  const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];
  if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'fixture-native-unavailable'})};});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');
  await page.waitForFunction(()=>window.__northBootReady);
  await page.evaluate(()=>{S.me.locked=false;S.me.active='main';const c=S.contacts[0];window.testId=c.id;S.couple={cid:c.id};c.spy={granted:true,loc:false};c.proactive={enabled:false};S.settings.replyDelay=0;S.settings.chat={base:'https://voice-fixture.invalid/v1',key:'fixture',model:'fixture',maxTokens:9000,temp:.7};aiCoreOn=()=>false;openChat(c.id);});
  for(const raw of [false,true])for(const fixture of cases){
   const result=await page.evaluate(async({raw,fixture})=>{
    const c=getC(testId);c.voice={lang:fixture.lang||'en'};S.settings.voiceFreq=fixture.freq??1;S.settings.modelOutputUnfiltered=raw;
    const toastElement=document.querySelector('#toast');if(toastElement){toastElement.textContent='';toastElement.classList.remove('show');}
    const config=JSON.stringify({voice:c.voice,chat:S.settings.chat});window.voiceCalls=[];window.voiceWarm=[];
    // TTS itself is not claimed: capture dispatch before audio/network, preserving actual bubble render.
    scheduleVoiceWarm=(m)=>voiceWarm.push(m.id);
    fetchT=async(url,opt)=>{if(!String(url).startsWith('https://voice-fixture.invalid/'))return{ok:true,json:async()=>false,text:async()=>'false'};voiceCalls.push(JSON.parse(opt.body));const text=fixture.responses[Math.min(voiceCalls.length-1,fixture.responses.length-1)];return{ok:true,json:async()=>({choices:[{message:{content:text},finish_reason:'stop'}]})};};
    S.messages[testId]=[{id:uid(),role:'user',type:'text',content:fixture.user,time:Date.now()}];openChat(testId);await aiReply(testId);
    const rows=msgs(testId).filter(m=>m.role==='assistant');
    return{rows:rows.map(m=>({type:m.type,content:m.content,trans:m.trans})),calls:voiceCalls.length,warm:voiceWarm.length,busy:replyGenerationBusy(testId,actId()),unchanged:config===JSON.stringify({voice:c.voice,chat:S.settings.chat}),voiceBubble:!!document.querySelector('.voiceb[data-vid]'),body:document.body.innerText.slice(-1200)};
   },{raw,fixture});
   try{assert.equal(result.calls,fixture.calls);assert(!result.busy);assert(result.unchanged);assert.doesNotMatch(result.body,/is not defined|ReferenceError|SyntaxError/);if(fixture.expected){assert.equal(result.rows.length,1);assert.equal(result.rows[0].type,fixture.expected);assert.equal(result.warm,fixture.expected==='voice'?1:0);assert.equal(result.voiceBubble,fixture.expected==='voice');if(fixture.expected==='text')assert.match(result.rows[0].content,/[\u3400-\u9fff]/);else if(fixture.lang!=='zh')assert.match(result.rows[0].trans,/[\u3400-\u9fff]/);}else {assert.equal(result.rows.length,0);assert.match(result.body,/语音格式不完整/);}}
   catch(e){failures.push({privateApp,raw,name:fixture.name,error:e.message,result});}
   if(raw&&fixture.name==='screenshot-no-comma'){await page.waitForFunction(()=>[...document.querySelectorAll('.voiceb')].some(e=>Number(getComputedStyle(e.closest('.msg')).opacity)>.99));await page.screenshot({path:path.join(require('node:os').tmpdir(),'voice-v1228-'+(privateApp?'private':'web')+'.png')});}
   console.log(JSON.stringify({privateApp,raw,name:fixture.name,rows:result.rows,calls:result.calls}));
  }
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();server.close();}
 assert.deepEqual(failures,[],JSON.stringify(failures,null,2));
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
