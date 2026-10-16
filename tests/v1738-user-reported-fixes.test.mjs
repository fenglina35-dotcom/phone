/* v1738 用户反馈的六项：库外城市订票、总结视角误判、群聊气泡白边、群聊每人条数与总条数、搜索聊天记录分组与跳转。
   每一条都对着旧实现会失败的那个具体行为写。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('app.js'),html=read('小手机.html');
function fn(name){
  const m=new RegExp('(?:^|\\n)(?:async )?function '+name+'\\(').exec(app);assert.ok(m,'missing '+name);
  const start=m.index+(app[m.index]==='\n'?1:0),brace=app.indexOf('{',app.indexOf(')',start));let depth=0,quote='',escaped=false;
  for(let i=brace;i<app.length;i++){const ch=app[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='/'&&app[i+1]==='*'){i=app.indexOf('*/',i)+1;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return app.slice(start,i+1);}
  throw new Error('unterminated '+name);
}
const line=prefix=>{const l=app.split('\n').find(x=>x.startsWith(prefix));assert.ok(l,'missing '+prefix);return l;};

/* ---------- 订机票 / 火车票：城市库外的城市 ---------- */
/* 订票代码里用 Date.now() 判断航班是否已起飞，把「现在」固定在 2026-10-13 06:00，测试结果不随运行当天变化 */
const FIXED_NOW=new Date('2026-10-13T06:00:00').getTime();
class FixedDate extends Date{constructor(...a){if(a.length)super(...a);else super(FIXED_NOW);}static now(){return FIXED_NOW;}}
function travel(){
  let id=0;const S={me:{name:'North',balance:10000},contacts:[{id:'r',name:'Claude',wallet:100000}],travel:{trips:[]},spy:{r:{balance:100000,wallet:[]}}};
  const ctx=vm.createContext({S,actId:()=>'main',Date:FixedDate,todayStr:()=>'2026-10-13',uid:()=>'t-'+(++id),tvInit:()=>S.travel,save(){},toast(){},esc:String,getC:i=>S.contacts.find(c=>c.id===i),tvHotelRoleMoney:c=>({balance:c.wallet,source:'roleWallet'}),cur:()=>({p:'travel'}),render(){},msgs:()=>[],meHomeCity:()=>'苏州',document:{querySelector:()=>null,querySelectorAll:()=>[]}});
  for(const f of ['travel-hotel-data.js','travel-flight.js','travel-flight-booking.js','travel-train.js','travel-train-booking.js'])vm.runInContext(read(f),ctx);
  return {ctx,S};
}
test('flights and trains accept a Chinese city that is not in the bundled list (苏州→威海 used to be "城市或日期无效")',()=>{
  const {ctx,S}=travel(),F=ctx.NorthTravelFlight,T=ctx.NorthTravelTrain;
  assert.equal(F.cityFallback('苏州').n,'苏州');
  assert.deepEqual({...F.cityFallback('威海')},{n:'威海',c:'---',i:0,g:'自定义',r:'中国',custom:true});
  assert.equal(F.cityFallback('威海市').n,'威海','a trailing 市 is the same city');
  assert.equal(T.cityFallback('烟台').r,'中国');
  for(const junk of ['','随便','不知道','目的地','不存在的城市','某个地方','海边城市','哪里都行','A','威海!!','一二三四五六七八九十'])assert.equal(F.cityFallback(junk),null,'still rejects '+JSON.stringify(junk));
  const q={account:'main',id:'q',type:'one',cls:'economy',adults:1,children:0,infants:0,people:[{id:'me',name:'North'}],legs:[{from:'苏州',to:'威海',date:'2026-10-15'}],selectedLeg:0};
  assert.equal(ctx.NorthFlightBooking.validate(q),'');
  assert.equal(ctx.NorthFlightBooking.flights(q).length,6);
  assert.equal(ctx.NorthFlightBooking.validate({...q,legs:[{from:'苏州',to:'威海',date:'2026-10-01'}]}),'城市或日期无效','a past date is still refused');
  assert.equal(ctx.NorthFlightBooking.validate({...q,legs:[{from:'威海',to:'威海市',date:'2026-10-15'}]}),'城市或日期无效','same city both ends is still refused');
  assert.equal(ctx.NorthTrainBooking.validate({...q,cls:'second'}),'');
  assert.equal(ctx.NorthTrainBooking.validate({...q,cls:'second',legs:[{from:'威海',to:'纽约',date:'2026-10-15'}]}),'当前模拟铁路不支持这条跨国路线');
  assert.equal(S.travel.trips.length,0);
});

