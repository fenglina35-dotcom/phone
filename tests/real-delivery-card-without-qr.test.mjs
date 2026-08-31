import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} must exist`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const messages=[];
const replies=[];
const notices=[];
const role={id:'role-no-qr',name:'North',blocked:false};
const context={
  Date,Math,String,RegExp,
  text(value,max){return String(value??'').trim().slice(0,max||300);},
  msgs(id){assert.equal(id,role.id);return messages;},
  syncRoleOrderCard(order){return messages.find(item=>item.orderId===order.id)||null;},
  orderCardSnapshot(order){return{...order};},
  uid(){return`id-${messages.length+1}`;},
  notifyIncoming(){},save(){},refreshChatMessages(){},
  roleSystemNotice(message,kind){notices.push({message,kind});},
  orderEtaText(){return'平台暂未给出预计送达时间';},
  getC(id){return id===role.id?role:null;},
  TERMINAL:{canceled:true,refunded:true,failed:true},
  STATUS_RANK:{created:1,pending_payment:1,paid:2,merchant_confirmed:3,preparing:4,courier_assigned:5,picked_up:6,delivering:7,delivered:8},
  S:{me:{name:'我'}},
  featureEventNote(kind,note){return`${kind}\n${note}`;},
  scheduleReply(id,note){replies.push({id,note});return true;},
};
vm.createContext(context);
vm.runInContext(`${functionSource('pushRoleOrderCard')}\n${functionSource('scheduleRoleOrderAcknowledgement')}\n${functionSource('recoverRoleOrderCard')}\n${functionSource('resultReply')}`,context);

const pending={id:'order-1',remoteId:'remote-1',status:'pending_payment',payUrl:'',payQrDataUrl:'',merchant:'测试店',items:[{name:'测试餐品'}]};
context.resultReply(role,pending,'');
assert.equal(messages.length,1,'a real pending-payment order without a QR still creates one chat card');
assert.equal(messages[0].type,'deliveryorder');
assert.equal(replies.length,1,'the role acknowledgement is scheduled independently of the payment QR');
assert.match(replies[0].note,/已经提交/);
assert.match(replies[0].note,/不能只发送订单卡片后保持沉默/);
assert.match(replies[0].note,/平台没有返回付款结果时也不要擅自声称已经付款/);
assert.equal(notices.at(-1).kind,'success');

context.resultReply(role,pending,'');
assert.equal(messages.length,1,'a repeated result reuses the existing card instead of duplicating it');
assert.equal(replies.length,2,'each distinct successful result path can still request its role acknowledgement');

const recovered={id:'order-recovered',remoteId:'remote-recovered',roleId:role.id,status:'pending_payment',payUrl:'',payQrDataUrl:'',merchant:'恢复店',items:[{name:'恢复餐品'}],notifiedStatuses:[]};
assert.ok(context.recoverRoleOrderCard(recovered),'a later platform-confirmed pending order repairs its missing card');
assert.equal(messages.length,2,'the recovered order creates exactly one missing chat card');
assert.equal(replies.length,3,'card recovery also schedules one genuine role acknowledgement');
assert.ok(recovered.cardRecoveredAt,'the recovered order records its one-time repair');
assert.deepEqual(recovered.notifiedStatuses,['pending_payment'],'the same status is marked handled so polling cannot send a duplicate status reply');
context.recoverRoleOrderCard(recovered);
assert.equal(messages.length,2,'repeated polling reuses the recovered card');
assert.equal(replies.length,3,'repeated polling does not repeat the recovered acknowledgement');

const draft={id:'order-draft',remoteId:'remote-draft',roleId:role.id,status:'created',merchant:'未确认店',items:[{name:'未确认餐品'}],notifiedStatuses:[]};
assert.equal(context.recoverRoleOrderCard(draft),null,'a checkout draft without confirmed payment selection never fabricates a card');
assert.equal(messages.length,2);

const failed={id:'order-2',remoteId:'remote-2',status:'failed',payQrDataUrl:''};
assert.equal(context.pushRoleOrderCard(role,failed),null,'a failed non-order status never creates a card');
assert.equal(messages.length,2);

console.log('real delivery card without QR tests passed');
