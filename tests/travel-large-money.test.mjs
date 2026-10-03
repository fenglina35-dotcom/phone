import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
for(const base of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']){
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(base+'travel-hotel-data.js','utf8'),ctx);const api=ctx.NorthHotelData;
 test(base+'large decimal and scientific balances debit and refund exactly',()=>{for(const start of ['999999999999999999999999.00',1e30,'1e100']){const paid=api.moneyNext(start,-39900);assert.notEqual(paid,null);assert.equal(api.moneyCents(api.moneyNext(paid,39900)),api.moneyCents(start));assert.equal(api.moneyCents(start)-api.moneyCents(paid),39900n);assert.doesNotThrow(()=>JSON.stringify({balance:paid}));}});
 test(base+'invalid balances and genuine insufficient funds never debit',()=>{for(const x of [null,undefined,Infinity,NaN,'NaN','Infinity','-10','junk','9'.repeat(401)])assert.equal(api.moneyNext(x,-100),null);assert.equal(api.moneyNext(1,-101),null);assert.equal(api.moneyNext(0,0),0);assert.equal(api.moneyNext('100.05',-1),100.04);assert.equal(api.moneyNext('1.005',0),1.01);});
}
