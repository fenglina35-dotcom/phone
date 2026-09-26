import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const rootSource=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const privateSource=readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');

function functionSource(source,name){
  const marker=`function ${name}(`,found=source.indexOf(marker);
  assert.ok(found>=0,`missing ${name}`);
  const brace=source.indexOf('{',found);let depth=0,quote='',escape=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(found,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

function runtime(source){
  const context={TAGWORDS:'(?:记住|内心|行程|账单|转账|改头像|改名|通知|发语音|换发型|换衣服|点外卖|真实外卖|代付|改卡片|加餐|购物|买东西)'};vm.createContext(context);
  for(const name of ['deliveryActionSource','deliveryStructuredActionTags','deliveryIsolateStructuredActions','deliveryReplaceStructuredActions','normTag'])vm.runInContext(functionSource(source,name),context);
  return context;
}

for(const [label,source] of [['web',rootSource],['private',privateSource]]){
  test(`${label} consumes a KFC action whose product title contains Chinese brackets`,()=>{
    const ctx=runtime(source),body='用户明确；门店=肯德基；商品=【夜宵专享】吃堡堡4件套；规格=主食选香辣鸡腿汉堡(辣)、小食1选香辣鸡翅(2块装)、小食2选薯条(中)、饮料选百事可乐(冷/中)',tag=`[真实外卖|${body}]`;
    const found=ctx.deliveryStructuredActionTags(tag);
    assert.equal(found.length,1);
    assert.equal(found[0].body,body);
    assert.equal(ctx.deliveryIsolateStructuredActions(`好。${tag}继续说话。`),`好。\n${tag}\n继续说话。`);
    let consumed='';
    assert.equal(ctx.deliveryReplaceStructuredActions(`开始\n${tag}\n结束`,action=>{consumed=action.body;return '';}),'开始\n\n结束');
    assert.equal(consumed,body);
  });

  test(`${label} normalizes a full-width outer action without truncating its nested title`,()=>{
    const ctx=runtime(source),line='【真实外卖｜用户明确；门店=肯德基；商品=【夜宵专享】吃堡堡4件套；规格=饮料选九珍果汁饮料(冷)】';
    assert.equal(ctx.normTag(line),'[真实外卖|用户明确；门店=肯德基；商品=【夜宵专享】吃堡堡4件套；规格=饮料选九珍果汁饮料(冷)]');
  });
}

test('malformed real-delivery controls are filtered instead of rendered as role chat',()=>{
  assert.match(rootSource,/if\(_realDeliveryTag\)\{_replyAuditPartial=true;continue;\}/);
  assert.match(privateSource,/if\(_realDeliveryTag\)\{_replyAuditPartial=true;continue;\}/);
});
