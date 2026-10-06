const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),server=http.createServer((q,r)=>{const f=path.resolve(root,decodeURIComponent(new URL(q.url,'http://localhost').pathname).slice(1));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){r.writeHead(404);return r.end();}r.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');r.end(fs.readFileSync(f));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
try{for(const privateApp of [false,true]){const page=await browser.newPage({serviceWorkers:'block'}),errors=[];if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'fixture-native-unavailable'})};});page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
const result=await page.evaluate(async privateApp=>{
 S.me.locked=false;S.me.active='main';const c=S.contacts[0];S.couple={cid:c.id,grant:{},locks:{},timeLimit:{},companion:{linked:true,health:{heartRate:99},apps:[]}};c.proactive={enabled:false};
 const now=Date.now(),payload={linked:true,deviceId:'fixture-device',lastSyncAt:now,snapshot:{generatedAt:now,snapshotSequence:2,screenTime:{reportAvailable:true,generatedAt:now,totalSeconds:123,apps:[{id:'fixture-app',name:'音乐',usedSeconds:123,locked:false}]},deviceTelemetry:{batteryLevel:.42,generatedAt:now,batteryState:'unplugged'},health:{steps:300,heartRateBpm:99,generatedAt:now}}};
 if(privateApp){S._shortcutCloudEnabled=true;const job={id:'private-fixture-job',role_id:c.id,mode:'role_event',input_text:'充电',status:'completed',reply_text:'先歇一会。',received_at:new Date(now).toISOString(),completed_at:new Date(now+1000).toISOString()};fetchT=async(url,opt)=>({ok:true,json:async()=>JSON.parse(opt.body).action==='pull'?{jobs:[job]}:{ok:true}});await PhoneShortcuts.pull(true);await PhoneShortcuts.pull(true);const rows=msgs(c.id).filter(x=>x._shortcutJob===job.id);return{available:NorthPublicRuntime.available(),entry:renderSettings().includes('PhoneShortcuts.open'),history:renderCompanionPage(c,'',(_,t)=>t).includes('NorthPublicRuntime.history'),count:rows.length,reply:rows[0]?.content};}
 const st=companionState(),isolated=!st.linked&&!st.health;NorthPublicRuntime.apply(st,payload);st.roleAccess=true;st.permissions.health=true;
 const sys=buildSystem(c),html=renderCompanionPage(c,'',(_,t)=>t),calls=[];
 fetchT=async(url,opt)=>{calls.push({url,body:JSON.parse(opt.body)});return {ok:true,text:async()=>JSON.stringify([]),json:async()=>({jobs:[]})};};
 await companionRpc('phone_role_background_complete_turn',{p_role_id:c.id});const unconsented=calls.length===0;
 st.backgroundConsent[c.id]=true;await companionRpc('phone_role_push_history',{p_role_id:c.id});
 const targets=cohabPhoneTargets(c),cp=cohabPhonePrompt(c),cmd=companionLog(st,'lock','测试','pending','用户');
 companionSendCommand(st,'lock',st.apps[0],{by:'owner',actor:'用户'},cmd);await new Promise(r=>setTimeout(r,20));
 const first=NorthPublicRuntime.profile().target;S.couple.cid='other-role';const second=NorthPublicRuntime.profile().target;S.couple.cid=c.id;S.me.active='account-fixture';const accountTarget=NorthPublicRuntime.profile().target,accountEmpty=!companionState().linked;S.me.active='main';
 S._shortcutCloudEnabled=true;const auth={...PhoneShortcuts.request};
 const job={id:'fixture-shortcut-job',role_id:c.id,mode:'user_message',input_text:'到家了',status:'completed',reply_text:'回来啦，先歇一会。',received_at:new Date(now).toISOString(),completed_at:new Date(now+1000).toISOString()};
 fetchT=async(url,opt)=>({ok:true,json:async()=>JSON.parse(opt.body).action==='pull'?{jobs:[job]}:{ok:true}});
 await PhoneShortcuts.pull(true);await PhoneShortcuts.pull(true);const rows=msgs(c.id).filter(x=>x._shortcutJob===job.id);
 return {isolated,sys,html,targets,cp,unconsented,calls,separate:first!==second&&first!==accountTarget&&accountEmpty,rows:rows.map(x=>x.content),entry:renderSettings().includes('PhoneShortcuts.open')};
},privateApp);
if(privateApp){assert.equal(result.available,false);assert(result.entry&&result.history);assert.equal(result.count,1);assert.equal(result.reply,'先歇一会。');}else{assert(result.isolated&&result.unconsented&&result.separate&&result.entry);assert(result.sys.includes('300 步'));assert(!result.html.includes('Apple Watch'));assert(!result.targets.some(x=>/睡眠|心率|心电|HRV/.test(x)));assert(result.targets.includes('iPhone步数'));assert(!result.cp.includes('当前环境没有真实 iPhone'));assert(result.calls.every(x=>x.url.includes('lkhlyfpssmrjkkzhuzag')));assert(result.calls.some(x=>x.body.p_command?.externalAppId==='fixture-app'));assert.deepEqual(result.rows,['到家了','回来啦，先歇一会。']);}
if(!privateApp){assert(!result.html.includes('外置屏幕使用'));assert(!result.html.includes('外置逐 App 时长'));assert(!result.html.includes('每天查看屏幕报告'));assert(!result.html.includes('外置：已用'));assert(result.html.includes('批量锁定'));assert(result.html.includes('设置每日限额'));}
await page.evaluate(()=>{_couTab=1;go('couple');});
if(privateApp){
await page.locator('#cou_shortcut_screen_time button').first().click();
await page.locator('#sti_text').fill('抖音 | 11040.155秒钟\n微信 | 3530.637秒钟\nWeb | 2100秒钟\nexample.com | 2100秒钟');
await page.locator('#sti_consent').check();
await page.getByRole('button',{name:'预览导入',exact:true}).click();
await page.locator('#sti_commit').click();
await page.waitForFunction(()=>PhoneScreenTimeImport.record()?.apps.length===4);
assert.equal(await page.evaluate(()=>PhoneScreenTimeImport.record().apps[0].seconds),11040.155);
await page.waitForFunction(()=>document.querySelector('#cou_shortcut_screen_time')?.textContent.includes('3 小时 4 分钟'));
const importCheck=await page.evaluate(()=>{const c=getC(S.couple.cid);return {prompt:buildSystem(c,{}).includes('用户授权的快捷指令屏幕时长'),foreign:PhoneScreenTimeImport.prompt({id:'foreign-role'}),native:companionState().screenTimeSec};});
assert(importCheck.prompt);assert.equal(importCheck.foreign,'');
await page.evaluate(()=>history.replaceState(null,'',location.pathname));
await page.reload();await page.waitForFunction(()=>window.__northBootReady);
assert.equal(await page.evaluate(()=>PhoneScreenTimeImport.record()?.apps[0].seconds),11040.155);

}else{assert.equal(await page.locator('#cou_shortcut_screen_time').count(),0);assert.equal(await page.locator('#cou_screen_cloud').count(),1);}

