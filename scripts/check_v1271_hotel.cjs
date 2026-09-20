const {chromium}=require('playwright');
const http=require('http');
const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');

const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const file=path.join(root,pathname==='/'?'小手机.html':pathname.slice(1));
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try{
    const page=await browser.newPage({viewport:{width:402,height:874}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(origin+'/小手机.html?northPreview=black-home');
    await page.waitForFunction(()=>window.__northBootReady===true);
    const data=await page.evaluate(()=>{
      S.me.locked=false;S.me.balance=99999;
      let c=S.contacts.find(x=>!x.deleted);
      if(!c){c={id:uid(),name:'North',remark:'North',persona:'冷静',wallet:99999};S.contacts.push(c);}
      scheduleReply=()=>{};
      const t=tvInit();t.hotels=[];t.hotelSearch={city:'上海',checkIn:'2026-09-22',nights:2,stars:5,roomType:'double',guestMode:'together',cid:c.id,results:null};
      _tvTab='hotels';go('travel');tvHotelSearch();tvHotelBook(0);openChat(c.id);
      const h=t.hotels[0];
      return {hotel:h,participant:tvHotelVisibleToRole(h,c.id),unrelated:tvHotelVisibleToRole(h,'unrelated'),systemHas:buildSystem(c).includes('你参与的云程酒店订单'),spyHas:spyAppView(c.id,c,'trips').includes(h.hotelName),remoteHas:remoteControlViewableSnapshot(c.id).hotelStays.some(x=>x.includes(h.hotelName)),messageType:msgs(c.id).find(x=>x.type==='hotel')?.type};
    });
    assert.equal(data.participant,true);assert.equal(data.unrelated,false);assert.equal(data.systemHas,true);assert.equal(data.spyHas,true);assert.equal(data.remoteHas,true);assert.equal(data.messageType,'hotel');
    await page.waitForFunction(()=>document.body.innerText.includes('查看详情'));
    const card=page.getByText('查看详情').locator('..').locator('..'),box=await card.boundingBox();
    assert(box&&Math.round(box.width)===260);assert(box.height<=180,'compact card height '+box.height);
    await page.getByText('查看详情').click();
    await page.waitForFunction(()=>document.body.innerText.includes('酒店订单详情'));
    const detail=await page.locator('#modal').innerText();assert(detail.includes('订单金额'));assert(detail.includes('预订人'));assert(detail.includes('礼遇'));assert.deepEqual(errors,[]);
    console.log(JSON.stringify({version:await page.evaluate(()=>APP_VER),hotel:data.hotel.hotelName,card:{width:box.width,height:box.height},detail:true,participant:true,unrelated:false,spy:true,remote:true,pageErrors:errors}));
    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'artifacts','v1274-hotel-browser.png'),fullPage:true});
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
