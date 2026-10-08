import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
 const src=fs.readFileSync(file,'utf8');
 const pick=name=>src.match(new RegExp('(?:async )?function '+name+'\\([^\\n]+'))[0];
 test(file+' v1658 the reply after a shop lookup retries once with flattened messages instead of stopping on a 500',async()=>{
  const calls=[];const ctx={wechatPrimaryReply:async ms=>{calls.push(ms);if(calls.length===1){const e=Error('HTTP 500');e.status=500;throw e;}return '好，给你点。[点外卖|可爱甜心蛋糕|68|凌逾甜点|4寸|不适用|1]';},wechatAuxConfigured:()=>false,roleVisibleEnvelopeText:x=>x,modelUnfilteredText:x=>x,chatAPI:async()=>''};
  vm.createContext(ctx);vm.runInContext(pick('northShopFlatMessages')+'\n'+pick('northShopPostQueryReply'),ctx);
  const msgs=[{role:'system',content:'人设'},{role:'user',content:'想吃可爱甜心'},{role:'assistant',content:'[查店铺|凌逾甜点]'},{role:'system',content:'菜单……'},{role:'system',content:'提醒'}];
  const out=await ctx.northShopPostQueryReply(msgs,{},{},{id:'c'});
  assert.match(out,/点外卖/);assert.equal(calls.length,2);
  const flat=calls[1];assert.equal(flat[0].role,'system');assert.ok(flat.slice(1).every(m=>m.role!=='system'),'中途的系统消息改成普通消息');
  for(let i=2;i<flat.length;i++)assert.notEqual(flat[i].role,flat[i-1].role,'相邻同角色已合并');
  assert.match(flat.at(-1).content,/菜单……[\s\S]*提醒/);
 });
}