test('role booking dates are read by content: relative words, weekdays, slashes and dots no longer fall back to today',()=>{
  /* fixture 的「今天」固定为 2026-10-13（周二） */
  const {ctx}=travel(),d=(v,texts)=>{ctx.msgs=()=>(texts||[]).map(t=>({role:'user',type:'text',content:t}));return ctx.NorthTravelFlight.roleDate(v,{id:'r'});};
  vm.runInContext("function tvNormDate(s){return todayStr();}",ctx);
  const want={'后天':'2026-10-15','明天早上':'2026-10-14','大后天':'2026-10-16','今晚':'2026-10-13','3天后':'2026-10-16','两天后':'2026-10-15','周四':'2026-10-15','下周一':'2026-10-19','下下周六':'2026-10-31','本周日':'2026-10-18','这周末':'2026-10-17','下周末':'2026-10-24','下周':'2026-10-20','10.20':'2026-10-20','10/20':'2026-10-20','10月28日':'2026-10-28','1月5日':'2027-01-05','2026/11/08':'2026-11-08','2026年11月8日':'2026-11-08','2026-11-3':'2026-11-03','大概下个月吧':'2026-11-13','昨天':'2026-10-12','前天':'2026-10-11','2026-02-30':'2026-02-30'};
  for(const [text,date] of Object.entries(want))assert.equal(d(text),date,text);
  assert.equal(d('随便',['那就10月25日走']),'2026-10-25','an empty date still reads the date the user just said');
  assert.equal(d('',['后天吧，周四']),'2026-10-15');
  assert.equal(d(''),'2026-10-13');
});
test('niche cities book end to end with different date spellings and time-of-day requests; past dates stay refused',()=>{
  const book=(tag)=>{const {ctx,S}=travel();vm.runInContext("function tvNormDate(s){return todayStr();}",ctx);const res=[];const api=/订机票/.test(tag)?ctx.NorthFlightBooking:ctx.NorthTrainBooking;api.consume(tag,S.contacts[0],ok=>res.push(!!ok));const t=S.travel.trips[S.travel.trips.length-1];return {ok:res[0],t};};
  for(const [tag,from,to,date,test] of [
    ['[订机票|苏州|威海|后天|经济舱|给你]','苏州','威海','2026-10-15'],
    ['[订机票|上海|漠河|10月28日|经济舱|给你|早上]','上海','漠河','2026-10-28',h=>h<12],
    ['[订机票|北京|喀什|2026-11-03|头等舱|我们一起|下午]','北京','喀什','2026-11-03',h=>h>=12&&h<18],
    ['[订机票|广州|阿勒泰|12月31日|经济舱|我自己|晚上]','广州','阿勒泰','2026-12-31',h=>h>=18],
    ['[订机票|武汉|呼伦贝尔|大后天|经济舱|我们一起]','武汉','呼伦贝尔','2026-10-16'],
    ['[订机票|威海市|苏州市|10/20|经济舱|给你]','威海','苏州','2026-10-20'],
    ['[订机票|无锡|烟台|明天早上|经济舱|给你]','无锡','烟台','2026-10-14'],
    ['[订火车票|无锡|烟台|下周五|一等座|我们一起]','无锡','烟台','2026-10-23'],
    ['[订高铁|苏州|威海|后天|二等座|给你]','苏州','威海','2026-10-15'],
  ]){const {ok,t}=book(tag);assert.equal(ok,true,tag);assert.equal(t.from+'→'+t.to+' '+t.date,from+'→'+to+' '+date,tag);if(test)assert.ok(test(+t.dep.slice(0,2)),tag+' departs at '+t.dep);}
  for(const tag of ['[订机票|苏州|威海|昨天|经济舱|给你]','[订机票|苏州|威海|2026-02-30|经济舱|给你]','[订机票|苏州|不知道|后天|经济舱|给你]','[订机票|威海|威海市|后天|经济舱|给你]']){const {ok,t}=book(tag);assert.equal(ok,false,tag);assert.equal(t,undefined,tag+' must not create an order');}
});

