// Core release gate: run actual prompt construction and reply delivery with phone permission.
// Only the HTTP model is simulated; never replace buildSystem or myActivity.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');let body=fs.readFileSync(file);if(process.env.NORTH_CHECKIN_BASELINE==='1'&&file.endsWith('phone-shortcuts.js')){const source=body.toString('utf8'),marker=source.indexOf('/* CHECKIN_SHORTCUTS_V1:');if(marker>=0)body=Buffer.from(source.slice(0,marker));}res.end(body);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{for(const privateApp of [false,true]){
  const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];
  if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'fixture-native-unavailable'})};});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>process.env.NORTH_MISSING_FLIGHT==='1'&&new URL(r.request().url()).pathname.endsWith('/travel-flight.js')?r.abort():new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');
  await page.waitForFunction(()=>window.__northBootReady);
  if(process.env.NORTH_MISSING_FLIGHT==='1')assert(await page.evaluate(()=>typeof NorthTravelFlight==='undefined'&&typeof NorthFlightBooking!=='undefined'),'only the optional query component must be absent');
  await page.evaluate(()=>{
   S.me.locked=false;S.me.active='main';const role=S.contacts[0];window.testId=role.id;
   S.couple={cid:role.id};role.spy={granted:true,loc:false};role.proactive={enabled:false};S._spyCount={[role.id]:{date:new Date().toDateString(),n:2}}; // Opening an empty chat must not race this manual-reply test with an independent idle inspection; forced inspection is verified below.
   S.settings.replyDelay=0;S.settings.chat={base:'https://fake.invalid/v1',key:'fixture',model:'fixture',maxTokens:9000,temp:.7};
   aiCoreOn=()=>false;window.testCalls=[];window.fixtureRaw='[内心|想听你说话]\n我在，慢慢说。';
   fetchT=async(url,opt)=>{if(!String(url).startsWith('https://fake.invalid/'))return{ok:true,json:async()=>false,text:async()=>'false'};testCalls.push(JSON.parse(opt.body));return{ok:true,json:async()=>({choices:[{message:{content:fixtureRaw},finish_reason:'stop'}]})};};
   if(typeof NorthTravelFlight==='undefined'){const date='2099-10-05';tvInit().trips.push({id:'missing-component-saved-flight',accountId:'main',flightV2:true,from:'北京',to:'上海',date,dep:'09:00',arr:'11:00',cls:'economy',adults:1,children:0,infants:0,people:[{id:'role:'+role.id,name:role.name}],knownRoleIds:[role.id],status:'upcoming',payer:'ta',cid:role.id,price:100,_reminded:true});}
   openChat(role.id);
  });
  if(process.env.NORTH_SEARCH_PARITY==='1'){
   await page.evaluate(()=>{window.searchFixtureSaved={messages:msgs(testId).slice(),groups:S.groups,theme:S.me.wxTheme};const rows=msgs(testId);rows.splice(0,rows.length,...Array.from({length:420},(_,i)=>({id:'search-gate-'+i,role:i%2?'assistant':'user',type:'text',content:i===5?'定位词 较早消息':i===410?'定位词 最近消息':'普通消息 '+i,time:Date.now()-500000+i*500})));S.groups=(S.groups||[]).concat([{id:'search-gate-group',name:'搜索核验群',members:[testId],msgs:[{id:'search-group-hit',senderId:testId,type:'text',content:'定位词 群里的消息',time:Date.now()-1000}]}]);S.me.wxTheme='white';openChatSearch(testId);});
   await page.locator('#wxs_in').fill('定位词');assert.equal(await page.locator('.wxs-row').count(),2);
   assert.equal(await page.locator('.wxs-page').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(237, 237, 237)');
   await page.locator('.wxs-row').filter({hasText:'较早消息'}).click();
   await page.waitForFunction(()=>cur().p==='chat'&&document.querySelector('.msg-jump-hit[data-message-id="search-gate-5"]'));
   const positioned=await page.locator('[data-message-id="search-gate-5"]').evaluate(n=>{const b=n.closest('.chatbg'),a=n.getBoundingClientRect(),r=b.getBoundingClientRect();return a.bottom>r.top&&a.top<r.bottom;});assert(positioned,'old matching message must be visibly positioned');
   await page.evaluate(()=>back());assert.equal(await page.locator('#wxs_in').inputValue(),'定位词');assert.equal(await page.locator('.wxs-row').count(),2);
   await page.evaluate(()=>{go('wechat');openWxSearch();});await page.locator('#wxs_in').fill('定位词');assert.equal(await page.locator('.wxs-row').count(),2,'one role row plus one group row');
   await page.locator('.wxs-row').filter({hasText:'搜索核验群'}).click();await page.waitForFunction(()=>cur().p==='group'&&document.querySelector('.msg-jump-hit[data-message-id="search-group-hit"]'));
   await page.evaluate(()=>go('gsettings',{id:'search-gate-group'}));await page.locator('#g_total').fill('4');await page.locator('.g-role-max').fill('2');await page.getByRole('button',{name:'完成',exact:true}).click();
   assert.deepEqual(await page.evaluate(()=>{const g=S.groups.find(g=>g.id==='search-gate-group');return[g.totalMax,g.roleMsgMax[testId]];}),[4,2]);
   await page.evaluate(()=>{const a=searchFixtureSaved;msgs(testId).splice(0,msgs(testId).length,...a.messages);S.groups=a.groups;S.me.wxTheme=a.theme;delete window.searchFixtureSaved;openChat(testId);});
   console.log(JSON.stringify({privateApp,searchParityActualPage:{oldMessagePositioned:true,keywordPreserved:true,groupJump:true,lightTheme:true,groupLimitsSaved:true}}));
  }
  // Real calendar UI: hidden-category defaults, saved participation switches and network setting.
  await page.evaluate(()=>{S.calendar=[];S.calendarPreferences={main:{legacyVisible:false}};S.calendarCollections=[{id:'gate-hidden',owner:'main',name:'隐藏分类',visible:false}];go('calendar');calNewEvent(todayStr());});
  await page.getByRole('textbox',{name:'日程标题',exact:true}).fill('手动新建可见回归');
  await page.evaluate(()=>{_calEventDraft.invitees=[testId];_calEventDraft.roleParticipation={[testId]:{mode:'remind',response:'accepted',prepare:true,followup:true}};calNewRender();});
  await page.getByRole('button',{name:/只告知/}).click();assert.equal(await page.evaluate(()=>calParticipation(_calEventDraft,testId).mode),'inform');
  await page.evaluate(()=>calNewSave());await page.waitForFunction(()=>!_calSaving);assert.equal(await page.evaluate(()=>S.calendar.length),1);assert.equal(await page.evaluate(()=>calEventVisible(S.calendar[0])),true);
  assert(await page.getByText('手动新建可见回归',{exact:true}).count());
  await page.evaluate(()=>calDetailOpen(S.calendar[0].id,S.calendar[0].date));
  await page.getByRole('button',{name:/帮我提醒/}).click();await page.waitForFunction(()=>!_calSaving);
  await page.getByRole('switch',{name:/提前准备/}).click();await page.waitForFunction(()=>!_calSaving);assert.equal(await page.evaluate(()=>calParticipation(S.calendar[0],testId).prepare),true);
  await page.getByRole('button',{name:/只告知/}).click();await page.waitForFunction(()=>!_calSaving);assert.equal(await page.evaluate(()=>calRoleCanRemind(S.calendar[0],testId)),false);assert.equal(await page.evaluate(()=>calParticipation(S.calendar[0],testId).prepare),false);
  await page.evaluate(()=>openSettings('network'));await page.getByRole('checkbox',{name:'流式回复',exact:true}).check();assert.equal(await page.evaluate(()=>S.settings.chatStreaming),true);
  console.log(JSON.stringify({privateApp,manualSaveVisible:true,participationButtons:true,streamToggle:true}));
  // Optional local thinking preview gate; fixture data is clearly labelled, never a paid API request.
  if(process.env.NORTH_THINKING_PREVIEW==='1'){
   await page.evaluate(()=>{S.settings.roleThinkingPreview=false;openSettings('media');});
   assert.equal(await page.locator('#s_rolethinking_budget').inputValue(),'2048');
   assert.equal(await page.getByRole('switch',{name:'在心声中查看思考摘要'}).getAttribute('aria-checked'),'false');
   await page.getByRole('switch',{name:'在心声中查看思考摘要'}).click();
   if(!privateApp){await page.locator('#s_rolethinking_budget').scrollIntoViewIfNeeded();await page.waitForTimeout(1800);await page.screenshot({path:path.join(root,'.codex_tmp/eight-chat/thinking-settings.png')});}
   const result=await page.evaluate(async()=>{const c=getC(testId),previousFetch=fetchT,previousChat=S.settings.chat,previousRoutes=S.settings.chatRoutes;try{S.settings.chat={base:'https://thinking-test.invalid/v1',key:'fixture',model:'[测试]claude-opus-4-6',maxTokens:4096,temp:.7};S.settings.chatRoutes=[];chatRoutesInit();window.thinkingCalls=[];fetchT=async(url,opt)=>{if(!String(url).startsWith('https://thinking-test.invalid/'))return previousFetch(url,opt);thinkingCalls.push({url,body:JSON.parse(opt.body)});return {ok:true,json:async()=>({model:'claude-opus-4-6',content:[{type:'thinking',thinking:'【界面测试摘要】用户希望我自然回应。结合上一条消息，简短表达关心，再继续话题。',signature:'fixture-secret-signature'},{type:'text',text:'[内心|听见你说话，心里安稳了些。]\n我在，慢慢说，今天过得怎么样？'}],stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:100}})};};S.messages[accountMessageKey(testId,actId())]=[];pushMsg(testId,{role:'user',type:'text',content:'我回来啦。'});openChat(testId);await aiReply(testId);refreshChatMood(testId);return {calls:thinkingCalls,summary:c.roleThinkingPreview,visible:msgs(testId).filter(m=>m.role==='assistant'&&m.type==='text').map(m=>m.content),busy:replyGenerationBusy(testId)};}finally{fetchT=previousFetch;S.settings.chat=previousChat;S.settings.chatRoutes=previousRoutes;}});
   assert(result.calls.some(c=>c.url.endsWith('/messages')),JSON.stringify(result));assert(result.summary&&result.summary.summary.includes('界面测试摘要'),JSON.stringify(result));assert(result.visible.some(t=>t.includes('我在')));assert(!result.busy);
   await page.locator('#chatMoodBar').click();assert(await page.locator('#chatThoughtPanel').isVisible());assert.equal(await page.locator('.modal:visible').count(),0);assert.equal(await page.locator('#chatThoughtPanel').evaluate(el=>el.parentElement.id),'chatMoodBar');
   await page.locator('#roleThinkingExpand').click();assert(await page.locator('#roleThinkingPanel').isVisible());if(!privateApp){await page.waitForTimeout(1800);await page.screenshot({path:path.join(root,'.codex_tmp/eight-chat/thinking-expanded.png')});}
   await page.locator('#chatMoodBar').click();assert(!(await page.locator('#chatThoughtPanel').isVisible()));await page.evaluate(()=>refreshChatMood(testId));await page.locator('#chatMoodBar').click();assert(await page.locator('#chatThoughtPanel').isVisible());assert.equal(await page.locator('.modal:visible').count(),0);assert.equal(await page.locator('#chatThoughtPanel').evaluate(el=>el.parentElement.id),'chatMoodBar');
   await page.locator('#chatMoodBar').getByRole('button',{name:'关闭',exact:true}).click();assert(!(await page.locator('#chatThoughtPanel').isVisible()));assert.equal(await page.evaluate(()=>S.settings.roleThinkingPreview),true);await page.evaluate(()=>{S.settings.roleThinkingPreview=false;S.messages[accountMessageKey(testId,actId())]=[];openChat(testId);});console.log(JSON.stringify({privateApp,thinkingPreviewAccepted:true,inlineToggle:true}));
  }
  // Check-in exercises the actual HTML, IndexedDB, model routing and normal reply path.
  if(process.env.NORTH_CHECKIN_PREVIEW==='1'){
   await page.evaluate(()=>PhoneShortcuts.open());assert(await page.getByText('快捷指令与查岗',{exact:true}).isVisible());assert(await page.getByRole('button',{name:'管理云端动作',exact:true}).isVisible());
   if(!privateApp)assert(await page.getByRole('checkbox',{name:'查岗截屏',exact:true}).isDisabled());
   if(privateApp){
    await page.evaluate(()=>{window.checkinOriginalFetch=fetchT;window.checkinOriginalBridge=SmallPhoneNative.request;window.checkinNativeItem=null;window.checkinNativeEvents=[];window.checkinHttp=[];
     SmallPhoneNative.request=async(action,args)=>{if(action.startsWith('checkin.')){checkinNativeEvents.push(action);if(action==='checkin.configure')return{configured:true};if(action==='checkin.take')return checkinNativeItem||{found:false};if(action==='checkin.ack'){checkinNativeItem=null;return{removed:true};}}if(action==='storage.put')return{saved:true};if(action==='storage.delete')return{deleted:true};return checkinOriginalBridge(action,args);};
     fetchT=async(url,opt,ms)=>{const request=opt&&opt.body?JSON.parse(opt.body):{};if(String(url).startsWith('https://fake.invalid/')){checkinHttp.push(request);if((request.messages||[]).some(m=>typeof m.content==='string'&&m.content.includes('只输出JSON对象')))return{ok:true,json:async()=>({choices:[{message:{content:'{"want":2,"next":"23:10","lines":["你在忙什么？","让我看看你现在在看什么。"]}'},finish_reason:'stop'}]})};if((request.messages||[]).some(m=>Array.isArray(m.content)&&m.content.some(p=>p.type==='image_url')))return{ok:true,json:async()=>({choices:[{message:{content:'手机画面上有一块蓝色区域。'},finish_reason:'stop'}]})};}return checkinOriginalFetch(url,opt,ms);};
    });
    await page.evaluate(()=>PhoneCheckIn.select(testId));await page.getByRole('button',{name:'让TA写一批',exact:true}).click();await page.waitForFunction(()=>S.settings.checkinByAccount.main.lines.length===2&&S.settings.checkinByAccount.main.want===2&&S.settings.checkinByAccount.main.planAt>Date.now());
    await page.evaluate(async()=>{const confirm=uiConfirm;uiConfirm=async()=>true;try{await PhoneCheckIn.toggle(true);}finally{uiConfirm=confirm;}const canvas=document.createElement('canvas');canvas.width=30;canvas.height=40;const ctx=canvas.getContext('2d');ctx.fillStyle='blue';ctx.fillRect(0,0,30,40);checkinNativeItem={found:true,id:'1792120000000-ABCDEF12',at:Date.now(),account:'main',cid:testId,scope:S.settings.checkinByAccount.main.scope,mime:'image/jpeg',base64:canvas.toDataURL('image/jpeg').split(',')[1]};const other=S.contacts.find(c=>c.id!==testId&&!c.deleted);if(other)openChat(other.id);await PhoneCheckIn.receive(true);});
    try{await page.waitForFunction(()=>msgs(testId).some(m=>m.role==='assistant'&&m.type==='text'&&m.content.includes('我在')));}catch(e){console.log(JSON.stringify(await page.evaluate(()=>({events:checkinNativeEvents,requests:checkinHttp.length,cfg:S.settings.checkinByAccount.main,messages:msgs(testId).map(m=>({role:m.role,type:m.type,desc:m.desc,visionState:m.visionState,visionError:m.visionError,status:m._checkinStatus,queued:m._checkinReplyQueued})),pending:!!checkinNativeItem}))));throw e;}
    // The screenshot must be visible to the owner in that role's chat, not only to the role.
    await page.waitForFunction(()=>{const img=document.querySelector('#chatbg [data-idb-src="checkin-1792120000000-ABCDEF12"],#chatbg img[src^="data:image/jpeg"]');return cur().p==='chat'&&cur().id===testId&&img&&String(img.src).startsWith('data:image/jpeg')&&img.naturalWidth>1;},null,{timeout:8000}).catch(async e=>{console.log(JSON.stringify(await page.evaluate(()=>({route:cur(),imgs:[...document.querySelectorAll('#chatbg img')].map(i=>({src:String(i.src).slice(0,40),key:i.getAttribute('data-idb-src'),w:i.naturalWidth}))}))));throw e;});
    const qa=await page.evaluate(async()=>{const image=msgs(testId).find(m=>m._checkinID==='1792120000000-ABCDEF12');const before=checkinHttp.length;await PhoneCheckIn.receive(true);return{imageStored:image&&image.src.startsWith('data:image/jpeg')&&await imgGet('checkin-1792120000000-ABCDEF12')===image.src&&_imgRev.get(image.src)==='checkin-1792120000000-ABCDEF12',recognized:image&&image.visionState==='success'&&image.desc.includes('蓝色'),singleImage:msgs(testId).filter(m=>m._checkinID).length===1,noReplay:checkinHttp.length===before,nativeAck:checkinNativeEvents.includes('checkin.ack'),visionHttp:checkinHttp.some(r=>(r.messages||[]).some(m=>Array.isArray(m.content)&&m.content.some(p=>p.type==='image_url')))};});for(const [name,value] of Object.entries(qa))assert.equal(value,true,name+' '+JSON.stringify(qa));
    await page.evaluate(async()=>{await PhoneCheckIn.toggle(false);fetchT=checkinOriginalFetch;SmallPhoneNative.request=checkinOriginalBridge;S.messages[accountMessageKey(testId,actId())]=[];testCalls.length=0;openChat(testId);});console.log(JSON.stringify({privateApp,checkinActualPage:qa}));
   }
  }
  // Current role repair scenarios use the real prompt and action consumers; only HTTP replies are controlled.
  const repairQA=await page.evaluate(async()=>{const c=getC(testId),baseFetch=fetchT,baseAllDispatch=companionDispatchRoleAll;let shopQueries=0,allDispatches=0,lockWasSavedFirst=false;companionDispatchRoleAll=(action,opt)=>{allDispatches++;lockWasSavedFirst=msgs(testId).some(m=>m.role==='assistant'&&m.type==='text'&&roleAllLockAnnounced(m.content));return true;};S.couple={cid:c.id,grant:{wechat:true,cinema:true},locks:{wechat:{pwd:'1234'}}};S.travel.trips=[];c.wallet=5000;S.settings.showMoodTag=true;
   fetchT=async(url,opt,ms)=>{if(String(url).includes('/north_market_list'))shopQueries++;const req=opt&&opt.body?JSON.parse(opt.body):{};if(String(url).startsWith('https://fake.invalid/')&&(req.messages||[]).some(m=>m.role==='system'&&String(m.content).includes('这轮至少一项行程预订未成功')))return{ok:true,json:async()=>({choices:[{message:{content:'这趟没有订成，先核对城市和日期再选。'},finish_reason:'stop'}]})};return baseFetch(url,opt,ms);};
   async function turn(user,raw){S.messages[accountMessageKey(testId,actId())]=[];pushMsg(testId,{role:'user',type:'text',content:user,time:Date.now(),id:uid()});fixtureRaw=raw;openChat(testId);await aiReply(testId);return msgs(testId).filter(m=>m.role==='assistant'||m.role==='system').map(m=>m.content||'').join('\n');}
   try{await turn('给我解一下微信','[内心|仍然不想松口]\n不给你解锁。\n[解锁|微信]');const refusalKeepsLock=!!S.couple.locks.wechat;
    await turn('先聊点别的','[内心|想[锁定|全部应用]，还想[查店铺|奶茶]，但没有决定]\n晚点再说。');const hiddenActionsBlocked=!S.couple.locks.cinema&&shopQueries===0;
    await turn('你看着决定','[锁定|全部应用]');const silentAllLockBlocked=allDispatches===0;await turn('你看着决定','我现在把全部应用锁上。\n[锁定|全部应用]');const announcedAllLockOrdered=allDispatches===1&&lockWasSavedFirst;
    const key=accountMessageKey(testId,actId());S.messages[key]=[{id:'old-photo',role:'user',type:'image',textCard:true,desc:'轮回对戒',time:Date.now()-3600000},{id:'photo-answer',role:'assistant',type:'text',content:'已经看过了',time:Date.now()-3599000},{id:'current-user',role:'user',type:'text',content:'好～',time:Date.now()}];const callsBefore=testCalls.length;fixtureRaw='那就慢慢聊。';openChat(testId);await aiReply(testId);const oldPhotoNotCurrent=testCalls.slice(callsBefore).every(r=>!r.messages.some(m=>m.role==='system'&&String(m.content).includes('# 本轮图片事实')));
    const moneyBefore=S.me.balance,ordersBefore=S.travel.trips.length;const failureText=await turn('你自己订从不存在的城市到上海的模拟机票','我先看看。\n[订机票|不存在的城市|上海|'+todayStr()+'|经济舱|我自己]');const failedFlightVisible=/没有订成|预订未成功/.test(failureText)&&S.travel.trips.length===ordersBefore&&S.me.balance===moneyBefore;
    const day=new Date();day.setDate(day.getDate()+8);const date=calDateString(day);await turn('你自己从延安去上海，选早上的模拟机票','这次我自己过去。\n[订机票|延安|上海|'+date+'|经济舱|我自己|早上]');const o=S.travel.trips.at(-1),selfFlight=(typeof NorthTravelFlight==='undefined'?S.travel.trips.length===ordersBefore:!!o&&o.from==='延安'&&o.to==='上海'&&o.people.length===1&&o.people[0].id==='role:'+testId&&+o.dep.slice(0,2)<12&&S.me.balance===moneyBefore);
    return {silentAllLockBlocked,announcedAllLockOrdered,refusalKeepsLock,hiddenActionsBlocked,oldPhotoNotCurrent,failedFlightVisible,selfFlight};
   }finally{fetchT=baseFetch;companionDispatchRoleAll=baseAllDispatch;S.couple={cid:c.id};S.messages[accountMessageKey(testId,actId())]=[];testCalls.length=0;fixtureRaw='[内心|想听你说话]\n我在，慢慢说。';openChat(testId);}
  });for(const [name,ok] of Object.entries(repairQA))assert.equal(ok,true,name+' '+JSON.stringify(repairQA));console.log(JSON.stringify({privateApp,privateRepairScenarios:repairQA}));
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
  // A role lock carries an unlock time and reopens by itself (ROLE_LOCK_UNTIL_V1), through the real tag consumer.
  const lockUntilQA=await page.evaluate(async()=>{const role=getC(testId);S.couple={cid:role.id,grant:{nearby:true},locks:{}};const t0=Date.now();applyControlTags('我锁上了。\n[锁定|附近的人|2小时]',role,role.id,'','');const locked=appLocked('nearby');const at=+(S.couple.lockUntil&&S.couple.lockUntil['int:nearby']||0);const timed=Math.abs(at-(t0+2*3600e3))<60e3;_couTab=2;go('couple');const shown=document.body.innerText.includes('自动解锁');_couTab=1;S.couple.lockUntil['int:nearby']=Date.now()-1000;lockUntilSweep();const reopened=!appLocked('nearby')&&!S.couple.lockUntil['int:nearby'];applyControlTags('[锁定|附近的人]',role,role.id,'','');const d=new Date(+S.couple.lockUntil['int:nearby']);const defaultSeven=appLocked('nearby')&&d.getHours()===7&&d.getMinutes()===0;await window._lockUntilAsking;delete S.couple.locks.nearby;delete S.couple.lockUntil['int:nearby'];applyControlTags('今晚别玩了，明天中午再给你开。\n[锁定|附近的人]',role,role.id,'','');const noon=new Date(+S.couple.lockUntil['int:nearby']),tomorrow=new Date(Date.now()+86400e3);const fromWords=noon.getHours()===12&&noon.getDate()===tomorrow.getDate();await window._lockUntilAsking;delete S.couple.locks.nearby;delete S.couple.lockUntil['int:nearby'];const keepRaw=fixtureRaw,callsBefore=testCalls.length;fixtureRaw='3小时';applyControlTags('乖，我锁上了。\n[锁定|附近的人]',role,role.id,'','');await window._lockUntilAsking;fixtureRaw=keepRaw;const askedAt=+S.couple.lockUntil['int:nearby'];const askedRole=testCalls.length===callsBefore+1&&Math.abs(askedAt-(Date.now()+3*3600e3))<120e3;testCalls.length=callsBefore;S.couple={cid:role.id};openChat(role.id);return{locked,timed,shown,reopened,defaultSeven,fromWords,askedRole};});
  for(const [key,value] of Object.entries(lockUntilQA))assert.equal(value,true,JSON.stringify({privateApp,key,lockUntilQA}));
  console.log(JSON.stringify({privateApp,roleLockUntil:lockUntilQA}));
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
  try{await page.waitForFunction(()=>testCalls.length===1&&!replyGenerationBusy(testId,actId()));}catch(e){console.log(JSON.stringify({privateApp,manualReplyFailure:await page.evaluate(()=>({calls:testCalls.length,busy:replyGenerationBusy(testId,actId()),messages:msgs(testId).map(m=>({role:m.role,type:m.type,content:m.content})),requests:testCalls.map(x=>({last:x.messages?.at(-1),system:x.messages?.find(m=>m.role==='system')?.content?.slice(-400)}))}))}));throw e;}
  assert.deepEqual(await page.evaluate(()=>msgs(testId).map(m=>m.content)),['先生N','我在，慢慢说。']);
  const auto=await page.evaluate(async()=>{testCalls.length=0;fixtureRaw='刚才那些话我都记着呢。';S._spySeen={};const before=msgs(testId).length,oldSleep=sleep;sleep=async()=>{};try{const result=await doSpyViewCore(testId,true,{});return{result,calls:testCalls.length,delivered:msgs(testId).slice(before).some(m=>m.role==='assistant'&&m.content==='刚才那些话我都记着呢。')};}finally{sleep=oldSleep;}});
  assert.equal(auto.calls,1,JSON.stringify(auto));assert(auto.delivered,JSON.stringify(auto));
  if(process.env.NORTH_MISSING_FLIGHT==='1'&&!privateApp){await page.evaluate(()=>openChat(S.contacts[0].id));await page.waitForTimeout(2500);await page.screenshot({path:path.join(root,'.codex_tmp/eight-chat/chat-missing-flight.png')});}
  await page.evaluate(async()=>{S.couple.grant={nearby:true};S.couple.locks={nearby:{pwd:'3456',time:Date.now()}};await saveNowAsync();});await page.goto(page.url().split('?')[0]);await page.waitForFunction(()=>window.__northBootReady);
  const restored=await page.evaluate(()=>{const role=S.contacts[0];return{granted:role.spy.granted,reply:msgs(role.id).some(m=>m.content==='我在，慢慢说。'),sys:buildSystem(role).length,nearbyPermission:!!S.couple.grant.nearby,nearbyLock:appLocked('nearby'),streaming:S.settings.chatStreaming===true};});
  assert(restored.granted&&restored.reply&&restored.sys>0&&restored.nearbyPermission&&restored.nearbyLock&&restored.streaming);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({privateApp,composerAndManualReply:true,automaticInspection:auto,persisted:true}));
  console.log(JSON.stringify({privateApp,refreshAndSinceAndRevocation:true,pageErrors:errors.length}));
  await page.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
