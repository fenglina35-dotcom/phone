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
  assert.equal(context.transferCardCopy({received:true},false),'已收款');
  assert.equal(context.transferCardCopy({payState:'received'},true),'已被接收');
  assert.equal(context.transferCardCopy({refunded:true},false),'已退还');
  assert.equal(context.transferCardCopy({declined:true},true),'已被退还');
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
  assert.match(detail,/转账时间/);
  assert.match(detail,/收款时间/);
  assert.match(detail,/退款时间/);
  assert.match(detail,/1天内未确认，将退还给对方。/);
  assert.match(detail,/>收款<\/button>/);
  assert.match(detail,/>退还<\/button>/);
  assert.match(action,/m\.receivedAt=now/);
  assert.match(action,/m\.refundedAt=now/);
  assert.match(action,/m\._walletSettled=true;[^}]*addBill/);
  assert.match(app,/mix\(m\.payState\);mix\(m\.receivedAt\);mix\(m\.refundedAt\)/);
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
  assert.match(functionSource('transferDetailGlyph'),/M25 13v13l9 7/);
  assert.doesNotMatch(actionSource,/toast\(/);
  assert.match(css,/--wx-transfer-bg:#9b692b/);
  assert.match(css,/\.wxlight \.wx-transfer-detail/);
});