/* ---------- 手动总结：视角检查 ---------- */
function summary(){
  const ctx=vm.createContext({String,RegExp,Array,S:{me:{name:'North',callName:'',accounts:[]}},memoryScopeKey:a=>a||'main',actId:()=>'main'});
  for(const name of ['wxEscRe','summaryAccountProfile','summaryUserLabel','summaryReplaceAliasStable','summaryStripModelNoise','summaryCleanText','summaryPerspectiveIssue','summaryPerspectiveValid'])vm.runInContext(fn(name),ctx);
  return ctx;
}
test('summary perspective check passes ordinary diary sentences about the user and names the real reason otherwise',()=>{
  const s=summary(),c={name:'Claude',remark:'',callme:'North'};
  assert.equal(s.summaryPerspectiveValid(c,'今天North哭了很久，我陪着她说了一晚上的话。她后来说想去威海看海，我答应帮她把票订好。','main'),true,'a sentence that starts with 她 about the user is not a wrong perspective');
  assert.equal(s.summaryPerspectiveValid(c,'North今天哭了很久，想一个人去威海看海散心，还问了高铁和机票哪个更快。','main'),true,'a factual memory with no 我 at all is still usable');
  assert.match(s.summaryPerspectiveIssue(c,'','main'),/没有返回/);
  assert.match(s.summaryPerspectiveIssue(c,'Claude说会帮North把票订好。North很开心。','main'),/角色名字/);
  assert.match(s.summaryPerspectiveIssue(c,'他说会帮North把票订好。North很开心。','main'),/第三人称/);
  assert.match(fn('manualWechatSummary'),/这次没总结成：/);
});

