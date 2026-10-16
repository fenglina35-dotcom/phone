/* 角色自己订的票（机票/火车/演唱会/打车，消息 type:'ticket'、role:'assistant'）在交给角色的聊天记录里曾是空文字：
   msgToText 的角色分支没有 ticket，直接 return m.content||''（卡片没有 content）。订票指令又会被从角色原话里删掉，
   于是角色只看到自己说「我先试试帮你订」，看不到订成功，几轮后就说自己没订过（2026-10-16 实机，苏州→西安 10-18）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fnSource(src,name){const start=src.indexOf('function '+name+'(');assert.ok(start>=0,'missing '+name);const brace=src.indexOf('{',start);let depth=0,quote='',esc=false;
  for(let i=brace;i<src.length;i++){const ch=src[i];if(quote){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch===quote)quote='';continue;}if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return src.slice(start,i+1);}throw new Error('unterminated '+name);}
function run(file){
  const ctx=vm.createContext({S:{me:{name:'North'}},TV_CLS:[{k:'economy',t:'经济舱'}],tvMD:d=>d,
    NorthFlightBooking:{summary:tr=>'模拟机票 苏州→西安 · 2026-10-18 09:00—10:40 · 经济舱 · 同行：North · Claude付款 ¥1130.00 · 预订成功'},
    NorthTrainBooking:{summary:()=>'模拟火车票 预订成功'},NorthConcertBooking:{summary:()=>'模拟演唱会 预订成功'},NorthTravelTaxi:{summary:()=>'模拟打车 已下单'}});
  vm.runInContext(fnSource(read(file),'msgToText'),ctx);return ctx.msgToText;}

for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
  test(file+': cards the role sent itself (tickets, real-shop food, pay results, dice, music) are readable in its own history',()=>{
    const msgToText=run(file);
    const flight=msgToText({role:'assistant',type:'ticket',trip:{id:'o1',flightV2:true}});
    assert.match(flight,/苏州→西安/,'the role sees what it booked');assert.match(flight,/2026-10-18/);assert.match(flight,/预订成功/);
    for(const [trip,want] of [[{railV2:true},/火车票/],[{concertV2:true},/演唱会/],[{taxiV2:true},/打车/]])assert.match(msgToText({role:'assistant',type:'ticket',trip}),want);
    assert.equal(msgToText({role:'user',type:'ticket',trip:{id:'o1',flightV2:true}}),'模拟机票 苏州→西安 · 2026-10-18 09:00—10:40 · 经济舱 · 同行：North · Claude付款 ¥1130.00 · 预订成功','user-side tickets unchanged');
    assert.equal(msgToText({role:'assistant',type:'text',content:'我先试试帮你订18号的'}),'我先试试帮你订18号的','ordinary role text unchanged');
    // 同样曾是空白的角色卡片：真人店铺外卖、代付成功/拒绝、骰子、一起听歌
    assert.match(msgToText({role:'assistant',type:'marketfood',shop:'小面馆',name:'牛肉面',price:28,marketFood:{order:{discount:0},resultText:'已下单'}}),/小面馆.*牛肉面/);
    assert.match(msgToText({role:'assistant',type:'paid',name:'奶茶',price:18}),/我帮你代付成功了：奶茶/);
    assert.match(msgToText({role:'assistant',type:'payreject',name:'奶茶',price:18}),/我拒绝了帮你代付：奶茶/);
    assert.match(msgToText({role:'assistant',type:'dice',value:5}),/点数是5/);
    assert.match(msgToText({role:'assistant',type:'musicinvite',title:'晴天',artist:''}),/我邀请你一起听歌：晴天/);
    assert.match(msgToText({role:'user',type:'musicinvite',title:'晴天',artist:''}),/North邀请你一起听歌/,'user-side invite unchanged');
  });
}
