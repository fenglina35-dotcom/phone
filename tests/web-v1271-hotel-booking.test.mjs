import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const privateApp=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','PhoneWeb.bundle','app.js'),'utf8');

function functionSource(name){
  const start=app.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  let depth=0,quote='',escape=false,seen=false;
  for(let i=start;i<app.length;i++){
    const ch=app[i];
    if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{'){depth++;seen=true;}else if(ch==='}'&&seen&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

test('web Cloud Journey owns hotel search, orders, and role booking actions',()=>{
  assert.match(functionSource('tvInit'),/t\.hotels=t\.hotels\|\|\[\]/);
  assert.match(functionSource('renderTravel'),/\['hotels','酒店'\]/);
  assert.match(app,/function tvHotelView\(/);
  assert.match(app,/function tvHotelBook\(/);
  assert.match(app,/function tvCharHotelBook\(/);
  assert.match(app,/\[订酒店\|城市\|入住日期\|晚数\|星级\|房型\|入住方式\]/);
});

test('hotel chat card stays boarding-pass sized and opens full details',()=>{
  const card=functionSource('tvHotelCardHTML');
  assert.match(card,/width:260px/);
  assert.match(card,/tvHotelDetail\('/);
  assert.match(card,/查看详情/);
  assert.doesNotMatch(card,/礼遇|BOOKED BY|已支付/);
  const detail=functionSource('tvHotelDetail');
  assert.match(detail,/预订人/);
  assert.match(detail,/订单金额/);
  assert.match(detail,/入住人/);
});

test('hotel privacy exposes participant orders and phone-inspection orders at different scopes',()=>{
  const own=functionSource('tvHotelVisibleToRole');
  assert.match(own,/h\.cid===cid/);
  assert.match(functionSource('spyAppView'),/tvHotelVisibleToRole/);
  assert.match(functionSource('remoteControlViewableSnapshot'),/hotelStays/);
  assert.match(functionSource('remoteControlViewFact'),/hotelStays/);
  assert.match(functionSource('spyFocusData'),/travelHotelDiscoveryLine/);
});

test('hotel cards become role-readable chat context without entering private iOS source',()=>{
  assert.match(functionSource('msgToText'),/case 'hotel'/);
  assert.match(functionSource('buildPart'),/m\.type==='hotel'/);
  assert.match(functionSource('buildSystem'),/你参与的云程酒店订单/);
  assert.doesNotMatch(privateApp,/function tvHotelBook\(/);
});

test('user hotel booking persists one paid order and only notifies a participating role',()=>{
  const role={id:'north',name:'North'},sent=[];
  const S={me:{name:'我',balance:99999},travel:{hotels:[],hotelSearch:{results:['云庭臻选酒店'],city:'上海',stars:5,roomType:'double',checkIn:'2026-09-22',nights:2,guestMode:'together',cid:'north'}}};
  const context=vm.createContext({S,getC:id=>id==='north'?role:null,tvInit:()=>S.travel,tvHotelPrice:()=>2680,toast:()=>{},addBill:(kind,price,note)=>sent.push({kind,price,note}),uid:()=> 'hotel-1',tvHotelNo:()=> 'YH00000001',Date,save:()=>{},tvHotelSendCard:h=>sent.push({hotel:h}),render:()=>{}});
  vm.runInContext(functionSource('tvHotelBook')+';tvHotelBook(0);',context);
  assert.equal(S.travel.hotels.length,1);
  assert.equal(S.travel.hotels[0].guestMode,'together');
  assert.equal(S.travel.hotels[0].price,2680);
  assert.equal(sent.filter(x=>x.hotel).length,1);
  assert.equal(sent.filter(x=>x.kind==='out').length,1);
});

test('role hotel booking creates an assistant card and keeps unrelated roles outside participant scope',()=>{
  const north={id:'north',name:'North',wallet:5000},other={id:'other',name:'Other'},messages=[];
  const S={me:{name:'我'},travel:{hotels:[]}};
  const context=vm.createContext({S,tvInit:()=>S.travel,tvNormDate:x=>x,tvHotelNames:()=>['云庭臻选酒店'],tvHotelPrice:()=>1800,tvHotelNo:()=> 'YH2',uid:(()=>{let i=0;return()=>String(++i)})(),msgs:()=>messages,save:()=>{},cur:()=>({p:'home'}),render:()=>{},toast:()=>{},Date,getC:id=>id==='north'?north:id==='other'?other:null});
  vm.runInContext(functionSource('tvHotelRoomText')+';'+functionSource('tvCharHotelBook')+';'+functionSource('tvHotelVisibleToRole')+';globalThis.ok=tvCharHotelBook(argumentsRole,"上海","2026-09-22",2,5,"双人间","我们一起");globalThis.own=tvHotelVisibleToRole(S.travel.hotels[0],"north");globalThis.other=tvHotelVisibleToRole(S.travel.hotels[0],"other");',Object.assign(context,{argumentsRole:north}));
  assert.equal(context.ok,true);
  assert.equal(messages[0].type,'hotel');
  assert.equal(messages[0].role,'assistant');
  assert.equal(context.own,true);
  assert.equal(context.other,false);
});
