import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bundle=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');

function fn(name){
  const starts=[source.indexOf(`function ${name}(`),source.indexOf(`async function ${name}(`)].filter(x=>x>=0);
  assert.ok(starts.length,`missing ${name}`);
  const start=Math.min(...starts),brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const replyFns=['hisFriendReplyKey','hisFriendReplyBusy','queueHisFriendReply','hisFriendReplyFallback','hisFriendReplyText','aiHisFriendReply'];

function harness(chatAPI){
  const c={id:'role',name:'先生'},friends=[
    {id:'a',name:'阿哲',relation:'朋友',msgs:[{r:'me',c:'在吗',t:1}]},
    {id:'b',name:'林姐',relation:'同事',msgs:[{r:'me',c:'有空吗',t:2}]}
  ],spy={};
  const context=vm.createContext({
    String,Date,setTimeout,clearTimeout,chatAPI,
    getC:id=>id==='role'?c:null,
    hisWxData:()=>({friends}),
    hisSpyFriend:(cid,name)=>spy[name]||(spy[name]={lines:[]}),
    cleanReply:x=>String(x||''),
    save:()=>{},cur:()=>({p:'none'}),render:()=>{}
  });
  vm.runInContext(`let _hisReplyState={};${replyFns.map(fn).join('\n')}globalThis.queue=queueHisFriendReply;globalThis.busy=hisFriendReplyBusy;`,context);
  return {context,friends,spy};
}

async function waitFor(check){for(let i=0;i<40;i++){if(check())return;await new Promise(r=>setTimeout(r,0));}throw new Error('timed out');}

test('logged-in WeChat friends reply independently instead of sharing one dropped global lock',async()=>{
  const pending=[];
  const h=harness((messages)=>new Promise(resolve=>pending.push({messages,resolve})));
  h.context.queue('role','a');
  h.context.queue('role','b');
  await waitFor(()=>pending.length===2);
  assert.equal(h.context.busy('role','a'),true);
  assert.equal(h.context.busy('role','b'),true);
  pending.find(x=>x.messages[0].content.includes('阿哲')).resolve('刚看到，怎么了？');
  pending.find(x=>x.messages[0].content.includes('林姐')).resolve('有空，你说。');
  await waitFor(()=>!h.context.busy('role','a')&&!h.context.busy('role','b'));
  assert.equal(h.friends[0].msgs.at(-1).c,'刚看到，怎么了？');
  assert.equal(h.friends[1].msgs.at(-1).c,'有空，你说。');
  assert.deepEqual(h.spy['阿哲'].lines,['阿哲：刚看到，怎么了？']);
  assert.deepEqual(h.spy['林姐'].lines,['林姐：有空，你说。']);
});

test('an empty or failed friend response retries once, then still leaves a natural visible reply',async()=>{
  const routes=[];
  const h=harness(async(messages,opt)=>{routes.push(opt.aux);return '';});
  h.context.queue('role','a');
  await waitFor(()=>!h.context.busy('role','a'));
  assert.deepEqual(routes,[true,false]);
  assert.equal(h.friends[0].msgs.filter(x=>x.r==='ta').length,1);
  assert.ok(h.friends[0].msgs.at(-1).c.trim());
  assert.equal(h.spy['阿哲'].lines.length,1);
});

test('the send and UI paths use the reliable per-friend queue',()=>{
  assert.match(fn('hisChatSend'),/queueHisFriendReply\(cid,fid\)/);
  assert.doesNotMatch(source,/let _hisReplyBusy=false/);
  assert.match(fn('renderHisChat'),/hisFriendReplyBusy\(cid,fid\)/);
  assert.match(fn('renderHisChat'),/对方正在输入/);
  assert.match(source,/APP_VER='v1638 · 公开伴生时长入口撤除'/);
  assert.match(bundle,/queueHisFriendReply\(cid,fid\)/);
  assert.doesNotMatch(bundle,/let _hisReplyBusy=false/);
});


function rolePaymentHarness(){
  const role={id:'role',name:'角色',wallet:100},messages=[],data={friends:[],payments:[]},S={me:{active:'main',name:'玩家',balance:20},hisWx:{role:data},spy:{}};
  let seq=0;
  const context=vm.createContext({S,Date,Number,JSON,String,Set,Math,uid:()=>String(++seq),actId:()=>S.me.active,getC:id=>id==='role'?role:null,hisWxData:()=>data,msgs:()=>messages,save:()=>{},hisLog:()=>{},toast:()=>{},back:()=>{},render:()=>{},fmtDT:()=>'',hisSpyFriend:()=>({lines:[]})});
  vm.runInContext(`let _hisLogin={cid:'role'},_paySend=null;${['hisChatAllowed','hisMessageDescription','hisChatAppend','spyBalance','setSpyBalance','hisPayParts','hisPaymentFind','hisPaymentMessage','hisPaymentSettle','hisPaymentsExpire','hisPaymentCanReceive','hisPaySendSubmit'].map(fn).join('\n')}
    globalThis.send=(amount,type='transfer')=>hisPaySendSubmit({id:JSON.stringify(['role','__me']),account:'main',session:_hisLogin,kind:type,note:''},amount);
    globalThis.append=m=>hisChatAppend('role','__me',m);globalThis.expire=hisPaymentsExpire;globalThis.settle=hisPaymentSettle;globalThis.canReceive=hisPaymentCanReceive;`,context);
  return {context,role,messages,data,S};
}

test('role-originated media shares the player conversation and keeps its true operator',()=>{
  const h=rolePaymentHarness();h.context.append({type:'image',src:'data:image/png;base64,fixture'});
  h.context.append({type:'sticker',img:'fixture',meaning:'笑'});
  assert.deepEqual(h.messages.map(m=>m.type),['image','sticker']);
  assert.ok(h.messages.every(m=>m.role==='assistant'&&m._forged&&m.id));
});

test('role payment debits only the role, retains deleted pending money, and refunds once',()=>{
  const h=rolePaymentHarness();h.context.send(12.34);
  assert.equal(h.role.wallet,87.66);assert.equal(h.S.me.balance,20);
  assert.equal(h.messages[0]._hisPaymentId,h.data.payments[0].id);
  h.context.send(999);assert.equal(h.data.payments.length,1);
  const p=h.data.payments[0];h.messages.splice(0);p.time-=86400001;
  h.context.expire();h.context.expire();assert.equal(h.role.wallet,100);assert.equal(p.state,'refunded');
  assert.equal(h.S.spy.role.wallet.length,2);assert.equal(h.S.spy.role.wallet[1].amount,12.34);
});

test('role payments reject stale accounts and preserve explicit zero and phone-wallet balances',()=>{
  const h=rolePaymentHarness();h.S.me.active='other';h.context.send(5);assert.equal(h.role.wallet,100);assert.equal(h.data.payments.length,0);
  h.S.me.active='main';h.role.wallet=0;h.S.spy.role={balance:100};h.context.send(5);assert.equal(h.data.payments.length,0);
  h.role.wallet=null;h.S.spy.role.balance=10;h.context.send(5);assert.equal(h.S.spy.role.balance,5);assert.equal(h.role.wallet,null);
  const p=h.data.payments[0];h.context.settle(p,'received');h.context.settle(p,'refunded');assert.equal(h.S.spy.role.balance,5);assert.equal(p.state,'received');
});