if(!privateApp){
await page.evaluate(()=>{
 S.me.locked=false;const gate=document.querySelector('#gate');if(gate)gate.style.display='none';S.couple.companion.linked=true;const c=getC(S.couple.cid);const p=NorthPublicRuntime.profile();if(p)p.target='fixture-cloud-owner';
 uiConfirm=async()=>true;window.__screenReadCount=0;
 PhoneShortcuts.request=async(action,body,auth)=>{
  if(action==='screen_save')return{ok:true,url:'https://cloud.example/functions/v1/phone-shortcuts',token:'a'.repeat(64)};
  if(action==='screen_pull'){window.__screenReadCount++;const d=new Date(),date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');return{ok:true,enabled:true,snapshot:{date,apps:[{name:'微信',seconds:1234}],skipped:1},receivedAt:new Date().toISOString()};}
  if(action==='screen_revoke')return{ok:true};throw Error('unexpected-screen-action');
 };_couTab=1;go('couple');
});
if(!privateApp){assert.equal(await page.locator('#cou_screen_cloud_details').evaluate(e=>e.open),false);await page.locator('#cou_screen_cloud_details summary').click();}
await page.locator('#cou_screen_cloud button').first().click();
await page.waitForFunction(()=>document.querySelector('#modal')?.textContent.includes('screen_upload')||document.body.textContent.includes('action（文本）'));
assert(await page.getByText('action（文本）',{exact:true}).count());
await page.getByRole('button',{name:'完成',exact:true}).click();
await page.locator('#cou_screen_cloud button').filter({hasText:'读取最新'}).click();
await page.waitForFunction(()=>document.querySelector('#cou_screen_cloud')?.textContent.includes('微信'));
assert(await page.evaluate(()=>buildSystem(getC(S.couple.cid)).includes('1234')));
if(!privateApp){assert(await page.locator('#cou_screen_cloud_details').evaluate(e=>e.open));assert.equal(await page.locator('#cou_screen_cloud .hint').first().evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');assert.equal(await page.locator('#cou_screen_cloud span').filter({hasText:'微信'}).evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');await page.locator('#cou_screen_cloud_details summary').click();await page.evaluate(()=>render());assert.equal(await page.locator('#cou_screen_cloud_details').evaluate(e=>e.open),false);}
assert.equal(await page.evaluate(()=>PhoneScreenTimeImport.cloudPrompt({id:'foreign-role'})),'');
await page.evaluate(()=>PhoneScreenTimeImport.cloudRevoke());
assert(await page.evaluate(()=>!buildSystem(getC(S.couple.cid)).includes('快捷指令云端时长')));

}else{assert.equal(await page.locator('#cou_screen_cloud').count(),0);assert.equal(await page.evaluate(()=>typeof PhoneScreenTimeImport.cloudPull),'undefined');}

assert.deepEqual(errors,[]);console.log(JSON.stringify({privateApp,publicIsolation:true,entry:true,sharedHistory:true,shortcutDedup:true,screenImport:privateApp,manualImportRemoved:!privateApp,screenCloudSetupPullRevoke:!privateApp,privateCloudRemoved:privateApp,persistedAfterReload:true,pageErrors:0}));await page.close();}
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
