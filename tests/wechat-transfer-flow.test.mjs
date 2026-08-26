import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../glass-theme.css',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} must exist`);
  const open=app.indexOf('{',start);
  let depth=0;
  for(let i=open;i<app.length;i++){
    if(app[i]==='{')depth++;
    else if(app[i]==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`${name} is incomplete`);
}

test('transfer cards expose every incoming and outgoing state with stable copy',()=>{
  const context=vm.createContext({});
  vm.runInContext(`${functionSource('transferState')}\n${functionSource('transferCardCopy')}`,context);
  assert.equal(context.transferCardCopy({},false),'请收款');
  assert.equal(context.transferCardCopy({},true),'你发起了一笔转账');
  assert.equal(context.transferCardCopy({received:true},false),'已被接收');
  assert.equal(context.transferCardCopy({payState:'received'},true),'已被接收');
  assert.equal(context.transferCardCopy({received:true,_transferReceipt:true},true),'已收款');
  assert.equal(context.transferCardCopy({refunded:true},false),'已被退还');
  assert.equal(context.transferCardCopy({declined:true},true),'已被退还');
  assert.equal(context.transferCardCopy({refunded:true,_transferReceipt:true},false),'已退还');
  const preview=functionSource('previewTransferRows');
  const order=['in_pending','in_received','in_refunded','out_pending','out_received','out_refunded'].map(key=>preview.indexOf(`preview_transfer_${key}`));
  assert.ok(order.every((at,index)=>at>=0&&(index===0||at>order[index-1])),'preview must group incoming states before outgoing states');
  assert.match(preview,/wechat-transfer-chat-\(incoming\|outgoing\)-\(pending\|received\|refunded\)/);
  assert.match(preview,/receipt\?\[row,receipt\]:\[row\]/);
  assert.equal((preview.match(/amount:1(?:,|\})/g)||[]).length,5,'incoming previews include the original cards and both receipts');
  assert.equal((preview.match(/amount:5\.2(?:,|\})/g)||[]).length,5,'outgoing previews include the original cards and both receipts');
});

