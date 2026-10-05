import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
 const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 test(file+' refreshed login friend chat preserves rich messages and imports new lines once',()=>{
  const c={name:'甲'},rich={r:'me',c:'图片',type:'image'},pay={r:'me',c:'转账',type:'transfer',amount:200};
  const d={seeded:true,friends:[{name:'乙',msgs:[{r:'ta',c:'旧消息'},rich,pay]}]},S={spy:{a:{wechat:[{who:'乙',lines:['乙：旧消息','乙：新消息','他：图片']}]}}};
  const ctx=vm.createContext({S,getC:()=>c,hisWxData:()=>d,save(){}});
  vm.runInContext(source.slice(source.indexOf('function hisSeed('),source.indexOf('function hisLastMain(')),ctx);
  ctx.hisSeed('a');assert.equal(d.friends[0].msgs.length,4);assert.equal(d.friends[0].msgs[3].c,'新消息');
  assert.equal(d.friends[0].msgs[1],rich);assert.equal(d.friends[0].msgs[2],pay);
  ctx.hisSeed('a');assert.equal(d.friends[0].msgs.length,4);
  S.spy.a.wechat[0].lines.push('乙：第二次刷新','乙：第二次刷新');ctx.hisSeed('a');assert.equal(d.friends[0].msgs.length,6);
  ctx.hisSeed('a');assert.equal(d.friends[0].msgs.length,6);
 });

 test(file+' legacy moment snapshots expose only added lines',()=>{
  const fn=source.split(/\r?\n/).find(l=>l.startsWith('function rolePhoneInspectionNovelText('));
  const ctx=vm.createContext({});vm.runInContext(fn,ctx);
  const role={_phoneInspectionFacts:{moments:{snapshot:'给乙点了赞\n评论：昨天讲过的事'}}};
  assert.equal(ctx.rolePhoneInspectionNovelText(role,{key:'moments',snapshot:'给乙点了赞\n评论：昨天讲过的事\n评论：今天新增'}),'评论：今天新增');
 });
 function runtime(){
  const c={id:'a',name:'甲'},other={id:'b',name:'乙'};
  const S={me:{name:'我'},contacts:[c,other],messages:{b:[{id:'m1',role:'user',content:'已经谈过的旧事',time:10}]},moments:[{id:'p1',authorId:'b',text:'旧动态',time:1,likes:['我'],comments:[{id:'c1',cid:'me',name:'我',text:'第一次评论',time:11}]}]};
  const ctx=vm.createContext({S,account:'main',actId(){return this.account;},getC:id=>S.contacts.find(x=>x.id===id),msgs:id=>S.messages[id]||[],msgToText:m=>m.content||'',save(){},factStamp:String,fmtDT:String,lifeNotesForRole:()=>[],shopOrderRows:()=>[],cMark:()=>'',replyDedupNorm:s=>s,companionRoleAllFocus:()=>false});
  ctx.actId=()=>ctx.account;
  const start=source.indexOf('/* Persistent per-record phone inspection ledger. */'),end=source.indexOf('/* End phone inspection ledger. */',start);
  assert(start>=0&&end>start,'missing persistent record ledger');
  vm.runInContext(source.split(/\r?\n/).find(l=>l.startsWith('function tvHotelOwned(')),ctx);
  vm.runInContext(source.slice(start,end),ctx);
  return{ctx,S,c};
 }
 test(file+' consumes only delivered records, shares categories/channels, persists role and account isolation',()=>{
  const {ctx,S,c}=runtime(),first=ctx.rolePhoneLocalRead('a','wechat');
  assert.match(first.data,/已经谈过/);
  assert.match(ctx.rolePhoneLocalRead('a','wechat').data,/已经谈过/,'reading or failed generation cannot consume facts');
  ctx.rolePhoneLocalCommit(c,first);
  assert.match(ctx.rolePhoneLocalRead('a','overview').data,/第一次评论/);
  assert.doesNotMatch(ctx.rolePhoneLocalRead('a','overview').data,/已经谈过/);
  const saved=JSON.parse(JSON.stringify(c));Object.assign(c,saved);
  assert.equal(ctx.rolePhoneLocalRead('a','wechat').records.length,0);
  S.messages.b.push({id:'m2',role:'user',content:'真正的新消息',time:10});
  assert.match(ctx.rolePhoneLocalRead('a','wechat').data,/真正的新消息/);
  assert.doesNotMatch(ctx.rolePhoneLocalRead('a','wechat').data,/已经谈过/);
  ctx.account='alt';assert.match(ctx.rolePhoneLocalRead('a','wechat').data,/已经谈过/);
  ctx.account='main';assert.match(ctx.rolePhoneLocalRead('different-role','wechat').data,/已经谈过/);
 });
 test(file+' separates each post, comment and like; new activity on an old post does not replay siblings',()=>{
  const {ctx,S,c}=runtime();ctx.rolePhoneLocalCommit(c,ctx.rolePhoneLocalRead('a','moments'));
  assert.equal(ctx.rolePhoneLocalRead('a','moments').records.length,0);
  S.moments[0].comments.push({id:'c2',cid:'me',name:'我',text:'今天补充的评论',time:20,replyToName:'丙'});
  const fresh=ctx.rolePhoneLocalRead('a','moments');
  assert.equal(fresh.records.length,1);assert.match(fresh.data,/今天补充的评论/);assert.match(fresh.data,/丙/);
  assert.doesNotMatch(fresh.data,/第一次评论|点了赞/);
  ctx.rolePhoneLocalCommit(c,fresh);
  S.moments.unshift({id:'own',authorId:'me',text:'我新发的朋友圈',time:30,comments:[],likes:[]});
  assert.match(ctx.rolePhoneLocalRead('a','moments').data,/我新发的朋友圈/);
 });
 test(file+' inspected empty state and repeated scans never manufacture new records',()=>{
  const {ctx,c}=runtime();const first=ctx.rolePhoneLocalRead('a','overview');ctx.rolePhoneLocalCommit(c,first);
  for(let i=0;i<20;i++){const next=ctx.rolePhoneLocalRead('a','overview');assert.equal(next.records.length,0);assert.match(next.data,/没有新的内容/);}
 });
 test(file+' facts arriving in flight remain unread and switching accounts cannot consume another account',()=>{
  const {ctx,S,c}=runtime(),pending=ctx.rolePhoneLocalRead('a','wechat');
  S.messages.b.push({id:'later',role:'user',content:'请求中途新收到',time:50});
  ctx.account='alt';assert.equal(ctx.rolePhoneLocalCommit(c,pending),false);
  ctx.account='main';assert.match(ctx.rolePhoneLocalRead('a','wechat').data,/已经谈过/);
  ctx.rolePhoneLocalCommit(c,pending);
  const next=ctx.rolePhoneLocalRead('a','wechat');assert.match(next.data,/请求中途新收到/);assert.doesNotMatch(next.data,/已经谈过/);
 });
 test(file+' unchanged untimed searches and bills are deduplicated; edited and re-liked records are distinct',()=>{
  const {ctx,S,c}=runtime();S.browser={history:[{q:'旧搜索'}]};S.dy={history:['旧抖音搜索'],liked:[{id:'v1',desc:'旧点赞'}]};S.me.bills=[{id:'bill',note:'旧账单',amount:10}];
  ctx.rolePhoneLocalCommit(c,ctx.rolePhoneLocalRead('a','overview'));
  assert.equal(ctx.rolePhoneLocalRead('a','overview').records.length,0);
  S.moments[0]._myLikeAt=100;S.moments[0].comments[0].text='编辑过的内容';
  const next=ctx.rolePhoneLocalRead('a','moments');assert.equal(next.records.length,2);assert.match(next.data,/编辑过的内容/);
 });
 test(file+' trimming a recent window cannot make unchanged no-id entries unread again',()=>{
  const {ctx,S,c}=runtime();S.me.bills=Array.from({length:20},(_,i)=>({time:i+1,note:'账单'+i,amount:i}));
  ctx.rolePhoneLocalCommit(c,ctx.rolePhoneLocalRead('a','wallet'));
  S.me.bills.push({time:21,note:'新账单',amount:21});
  const next=ctx.rolePhoneLocalRead('a','wallet');assert.equal(next.records.length,1);assert.match(next.data,/新账单/);
  S.browser={history:[{q:'原来搜索'}]};ctx.rolePhoneLocalCommit(c,ctx.rolePhoneLocalRead('a','browser'));
  S.browser.history.unshift({q:'新增搜索'});const search=ctx.rolePhoneLocalRead('a','browser');assert.equal(search.records.length,1);assert.doesNotMatch(search.data,/原来搜索/);
 });

 test(file+' another account social records are not exposed in the active account',()=>{
  const {ctx,S}=runtime();S.moments.push({id:'other-account',acct:'alt',authorId:'me',text:'OTHER_ACCOUNT_SECRET'});S.x={tweets:[{id:'other-x',acct:'alt',who:'me',text:'OTHER_X_SECRET'}]};
  assert.doesNotMatch(ctx.rolePhoneLocalRead('a','overview').data,/OTHER_ACCOUNT_SECRET|OTHER_X_SECRET/);
 });

}

