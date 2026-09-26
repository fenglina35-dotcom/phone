import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
 const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
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
