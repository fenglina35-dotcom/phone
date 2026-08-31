import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const privateApp=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');
const delivery=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const privateDelivery=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/delivery.js',import.meta.url),'utf8');

function functionSource(source,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match,`missing ${name}`);
  const start=match.index,open=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=open;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(escaped)escaped=false;
      else if(ch==='\\\\')escaped=true;
      else if(ch===quote)quote='';
      continue;
    }
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

function text(value,length=300){return String(value==null?'':value).trim().slice(0,length);}

{
  const sandbox=vm.createContext({
    replyPendingUserText:()=>'· 茶百道的杨枝甘露不加糖\n· ！',
    String,
  });
  vm.runInContext(`${functionSource(app,'deliveryPendingUserTurnText')};this.combine=deliveryPendingUserTurnText;`,sandbox);
  assert.equal(sandbox.combine('role-1','main','！'),'茶百道的杨枝甘露不加糖','punctuation-only follow-ups must not replace the actionable request');
}

{
  const sandbox=vm.createContext({
    replyPendingUserText:()=>'· 茶百道的杨枝甘露\n· 不加糖',
    String,
  });
  vm.runInContext(`${functionSource(app,'deliveryPendingUserTurnText')};this.combine=deliveryPendingUserTurnText;`,sandbox);
  assert.equal(sandbox.combine('role-1','main','不加糖'),'茶百道的杨枝甘露，不加糖','a separate specification message must stay in the same pending turn');
}

{
  const sandbox=vm.createContext({text});
  const names=['deliveryMatchKey','deliveryOrderContextRejected','splitTrailingDeliverySpecs','contextualNaturalOrderIntent','explicitOrderQuery'];
  vm.runInContext(`${names.map(name=>functionSource(delivery,name)).join('\n')};this.parse=contextualNaturalOrderIntent;this.query=explicitOrderQuery;`,sandbox);
  const exact=sandbox.parse('茶百道的杨枝甘露不加糖');
  assert.deepEqual(JSON.parse(JSON.stringify(exact)),{
    merchant:'茶百道',items:['杨枝甘露'],specs:['不加糖'],proactive:false,summary:'茶百道 / 杨枝甘露'
  });
  assert.equal(sandbox.query(exact),'用户明确；门店=茶百道；商品=杨枝甘露；规格=不加糖');
  const separate=sandbox.parse('茶百道的杨枝甘露，不加糖');
  assert.equal(separate?.merchant,'茶百道');
  assert.deepEqual(Array.from(separate?.items||[]),['杨枝甘露']);
  assert.deepEqual(Array.from(separate?.specs||[]),['不加糖']);
}

assert.match(app,/_deliveryPendingUserText=deliveryPendingUserTurnText\(id,replyAccount,_userText\)/);
assert.match(app,/deliveryTryExplicitApprovalFallback\(id,_deliveryPendingUserText,content,_deliveryActionMeta\)/);
assert.match(app,/deliveryHandleRoleRequest\(id,\(mm\[1\]\|\|''\)\.trim\(\),_deliveryActionMeta\)/);
assert.match(delivery,/userText:text\(meta\.userText,800\)/);
assert.equal(functionSource(privateApp,'deliveryPendingUserTurnText'),functionSource(app,'deliveryPendingUserTurnText'));
assert.equal(privateDelivery,delivery,'web and private delivery runtimes must stay identical');

console.log('real delivery consecutive user-turn tests passed');
