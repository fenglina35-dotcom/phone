const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.codex_tmp/travel-home');
const server=http.createServer((req,res)=>{const f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\//,''));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg'}[path.extname(f)]||'application/octet-stream'));res.end(fs.readFileSync(f));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),reports=[];
try{for(const priv of [false,true]){const label=priv?'private':'web',p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());if(priv)await p.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false})};});
await p.goto(origin+(priv?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');await p.waitForFunction(()=>window.__northBootReady);

const result=await p.evaluate(async()=>{
 S.me.locked=false;document.getElementById('gate')?.remove();localStorage.setItem('yibei_unlocked',String(SHARE_EPOCH));renderLockScreen();S.settings.sound=false;S.contacts.forEach(c=>c.proactive={enabled:false});const c=S.contacts[0];c.deleted=false;c.blocked=false;c.isPhoneFriend=false;S.spy=S.spy||{};S.spy[c.id]={balance:0,wallet:[]};S.me.balance=10000;tvInit();
 const original='999999999999999999999999.00',report=[];
 for(const source of ['roleWallet','roleBank']){
  const reset=()=>{if(source==='roleWallet'){c.wallet=original;S.spy[c.id].balance=3;}else{delete c.wallet;S.spy[c.id].balance=original;}};
  const amount=()=>source==='roleWallet'?c.wallet:S.spy[c.id].balance;
  const verify=async(kind,book,order,refund)=>{reset();if(!book())throw Error(kind+' book failed');const o=order();if(!o||amount()===original)throw Error(kind+' no debit');if(S.me.balance!==10000)throw Error('user charged');await refund(o);if(amount()!==original)throw Error(kind+' refund not exact: '+amount());report.push(kind+':'+source);};
  await verify('flight',()=>NorthFlightBooking.roleDirect(c,'北京','上海','2099-10-05','经济舱','我们一起'),()=>tvInit().trips.filter(o=>o.flightV2).at(-1),o=>NorthFlightBooking.refund(o.id));
  await verify('train',()=>NorthTrainBooking.roleDirect(c,'北京','上海','2099-10-05','二等座','我们一起'),()=>tvInit().trips.filter(o=>o.railV2).at(-1),o=>NorthTrainBooking.refund(o.id));
  await verify('concert',()=>NorthConcertBooking.roleDirect(c,'王俊凯','上海','2099-10-05','19:30','内场','我们一起'),()=>tvInit().concertOrders.at(-1),o=>NorthConcertBooking.refund(o.id));
  await verify('hotel',()=>tvCharHotelBook(c,'上海','2099-10-05',1,4,'双人间','我们一起','全季',1,2,0),()=>tvInit().hotels.at(-1),o=>tvHotelCancel(o.id,{direct:true}));
  await verify('ticket',()=>NorthTravelOrders.roleBook(c,'上海迪士尼度假区','2099-10-05','07:00','17:00','我们一起'),()=>tvInit().ticketOrders.at(-1),o=>{NorthTravelOrders.roleRefund(o);o.status='refunded';o.refundedAt=Date.now();});
  reset();const q={accountId:actId(),from:'上海家门口',to:'上海虹桥站',coords:null,locationAt:Date.now(),mode:'together',roleIds:[c.id],helperId:'',distance:8,ts:Date.now()};if(!NorthTravelTaxi.book(q,'express',c))throw Error('taxi book');const o=tvInit().taxiOrders.at(-1);if(amount()===original)throw Error('taxi no debit');const oldNow=Date.now;try{Date.now=()=>o.arriveAt+1800000;NorthTravelTaxi.tick();}finally{Date.now=oldNow;}if(amount()!==original)throw Error('taxi refund');report.push('taxi:'+source);
 }
 return {orders:report,userBalance:S.me.balance};
});
assert.equal(result.orders.length,12);assert.equal(result.userBalance,10000);assert.deepEqual(errors,[]);reports.push({runtime:label,...result,pageErrors:errors});await p.close();}
console.log(JSON.stringify(reports));}finally{await b.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