for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
 const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 test(file+' role phone shows live anonymous SMS with reversed directions and isolates other roles',()=>{
  const c={id:'a',phone:'13800000001',phoneAliasHistory:[{ts:1,num:'15900000000',text:'history fallback',from:'stranger'}],phoneAliasCallHistory:[{ts:35,num:'15900000000',lines:[]}]};
  const S={me:{name:'North'},phoneapp:{rolePhones:{a:c.phone},sms:{'alias:15900000000:13800000001':[{id:'in',time:10,text:'anonymous incoming',from:'me',aliasTo:'a'},{id:'out',time:20,text:'role reply',from:'them',aliasFrom:'a'}],'alias:15800000000:13800000002':[{time:100,text:'OTHER_ROLE_SECRET',from:'me',aliasTo:'b'}]},recents:[{time:30,num:c.phone,dir:'out',status:'ok'},{time:31,num:c.phone,dir:'out',line:'alias'}]},spy:{a:{calls:[{who:'old snapshot',time:5},{who:'fresh refresh',_snapshotAt:40}],sms:[]}}};
  const ctx=vm.createContext({S,getC:id=>id==='a'?c:{id},phDigits:n=>String(n||'').replace(/\D/g,''),phFmt:String});
  for(const name of ['phSmsIsAliasKey','phSmsAliasNumFromKey','phSmsDisplayNum'])vm.runInContext(source.split(/\r?\n/).find(l=>l.startsWith('function '+name+'(')),ctx);
  const start=source.indexOf('function spyPhoneData('),end=source.indexOf('function spyPhoneSanitize(',start);assert.ok(start>=0);vm.runInContext(source.slice(start,end),ctx);
  const before=JSON.stringify(S),a=ctx.spyPhoneData('a');assert.equal(JSON.stringify(S),before,'inspection cannot mutate player phone');
  assert.equal(a.sms['15900000000'].length,2,'canonical thread supersedes truncated history');assert.equal(a.sms['15900000000'][0].from,'them');assert.equal(a.sms['15900000000'][1].from,'me');assert.doesNotMatch(JSON.stringify(a),/OTHER_ROLE_SECRET/);
  assert.equal(a.calls.some(x=>x.time===31),false,'anonymous calls cannot reveal the player identity through main-number recents');assert.equal(a.calls[0].who,'fresh refresh');assert.equal(a.calls.find(x=>x.time===30).dir,'in');
  S.phoneapp.sms['alias:15900000000:13800000001'].push({time:50,text:'new incoming while inspecting',from:'me'});S.spy.a.calls=[{who:'second refresh',_snapshotAt:60}];
  const b=ctx.spyPhoneData('a');assert.equal(b.sms['15900000000'].slice(-1)[0].text,'new incoming while inspecting');assert.equal(b.calls[0].who,'second refresh');assert.doesNotMatch(JSON.stringify(b),/old snapshot|fresh refresh/);
  delete S.phoneapp.sms['alias:15900000000:13800000001'];delete c.phoneAliasHistory;assert.equal(ctx.spyPhoneData('a').sms['15900000000'],undefined,'cleared SMS must not survive in a copied snapshot');
 });
}

