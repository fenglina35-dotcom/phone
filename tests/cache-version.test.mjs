import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const repair = fs.readFileSync(new URL('../repair.html', import.meta.url), 'utf8');
const privateHtml = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html', import.meta.url), 'utf8');
const privateApp = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');

const version = app.match(/APP_VER='v(\d+)\b/)?.[1];
const privateVersion = privateApp.match(/APP_VER='v(\d+)\b/)?.[1];
assert.ok(version, 'app.js must expose a numeric APP_VER');
assert.ok(privateVersion, 'private app.js must expose its own numeric APP_VER');

assert.match(html, new RegExp(`app\\.js\\?v=${version}\\b`));
assert.match(html, new RegExp(`photo-album\\.js\\?v=${version}\\b`));
assert.match(html, new RegExp(`sw\\.js\\?v=${version}\\b`));
assert.match(html, new RegExp(`north-sw-reloaded-${version}\\b`));
const controllerStart=html.indexOf("addEventListener('controllerchange'");
const controllerEnd=html.indexOf("var url='sw.js",controllerStart);
assert.ok(controllerStart>=0&&controllerEnd>controllerStart,'service worker controller handler must exist');
assert.doesNotMatch(html.slice(controllerStart,controllerEnd),/location\\.replace|searchParams\\.set/,'cache activation must not reload the active app page');
assert.match(html, new RegExp(`window\\.__NORTH_SHELL_BUILD__='${version}'`));
assert.match(app, new RegExp(`window\\.__NORTH_SHELL_BUILD__!=='${version}'`));
assert.match(app, new RegExp(`sw\\.js\\?v=${version}\\b`));
assert.match(sw, new RegExp(`north-shell-v${version}\\b`));
assert.match(sw, new RegExp(`const BUILD='${version}'`));
assert.match(sw, /validShellText/);
assert.match(sw, /incomplete/);
assert.match(sw, /cache:'no-store'/);
const activateStart=sw.indexOf("self.addEventListener('activate'");
const fetchStart=sw.indexOf("self.addEventListener('fetch'",activateStart);
assert.ok(activateStart>=0&&fetchStart>activateStart,'service worker activation handler must exist');
const activation=sw.slice(activateStart,fetchStart);
assert.match(activation, /self\.clients\.claim\(\)/);
assert.doesNotMatch(activation, /client\.navigate|location\.(?:replace|reload)|clients\.openWindow/,'cache activation must never interrupt the active app page');
assert.match(index, new RegExp(`小手机\\.html\\?v=${version}\\b`));
assert.match(repair, new RegExp(`小手机\\.html\\?v=${version}\\b`));
assert.match(privateHtml, new RegExp(`window\\.__NORTH_SHELL_BUILD__='${privateVersion}'`));
assert.match(privateHtml, new RegExp(`app\\.js\\?v=${privateVersion}\\b`));
  assert.match(privateHtml, new RegExp(`photo-album\\.js\\?v=${privateVersion}\\b`));
  assert.match(privateHtml, new RegExp(`delivery\\.js\\?v=${privateVersion}\\b`));
  assert.match(privateHtml, new RegExp(`pet-game\\.js\\?v=${privateVersion}\\b`));
assert.match(privateApp, new RegExp(`window\\.__NORTH_SHELL_BUILD__!==\\'${privateVersion}\\'`));

console.log(`cache version tests passed (web v${version}, private v${privateVersion})`);

import test from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
for(const priv of [false,true])for(const failure of ['once','always','runtime','healthy-query','clear-query'])test((priv?'private':'web')+' missing commerce '+failure+' never renders the old food list and preserves saved state',async()=>{
 const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{const page=await browser.newPage({serviceWorkers:'block'}),origin='http://127.0.0.1:8778';let requests=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(url.pathname.endsWith('/commerce-ui.js')){requests++;if(failure==='runtime')return route.fulfill({status:200,contentType:'text/javascript',body:"window.__NORTH_COMMERCE_STARTED__=true;throw Error('fixture-commerce-init');"});if(failure==='always'||failure==='once'&&requests===1)return route.abort();}if(process.env.NORTH_COMMERCE_OLD&&['app.js','小手机.html','index.html','commerce-ui.js'].some(name=>decodeURIComponent(url.pathname).endsWith('/'+name))){const file=decodeURIComponent(url.pathname.slice(1)),body=require('node:child_process').execFileSync('git',['show','HEAD:'+file],{maxBuffer:10e6});return route.fulfill({status:200,contentType:file.endsWith('.js')?'text/javascript':'text/html',body});}const file=require('node:path').resolve(decodeURIComponent(url.pathname.slice(1)));if(!file.startsWith(process.cwd()+require('node:path').sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});const type=file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream';return route.fulfill({status:200,contentType:type,body:fs.readFileSync(file)});});await page.goto(origin+(priv?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');try{await page.waitForFunction(()=>window.__northBootReady);}catch(error){throw Error('commerce fixture boot failure '+JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,1600)}));}
 await page.evaluate(()=>{S.me.locked=false;S.me.active='main';S.settings.sound=false;S.contacts.forEach(c=>c.proactive={enabled:false});S.food.q='kkk';S.food.results=[{name:'美式咖啡',price:15,shop:'晨光咖啡工坊'}];S.food.cart=[{name:'saved-cart',price:7}];go('food');});
 if(failure==='once'){await page.waitForFunction(()=>window.__NORTH_COMMERCE_READY__===window.__NORTH_SHELL_BUILD__,null,{timeout:6000});assert.equal(await page.locator('.mt-home').count(),1);assert.equal(requests,2);}else if(failure==='clear-query'){assert.equal(await page.getByRole('button',{name:'清空搜索',exact:true}).count(),0);await page.locator('#food_q').click();await page.locator('#food_q').fill('');await page.evaluate(()=>render());assert.equal(await page.locator('#food_q').inputValue(),'');await page.locator('#food_q').click();await page.locator('#food_q').fill('咖啡');await page.locator('#food_q').fill('');await page.evaluate(()=>render());assert.equal(await page.locator('#food_q').inputValue(),'');await page.locator('#food_q').fill('咖啡');await page.evaluate(()=>{window.clearAiCalls=0;aiGen=async()=>{clearAiCalls++;return [];};fetchT=async(url,opt)=>{const body=opt&&opt.body?JSON.parse(opt.body):{};if(String(url).includes('north_market_list')&&body.p_query==='咖啡')return new Promise(resolve=>{window.resolveOldSearch=()=>resolve({ok:true,status:200,json:async()=>({shops:[{id:'stale',name:'STALE_REMOTE_SHOP'}]})});});return {ok:true,status:200,json:async()=>({shops:[]})};};window.pendingClearSearch=foodSearch();});await page.waitForFunction(()=>typeof window.resolveOldSearch==='function');await page.locator('#food_q').fill('');await page.evaluate(async()=>{resolveOldSearch();await pendingClearSearch;render();});assert.equal(await page.locator('#food_q').inputValue(),'');assert.equal(await page.evaluate(()=>clearAiCalls),0);assert.equal(await page.getByText('STALE_REMOTE_SHOP',{exact:true}).count(),0);await page.evaluate(()=>northPersonalBack());assert.equal(await page.locator('#food_q').inputValue(),'');assert.equal(await page.getByText('NORTH甜品店',{exact:true}).count(),1);
}else if(failure==='healthy-query'){assert.equal(await page.getByText('NORTH甜品店',{exact:true}).count(),1);const cards=page.locator('.mt-list .north-nearby');for(const name of ['NORTH奶茶店','NORTH甜品店']){const card=cards.filter({has:page.getByText(name,{exact:true})});assert.equal(await card.locator('.north-badges strong').count(),1,'both fixed shops need the same rating row');assert.equal(await card.locator('.north-badges strong').innerText(),'4.9分');assert.equal(await card.locator('.north-badges strong').evaluate(el=>getComputedStyle(el).color),'rgb(230, 135, 50)');assert.equal(await card.getByText('店铺配送',{exact:true}).count(),1);assert.equal(await card.locator('.north-muted').count(),2);const distance=Number((await card.locator('.north-distance').innerText()).match(/[0-9.]+/)[0]);assert.ok(distance>=.4&&distance<=.9,'both nearby fixed shops stay within one kilometre');assert.equal(await card.locator('.north-area').innerText(),'商圈｜北岸生活街 ›');assert.ok(await card.locator('.north-demo').isVisible());const rating=await card.locator('.north-badges').boundingBox(),delivery=await card.locator('.north-muted').last().boundingBox();assert.ok(rating.y>=delivery.y+delivery.height-1,'rating must sit below delivery row');}const dessert=cards.filter({has:page.getByText('NORTH甜品店',{exact:true})});assert.match(await dessert.innerText(),/起送 ¥15.*配送 约 ¥1.9/);await page.evaluate(()=>northBuiltinOpen('north-dessert'));assert.equal(await page.locator('.north-custom-product').count(),13);const localOrder=await page.evaluate(async()=>{const c=S.contacts.find(c=>!c.isPhoneFriend&&!c.deleted&&!c.blocked);S.couple={cid:c.id};phoneFriendState=()=>({id:'fixture',secret:'fixture'});let called=0;fetchT=async()=>{throw Error('cloud offline');};chatAPI=async(messages)=>{called++;const request=JSON.parse(messages[1].content);if(!request.localMenus.some(shop=>shop.name==='NORTH甜品店'&&shop.products.some(p=>p.name==='蓝莓小蛋糕'&&p.price===15&&p.specGroups.length===0)))throw Error('original menu missing');return JSON.stringify({order:true,name:'蓝莓小蛋糕',shop:'NORTH甜品店',specs:'无规格',temperature:'不适用',quantity:1});};const meta={messageId:'fixed-browser-request',northCurrentRequest:true};const repaired=await NorthMarketBusiness.ensureAction(c,'乖，嘴倒是甜了。喝口水，等着。','我想吃蓝莓小蛋糕给我点',meta);const action=repaired.match(/\[点外卖\|([^|]+)\|([^\]]+)\]/);if(!action)return {repaired};const card=await NorthMarketBusiness.preferredFood(c,action[1],action[2],actId(),meta);if(card){pushMsg(c.id,card);save();openChat(c.id);}const repeat=await NorthMarketBusiness.preferredFood(c,action[1],action[2],actId(),meta);return {type:card&&card.type,shop:card&&card.shop,price:card&&card.price,image:card&&card.foodDetail.imageUrl.length,repeat:repeat,called};});assert.equal(localOrder.type,'food');assert.equal(localOrder.shop,'NORTH甜品店');assert.equal(localOrder.price,15);assert.ok(localOrder.image>1000);assert.equal(localOrder.repeat,null);assert.equal(localOrder.called,1);assert.equal(await page.locator('.wx-north-food-card').count(),1);}else{await page.waitForFunction(()=>document.body.innerText.includes('新版美团未能加载'),null,{timeout:6000});assert.equal(await page.locator('.food-scroll').count(),0);assert.equal(requests,failure==='always'?2:1);if(failure==='always'){await page.getByText('重试加载美团',{exact:true}).click();await page.waitForFunction(()=>_northCommerceLoad.attempts===2&&!_northCommerceLoad.busy,null,{timeout:6000});assert.equal(requests,3);assert.equal(await page.getByText('重试加载美团',{exact:true}).count(),0);}}
 const saved=await page.evaluate(()=>({query:S.food.q,results:S.food.results.map(p=>p.name),cart:S.food.cart.map(p=>p.name)}));assert.deepEqual(saved,{query:failure==='clear-query'?'':'kkk',results:['美式咖啡'],cart:['saved-cart']});
 }finally{await browser.close();}
});
