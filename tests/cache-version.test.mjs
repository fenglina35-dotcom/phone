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
for(const priv of [false,true])for(const failure of ['once','always','runtime'])test((priv?'private':'web')+' missing commerce '+failure+' never renders the old food list and preserves saved state',async()=>{
 const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{const page=await browser.newPage({serviceWorkers:'block'}),origin='http://127.0.0.1:8778';let requests=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(url.pathname.endsWith('/commerce-ui.js')){requests++;if(failure==='runtime')return route.fulfill({status:200,contentType:'text/javascript',body:"window.__NORTH_COMMERCE_STARTED__=true;throw Error('fixture-commerce-init');"});if(failure==='always'||requests===1)return route.abort();}if(process.env.NORTH_COMMERCE_OLD&&['app.js','小手机.html','index.html'].some(name=>decodeURIComponent(url.pathname).endsWith('/'+name))){const file=decodeURIComponent(url.pathname.slice(1)),body=require('node:child_process').execFileSync('git',['show','HEAD:'+file],{maxBuffer:10e6});return route.fulfill({status:200,contentType:file.endsWith('.js')?'text/javascript':'text/html',body});}const file=require('node:path').resolve(decodeURIComponent(url.pathname.slice(1)));if(!file.startsWith(process.cwd()+require('node:path').sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});const type=file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream';return route.fulfill({status:200,contentType:type,body:fs.readFileSync(file)});});await page.goto(origin+(priv?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');try{await page.waitForFunction(()=>window.__northBootReady);}catch(error){throw Error('commerce fixture boot failure '+JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,1600)}));}
 await page.evaluate(()=>{S.me.locked=false;S.me.active='main';S.settings.sound=false;S.contacts.forEach(c=>c.proactive={enabled:false});S.food.q='kkk';S.food.results=[{name:'美式咖啡',price:15,shop:'晨光咖啡工坊'}];S.food.cart=[{name:'saved-cart',price:7}];go('food');});
 if(failure==='once'){await page.waitForFunction(()=>window.__NORTH_COMMERCE_READY__===window.__NORTH_SHELL_BUILD__,null,{timeout:6000});assert.equal(await page.locator('.mt-home').count(),1);assert.equal(requests,2);}else{await page.waitForFunction(()=>document.body.innerText.includes('新版美团未能加载'),null,{timeout:6000});assert.equal(await page.locator('.food-scroll').count(),0);assert.equal(requests,failure==='always'?2:1);if(failure==='always'){await page.getByText('重试加载美团',{exact:true}).click();await page.waitForFunction(()=>_northCommerceLoad.attempts===2&&!_northCommerceLoad.busy,null,{timeout:6000});assert.equal(requests,3);assert.equal(await page.getByText('重试加载美团',{exact:true}).count(),0);}}
 const saved=await page.evaluate(()=>({query:S.food.q,results:S.food.results.map(p=>p.name),cart:S.food.cart.map(p=>p.name)}));assert.deepEqual(saved,{query:'kkk',results:['美式咖啡'],cart:['saved-cart']});
 }finally{await browser.close();}
});