for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
 const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 test(file+' role travel keeps all live owned/party orders with account and expiry isolation',()=>{
  const base={accountId:'main',payer:'ta',cid:'a',ts:10,status:'upcoming',price:250};
  const S={travel:{trips:[{...base,id:'mine',flightV2:true},{...base,id:'other-role',cid:'b',flightV2:true},{...base,id:'other-account',accountId:'alt',flightV2:true},{...base,id:'expired',flightV2:true,expired:true},{...base,id:'shared',payer:'me',people:[{id:'role:a'}],railV2:true}],ticketOrders:Array.from({length:30},(_,i)=>({...base,id:'ticket'+i})),hotels:[]}};
  const api={visible:o=>!o.expired,summary:o=>o.id};const ctx=vm.createContext({S,actId:()=> 'main',NorthHotelData:{roleOrder:o=>o.payer==='ta'},NorthFlightBooking:api,NorthTrainBooking:api,NorthTravelOrders:api,tvHotelVisibleToRole:()=>false,tvHotelSummary:()=>''});
  const start=source.indexOf('function spyTravelEntries('),end=source.indexOf('const _spyTravelViews=',start);vm.runInContext(source.slice(start,end),ctx);vm.runInContext(source.split(/\r?\n/).find(l=>l.startsWith('function spyTravelOrderRows(')),ctx);
  const before=JSON.stringify(S),rows=ctx.spyTravelOrderRows('a');assert.equal(rows.length,32,'inspection must not truncate older purchases at 24');assert.doesNotMatch(JSON.stringify(rows),/other-role|other-account|expired/);assert.equal(JSON.stringify(S),before);
  S.travel.ticketOrders.push({...base,id:'new-order',ts:100});assert.equal(ctx.spyTravelOrderRows('a')[0].id,'new-order');
 });
 test(file+' role new friends tracks generated contacts and actual role friends without player requests',()=>{
  const S={spy:{a:{contacts:[{name:'妈妈',note:'家人',added:'昨天'}],friends:['新同事']},b:{contacts:[{name:'OTHER_ROLE_SECRET'}]}},hisWx:{a:{friends:[{name:'妈妈'},{name:'老周',relation:'同事'}]}},friendRequests:[{contactId:'PLAYER_REQUEST_SECRET'}]};const c={_gotFromMe:['推荐朋友']};const ctx=vm.createContext({S,getC:id=>id==='a'?c:{}});vm.runInContext(source.split(/\r?\n/).find(l=>l.startsWith('function spyNewFriendRows(')),ctx);
  const before=JSON.stringify(S),rows=ctx.spyNewFriendRows('a');assert.deepEqual(Array.from(rows,x=>x.name),['妈妈','新同事','推荐朋友','老周']);assert.equal(JSON.stringify(S),before);assert.doesNotMatch(JSON.stringify(rows),/OTHER_ROLE_SECRET|PLAYER_REQUEST_SECRET/);
  S.spy.a.contacts.push({name:'刚生成的角色',note:'新认识',status:'pending'});assert.equal(ctx.spyNewFriendRows('a').find(x=>x.name==='刚生成的角色').status,'pending');
 });
}

