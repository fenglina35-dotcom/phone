import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// v1384 角色扮演点开提示「这个红包找不到了」：红包的 rpOpen(scope,key,mid) 和角色扮演的 rpOpen(id) 同名，后者被覆盖。
for (const [label, path] of [['web', '../app.js'], ['private', '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']]) {
  test(label + ': role play and red packets have their own open functions', () => {
    const app = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
    const names = [...app.matchAll(/^(?:async )?function ([A-Za-z0-9_$]+)\(/gm)].map(m => m[1]);
    assert.equal(names.filter(n => n === 'rpOpen').length, 1, 'only the role-play rpOpen(id) remains');
    assert.match(app, /^function rpOpen\(id\)\{const d=rpData\(id\);/m);
    assert.match(app, /^function redpOpen\(scope,key,mid\)\{const r=rpResolve\(scope,key,mid\);/m);
    assert.doesNotMatch(app, /[^d]rpOpen\('(?:pf|group|role)'/, 'red packet cards call redpOpen');
  });
}


test('actual roleplay reply uses the role route and produces visible dialogue on both runtimes',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright'),path=require('node:path');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const priv of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:844}}),requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname.endsWith('rp-fixture.invalid')){requests.push({host:u.hostname,body:JSON.parse(route.request().postData()||'{}')});return route.fulfill({status:u.hostname==='role-rp-fixture.invalid'?200:401,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(u.hostname==='role-rp-fixture.invalid'?{choices:[{message:{content:'阿澈：我听见了，我们接着说。'}}]}:{error:{message:'fixture default route is unavailable'}})});}if(u.origin!=='http://127.0.0.1:8778')return route.abort();const f=path.resolve(decodeURIComponent(u.pathname.slice(1)));const ok=f.startsWith(process.cwd()+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile();return route.fulfill({status:ok?200:404,body:ok?fs.readFileSync(f):'',contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});});
  await page.goto('http://127.0.0.1:8778/'+(priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady,{},{timeout:8000}).catch(async e=>{throw new Error('Boot errors: '+errors.join(' | ')+' '+(await page.locator('body').innerText()).slice(0,300));});
  await page.evaluate(()=>{S.me.locked=false;S.me.active='main';S.settings.sound=false;S.contacts.forEach(c=>c.proactive={enabled:false});const c=S.contacts[0];c.name='阿澈';c.remark='';c.chatRouteIndex=2;c.model='main';S.settings.offAux=false;S.settings.chatStreaming=false;S.settings.chat={base:'https://default-rp-fixture.invalid/v1',key:'fixture',model:'default-model'};S.settings.chatRoutes=[chatRouteCopy(S.settings.chat),chatRouteCopy({}),chatRouteCopy({base:'https://role-rp-fixture.invalid/v1',key:'fixture-role',model:'role-model',aux:{base:'https://role-rp-fixture.invalid/v1',key:'fixture-aux',model:'role-aux'}}),chatRouteCopy({})];const d=rpData(c.id);d.active=true;d.msgs=[{id:'user-rp',who:'me',text:'接着刚才的剧情说吧。'}];window.rpFixtureId=c.id;_rp=null;stack=[{p:'home'},{p:'rp',id:c.id}];render();rpReply();});
  await page.waitForFunction(()=>_rp&&!_rp.busy,{},{timeout:5000}).catch(async e=>{throw new Error(JSON.stringify({errors,requests,state:await page.evaluate(()=>({busy:_rp&&_rp.busy,messages:rpData(rpFixtureId).msgs}))}));});const result=await page.evaluate(()=>({text:rpData(rpFixtureId).msgs.map(m=>m.text).join('\n'),visible:document.querySelector('#rpbg').innerText,busy:_rp.busy}));
  assert(requests.some(r=>r.host==='role-rp-fixture.invalid'&&r.body.model==='role-model'),`${priv?'private':'web'} roleplay ignored the working role route`);assert(result.text.includes('我听见了，我们接着说。'));assert(result.visible.includes('我听见了，我们接着说。'));assert.equal(result.busy,false);
  const at=requests.length;await page.evaluate(()=>{S.settings.offAux=true;rpReply();});await page.waitForFunction(()=>_rp&&!_rp.busy,{},{timeout:8000});assert(requests.slice(at).some(r=>r.body.model==='role-aux'),'roleplay auxiliary setting must use the same role route auxiliary');
  const original=await page.evaluate(()=>rpData(rpFixtureId).msgs.length);await page.route('https://role-rp-fixture.invalid/**',r=>r.fulfill({status:503,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'application/json',body:JSON.stringify({error:{message:'fixture failure'}})}));await page.evaluate(()=>rpReply());await page.waitForFunction(()=>_rp&&!_rp.busy,{},{timeout:8000});const failed=await page.evaluate(()=>({count:rpData(rpFixtureId).msgs.length,error:_rp.error,visible:document.querySelector('.rp-reply-error')&&document.querySelector('.rp-reply-error').innerText}));assert.equal(failed.count,original,'transport failure must not invent dialogue');assert(failed.error.includes('回复失败'));assert(failed.visible.includes('回复失败'));assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});


for(const [kind,path] of [['web','../app.js'],['private','../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']])test(kind+': roleplay releases failed rendering and ignores superseded or cross-account replies',async()=>{
 const {default:vm}=await import('node:vm');const source=fs.readFileSync(new URL(path,import.meta.url),'utf8'),a=source.indexOf('async function rpAI('),b=source.indexOf('function rpRender()',a);let seq=0,failRender=false;const calls=[],d={active:true,msgs:[]},S={settings:{offAux:false}},c={id:'role'};
 const ctx={_rp:{id:'role',busy:false},S,actId:()=>ctx.account,getC:()=>c,rpData:()=>d,uid:()=>String(++seq),Date,setTimeout,account:'main',rpRender(){if(failRender){failRender=false;throw Error('render fixture failure');}},rpMembers:()=>[{id:'role'}],rpMemberTitle:()=> 'role',roleChatRouteIndex:()=>2,rpSystem:()=>'',personaPin:()=>'',chatAPI:(messages,opt)=>new Promise(resolve=>calls.push({resolve,opt})),isRefusal:()=>false,splitBubbles:r=>[r],normTag:x=>x,LEAKRE:/never-match/,isOOCLine:()=>false,splitActions:r=>[r],offRevealTiming:()=>({step:0,total:0}),save(){},playDing(){},toast(){},offlineReplyFailureReason:e=>e.message};vm.createContext(ctx);vm.runInContext(source.slice(a,b),ctx);
 failRender=true;await ctx.rpAI();assert.equal(ctx._rp.busy,false);assert(ctx._rp.error.includes('render fixture failure'));assert.equal(d.msgs.length,0);assert.equal(calls.length,0);
 const first=ctx.rpAI();assert.equal(ctx._rp.busy,true);ctx._rp.busy=false;const newer=ctx.rpAI();calls[0].resolve('old');await first;assert.equal(ctx._rp.busy,true,'older request cannot release the newer request');assert.equal(d.msgs.length,0);calls[1].resolve('new');await newer;assert.equal(ctx._rp.busy,false);assert.equal(d.msgs[0].text,'new');
 const count=d.msgs.length,pending=ctx.rpAI();ctx.account='alt';calls[2].resolve('wrong account');await pending;assert.equal(d.msgs.length,count);assert.equal(ctx._rp.busy,false);assert.equal(calls[2].opt.routeIndex,2);assert.equal(calls[2].opt.complete,true);
});
