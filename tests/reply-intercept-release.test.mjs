import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source=fs.readFileSync(path.join(process.cwd(),'app.js'),'utf8');
const start=source.indexOf('const _roleInterceptReleaseBusy=new Set();');
const end=source.indexOf('function offlineRoleDrift(',start);
assert.ok(start>=0&&end>start,'manual intercept release helper must exist');
const block=source.slice(start,end);

assert.match(source,/释放全部到聊天/);
assert.match(source,/不能手动释放/);
assert.match(block,/if\(row\.kind==='request-failure'\)return toast\('这轮只有接口失败依据，没有可释放的角色正文'\),false/);
assert.doesNotMatch(block,/\b(?:chatAPI|callAI|offAI|cohabAI|applyRoleActions)\s*\(/,'release must not call the model or execute hidden actions');

function makeHarness({lane='online',saveResult=true,rowKind='intercept'}={}){
  const contact={id:'role-a',name:'角色A'},rows={},online=[],offline=[],cohab=[];
  const account='main',key=`${contact.id}|${lane}|${lane==='online'?account:''}`;
  rows[key]={
    roleId:contact.id,roleName:contact.name,channel:lane,account:lane==='online'?account:undefined,
    at:1234,kind:rowKind,
    failure:rowKind==='request-failure'?{reason:'超时'}:undefined,
    items:rowKind==='request-failure'?[]:[
      {raw:'第一份[闹钟|07:00|起床]',stage:'主回复'},
      {raw:'第二份',stage:'纠正回复',truncated:true}
    ]
  };
  let confirms=0,saves=0,legacySaves=0,opened='',closed=0,renders=0,now=2000,uidSeq=0;
  const S={offline:{[contact.id]:{msgs:offline}},cohabitation:{homes:{[contact.id]:{msgs:cohab,msgSeq:7}}}};
  const ctx={
    Set,Array,Object,String,Date:{now:()=>now++},Promise,
    getC:id=>id===contact.id?contact:null,
    roleInterceptDiagnosticChannel:v=>v,
    roleInterceptDiagnosticAccount:()=>account,
    roleInterceptDiagnosticKey:(id,ch,acct)=>`${id}|${ch}|${ch==='online'?acct:''}`,
    roleInterceptDiagnosticRead:(c,ch,acct)=>rows[`${c.id}|${ch}|${ch==='online'?acct:''}`]||null,
    roleInterceptDiagnosticReadAll:()=>rows,
    roleInterceptDiagnosticWriteAll:()=>{},
    toast:()=>{},
    uiConfirm:async()=>{confirms++;return true;},
    msgsForAccount:()=>online,
    S,uid:()=>`m-${++uidSeq}`,
    saveNowAsync:async()=>{saves++;return saveResult;},
    save:()=>{legacySaves++;},
    closeModal:()=>{closed++;},openChat:id=>{opened=id;},offRender:()=>{renders++;},render:()=>{renders++;}
  };
  vm.createContext(ctx);
  vm.runInContext(`${block}\nthis.release=roleInterceptDiagnosticRelease;`,ctx);
  return {ctx,contact,rows,row:rows[key],online,offline,cohab,S,
    stats:()=>({confirms,saves,legacySaves,opened,closed,renders})};
}

{
  const h=makeHarness();
  assert.equal(await h.ctx.release(h.contact.id,'online'),true);
  assert.deepEqual(h.online.map(x=>x.content),[
    '第一份[闹钟|07:00|起床]',
    '第二份\n\n（这条候选超过诊断保存上限，仅释放本机保留的前 12000 字。）'
  ]);
  assert.ok(h.online.every(x=>x.role==='assistant'&&x.type==='text'&&x._interceptReleased===true));
  assert.equal(h.row.releasedCount,2);
  assert.ok(h.row.releasedAt);
  assert.equal(h.stats().saves,1);
  assert.equal(h.stats().opened,h.contact.id);
  assert.equal(await h.ctx.release(h.contact.id,'online'),false,'the same diagnostic row must not be released twice');
  assert.equal(h.online.length,2);
}

{
  const h=makeHarness({rowKind:'request-failure'});
  assert.equal(await h.ctx.release(h.contact.id,'online'),false);
  assert.equal(h.online.length,0);
  assert.equal(h.stats().confirms,0,'request failures must be rejected before confirmation');
}

{
  const h=makeHarness({saveResult:false});
  assert.equal(await h.ctx.release(h.contact.id,'online'),false);
  assert.equal(h.online.length,0,'a failed durable save must roll back the whole batch');
  assert.equal(h.row.releasedAt,undefined);
  assert.equal(h.stats().legacySaves,1,'rollback should restore persistence state');
}

{
  const h=makeHarness({lane:'offline'});
  assert.equal(await h.ctx.release(h.contact.id,'offline'),true);
  assert.deepEqual(h.offline.map(x=>x.who),['ta','ta']);
  assert.equal(h.offline[0].text,'第一份[闹钟|07:00|起床]');
}

{
  const h=makeHarness({lane:'cohab'});
  assert.equal(await h.ctx.release(h.contact.id,'cohab'),true);
  assert.deepEqual(h.cohab.map(x=>x.cohabSeq),[8,9]);
  assert.equal(h.S.cohabitation.homes[h.contact.id].msgSeq,9);
  assert.deepEqual(h.cohab.map(x=>x.who),['ta','ta']);
}