for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
 const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 test(file+' role settings keep only three categories and save name/PIN/phone on the selected role',()=>{
  const c={id:'a',name:'Alice',blocked:true,spy:{pwd:'1234',phone:'13800000001',granted:true}},other={id:'b',name:'Bob',spy:{pwd:'9876'}};
  const S={me:{name:'PLAYER_NAME',avatar:'PLAYER_AVATAR'},settings:{chat:{key:'PLAYER_API_SECRET'}},contacts:[c,other]},fields={};let account='main';
  const ctx=vm.createContext({S,APP_VER:'fixture',actId:()=>account,getC:id=>S.contacts.find(x=>x.id===id),esc:s=>String(s??''),jq:s=>JSON.stringify(s),av:s=>String(s),save(){},render(){},toast(){},setTimeout(){},document:{getElementById:id=>fields[id]},$:id=>fields[id.replace('#','')],spyOpen(){},privatePhoneAccountAvailable(){throw Error('role settings must not read private cloud account');},privateNativeSettingsAction(){throw Error('role settings must not expose native maintenance actions');}});
  const defs=source.slice(source.indexOf('const SETTINGS_CATEGORIES='),source.indexOf('function settingsCategoryMeta('));vm.runInContext(defs,ctx);
  for(const name of ['getSpy','spyPwd','spyAppearance','spyAppearanceNameSave','settingsCategoryMeta','settingsLineIcon','settingsHomeRow','settingsHomeHTML']){
   const a=source.indexOf('function '+name+'('),b=source.indexOf('\nfunction ',a);vm.runInContext(source.slice(a,b),ctx);
  }
  const a=source.indexOf('const _spySettingsViews='),b=source.indexOf('/* End role settings. */',a);vm.runInContext(source.slice(a,b),ctx);
  for(const name of ['spyChangePwd','spySetPhone']){const a=source.indexOf('function '+name+'('),b=source.indexOf('\nfunction ',a);vm.runInContext(source.slice(a,b),ctx);}
  const before=JSON.stringify({me:S.me,settings:S.settings,other}),home=ctx.renderSpySettings('a',c);
  assert.equal((home.match(/class="ios-settings-row"/g)||[]).length,3);assert.match(home,/外观与主屏幕/);assert.doesNotMatch(home,/PLAYER_NAME|PLAYER_AVATAR|PLAYER_API_SECRET|聊天 API|声音与通话/);
  ctx.spySettingsOpen('a','phone');assert.match(ctx.renderSpySettings('a',c),/13800000001/);account='alt';assert.equal((ctx.renderSpySettings('a',c).match(/class="ios-settings-row"/g)||[]).length,3,'navigation cannot leak between account views');account='main';
  fields.spynewpw={value:'12'};ctx.spyChangePwd('a');assert.equal(c.spy.pwd,'1234');fields.spynewpw.value='2468';ctx.spyChangePwd('a');assert.equal(ctx.spyPwd(c),'2468');fields.spyphone={value:'invalid'};ctx.spySetPhone('a');assert.equal(c.spy.phone,'13800000001');fields.spyphone.value='13712345678';ctx.spySetPhone('a');assert.equal(c.spy.phone,'13712345678');
  fields.spyAppearanceName={value:'Role display name',dataset:{}};ctx.spyAppearanceNameSave('a');assert.equal(c._spyAppearance.name,'Role display name');assert.equal(JSON.stringify({me:S.me,settings:S.settings,other}),before);
 });
}
