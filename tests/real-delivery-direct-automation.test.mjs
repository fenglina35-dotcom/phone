import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
function functionSource(name){
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch.charCodeAt(0)===96){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

const context=vm.createContext({
  String,Number,Math,Array,Object,RegExp,Promise,
  normalizeSelectedOptions:(_offer,selected)=>selected,
});
for(const name of [
  'text','roleOrderIntent','deliveryMatchKey','deliveryBigrams','deliveryMatchScore',
  'chooseOffer','deliveryRequirementText','deliverySpecificationText','deliveryExcluded','deliveryChoiceMentionScore',
  'explicitToppings','deliverySemanticChoice','chooseOptions','rolePreludeAllowed',
])vm.runInContext(functionSource(name),context);

assert.equal(context.rolePreludeAllowed('等我一下，我给你找找。'),true,'a persona-generated preparation line must remain visible');
assert.equal(context.rolePreludeAllowed('我去看看今天还有没有。'),true,'a natural role opening must remain visible');
assert.equal(context.rolePreludeAllowed('已经替你下单付款了。'),false,'premature commerce claims must never be shown as an opening line');

const offers=[
  {offerId:'wrong',merchant:'手工拉面',name:'牛肉饼',description:''},
  {offerId:'right',merchant:'曼玲粥（活力岛店）',name:'燕麦牛奶粥',description:''},
];
const chosen=await context.chooseOffer({},'用户明确；门店=曼玲粥；商品=燕麦牛奶粥',offers,{userMessages:[]});
assert.equal(chosen.offerId,'right','automation must rank all candidates and choose the matching merchant/product');

const offer={optionGroups:[
  {id:'portion',name:'份量',required:true,multiple:false,selectionCount:1,choices:[
    {id:'one',label:'1人份',selected:true},{id:'two',label:'2人份',selected:false},
  ]},
  {id:'sugar',name:'糖度',required:true,multiple:false,selectionCount:1,choices:[
    {id:'normal',label:'正常糖',selected:false},{id:'none',label:'不额外加糖',selected:true},
  ]},
]};
let choice=await context.chooseOptions({},'用户明确；门店=茶百道；商品=茉莉奶绿；规格=不加糖',offer,{userMessages:['茉莉奶绿，不加糖']});
assert.deepEqual({...choice.selectedOptions},{portion:'one',sugar:'none'});
assert.equal(choice.quantity,1);

choice=await context.chooseOptions({},'用户明确；门店=曼玲粥；商品=燕麦牛奶粥',offer,{userMessages:['燕麦牛奶粥']});
assert.deepEqual({...choice.selectedOptions},{portion:'one',sugar:'none'},'unspecified specs must preserve platform-selected defaults');

const yogurt={name:'草莓桃儿白糯米酸奶奶昔',optionGroups:[{id:'rice',name:'糯米选择',required:true,multiple:false,selectionCount:1,choices:[
  {id:'standard',label:'经典黑糯米',selected:true},
  {id:'white',label:'现蒸白糯米',selected:false},
]}]};
choice=await context.chooseOptions({},'用户明确；门店=李若桃；商品=草莓桃儿白糯米酸奶奶昔',yogurt,{userMessages:['我想喝李若桃家的：草莓桃儿白糯米酸奶奶昔']});
assert.equal(choice.selectedOptions.rice,'standard','words inside the product title must not invent a separate hard specification');
choice=await context.chooseOptions({},'用户明确；门店=李若桃；商品=草莓桃儿白糯米酸奶奶昔；规格=现蒸白糯米',yogurt,{userMessages:['要现蒸白糯米']});
assert.equal(choice.selectedOptions.rice,'white','an explicitly requested specification must still select the matching real choice');

assert.throws(
  ()=>context.chooseOptions({},'用户明确；门店=茶百道；商品=茉莉奶绿；规格=七分糖',offer,{userMessages:['七分糖']}),
  /没有本次明确要求.*现有选项/,
  'an unavailable explicit spec must block instead of silently taking another option',
);

const bundle={optionGroups:[{id:'main',name:'主食',required:true,multiple:false,selectionCount:1,choices:[
  {id:'spicy',label:'香辣鸡腿汉堡（辣）',selected:false},
  {id:'crispy',label:'劲脆鸡腿汉堡',selected:true},
]}]};
choice=await context.chooseOptions({},'用户明确；门店=肯德基；商品=招牌汉堡4件套；规格=脆鸡腿堡',bundle,{userMessages:['要脆鸡腿堡']});
assert.equal(choice.selectedOptions.main,'crispy','short product names must match the closest real bundle choice');

console.log('real delivery direct automation tests passed');