/* ---------- 群聊气泡：别人的气泡不再有白色包边 ---------- */
test('group bubbles of other members carry no light rim, matching 1:1 chats',()=>{
  const ctx=vm.createContext({BUBBLE_SHAPES:{},bubbleSafeColor:(v,d)=>v||d,bubbleReadableText:(bg,v,d)=>v||d,bubbleGlowColor:()=>'rgba(0,0,0,.1)',bubbleReadableBorder:()=>'rgba(255,255,255,.28)'});
  vm.runInContext(fn('bubbleSingleLook'),ctx);
  assert.match(ctx.bubbleSingleLook({bg:'#2c2c2e'},false).css,/--bborder:transparent/);
  assert.match(ctx.bubbleSingleLook({bg:'#95ec69'},true).css,/--bborder:rgba\(255,255,255,\.28\)/);
  assert.match(html,/\.bubble\.bpretty\{[^}]*border:1px solid var\(--bborder,/);
});

/* ---------- 群聊：每个角色的回复条数 + 每轮总条数上限 ---------- */
function groupPlan(){
  const ctx={S:{couple:null},gnm:(g,id)=>id,Math};
  vm.runInNewContext([line('const GROUP_QUIET_RE='),line('const GROUP_LIVELY_RE='),line('const GROUP_TOPIC_STOP='),fn('groupRoleTemper'),fn('groupRoleCares'),fn('groupReplyPlan'),fn('groupTotalCap'),'globalThis.plan=groupReplyPlan;globalThis.total=groupTotalCap;'].join('\n'),ctx);
  return ctx;
}
test('a per-role reply count overrides the group range, including the talkative bonus',()=>{
  const {plan,total}=groupPlan(),a={id:'a',name:'甲',persona:'话痨，爱凑热闹'},b={id:'b',name:'乙',persona:''};
  const g={msgMin:1,msgMax:2,roleMsgMax:{a:5}};
  for(let i=0;i<40;i++){const p=plan(g,[a,b],'甲 乙 你们好',()=>.01);assert.equal(p.find(e=>e.c.id==='a').cap,5);assert.ok(p.find(e=>e.c.id==='b').cap<=2);}
  assert.equal(plan({msgMin:1,msgMax:2,roleMsgMax:{a:1}},[a],'甲',()=>.99)[0].cap,1,'a talkative role set to 1 stays at 1');
  assert.equal(total({}),Infinity);assert.equal(total({totalMax:0}),Infinity);assert.equal(total({totalMax:4}),4);
});
async function runGroup(g,solo){
  const roles={a:{id:'a',name:'甲'},b:{id:'b',name:'乙'},c:{id:'c',name:'丙'}},sent=[],asked=[];
  const ctx={S:{groups:[g],couple:null},Math,Infinity,Set,Map,Promise,getC:id=>roles[id],gmMutes:()=>({}),gmMutedUntil:()=>0,sleep:()=>Promise.resolve(),groupTypingSet(){},cur:()=>({p:'home'}),render(){},save(){},toast(){},roleChatRouteIndex:()=>null,
    gCallSolo:()=>solo,
    groupReplyPlan:(gg,members)=>members.map(c=>({c,cap:3,temper:'normal',cares:false})),
    groupRoleReplyItems:async(gg,c,recent,pcap)=>{asked.push([c.id,pcap]);return Array.from({length:pcap},(_,i)=>({type:'text',content:c.id+i}));},
    groupBatchReplyItems:async(gg,batch)=>{const out=new Map();batch.forEach(e=>{asked.push([e.c.id,e.cap]);out.set(e.c.id,Array.from({length:3},(_,i)=>({type:'text',content:e.c.id+i})));});return out;},
    gEmitRoleItems:async(gg,c,items)=>{items.forEach(()=>sent.push(c.id));}};
  vm.runInNewContext([fn('groupTotalCap'),fn('aiGroupReplyRun'),'globalThis.run=aiGroupReplyRun;'].join('\n'),ctx);
  await ctx.run(g.id,'大家好');return {sent,asked};
}
test('the per-round total cap is never exceeded, for solo calls and for merged calls',async()=>{
  for(const solo of [true,false]){
    const capped=await runGroup({id:'g',members:['a','b','c'],msgs:[],totalMax:4},solo);
    assert.equal(capped.sent.length,4,(solo?'solo':'merged')+': 3+3+3 planned, only 4 may be sent');
    assert.deepEqual(capped.sent,['a','a','a','b']);
    const free=await runGroup({id:'g',members:['a','b','c'],msgs:[]},solo);
    assert.equal(free.sent.length,9,(solo?'solo':'merged')+': no cap keeps the old behaviour');
  }
  const solo=await runGroup({id:'g',members:['a','b','c'],msgs:[],totalMax:4},true);
  assert.deepEqual(solo.asked,[['a',3],['b',1]],'the second role is only asked for what is left, the third is not called at all');
});
test('group settings page exposes and saves both new numbers',()=>{
  assert.match(fn('renderGroupSettingsPage'),/id="g_total"/);
  assert.match(fn('renderGroupSettingsPage'),/class="g-role-max" data-cid=/);
  assert.match(fn('gsettingsSave'),/g\.totalMax=Math\.min\(200,total\)/);
  assert.match(fn('gsettingsSave'),/g\.roleMsgMax=roleMax/);
});

/* ---------- 搜索聊天记录：按聊天分组，点进去跳到那条消息 ---------- */
function search(){
  const day=86400000,now=Date.now();
  const chats={r1:[{id:'a1',role:'user',type:'text',content:'先生今天回来吗',time:now-9*day},{id:'a2',role:'assistant',type:'text',content:'先生想听你发语音',time:now-2*day},{id:'a3',role:'assistant',type:'sys',content:'先生 系统提示',time:now}],r2:[{id:'b1',role:'assistant',type:'text',content:'没有提到',time:now}]};
  const S={me:{name:'North',avatar:'me'},contacts:[{id:'r1',name:'Claude',avatar:'x'},{id:'r2',name:'Other',avatar:'y'},{id:'r3',name:'Gone',deleted:true}],groups:[{id:'g1',name:'后宫',members:['r1'],msgs:[{id:'g-1',senderId:'me',type:'text',content:'你先生看到会不会生气',time:now-1*day},{id:'g-2',senderId:'r1',type:'text',content:'先生不会',time:now-3600000}]}]};
  let stack=[{p:'wechat'},{p:'wxsearch',q:'先生'}];const went=[];
  const ctx=vm.createContext({S,Date,Math,String,Array,RegExp,Object,msgs:id=>chats[id]||[],getC:id=>S.contacts.find(c=>c.id===id),uid:()=>'new',av:v=>'<i>'+v+'</i>',gnm:(g,id)=>id==='me'?'North':'Claude',groupDisplayName:g=>g.name,wxClassicGroupAvatarHTML:()=>'<i>g</i>',esc:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;'),hm:()=>'12:00',svgIc:()=>'',toast(){},wxChatRestore(){},$:()=>null,
    CHAT_RENDER_LIMIT:180,_wxSearchTop:{},_chatRenderExtra:{},_scrollBottomOnce:{'chat:r1':1},_chatJump:null,
    cur:()=>stack[stack.length-1],go:(p,params)=>{went.push(Object.assign({p},params));stack.push(Object.assign({p},params));}});
  Object.defineProperty(ctx,'stack',{get:()=>stack,set:v=>{stack=v;}});
  for(const name of ['wxSearchPage','wxSearchTopKey','wxSearchKeepTop','wxSearchWhen','wxHi','wxSearchMsgText','wxSearchChats','wxSearchRowHTML','wxSearchBodyHTML','wxSearchOpen','wxSearchJump'])vm.runInContext(fn(name),ctx);
  return {ctx,went,chats,S,now,day};
}
test('search groups hits per chat (roles and groups), newest chat first, with the hit count',()=>{
  const {ctx}=search(),found=ctx.wxSearchChats('先生','','');
  assert.equal(JSON.stringify(found.map(x=>[x.kind,x.id,x.hits.length])),JSON.stringify([['group','g1',2],['role','r1',2]]));
  assert.equal(found[1].hits.map(h=>h.m.id).join(),'a2,a1','system rows are not searched; newest hit first');
  const body=ctx.wxSearchBodyHTML('先生');
  assert.match(body,/<div class="wxs-head">聊天记录<\/div>/);
  assert.equal((body.match(/class="wxs-row"/g)||[]).length,2,'one row per chat, not one row per message');
  assert.equal((body.match(/共 <i>2<\/i> 条相关聊天记录/g)||[]).length,2);
  assert.match(body,/<b>先生<\/b>/);
  assert.match(ctx.wxSearchBodyHTML('没有这个词'),/没找到/);
});
test('opening a chat with several hits lists them; a single hit, or a tapped hit, jumps to that exact message',()=>{
  const {ctx,went}=search();
  ctx.wxSearchOpen('role','r1');
  assert.deepEqual({...went[0]},{p:'wxsearch',id:'r1',q:'先生'});
  const list=ctx.wxSearchBodyHTML('先生');
  assert.match(list,/2 条与“先生”相关的聊天记录/);
  assert.match(list,/wxSearchJump\('role','r1','a2'\)/);assert.match(list,/wxSearchJump\('role','r1','a1'\)/);
  ctx.wxSearchJump('role','r1','a1');
  assert.deepEqual({...ctx._chatJump},{key:'chat:r1',mid:'a1'});
  assert.equal(ctx._scrollBottomOnce['chat:r1'],undefined,'the jump must not be overridden by pin-to-bottom');
  assert.deepEqual({...went[1]},{p:'chat',id:'r1'});
  ctx.wxSearchJump('group','g1','g-1');
  assert.deepEqual({...ctx._chatJump},{key:'group:g1',mid:'g-1'});
  assert.deepEqual({...went[2]},{p:'group',id:'g1'});
});
test('a hit outside the default render window widens the window far enough to reach it',()=>{
  const {ctx,chats,now}=search();
  chats.r1=Array.from({length:600},(_,i)=>({id:'m'+i,role:'assistant',type:'text',content:i===10?'先生在这里':'普通消息',time:now-600000+i}));
  ctx.wxSearchJump('role','r1','m10');
  assert.ok(180+ctx._chatRenderExtra.r1>=600-10,'message 10 of 600 must be inside the rendered slice');
});
test('the render pipeline consumes a pending jump once and leaves normal opens pinned to the bottom',()=>{
  const src=fn('restoreRenderScroll');
  assert.match(src,/_chatJump&&_chatJump\.key===key/);
  assert.match(src,/_chatJump=null;/);
  assert.match(fn('renderWxSearch'),/_wxSearchTop\[topKey\]/);
  assert.match(fn('gbubble')+fn('bubbleRow'),/data-message-id=/);
  assert.match(fn('openChat'),/_scrollBottomOnce\['chat:'\+id\]=Date\.now\(\)/);
  assert.match(html,/\.wxs-count i\{font-style:normal;color:var\(--wxs-green\)\}/);
  assert.match(html,/\.msg\.msg-jump-hit \.col\{animation:msgJumpHit/);
  assert.match(fn('wxSearchRun'),/!scopeId\|\|c\.id===scopeId/);
});

/* v1745：私人版 App 一直还是旧的订票文件（苏州→威海仍提示城市或日期无效）。私人版的四个订票文件与网页逐字节一致。 */
test('the private App ships the same flight and rail booking files as the web build',()=>{
  for(const f of ['travel-flight.js','travel-flight-booking.js','travel-train.js','travel-train-booking.js'])
    assert.equal(read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/'+f),read(f),f+' differs between web and private');
});
