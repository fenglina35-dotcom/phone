import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf(`function ${name}(`);assert.ok(start>=0,`missing ${name}`);
  const brace=app.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('an explicit recent remark request is detected but a refusal is not',()=>{
  const now=Date.now(),contact={id:'role',_remarkAt:now-1000};
  const rows=[{role:'user',type:'text',content:'登录微信以后改一下你的备注',time:now}];
  const ctx=vm.createContext({getC:()=>contact,msgs:()=>rows,msgToText:m=>m.content});
  vm.runInContext(`${functionSource('wxLoginRecentIntent')};globalThis.read=wxLoginRecentIntent;`,ctx);
  assert.equal(ctx.read('role').remark,true);
  rows[0]={role:'user',type:'text',content:'登录微信，但先不要改备注',time:now+1};
  assert.equal(ctx.read('role').remark,false);
  rows[0]={role:'user',type:'text',content:'上次改备注挺好玩的',time:now-2000};
  assert.equal(ctx.read('role').remark,false,'an old statement before the last applied remark is not a pending command');
});

test('explicit remark requests bypass autonomous cooldown and use one genuine-model retry',async()=>{
  const now=Date.now(),contact={id:'role',remark:'旧备注',_remarkAt:now,_remarkHistory:[]},calls=[];
  const S={me:{name:'用户'},contacts:[contact],wxLogin:{by:'role',sessionId:'session',did:[],actions:[]}};
  const ctx=vm.createContext({S,Date,String,buildSystem:()=>'',chatAPI:async messages=>{calls.push(messages);return '[改备注|诊室外的先生]';}});
  vm.runInContext([functionSource('roleRemarkApply'),functionSource('wxLoginSelfName'),functionSource('wxLoginRecordAction'),functionSource('wxLoginApplyRemarkResponse'),'async '+functionSource('wxLoginEnsureRequestedRemark')].join('\n')+';globalThis.apply=wxLoginApplyRemarkResponse;globalThis.retry=wxLoginEnsureRequestedRemark;',ctx);
  assert.equal(ctx.apply(contact,'[改备注|自主昵称]',{remark:false}),false,'autonomous changes still respect the cooldown');
  assert.equal(await ctx.retry(contact,'role','session',{remark:true},'我先看看'),true);
  assert.equal(calls.length,1,'a missing requested action consumes only one bounded repair call');
  assert.equal(contact.remark,'诊室外的先生');
  assert.equal(S.wxLogin.actions.length,1);
  assert.equal(S.wxLogin.did.length,1);
  assert.equal(await ctx.retry(contact,'role','session',{remark:true},''),false,'an applied request is not generated twice');
  assert.equal(calls.length,1);
});

test('login completion repairs operation-only output without turning a genuine visible reply into silence',()=>{
  const ctx=vm.createContext({initiativeVisibleText:v=>String(v||'')});
  vm.runInContext(`${functionSource('wxLoginCompletionFeature')};${functionSource('wxLoginCompletionReplyValid')};${functionSource('wxLoginCompletionRepairPrompt')};globalThis.feature=wxLoginCompletionFeature;globalThis.valid=wxLoginCompletionReplyValid;globalThis.prompt=wxLoginCompletionRepairPrompt;`,ctx);
  assert.equal(ctx.feature('功能事件即时反应｜角色退出微信登录\n事实'),true);
  for(const line of ['','我看完了。','我改了备注。','我刚退出微信。','我弄好了。'])assert.equal(ctx.valid(line),false,line);
  assert.equal(ctx.valid('我看完了。那个群里没什么新动静。'),true);
  assert.equal(ctx.valid('我把备注改好了，这个名字更像我。'),true);
  assert.match(ctx.prompt(),/只输出一至三条角色本人会说的话/);
  assert.match(ctx.prompt(),/禁止输出任何方括号标签/);
  const schedule=functionSource('scheduleReply');
  assert.match(schedule,/!wxLoginCompletionFeature\(note\).*roleBusyDeferReply/,'login completion must not be parked behind persona busy mode');
  assert.match(app,/wxLoginCompletionRepairPrompt\(\)/,'an operation-only first result receives one focused genuine-model repair');
  assert.match(app,/else content=initiativeVisibleText\(original\)\?original:''/,'a genuine visible first result is retained if repair still fails');
  assert.match(app,/got=replyVisibleAssistantCount\(id,replyAccount\)>_wxLoginVisibleBefore/,'hidden tags cannot falsely acknowledge the completion as delivered');
});

test('login completion enters the reply scheduler immediately instead of waiting in an in-memory handoff timer',()=>{
  const calls=[],ctx=vm.createContext({actId:()=> 'main',featureEventNoteActive:()=>true,wxLoginCompletionFeature:()=>true,scheduleReply(...args){calls.push(args);return true;}});
  vm.runInContext(`${functionSource('scheduleFeatureReply')};globalThis.run=scheduleFeatureReply;`,ctx);
  assert.equal(ctx.run('role','功能事件即时反应｜角色退出微信登录',220,null,'main'),true);
  assert.equal(calls.length,1);
  assert.deepEqual(Array.from(calls[0].slice(0,2)),['role','功能事件即时反应｜角色退出微信登录']);
});

