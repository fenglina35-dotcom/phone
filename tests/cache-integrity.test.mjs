import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const ai = fs.readFileSync(new URL('../photo-album.js', import.meta.url), 'utf8');

const helpers = sw.slice(0, sw.indexOf("self.addEventListener('install'"));
const context = {Response, AbortController, fetch:()=>{}, setTimeout, clearTimeout};
vm.createContext(context);
vm.runInContext(helpers,context);

assert.equal(context.validShellText('html',html),true,'complete HTML must pass');
assert.equal(context.validShellText('app',app),true,'complete app.js must pass');
assert.equal(context.validShellText('album',ai),true,'complete ai-account.js must pass');
assert.equal(context.validShellText('html',html.slice(0,50000)),false,'truncated HTML must fail');
assert.equal(context.validShellText('app',app.slice(0,900000)),false,'truncated app.js must fail');
assert.equal(context.validShellText('album',ai.slice(0,100)),false,'truncated ai-account.js must fail');
assert.match(sw,/Promise\.all\(CORE_FILES\.map[\s\S]*checkedResponse\(item\.url,item\.kind,3\)/);
assert.match(sw,/currentCore\(cache,'html'\)/);
assert.match(sw,/currentCore\(cache,'app'\)/);
assert.match(sw,/const GLASS_ICON_CACHE='north-glass-icons-v2'/);
assert.match(sw,/assets\\\/app-icons\\\/glass/);
assert.doesNotMatch(app,/loading="lazy" decoding="async" fetchpriority="low"/);
assert.match(app,/packed\?' decoding="sync" loading="eager" fetchpriority="high"':''/);

console.log('cache integrity tests passed');

assert.equal(context.validShellText('commerce',fs.readFileSync(new URL('../commerce-ui.js',import.meta.url),'utf8')),true,'complete commerce runtime passes');
assert.equal(context.validShellText('commerce','window.renderFood=function(){};'),false,'missing or incomplete commerce must not activate as a valid release');
assert.match(sw,/kind:'commerce'/);assert.match(sw,/currentCore\(cache,'commerce'\)/);


// A previous release's durable icon cache must not shadow the newer game artwork.
const iconEvents={},opened=[],oldIcon=new Response('OLD_ICON');let iconNetwork=0,iconResponse;
const iconContext=vm.createContext({self:{location:{origin:'https://phone.example'},addEventListener:(name,fn)=>iconEvents[name]=fn},caches:{open:async name=>{opened.push(name);return{match:async()=>name==='north-glass-icons-v1'?oldIcon:undefined,put:async()=>{}};}},fetch:async()=>{iconNetwork++;return new Response('CURRENT_ICON');},URL,Request,Response,AbortController,setTimeout,clearTimeout});
vm.runInContext(sw,iconContext);
iconEvents.fetch({request:new Request('https://phone.example/assets/app-icons/glass/black/tale.webp?v=20261008games'),respondWith:value=>iconResponse=value});
assert.equal(await(await iconResponse).text(),'CURRENT_ICON');assert.equal(iconNetwork,1);assert.ok(opened.includes('north-glass-icons-v2'));assert.ok(!opened.includes('north-glass-icons-v1'));

// iOS home-screen navigation uses a percent-encoded Chinese pathname.
for(const query of ['?open=latest','?north_update=1688','?reload=1','?northPreview=black-home']){
 const events={};let supplied,network=0,writes=0;
 const ctx=vm.createContext({self:{location:{origin:'https://phone.example'},addEventListener:(name,fn)=>events[name]=fn},caches:{open:async()=>({match:async()=>new Response('STALE_SHELL'),put:async()=>writes++})},fetch:async()=>{network++;return new Response(html+'\n<!-- fresh-shell -->');},URL,Request,Response,AbortController,setTimeout,clearTimeout});vm.runInContext(sw,ctx);
 events.fetch({request:{method:'GET',mode:'navigate',url:'https://phone.example/phone/'+encodeURIComponent('小手机.html')+query},respondWith:value=>supplied=value});
 assert.match(await(await supplied).text(),/fresh-shell/,'explicit encoded navigation must reach the network: '+query);assert.equal(network,1);
}

// Illustrated hubs must be prepared before the first navigation, not downloaded on entry.
assert.ok(html.includes("window.__NORTH_PAGE_ART__="),"the three illustrated pages must preload their artwork before navigation");

// Stable artwork URLs must identify the actual original bytes in both shipped bundles.
const {createHash,webcrypto}=await import('node:crypto');
const artURLs=JSON.parse(html.match(/window\.__NORTH_PAGE_ART__=(\[[^;]+\]);/)[1]);
assert.equal(artURLs.length,7);assert.equal(new Set(artURLs).size,7);
const privateBase=new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/',import.meta.url);
for(const file of ['index.html','小手机.html']){const source=fs.readFileSync(new URL(file,privateBase),'utf8');assert.deepEqual(JSON.parse(source.match(/window\.__NORTH_PAGE_ART__=(\[[^;]+\]);/)[1]),artURLs);}
for(const src of artURLs){const u=new URL(src,'https://phone.example/phone/'),file=u.pathname.slice('/phone/'.length),bytes=fs.readFileSync(new URL('../'+file,import.meta.url)),hash=createHash('sha256').update(bytes).digest('hex');assert.equal(u.searchParams.get('art'),hash.slice(0,12));assert.deepEqual(bytes,fs.readFileSync(new URL(file,privateBase)));for(const base of [new URL('../',import.meta.url),privateBase])assert.ok(fs.readFileSync(new URL('glass-theme.css',base),'utf8').includes("url('"+src+"')"),'CSS must reuse the exact preloaded image URL');}
// A new shell/worker must reuse these images offline, and must never cache a failed or old image as the current art.
const artStores=new Map();let artFetches=0,artOffline=false,artDenied=false,artWrong=false;
const artCache={match:async key=>artStores.get(typeof key==='string'?key:key.url)?.clone(),put:async(key,response)=>artStores.set(typeof key==='string'?key:key.url,response.clone()),keys:async()=>[...artStores.keys()].map(key=>new Request(key)),delete:async key=>artStores.delete(typeof key==='string'?key:key.url)};
function artWorker(source=sw){const events={};const ctx=vm.createContext({self:{location:{origin:'https://phone.example',href:'https://phone.example/phone/sw.js'},addEventListener:(name,fn)=>events[name]=fn},caches:{open:async()=>{if(artDenied)throw Error('quota');return artCache;}},fetch:async request=>{artFetches++;if(artOffline)throw Error('offline');const u=new URL(typeof request==='string'?request:request.url),file=u.pathname.slice('/phone/'.length);return new Response(artWrong?'old or incomplete image':fs.readFileSync(new URL('../'+file,import.meta.url)),{headers:{'Content-Type':'image/png'}});},crypto:webcrypto,URL,Request,Response,AbortController,setTimeout,clearTimeout});vm.runInContext(source,ctx);return{ctx,events};}
artStores.set('https://phone.example/phone/assets/obsolete-art.png',new Response('old revision'));const firstArt=artWorker();let artWarm;firstArt.events.message({data:{type:'north-page-art-warm'},waitUntil:p=>artWarm=p});await artWarm;assert.equal(artFetches,7);assert.equal(artStores.size,7);
artOffline=true;const nextArt=artWorker(sw.replace("const BUILD='1831'","const BUILD='9999'"));for(const src of artURLs){let response;nextArt.events.fetch({request:new Request(new URL(src,'https://phone.example/phone/')),respondWith:p=>response=p});assert.equal((await response).status,200);assert.ok((await(await response).arrayBuffer()).byteLength>1000);}assert.equal(artFetches,7,'warm/reopened pages must not request artwork from the network');
artOffline=false;artDenied=true;{let response;nextArt.events.fetch({request:new Request(new URL(artURLs[0],'https://phone.example/phone/')),respondWith:p=>response=p});assert.equal((await response).status,200);}artDenied=false;
artStores.clear();artWrong=true;await nextArt.ctx.warmPageArt();assert.equal(artStores.size,0,'incomplete/old bytes must never be pinned under a current content hash');
let oldArtClaimed=false;nextArt.events.fetch({request:new Request('https://phone.example/phone/assets/roleplay-studio/theatre-card.png?art=outdated'),respondWith:()=>oldArtClaimed=true});assert.equal(oldArtClaimed,false,'an unknown content revision must not get a newer cached image');
console.log('page art preload, original bytes, durable offline cache, shell update, quota and corruption checks passed');
