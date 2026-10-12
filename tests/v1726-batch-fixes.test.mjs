import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const PRIV='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const web=fs.readFileSync('app.js','utf8'),priv=fs.readFileSync(PRIV+'app.js','utf8'),commerce=fs.readFileSync('commerce-ui.js','utf8');

test('v1726 role takeout falls back to a real cheapest menu item when the selection model fails',()=>{
  assert.equal(commerce,fs.readFileSync(PRIV+'commerce-ui.js','utf8'),'网页与私人同一份');
  const src=commerce.slice(commerce.indexOf('function northRoleFallbackPick'),commerce.indexOf('function northRoleFailureReceipt'));
  const ctx={};vm.createContext(ctx);
  vm.runInContext('function northRoleProductText(p){return (p.name+" "+(p.description||"")).toLowerCase().replace(/\\s+/g,"");}'+src+';this.pick=northRoleFallbackPick;',ctx);
  const found={shops:[{id:'s1',products:[
    {id:'a',name:'皮蛋瘦肉粥',price:900,available:true,soldOut:false,stock:5,specGroups:[{id:'g',required:true,mode:'single',options:[{id:'big',price:300},{id:'small',price:0}]}]},
    {id:'b',name:'白粥',price:500,available:true,soldOut:true,stock:5},
    {id:'c',name:'肉夹馍',price:700,available:true,soldOut:false,stock:0}]}]};
  const pick=JSON.parse(ctx.pick(found,{must:['粥'],quantity:1}));
  assert.equal(pick.primaryId,'a');assert.deepEqual(JSON.parse(JSON.stringify(pick.lines[0].selections)),{g:['small']},'必选组没有默认就用最便宜的');
  assert.equal(ctx.pick(found,{must:['蛋糕']}),null,'没有符合的就不乱点');
  assert.match(commerce,/catch\(selectModelError\)\{selection=northRoleFallbackPick\(found,plan\);if\(!selection\)throw selectModelError;\}/);
  assert.match(commerce,/intent\.stage='quote';var quote=await northMarketRpc\('quote'/,'兜底方案照样要报价和付款前校验');
});

test('v1726 a failed role order is not retried every turn unless she asks again',()=>{
  for(const s of [web,priv]){
    assert.match(s,/if\(mm&&roleOrderCoolingDown\(id,_userText\)\)\{_replyAuditPartial=true;continue;\}/);
    const fn=s.slice(s.indexOf('function roleOrderCoolingDown'),s.indexOf('function roleBackgroundShouldHandOff'));
    const now=Date.now(),list=[{_northOrderFailure:true,time:now-60000}],ctx={msgs:()=>list,Date};vm.createContext(ctx);vm.runInContext(fn+';this.f=roleOrderCoolingDown;',ctx);
    assert.equal(ctx.f('x','嗯嗯好'),true);assert.equal(ctx.f('x','再帮我点个外卖'),false);
    list[0].time=now-1300000;assert.equal(ctx.f('x','嗯嗯好'),false,'20分钟后恢复');
  }
});

test('v1726 roleplay reply button binds to the round on screen; cinema header; trip-day notice',()=>{
  for(const s of [web,priv]){
    assert.match(s,/function renderRP\(id\)\{const c=getC\(id\);if\(!c\)return '';[\s\S]{0,300}if\(!_rp\|\|_rp\.id!==id\)_rp=\{id:id,busy:false\};/);
    assert.match(s,/Date\.now\(\)-\(\+_rp\.busyAt\|\|0\)>180000/);
    assert.doesNotMatch(s,/cin-nav"><button onclick="back\(\)">'\+calIcon\('back'\)\+'<\/button>/,'模板里不能出现字面 +calIcon');
    assert.match(s,/if\(tr&&\(tr\.flightV2\|\|tr\.railV2\)\)\{if\(tvV2DayNotice\(tr\)\)ch=true;return;\}/);
    assert.match(s,/function tvV2DayNotice\(tr\)/);
  }
});

test('v1726 stickers: keep scroll on delete, batch delete, localize link stickers, no-referrer',()=>{
  for(const s of [web,priv]){
    assert.match(s,/function stkPanelRerender\(\)/);assert.match(s,/function delSticker\(i\)\{S\.me\.stickers\.splice\(i,1\);save\(\);stkPanelRerender\(\);\}/);
    assert.match(s,/async function stkSelDelete\(\)/);assert.match(s,/onclick="stkSelToggle\(\)"/);
    assert.match(s,/async function stickerLocalize\(url\)/);assert.match(s,/referrerpolicy="no-referrer"/);
  }
});

test('v1726 glass: reload the wallpaper texture instead of freezing; spy waits for the stored wallpaper',()=>{
  assert.match(web,/if\(!_lg\.texs\.has\(wall\)\)\{if\(!_lgSwipeReload\)/);
  assert.match(web,/if\(!src&&sc\.spy\)\{if\(\(root\._lgWait=/);
});

test('v1726 only read-only shop requests retry once on network failure',()=>{
  assert.match(commerce,/var NORTH_MARKET_READ_RPC=\['list','shop'/);
  const list=commerce.match(/var NORTH_MARKET_READ_RPC=(\[[^\]]+\])/)[1];
  for(const w of ['role_checkout','checkout','save_shop','shop_delete','refund','claim'])assert.ok(!list.includes("'"+w+"'"),w);
});
