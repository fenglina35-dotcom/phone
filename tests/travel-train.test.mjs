import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(){
  let id=0;
  const S={me:{name:'我',balance:10000},contacts:[{id:'r',name:'同行角色',wallet:10000}],travel:{trips:[]},spy:{r:{balance:10000,wallet:[]}}};
  const ctx=vm.createContext({S,actId:()=> 'main',todayStr:()=> '2026-10-04',uid:()=> 'rail-'+(++id),tvInit:()=>S.travel,save(){},toast(){},esc:String,getC:id=>S.contacts.find(c=>c.id===id),tvHotelRoleMoney:c=>({balance:c.wallet,source:'roleWallet'}),cur:()=>({p:'travel'}),render(){},msgs:()=>[],document:{querySelector:()=>null},NorthTravelTrain:{cityFallback:n=>({n,r:['纽约','洛杉矶'].includes(n)?'美国':'中国'}),state:()=>({}),active:()=>false}});
  vm.runInContext(fs.readFileSync(new URL('../travel-hotel-data.js',import.meta.url),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(new URL('../travel-train-booking.js',import.meta.url),'utf8'),ctx);
  const q={account:'main',id:'query',type:'one',cls:'second',adults:2,children:1,infants:1,people:[{id:'me',name:'我'},{id:'role:r',name:'同行角色'}],legs:[{from:'北京',to:'上海',date:'2099-10-05'}],selectedLeg:0};
  return {api:ctx.NorthTrainBooking,S,q};
}

test('rail fares include all adults and half-price children; infants without seats are free',()=>{const {api,q}=fixture();const f=api.trains(q)[0];assert.equal(f.totalCents,f.adultCents*2+Math.round(f.adultCents*.5));});
test('rail routes never synthesize cross-ocean trains; foreign domestic simulation remains available',()=>{const {api,q}=fixture();q.legs[0].to='纽约';assert.notEqual(api.validate(q),'');assert.equal(api.trains(q).length,0);q.legs[0].from='洛杉矶';assert.equal(api.validate(q),'');assert.equal(api.trains(q).length,6);});
test('invalid calendar dates and duplicate participants cannot charge',()=>{const {api,q,S}=fixture();q.legs[0].date='2099-02-30';assert(api.validate(q));q.legs[0].date='2099-10-05';q.people.push(q.people[1]);assert(api.validate(q));assert.equal(S.me.balance,10000);});
test('repeat booking and refunds are idempotent, and role funds never mix with user wallet',()=>{const {api,q,S}=fixture();const f=api.trains(q)[0];assert.equal(api.bookQuote(q,f.id,S.contacts[0]),true);const paid=S.contacts[0].wallet;assert.equal(S.me.balance,10000);assert.equal(api.bookQuote(q,f.id,S.contacts[0]),true);assert.equal(S.contacts[0].wallet,paid);assert.equal(S.travel.trips.length,1);const o=S.travel.trips[0];assert.equal(o.railV2,true);assert.equal(o.flightV2,undefined);assert.equal(api.refund(o.id),true);assert.equal(S.contacts[0].wallet,10000);assert.equal(api.refund(o.id),false);});
test('refund hides exactly after 24 hours and overnight trips remain until arrival',()=>{const {api}=fixture();const o={accountId:'main',date:'2099-10-05',arriveAt:+new Date('2099-10-06T02:00:00'),status:'upcoming'};assert(api.visible(o,o.arriveAt-1));assert.equal(api.visible(o,o.arriveAt),false);o.status='cancelled';o.refundedAt=1000;assert(api.visible(o,86400999));assert.equal(api.visible(o,86401000),false);});
test('rail lookup rejects a flight record even if its id is provided',()=>{const {api,S}=fixture();S.travel.trips.push({id:'flight-only',accountId:'main',flightV2:true});assert.equal(api.current('flight-only'),undefined);assert.equal(api.rows().length,0);});

test("large role wallet is not mistaken for insufficient funds and refunds exactly",()=>{const {api,q,S}=fixture();S.contacts[0].wallet='999999999999999999999999.00';const f=api.trains(q)[0];assert.equal(api.bookQuote(q,f.id,S.contacts[0]),true);assert.notEqual(S.contacts[0].wallet,'999999999999999999999999.00');assert.equal(S.me.balance,10000);assert(api.refund(S.travel.trips[0].id));assert.equal(S.contacts[0].wallet,'999999999999999999999999.00');});