test('card click opens an independent detail page instead of directly settling money',()=>{
  const payCard=functionSource('payCard');
  const transferBranch=payCard.slice(payCard.indexOf("if(kind==='t')"),payCard.indexOf("const cls="));
  assert.match(transferBranch,/openTransferDetail/);
  assert.doesNotMatch(transferBranch,/receivePay\(/);
  assert.match(app,/else if\(c\.p==='transferDetail'\)html=renderTransferDetail/);
  assert.match(functionSource('transferDetailBack'),/chatTop/);
  assert.match(functionSource('transferDetailBack'),/requestAnimationFrame/);
});

test('pending incoming detail can receive or refund and records exact timestamps once',()=>{
  const detail=functionSource('renderTransferDetail');
  const action=functionSource('transferDetailAction');
  const reaction=functionSource('transferCounterpartyReaction');
  assert.match(detail,/转账时间/);
  assert.match(detail,/收款时间/);
  assert.match(detail,/退款时间/);
  assert.match(detail,/1天内未确认，将退还给对方。/);
  assert.match(detail,/>收款<\/button>/);
  assert.match(detail,/>退还<\/button>/);
  assert.match(action,/m\.receivedAt=now/);
  assert.match(action,/m\.refundedAt=now/);
  assert.match(action,/m\._walletSettled=true;[^}]*addBill/);
  assert.match(action,/transferReceiptEnsure\(hit\.cid,m,'user','receive',now\)/);
  assert.match(action,/transferReceiptEnsure\(hit\.cid,m,'user','refund',now\)/);
  assert.match(action,/transferCounterpartyReaction\(hit\.cid,m,'receive'\)/);
  assert.match(action,/transferCounterpartyReaction\(hit\.cid,m,'refund'\)/);
  assert.match(reaction,/scheduleFeatureReply\(cid,featureEventNote\(kind/);
  assert.match(reaction,/你发出的转账被收款/);
  assert.match(reaction,/你发出的转账被退还/);
  assert.match(reaction,/不能再输出 \[收款\] 或 \[拒收\] 标签/);
  assert.doesNotMatch(reaction,/msgs\([^)]*\)\.push\(\{role:'assistant'/,'transfer reactions must not manufacture a fixed role reply');
  assert.match(functionSource('transferReceiptEnsure'),/_transferReceipt:true/);
  assert.match(functionSource('transferReceiptEnsure'),/receiptOf:m\.id/);
  assert.match(functionSource('transferReceiptEnsure'),/rows\.find\([^)]*x\.receiptOf===m\.id\)/);
  assert.match(app,/mix\(m\.payState\);mix\(m\.receivedAt\);mix\(m\.refundedAt\);mix\(m\._transferReceipt\);mix\(m\.receiptOf\);mix\(m\.receiptAction\)/);
});

test('incoming receive and refund create one linked user receipt and one genuine contextual reaction',()=>{
  const makeContext=()=>{
    const transfer={id:'t1',role:'assistant',type:'transfer',amount:8.8,note:'给你买早餐',time:100};
    const rows=[transfer],replies=[];
    const context=vm.createContext({
      S:{me:{name:'North'}},
      transferMessageFind:(cid,mid)=>cid==='c1'&&mid==='t1'?{cid,m:transfer}:null,
      getC:()=>({id:'c1',name:'先生'}),
      msgs:()=>rows,
      addBill:()=>{},save:()=>{},render:()=>{},uid:()=>`u${rows.length}`,
      featureEventNote:(kind,detail)=>`EVENT:${kind}\n${detail}`,
      scheduleFeatureReply:(cid,note,delay)=>{replies.push({cid,note,delay});return true;}
    });
    vm.runInContext(`${functionSource('transferState')}\n${functionSource('transferCardCopy')}\n${functionSource('transferReceiptEnsure')}\n${functionSource('transferCounterpartyReaction')}\n${functionSource('transferDetailAction')}`,context);
    return{context,transfer,rows,replies};
  };

  const received=makeContext();
  received.context.transferDetailAction('c1','t1','receive');
  assert.equal(received.transfer.payState,'received');
  const receivedCards=received.rows.filter(m=>m.type==='transfer');
  assert.equal(receivedCards.length,2);
  assert.equal(received.context.transferCardCopy(receivedCards[0],false),'已被接收');
  assert.equal(received.context.transferCardCopy(receivedCards[1],true),'已收款');
  assert.equal(receivedCards[1].role,'user');
  assert.equal(receivedCards[1].receiptOf,'t1');
  assert.equal(received.replies.length,1);
  assert.match(received.replies[0].note,/EVENT:你发出的转账被收款/);
  assert.match(received.replies[0].note,/North刚在你之前转给ta的 ¥8\.80 转账详情页亲手点击了【收款】/);
  received.context.transferDetailAction('c1','t1','receive');
  assert.equal(received.rows.filter(m=>m.type==='transfer').length,2,'a settled card must not create a second receipt');
  assert.equal(received.replies.length,1,'a settled card must not generate a second reaction');

  const refunded=makeContext();
  refunded.context.transferDetailAction('c1','t1','refund');
  assert.equal(refunded.transfer.payState,'refunded');
  const refundedCards=refunded.rows.filter(m=>m.type==='transfer');
  assert.equal(refundedCards.length,2);
  assert.equal(refunded.context.transferCardCopy(refundedCards[0],false),'已被退还');
  assert.equal(refunded.context.transferCardCopy(refundedCards[1],true),'已退还');
  assert.equal(refundedCards[1].role,'user');
  assert.equal(refundedCards[1].receiptOf,'t1');
  assert.equal(refunded.replies.length,1);
  assert.match(refunded.replies[0].note,/EVENT:你发出的转账被退还/);
  assert.match(refunded.replies[0].note,/是ta退还你的转账，不是你退还ta的钱/);
  refunded.context.transferDetailAction('c1','t1','refund');
  assert.equal(refunded.rows.filter(m=>m.type==='transfer').length,2,'a refunded card must not create a second receipt');
  assert.equal(refunded.replies.length,1,'a refunded card must not generate a second reaction');
});

test('linked transfer receipts are authoritative facts, never reverse transfers',()=>{
  const context=vm.createContext({
    aboutMeNoteText:(x)=>String(x||''),
    quoteContextText:()=>'',
  });
  vm.runInContext(functionSource('msgToText'),context);
  const received=context.msgToText({role:'user',type:'transfer',amount:8.8,_transferReceipt:true,receiptAction:'receive',payState:'received'});
  assert.match(received,/你此前转给用户的 ¥8\.80 已被用户收下/);
  assert.match(received,/不是用户给你转账/);
  assert.doesNotMatch(received,/我给你转/);
  const refunded=context.msgToText({role:'user',type:'transfer',amount:8.8,_transferReceipt:true,receiptAction:'refund',payState:'refunded'});
  assert.match(refunded,/用户把你此前转给ta的 ¥8\.80 原路退还给你/);
  const guards=functionSource('featureEventReplyNeedsRepair');
  vm.runInContext(guards,context);
  assert.equal(context.featureEventReplyNeedsRepair('功能事件即时反应｜你发出的转账被收款','你怎么又给我转回来了'),true);
  assert.equal(context.featureEventReplyNeedsRepair('功能事件即时反应｜你发出的转账被收款','好，看到你收下了'),false);
});

test('outgoing receive and refund create the matching assistant-side receipt without a second settlement',()=>{
  const run=mode=>{
    const original={id:'out1',role:'user',type:'transfer',amount:5.2,time:100};
    const rows=[original];
    const context=vm.createContext({msgs:()=>rows,uid:()=>`r${rows.length}`});
    vm.runInContext(`${functionSource('transferState')}\n${functionSource('transferCardCopy')}\n${functionSource('transferReceiptEnsure')}\n${functionSource('markTransfer')}`,context);
    const settled=context.markTransfer('c1',mode);
    return{context,original,rows,settled};
  };

  const received=run('collect');
  assert.equal(received.settled,received.original);
  assert.equal(received.rows.length,2);
  assert.equal(received.context.transferCardCopy(received.rows[0],true),'已被接收');
  assert.equal(received.context.transferCardCopy(received.rows[1],false),'已收款');
  assert.equal(received.rows[1].role,'assistant');
  assert.equal(received.rows[1].receiptOf,'out1');
  assert.equal(received.context.markTransfer('c1','collect'),null);
  assert.equal(received.rows.length,2);

  const refunded=run('reject');
  assert.equal(refunded.rows.length,2);
  assert.equal(refunded.context.transferCardCopy(refunded.rows[0],true),'已被退还');
  assert.equal(refunded.context.transferCardCopy(refunded.rows[1],false),'已退还');
  assert.equal(refunded.rows[1].role,'assistant');
  assert.equal(refunded.rows[1].receiptOf,'out1');
  assert.equal(refunded.context.markTransfer('c1','reject'),null);
  assert.equal(refunded.rows.length,2);
});

test('legacy duplicate collection and rejection cards stay hidden',()=>{
  const bubble=functionSource('bubbleRow');
  const actionStart=app.indexOf("mm=line.match(/^\\[收款");
  const actions=app.slice(actionStart,app.indexOf("mm=line.match(/^\\[收礼",actionStart));
  assert.match(bubble,/m\._silent\|\|m\.type==='tcollect'\|\|m\.type==='treject'/);
  assert.doesNotMatch(actions,/type:'tcollect'/);
  assert.doesNotMatch(actions,/type:'treject'/);
});

test('finished cards dim without losing black and white theme support',()=>{
  const actionSource=functionSource('transferDetailAction');
  assert.match(css,/\.wx-transfer-card\.state-received/);
  assert.match(css,/\.wx-transfer-card\.state-refunded/);
  assert.match(css,/\.wx-transfer-main\{min-height:68px/);
  assert.match(css,/\.wx-transfer-detail-icon\{width:56px;height:56px/);
  assert.match(css,/\.wx-transfer-detail\{height:calc\(100vh - 58px\);min-height:calc\(100vh - 58px\)/);
  assert.match(css,/\.page:has\(>\.wx-transfer-detail-nav\)\{display:flex;flex-direction:column\}/);
  assert.match(css,/\.page:has\(>\.wx-transfer-detail-nav\)>\.wx-transfer-detail\{flex:1 1 auto;height:auto;min-height:0\}/);
  assert.match(app,/M35 18H17/);
  assert.match(app,/M28\.5 18\.5 20 25l8\.5 6\.5/);
  assert.match(functionSource('transferGlyph'),/translate\(-1 -1\)/);
  assert.match(functionSource('transferGlyph'),/translate\(-1\.5 -1\)/);
  assert.match(functionSource('transferDetailGlyph'),/M25 13v13l9 7/);
  assert.doesNotMatch(actionSource,/toast\(/);
  assert.match(css,/--wx-transfer-bg:#9b692b/);
  assert.match(css,/\.wxlight \.wx-transfer-detail/);
});