test('real logout state machine sends an online-started login completion straight back to online chat',()=>{
  const contact={id:'role',blocked:false},scheduled=[],cohab=[],released=[];
  const S={me:{name:'用户'},cohabitation:{enabled:true,paused:false,cid:'role'},wxLogin:null};
  const ctx=vm.createContext({S,Date,String,Math,getC:()=>contact,roleLatestUserChannel:()=> 'online',save(){},wxLoginCommitHistory(){},wxLoginSnapshotNorm:v=>String(v||''),rolePhoneInspectionSignature:()=>({key:'wechat',hash:'new'}),rolePhoneInspectionUnchanged:()=>false,rolePhoneInspectionCommit(){},featureEventNote:(kind,detail)=>`[功能事件即时反应｜${kind}]\n${detail}`,featureEventNoteActive:n=>/功能事件即时反应/.test(String(n||'')),actId:()=> 'main',scheduleReply:(...args)=>{scheduled.push(args);return true;},cohabPhoneLoginFinished:(...args)=>cohab.push(args),rolePhoneInspectionRelease:t=>released.push(t),cur:()=>({p:'home'}),render(){},clearInterval(){},setTimeout(fn){fn();return 1;}});
  vm.runInContext(`let _wxLoginTimer=null;${functionSource('wxLoginCompletionFeature')};${functionSource('wxLoginCompletionChannel')};${functionSource('scheduleFeatureReply')};${functionSource('wxLogout')};globalThis.channel=wxLoginCompletionChannel;globalThis.logout=wxLogout;`,ctx);
  S.wxLogin={by:'role',channel:ctx.channel('role',{}),laneToken:'lane',did:[],actions:[],saw:'联系人摘要',previousSaw:''};
  assert.equal(S.wxLogin.channel,'online');
  ctx.logout();
  assert.equal(S.wxLogin,null);
  assert.equal(scheduled.length,1,'the completion must enter online scheduling in the same logout turn');
  assert.match(String(scheduled[0][1]),/角色退出微信登录/);
  assert.equal(cohab.length,0,'an enabled co-living switch must not steal the online completion');
  assert.deepEqual(released,['lane']);
});

test('real logout state machine keeps an explicitly co-living login inside co-living',()=>{
  const contact={id:'role',blocked:false},scheduled=[],cohab=[];
  const S={me:{name:'用户'},wxLogin:{by:'role',channel:'cohab',laneToken:'lane',did:[],actions:[],saw:'现场摘要',previousSaw:''}};
  const ctx=vm.createContext({S,Date,String,Math,getC:()=>contact,save(){},wxLoginCommitHistory(){},wxLoginSnapshotNorm:v=>String(v||''),rolePhoneInspectionSignature:()=>({key:'wechat',hash:'new'}),rolePhoneInspectionUnchanged:()=>false,rolePhoneInspectionCommit(){},featureEventNote:(kind,detail)=>`[功能事件即时反应｜${kind}]\n${detail}`,featureEventNoteActive:n=>/功能事件即时反应/.test(String(n||'')),actId:()=> 'main',scheduleReply:(...args)=>{scheduled.push(args);return true;},cohabPhoneLoginFinished:(...args)=>cohab.push(args),rolePhoneInspectionRelease(){},cur:()=>({p:'home'}),render(){},clearInterval(){},setTimeout(fn){fn();return 1;}});
  vm.runInContext(`let _wxLoginTimer=null;${functionSource('wxLoginCompletionFeature')};${functionSource('scheduleFeatureReply')};${functionSource('wxLogout')};globalThis.logout=wxLogout;`,ctx);
  ctx.logout();
  assert.equal(scheduled.length,0);
  assert.equal(cohab.length,1);
});

test('quoting updates only the composer row and preserves the live textarea node',()=>{
  let pending=null,inserted='',renderCalls=0;
  const textarea={value:'没有丢掉的草稿'},bar={insertAdjacentHTML(where,html){assert.equal(where,'beforebegin');inserted=html;pending={outerHTML:html,remove(){pending=null;}};}},contact={id:'role',name:'角色',remark:'先生'};
  const ctx=vm.createContext({S:{settings:{quoteOn:true},me:{name:'我'}},document:{querySelector:q=>q.includes('chat-inputbar')?bar:null},getC:()=>contact,cur:()=>({p:'chat',id:'role'}),esc:s=>String(s),render(){renderCalls++;},$:(q)=>q==='#chatQuotePending'?pending:q==='#cinput'?textarea:q==='.chat-inputbar'?bar:null});
  vm.runInContext(`let _quoting={id:'role',who:'ta',text:'引用这一句话'};${functionSource('quoteComposerHTML')};${functionSource('quoteComposerRefresh')};globalThis.refresh=quoteComposerRefresh;globalThis.clear=()=>{_quoting=null};`,ctx);
  ctx.refresh('role');
  assert.match(inserted,/id="chatQuotePending"/);
  assert.equal(textarea.value,'没有丢掉的草稿');
  assert.equal(renderCalls,0,'the full chat page must not render for a quote bar');
  ctx.clear();ctx.refresh('role');
  assert.equal(pending,null);
  assert.equal(textarea.value,'没有丢掉的草稿');
});

test('home gestures install one movement event family per browser',()=>{
  const run=hasPointer=>{
    const names=[],doc={hidden:false,addEventListener:n=>names.push(n)},win={_aDragInit:0,addEventListener:n=>names.push('window:'+n)};
    if(hasPointer)win.PointerEvent=function(){};
    const ctx=vm.createContext({window:win,document:doc,Date,appMove(){},appUp(){},appCancel(){},appTouchMove(){},appTouchEnd(){}});
    vm.runInContext(`${functionSource('initAppDrag')};initAppDrag();`,ctx);return names;
  };
  const pointer=run(true),touch=run(false);
  assert.ok(pointer.includes('pointermove'));
  assert.ok(!pointer.includes('touchmove'),'WKWebView must not also install a global non-passive touchmove listener');
  assert.ok(touch.includes('touchmove'));
  assert.ok(!touch.includes('pointermove'));
});
