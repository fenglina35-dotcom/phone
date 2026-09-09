import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../daily-event-ledger.js',import.meta.url),'utf8');
function setup(){const c={id:'a'},b={id:'b'},rows=[],box={console,Date,window:null,S:{me:{active:'main'}},c,b,rows,uid:(()=>{let i=0;return()=>String(++i)})(),esc:String,save(){},render(){},msgs:()=>rows,memoryScopeKey(){return box.S.me.active},getC:id=>id==='a'?c:b,lifeNoteModelPrompt:()=>'',lifeNoteStripModelTags:x=>x,lifeNoteReplyDraft:()=>null,lifeNoteCommitReply(){},clearContactMemoryData(c){c._memoryResetAt=Date.now()}};box.window=box;vm.createContext(box);vm.runInContext(code,box);return box;}
const at=Date.parse('2026-09-09T19:00:00+08:00');
test('off by default, per-role/account isolation and optional memory prompt',()=>{
 const x=setup(),api=x.DailyEventLedger;
 assert.equal(api.prompt(x.c),'');assert.equal(api.state(x.c),null);
 x.dailyEventLedgerSet('a','enabled',true);assert.match(api.prompt(x.c),/日常事件簿/);assert.equal(api.prompt(x.b),'');
 x.S.me.active='alt';assert.equal(api.prompt(x.c),'');x.S.me.active='main';assert.match(api.prompt(x.c),/日常事件簿/);
});
test('records only evidenced user fact after visible delivery, no duplicate on extra bubbles',()=>{
 const x=setup(),a=x.DailyEventLedger;x.dailyEventLedgerSet('a','enabled',true);
 x.rows.push({role:'user',content:'我昨天吃过晚饭了',time:at});
 const d=x.lifeNoteReplyDraft('[事件簿|新|已发生|我昨天吃过晚饭了|用户昨天吃过晚饭。]',x.c,'我昨天吃过晚饭了','wechat');
 assert.equal(a.state(x.c).items.length,0);x.lifeNoteCommitReply(d,'记得了。');x.lifeNoteCommitReply(d,'嗯。');
 assert.equal(a.state(x.c).items.length,1);assert.equal(a.state(x.c).items[0].eventDate,'2026-09-08');assert.equal(a.state(x.c).items[0].reportedAt,at);
 assert.equal(x.lifeNoteReplyDraft('[事件簿|新|已发生|你吃过饭|用户吃过饭了。]',x.c,'你猜','wechat'),null);
 assert.equal(a.strip('好。[事件簿|新|已发生|我吃过饭了|用户吃过饭了。]'),'好。');
});
test('pending questions and future plans never upgraded to completed by a substring',()=>{
 const x=setup(),a=x.DailyEventLedger;x.dailyEventLedgerSet('a','enabled',true);
 for(const user of ['我没有吃过晚饭','我吃过晚饭了吗？','如果我吃过晚饭就出去']){
  const d=a.draft('[事件簿|新|已发生|吃过晚饭|用户吃过晚饭了。]',x.c,user,'wechat');a.commit(d,'嗯。');
  assert.equal(a.state(x.c).items.at(-1).status,'待确认');
 }
});
test('same event progresses with previous state, clear/edit/toggle cancels stale write',()=>{
 const x=setup(),a=x.DailyEventLedger;x.dailyEventLedgerSet('a','enabled',true);
 let d=a.draft('[事件簿|新|计划中|明天去复查|用户计划明天去复查。]',x.c,'明天去复查','wechat');a.commit(d,'好。');const id=a.state(x.c).items[0].id;
 d=a.draft('[事件簿|'+id+'|已解决|已经复查完了|用户已完成复查。]',x.c,'已经复查完了','wechat');a.commit(d,'好。');assert.equal(a.state(x.c).items.length,1);assert.equal(a.state(x.c).items[0].previous.status,'计划中');
 d=a.draft('[事件簿|新|已发生|今天走过路|用户今天散步了。]',x.c,'今天走过路','wechat');x.dailyEventLedgerSet('a','enabled',false);a.commit(d,'好。');assert.equal(a.state(x.c).items.length,1);
 x.clearContactMemoryData(x.c,'a');assert.equal(a.state(x.c),null);
});
test('unknown date stays unknown and Beijing dates use original user timestamp',()=>{
 const x=setup(),a=x.DailyEventLedger;assert.equal(a.eventDay('昨天散步',Date.parse('2026-09-10T00:01:00+08:00')),'2026-09-09');
 assert.equal(a.eventDay('前几天散步',at),'');assert.equal(a.eventDay('吃过晚饭了',at),'');assert.equal(a.eventDay('2026年2月31日散步',at),'');assert.equal(a.eventDay('9月8日散步',at),'9月8日（年份未说明）');
});
test('cap is bounded and retrieval never includes every row',()=>{
 const x=setup(),a=x.DailyEventLedger;x.dailyEventLedgerSet('a','enabled',true);x.dailyEventLedgerSet('a','limit',50);
 for(let i=0;i<65;i++){const user='今天事件编号'+i;a.commit(a.draft('[事件簿|新|已发生|'+user+'|用户完成事件'+i+'。]',x.c,user,'wechat'),'好。');}
 assert.equal(a.state(x.c).items.length,50);assert(a.selected(x.c).length<=10);x.dailyEventLedgerSet('a','limit',5000);assert.equal(a.state(x.c).limit,300);
});
test('deleting an account clears only its ledger in both actual implementations',async()=>{
 for(const file of ['../app.js','../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
  const src=fs.readFileSync(new URL(file,import.meta.url),'utf8');
  const start=src.indexOf('async function delAccount(id)'),end=src.indexOf('\nfunction cMark',start);
  const ledgerMain={items:['keep']},c={_dailyEventLedgers:{main:ledgerMain,alt:{items:['remove']}}};
  const box={S:{me:{accounts:[{id:'main'},{id:'alt'}]},messages:{'role#alt':[],role:[]},contacts:[c]},uiConfirm:async()=>true,actId:()=> 'main',save(){},accountMgr(){}};
  vm.createContext(box);vm.runInContext(src.slice(start,end),box);await box.delAccount('alt');
  assert.equal(c._dailyEventLedgers.main,ledgerMain);assert.equal(c._dailyEventLedgers.alt,undefined);assert.deepEqual(box.S.me.accounts,[{id:'main'}]);
 }
});
