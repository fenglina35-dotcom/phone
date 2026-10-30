const BUILD='1863';
const HOTFIX='v1863-owner-todo-report-1';
const SHELL_CACHE='north-shell-v1863-owner-todo-report-1';
const GLASS_ICON_CACHE='north-glass-icons-v2';
const GLASS_ICON_PACKS=['black','gray','pink','blue'];
const GLASS_ICON_KEYS=['browser','calendar','cinema','couple','douyin','dread','food','games','mail','moments','music','offline','phoneapp','roleplay','settings','shop','spy','tale','tasks','travel','wechat','worldbook','x'];
const GLASS_ICON_FILES=GLASS_ICON_PACKS.flatMap(pack=>GLASS_ICON_KEYS.map(key=>'./assets/app-icons/glass/'+pack+'/'+key+'.webp'));
// PAGE_ART_CACHE_V1: bounded original art cache survives shell-only updates.
const PAGE_ART_CACHE='north-page-art-v1';
const PAGE_ART_FILES=[{"src":"assets/roleplay-studio/theatre-card.png?r=user-choice-4&art=e69a60671450","hash":"e69a60671450f61da9a1154ce40a0eb900661ab3044a4dc956079f5b79de8996"},{"src":"assets/game-hub/hero-board.png?art=4eceb1c4003f","hash":"4eceb1c4003f56c52d3f09d9931f7f59947cd14f8bddc26391eeef20ddb719cf"},{"src":"assets/game-hub/game-icons.png?art=2a33e7488bf9","hash":"2a33e7488bf9649f8b5f6859e604eb811b6296dbac6bf6c38fb86695d96b8a1c"},{"src":"assets/game-hub/heart-card.png?art=3d53b35915a3","hash":"3d53b35915a3ddc491a3a8b2583446d9bb9ec1ffe602417401b992019636b44c"},{"src":"assets/game-hub/dice.png?art=59d4dd351e43","hash":"59d4dd351e4366ca24fb22b4b680dcd7c525b8f3465c6feef7bcf635d20b1196"},{"src":"assets/worldbook-archive/archive-icons.png?art=c72d9bfc6f3a","hash":"c72d9bfc6f3aae6cc257d24eeb438ced55ec4ff1ade0a96e8573fec40a1531ba"},{"src":"assets/worldbook-archive/footer-cat.png?art=44cef7b9e5b3","hash":"44cef7b9e5b3aa49dc35ed92b0051be0ace0cb80495588c1917afe377a9728ca"}];
const CORE_FILES=[
  {url:'./commerce-ui.js?v='+BUILD,kind:'commerce'},
  {url:'./public-north-policy.js?v='+BUILD,kind:'publicNorthPolicy'},
  {url:'./public-north-runtime.js?v='+BUILD,kind:'publicNorthRuntime'},
  {url:'./phone-shortcuts.js?v='+BUILD,kind:'shortcuts'},
  {url:'./request-size-details.js?v='+BUILD,kind:'requestSize'},
  {url:'./request-diagnostics.js?v='+BUILD,kind:'requestDiagnostics'},
  {url:'./cohab-model-diagnostics.js?v='+BUILD,kind:'cohabDiagnostics'},
  {url:'./小手机.html?v='+BUILD+'&r='+HOTFIX,kind:'html'},
  {url:'./license-gate.js?v='+BUILD,kind:'license'},
  {url:'./app.js?v='+BUILD+'&r='+HOTFIX,kind:'app'},
  {url:'./cohab-theater.js?v='+BUILD+'&r=v1274-web-cohab-guests-1',kind:'theater'},
  {url:'./web-hotfix.js?v='+BUILD+'&r=v1863-owner-todo-report-1',kind:'hotfix'},
  {url:'./photo-album.js?v='+BUILD,kind:'album'},
  {url:'./task-notes.js?v='+BUILD,kind:'tasks'},
  {url:'./couple-watch.js?v='+BUILD,kind:'watch'},
  {url:'./couple-watch-runtime.js?v='+BUILD,kind:'watchRuntime'}
];
const OPTIONAL_FILES=[
  ...GLASS_ICON_PACKS.map(pack=>'./assets/app-icons/glass/'+pack+'/album.png'),
  './browser-diagnostics.js?v='+BUILD,
  './message-beijing-time.js?v='+BUILD+'&r=offline-me-1',
  './pixel-home-policy.js?v='+BUILD,
  './pixel-wardrobe-info.js?v='+BUILD,
  './pixel-home.js?v='+BUILD,
  './icon.png',
  './assets/meituan-categories.png',
  './assets/meituan-kangaroo.png',
  './assets/meituan-north-cover.jpg',
  './assets/north-extra-green.jpg',
  './assets/north-extra-rainbow.jpg',
  './assets/north-extra-cocoa.jpg',
  './assets/north-extra-peach.jpg',
  './assets/north-extra-crystal.jpg',
  './assets/north-extra-coconut.jpg',
  './assets/north-coffee-cloud.jpg',
  './assets/north-coffee-mint.jpg',
  './assets/north-ice-blue.jpg',
  './assets/north-ice-berry.jpg',
  './assets/north-ice-lime.jpg',
  './assets/north-ice-sunset.jpg',
  './assets/north-ice-lemon.jpg',
  './assets/north-ice-passion.jpg',
  './assets/north-snow-mango.jpg',
  './assets/north-snow-cocoa.jpg',
  './assets/north-snow-mulberry.jpg',
  './assets/north-snow-strawberry.jpg',
  './assets/north-snow-guava.jpg',
  './assets/north-snow-taro.jpg',
  './assets/incoming-wechat-call-default-v2.mp3',
  './assets/message-notification-user-v1.mp3',
  './assets/pet-room-v1.webp',
  './assets/north-dessert-shop.js?v='+BUILD,
  './assets/north-mcdonalds-shop.js?v='+BUILD,
  './assets/north-luckin-shop.js?v='+BUILD,
  './assets/north-breakfast-shop.js?v='+BUILD,
  './assets/north-fruit-bowl-shop.js?v='+BUILD,
  './assets/north-pharmacy-shop.js?v='+BUILD,
  './north-runner.js?v='+BUILD,
  './delivery.js?v='+BUILD,
  './gift-effects.js?v='+BUILD,
  './heart-quiz.js?v='+BUILD,
  './bead-studio.js?v='+BUILD+'&r=v1184-pixel-puzzle-4',
  './thought-card-effects.js?v='+BUILD,
  './pet-game.js?v='+BUILD,
  './desk-pet.js?v='+BUILD,
  './mail-outbox.js?v='+BUILD,
  './mail-outbox.css?v='+BUILD,
  './role-family-card.js?v='+BUILD,
  './role-family-card.css?v='+BUILD,
  './travel-home.js?v='+BUILD,
  './travel-home.css?v='+BUILD,
  './travel-gallery.js?v='+BUILD,
  './travel-payment.js?v='+BUILD,
  './travel-hotel.js?v='+BUILD,
  './travel-hotel-data.js?v='+BUILD,
  './travel-hotel.css?v='+BUILD,
  './assets/travel-home/DESTINATION_IMAGE_SOURCES.txt',
  './destination-photos.js?v='+BUILD,
  './travel-ticket-data.js?v='+BUILD,
  './travel-train.js?v='+BUILD,
  './travel-train-booking.js?v='+BUILD,
  './travel-train.css?v='+BUILD,
  './travel-concert-booking.js?v='+BUILD,
  './travel-concert-booking.css?v='+BUILD,
  './travel-taxi.js?v='+BUILD,
  './travel-taxi.css?v='+BUILD,
  './travel-concert.js?v='+BUILD,
  './travel-concert.css?v='+BUILD,
  './fish-mcp.js?v='+BUILD,
  './voice-expressive.js?v='+BUILD,
  './binaural-hrir.js?v='+BUILD,
  './travel-flight.js?v='+BUILD,
  './travel-flight-booking.js?v='+BUILD,
  './travel-flight.css?v='+BUILD,
  './travel-guide.js?v='+BUILD,
  './travel-guide.css?v='+BUILD,
  './travel-regions.js?v='+BUILD,
  './travel-regions.css?v='+BUILD,
  './assets/travel-home/GUIDE_IMAGE_SOURCES.txt',
  './pf-group-role.js?v='+BUILD,
  './pet-game.css?v='+BUILD,
  /* 主屏组件、音乐光盘和图片裁剪都靠它；以前每次打开都走网络，网络一抖就整页失去样式。 */
  './glass-theme.css?v='+BUILD+'&r=music-disc-color-1',
  './wedding-game.css?v=wedding-dual-17',
  './wechat-me.css?v='+BUILD,
  './wechat-me.js?v='+BUILD,
  './smart-home.js?v='+BUILD,
  './vendor/qr/qrcode.js?v='+BUILD,
  './vendor/qr/jsQR.js?v='+BUILD,
  './vendor/mp4box.all.mjs?v='+BUILD,
  './vendor/mp4box.all.js?v='+BUILD+'&r=file-safe-1',
  './vendor/rolldown-runtime-w6R9maHv.mjs',
  './vendor/styp-9TIZZDLN.mjs',
  './vendor/MP4BOX-LICENSE.txt'
];

/* SW_KEEP_BIG_FILES_V1（2026-10-18：很多人不开梯子，GitHub 很慢）：以前每次更新版本，整个缓存连同像素少女（约 89MB）、
   美团店铺数据（约 12MB）、图片和声音一起删掉，更新一次就得重新从 GitHub 下一遍，所以总是刷不出来。
   现在这些大文件放进一份不随版本删除的长期缓存：打开时先用存好的（马上就能用），新版本才在后台悄悄换新，换不到也不影响使用。
   小手机自己的程序文件（app.js、页面）不放进来，还是跟版本走。 */
const STATIC_CACHE='north-static-v1';
function staticKind(path){
  if(/\/games\/pixel-home\//.test(path))return 'pixel';
  if(/\/assets\/north-[a-z-]+-shop\.js$/.test(path))return 'data';
  if(/\/assets\/(?!travel-home\/)(?!app-icons\/)[^?]+\.(?:png|jpe?g|webp|gif|mp3|m4a|wav)$/.test(path))return 'media';
  return '';
}
async function staticStore(cache,key,response){
  if(!response||!response.ok||response.type==='opaque')return;
  const body=await response.blob();const headers=new Headers(response.headers);headers.set('x-north-build',BUILD);headers.delete('content-encoding');
  await cache.put(key,new Response(body,{status:200,statusText:response.statusText,headers}));
}
/* 先给存好的；没存过才等网络。存的是旧版本的（或者像素少女自己的页面和脚本），在后台换新一次。 */
async function staticResponse(request,event,key,kind){
  let cache;try{cache=await caches.open(STATIC_CACHE);}catch(_){cache=null;}
  const hit=cache?await cache.match(key,{ignoreSearch:kind!=='pixel'}).catch(()=>null):null;
  const pixelCode=kind==='pixel'&&!/\/(?:asset-data|assets)\//.test(new URL(key.url).pathname)&&/\.(?:html|js|css|json)$/.test(new URL(key.url).pathname);
  if(hit){
    const stale=kind==='pixel'?pixelCode:hit.headers.get('x-north-build')!==BUILD;
    if(stale&&cache)event.waitUntil(fetch(request,{cache:'no-cache'}).then(r=>staticStore(cache,key,r)).catch(()=>{}));
    return hit;
  }
  const response=await fetchRetry(request,{cache:'no-cache'},3);
  if(response.ok&&cache)event.waitUntil(staticStore(cache,key,response.clone()).catch(()=>{}));
  return response;
}

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function timeoutFetch(request,options,ms){
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),ms):null;
  const opts=Object.assign({},options||{});
  if(controller)opts.signal=controller.signal;
  return fetch(request,opts).finally(()=>{if(timer)clearTimeout(timer);});
}
async function fetchRetry(request,options,tries){
  let last;
  for(let i=0;i<tries;i++){
    try{return await timeoutFetch(request,options,12000);}
    catch(e){last=e;if(i+1<tries)await sleep(450*(i+1));}
  }
  throw last||new Error('network failed');
}
function validShellText(kind,text){
  if(kind==='commerce')return text.length>100000&&text.includes('window.renderFood=function')&&text.includes('northMarketHomeHTML')&&text.includes('window.__NORTH_COMMERCE_READY__=window.__NORTH_SHELL_BUILD__')&&text.trim().endsWith('})();');
  if(kind==='publicNorthPolicy')return text.includes('root.NorthPublicPolicy = Object.freeze');
  if(kind==='publicNorthRuntime')return text.includes('window.NorthPublicRuntime=')&&text.includes('NorthPublicRuntime.install();');
  if(kind==='shortcuts')return text.includes('window.PhoneShortcuts=')&&text.includes('phone-shortcuts');
  if(kind==='requestDiagnostics')return text.includes('function streamData(raw)')&&text.includes('async function streamBody(res,timeout)')&&text.includes('root.NorthRequestDiagnostics=');
  if(kind==='requestSize')return text.includes('window.requestSizeBreakdown=')&&text.includes('window.requestSizeDetailsHtml=');
  if(kind==='cohabDiagnostics')return text.includes('window.cohabModelDiagnosticOpen=')&&text.includes('const records=new Map()');
  if(kind==='watch')return text.includes('function localDay(at)')&&text.includes('function create(options)');
  if(kind==='watchRuntime')return text.includes('function coupleWatchRead()')&&text.includes('async function coupleWatchReact(');
  if(kind==='html')return text.length>80000
    &&text.includes("window.__NORTH_SHELL_BUILD__='"+BUILD+"'")
    &&text.includes('app.js?v='+BUILD)
    &&text.includes('</style>')
    &&text.includes('</html>');
  if(kind==='app')return text.length>1200000
    &&text.includes("const APP_VER='v"+BUILD+' ')
    &&text.includes("window.__NORTH_SHELL_BUILD__!=='"+BUILD+"'")
    &&text.includes('showGate();');
  if(kind==='theater')return text.length>30000
    &&text.includes("window.__NORTH_COHAB_THEATER__='v1274-web-cohab-guests-1'")
    &&text.includes('cohabTheaterSummarizeEpisode')
    &&text.includes('cohab-theater-target')
    &&text.includes('offAI=async')
    &&text.includes('theaterRevealActorItems')
    &&!text.includes('cohabReplyCore=async');
  if(kind==='hotfix')return text.length>800
    &&text.includes("window.__NORTH_WEB_HOTFIX__='v1863-owner-todo-report-1'")
    &&text.includes('reconcileExpiredWxLogin')
    &&text.includes('withBaseImageCheck')
    &&text.includes('isStoredImgRef');
  if(kind==='license')return text.length>10000
    &&text.includes('window.NorthLicense')
    &&text.includes('restorePasskey')
    &&text.includes('supportsPasskey');
  if(kind==='album')return text.includes('function renderPhotoAlbum(')&&text.includes('function photoAlbumTab(');
  if(kind==='tasks')return text.includes('TASK_NOTES_V2')&&text.includes('window.TaskNotes=api');
  return false;
}
async function checkedResponse(request,kind,tries){
  const response=await fetchRetry(request,{cache:'no-store'},tries||1);
  if(!response||!response.ok)throw new Error('HTTP '+(response&&response.status));
  const text=await response.text();
  if(!validShellText(kind,text))throw new Error('incomplete '+kind);
  const type=kind==='html'?'text/html;charset=utf-8':'text/javascript;charset=utf-8';
  return new Response(text,{status:response.status,statusText:response.statusText,headers:{'Content-Type':type,'Cache-Control':'no-store'}});
}
async function currentCore(cache,kind){
  const item=CORE_FILES.find(x=>x.kind===kind);
  return item?cache.match(item.url):null;
}
async function warmOptionalFiles(){
  const cache=await caches.open(SHELL_CACHE);
  let staticCache=null;try{staticCache=await caches.open(STATIC_CACHE);}catch(_){}
  for(let i=0;i<OPTIONAL_FILES.length;i+=6){
    await Promise.all(OPTIONAL_FILES.slice(i,i+6).map(async url=>{
      try{const fileUrl=new URL(url,self.location.href),kind=staticKind(fileUrl.pathname);
        if(kind&&staticCache){const key=new Request(fileUrl.origin+fileUrl.pathname),hit=await staticCache.match(key);if(hit&&hit.headers.get('x-north-build')===BUILD)return;const r=await fetchRetry(url,{cache:'no-cache'},2);await staticStore(staticCache,key,r);return;}
        const response=await fetchRetry(url,{cache:'no-cache'},2);if(response&&response.ok)await cache.put(url,response);}catch(_){}
    }));
  }
  const iconCache=await caches.open(GLASS_ICON_CACHE);
  for(let i=0;i<GLASS_ICON_FILES.length;i+=8){
    await Promise.all(GLASS_ICON_FILES.slice(i,i+8).map(async url=>{
      try{const response=await fetchRetry(url,{cache:'no-cache'},1);if(response&&response.ok)await iconCache.put(url,response);}catch(_){}
    }));
  }
}

function pageArtURL(item){return new URL(item.src,self.location.href||self.location.origin+'/');}
function pageArtEntry(url){return PAGE_ART_FILES.find(item=>{const expected=pageArtURL(item);return url.pathname===expected.pathname&&url.searchParams.get('art')===expected.searchParams.get('art');});}
async function pageArtValid(response,item){if(!response||!response.ok||!/^image\/png(?:;|$)/i.test(response.headers.get('content-type')||'')||typeof crypto==='undefined'||!crypto.subtle)return false;try{const bytes=await response.clone().arrayBuffer();if(bytes.byteLength>3*1024*1024||bytes.byteLength<8)return false;const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');return hash===item.hash;}catch(_){return false;}}
async function pageArtResponse(request,item){let cache;const key=pageArtURL(item).href;try{cache=await caches.open(PAGE_ART_CACHE);const hit=await cache.match(key);if(hit)return hit;}catch(_){/* Full or unavailable storage must not prevent drawing the page. */}const response=await timeoutFetch(request,{cache:'no-cache'},12000);if(cache&&await pageArtValid(response,item)){try{await cache.put(key,response.clone());const allowed=new Set(PAGE_ART_FILES.map(file=>pageArtURL(file).href));for(const old of await cache.keys())if(!allowed.has(old.url))await cache.delete(old);}catch(_){}}return response;}
async function warmPageArt(){let next=0;await Promise.all([0,1].map(async()=>{while(next<PAGE_ART_FILES.length){const item=PAGE_ART_FILES[next++];try{await pageArtResponse(new Request(pageArtURL(item).href),item);}catch(_){}}}));}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    const core=await Promise.all(CORE_FILES.map(async item=>{
      const response=await checkedResponse(item.url,item.kind,3);
      return {item,response};
    }));
    for(const entry of core)await cache.put(entry.item.url,entry.response);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    for(const item of CORE_FILES){
      if(!(await cache.match(item.url)))throw new Error('shell cache incomplete');
    }
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('north-shell-')&&key!==SHELL_CACHE).map(key=>caches.delete(key)));
    await Promise.all(keys.filter(key=>key.startsWith('north-glass-icons-')&&key!==GLASS_ICON_CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    windows.forEach(client=>{try{client.postMessage({type:'north-update-ready',build:BUILD});}catch(_){}});
    setTimeout(()=>warmOptionalFiles().catch(()=>{}),15000);
  })());
});

self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='north-page-art-warm'){event.waitUntil(warmPageArt());return;}
  if(!event.data||event.data.type!=='north-version-query')return;
  try{if(event.source)event.source.postMessage({type:'north-update-ready',build:BUILD});}catch(_){}
});

// Travel thumbnails have their own bounded cache; never prefetch the whole catalogue.
const TRAVEL_IMAGE_CACHE='north-travel-images-v1',TRAVEL_IMAGE_MAX_BYTES=512*1024,TRAVEL_IMAGE_MAX_FILES=24,TRAVEL_IMAGE_TOTAL_BYTES=5*1024*1024;
let travelImageWrites=Promise.resolve(),travelImagePending=0;
async function travelImageSave(cache,key,response){
  if(!response.ok||!/^image\//i.test(response.headers.get('content-type')||''))return;
  if(+response.headers.get('content-length')>TRAVEL_IMAGE_MAX_BYTES)return;
  if(!response.body||typeof response.body.getReader!=='function')return;
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>TRAVEL_IMAGE_MAX_BYTES){reader.cancel().catch(()=>{});return;}chunks.push(next.value);}}finally{reader.releaseLock();}
  const headers=new Headers(response.headers);headers.delete('content-encoding');headers.set('content-length',String(bytes));
  await cache.put(key,new Response(new Blob(chunks),{status:response.status,headers}));
  const keys=await cache.keys();let total=0;const sizes=[];for(const old of keys){const r=await cache.match(old);let n=Number(r?.headers.get('content-length'));if(!Number.isFinite(n)||n<=0)n=r?(await r.arrayBuffer()).byteLength:0;sizes.push(n);total+=n;}let count=keys.length;for(let i=0;i<keys.length&&(count>TRAVEL_IMAGE_MAX_FILES||total>TRAVEL_IMAGE_TOTAL_BYTES);i++){await cache.delete(keys[i]);total-=sizes[i];count--;}
}
async function travelImageResponse(request,event){
  const url=new URL(request.url),key=new Request(url.origin+url.pathname);let cache;
  try{cache=await caches.open(TRAVEL_IMAGE_CACHE);const hit=await cache.match(key);if(hit)return hit;}catch(_){/* Image cache failure must not block network or the app. */}
  const response=await fetch(request);
  if(cache&&response.ok&&travelImagePending<2){travelImagePending++;const copy=response.clone();travelImageWrites=travelImageWrites.then(()=>travelImageSave(cache,key,copy)).catch(()=>{}).finally(()=>travelImagePending--);event.waitUntil(travelImageWrites);}
  return response;
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  let url;
  try{url=new URL(request.url);}catch(_){return;}
  if(url.origin!==self.location.origin)return;
  let decodedPath;try{decodedPath=decodeURIComponent(url.pathname);}catch(_){decodedPath=url.pathname;}
  const artwork=pageArtEntry(url);if(artwork){event.respondWith(pageArtResponse(request,artwork).catch(()=>Response.error()));return;}

  if(/\/assets\/travel-home\/[^/]+\.(?:jpg|webp|png)$/.test(url.pathname)){
    event.respondWith(travelImageResponse(request,event).catch(()=>Response.error()));return;
  }

  // The embedded game has its own document, never the phone shell fallback.
  if(/\/games\/pixel-home\//.test(url.pathname)){
    /* 每次进入带的 session 和手动重试的 retry 不算进文件名（以前每次进入都多存一份 index.html）；手动重试一定走网络 */
    const keyUrl=new URL(url.href);keyUrl.searchParams.delete('session');keyUrl.searchParams.delete('retry');
    const key=new Request(keyUrl.href),retry=url.searchParams.has('northImageRetry')||url.searchParams.has('retry');
    if(retry){event.respondWith((async()=>{const r=await fetchRetry(request,{cache:'no-store'},3);try{if(r.ok){const c=await caches.open(STATIC_CACHE);event.waitUntil(staticStore(c,key,r.clone()));}}catch(_){}return r;})());return;}
    event.respondWith(staticResponse(request,event,key,'pixel'));return;
  }

  /* 美团店铺数据、美团图片、壁纸、声音：长期缓存，换版本不用重下 */
  /* 带 art= 的插画归新版本自己的插画缓存（PAGE_ART_CACHE_V1）管，这里不碰 */
  {const kind=url.searchParams.has('art')?'':staticKind(url.pathname);if(kind&&kind!=='pixel'){const key=new Request(url.origin+url.pathname);event.respondWith(staticResponse(request,event,key,kind).catch(()=>Response.error()));return;}}

  if(/\/assets\/app-icons\/glass\/(?:black|gray|pink|blue)\/[^/]+\.webp$/.test(url.pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(GLASS_ICON_CACHE),cached=await cache.match(request,{ignoreSearch:true});
      if(cached)return cached;
      try{const response=await fetch(request,{cache:'no-cache'});if(response&&response.ok)await cache.put(request,response.clone());return response;}catch(_){return Response.error();}
    })());
    return;
  }

  // App Store support/privacy and the signed-in role controller are ordinary
  // public documents. They must
  // never be replaced by the cached small-phone application shell.
  if(request.mode==='navigate'&&/\/north-(?:support|privacy|role-controller)\.html$/.test(url.pathname))return;

  // Fish 会员登录的授权码页（私人 App 在 Safari 登录后跳到这里）。以前访问过网页版的 Safari
  // 会被缓存的小手机外壳顶替，用户看不到授权码（2026-10-16 实机）。必须直接走网络。
  if(request.mode==='navigate'&&/\/fish-oauth\.html$/.test(url.pathname))return;

  // The owner and staff admin portals have their own application shells and
  // service workers. Never replace either portal with the cached phone shell.
  if(request.mode==='navigate'&&/\/admin(?:-owner)?(?:\/|$)/.test(url.pathname))return;

  // Recovery and launcher pages must bypass the application shell cache.
  // Otherwise the old worker serves the broken app shell again and the
  // "repair cache" button appears to do nothing.
  if(request.mode==='navigate'&&/(?:^|\/)(?:repair|index)\.html$/.test(url.pathname)){
    event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>new Response(
      '<meta charset="utf-8"><body style="background:#111;color:#eee;font-family:sans-serif;padding:30px;text-align:center">修复页暂时无法下载，请检查网络后重试；本机数据没有被删除。</body>',
      {headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}}
    )));
    return;
  }

  // Local visual previews must always load the exact requested document.
  // Otherwise an old cached app shell can replace the preview with the gate.
  if(request.mode==='navigate'&&(
    /\/theme-real-preview\.html$/.test(url.pathname)||
    (/\/小手机\.html$/.test(decodedPath)&&url.searchParams.has('northPreview'))
  )){
    event.respondWith(fetch(request,{cache:'no-store'}));
    return;
  }

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(SHELL_CACHE);
      const cached=await currentCore(cache,'html');
      const explicit=/\/小手机\.html$/.test(decodedPath)&&(url.searchParams.has('reload')||url.searchParams.has('open')||url.searchParams.has('from')||url.searchParams.has('north_update'));
      const reloading=request.cache==='reload'||request.cache==='no-cache';
      /* 「立即更新」要的正好是这个版本：装新版本时这一页已经存好、核对过，直接用，不再等 GitHub（以前要等最多 12 秒） */
      const wanted=String(url.searchParams.get('north_update')||'').replace(/\D/g,'');
      if(cached&&!reloading&&wanted&&wanted===BUILD)return cached;
      if(cached&&!explicit&&!reloading)return cached;
      try{
        /* 从桌面图标打开（带 open/from）也会走到这里：网络 3.5 秒内没回就先用存好的，不让人干等 */
        const response=explicit&&cached&&!reloading?await Promise.race([checkedResponse(request,'html',1),sleep(3500).then(()=>{throw new Error('slow');})]):await checkedResponse(request,'html',1);
        await cache.put(CORE_FILES.find(item=>item.kind==='html').url,response.clone());
        return response;
      }catch(_){
        if(cached)return cached;
        return new Response(
          '<meta charset="utf-8"><body style="background:#111;color:#eee;font-family:sans-serif;padding:30px;text-align:center">页面文件没有完整下载，请连接可访问 GitHub Pages 的网络后重新打开。聊天和角色数据不会丢失。</body>',
          {headers:{'Content-Type':'text/html;charset=utf-8'}}
        );
      }
    })());
    return;
  }

  if(/\/commerce-ui\.js$/.test(url.pathname)){event.respondWith((async()=>{const cache=await caches.open(SHELL_CACHE);return (await currentCore(cache,'commerce'))||checkedResponse(request,'commerce',2);})());return;}

  if(/\/app\.js$/.test(url.pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(SHELL_CACHE);
      return (await currentCore(cache,'app'))||checkedResponse(request,'app',2);
    })());
    return;
  }
  if(/\/license-gate\.js$/.test(url.pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(SHELL_CACHE);
      return (await currentCore(cache,'license'))||checkedResponse(request,'license',2);
    })());
    return;
  }
  if(/\/photo-album\.js$/.test(url.pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(SHELL_CACHE);
      return (await currentCore(cache,'album'))||checkedResponse(request,'album',2);
    })());
    return;
  }
  if(/\/couple-watch(?:-runtime)?\.js$/.test(url.pathname)){
    const kind=url.pathname.endsWith('-runtime.js')?'watchRuntime':'watch';
    event.respondWith((async()=>{const cache=await caches.open(SHELL_CACHE);return (await currentCore(cache,kind))||checkedResponse(request,kind,2);})());return;
  }
  if(/\/cohab-model-diagnostics\.js$/.test(url.pathname)){
    event.respondWith((async()=>{const cache=await caches.open(SHELL_CACHE);return (await currentCore(cache,'cohabDiagnostics'))||checkedResponse(request,'cohabDiagnostics',2);})());return;
  }
  if(/\/request-diagnostics\.js$/.test(url.pathname)){event.respondWith((async()=>{const cache=await caches.open(SHELL_CACHE);return (await currentCore(cache,'requestDiagnostics'))||checkedResponse(request,'requestDiagnostics',2);})());return;}

  if(/\/request-size-details\.js$/.test(url.pathname)){
    event.respondWith((async()=>{const cache=await caches.open(SHELL_CACHE);return (await currentCore(cache,'requestSize'))||checkedResponse(request,'requestSize',2);})());return;
  }
  const optionalPath=OPTIONAL_FILES.some(value=>{try{return new URL(value,self.location.href).pathname===url.pathname;}catch(_){return false;}});
  if(/\/assets\/north-runner-(?:(?:rider|street|van)\.png|(?:game|result)\.mp3)$/.test(url.pathname)||optionalPath||/\/commerce-ui\.js$/.test(url.pathname)||/\/(?:gift-effects|thought-card-effects)\.js$/.test(url.pathname)||/\/pet-game\.js$/.test(url.pathname)||/\/pet-game\.css$/.test(url.pathname)||/\/assets\/pet-room-v1\.webp$/.test(url.pathname)||/\/icon\.png$/.test(url.pathname)||/\/vendor\//.test(url.pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(SHELL_CACHE);
      const cached=await cache.match(request,{ignoreSearch:true});
      if(cached)return cached;
      try{
        const response=await fetchRetry(request,{cache:'no-cache'},2);
        if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
        return response;
      }catch(_){return Response.error();}
    })());
  }
});

function openUrlFor(data){
  const base=new URL('小手机.html',self.registration.scope);
  if(data&&data.target==='chat'&&data.id)base.hash='chat='+encodeURIComponent(data.id);
  else if(data&&data.target==='group'&&data.id)base.hash='group='+encodeURIComponent(data.id);
  else if(data&&data.target==='call')base.hash='call';
  else if(data&&data.target==='mail')base.hash='mail';
  else if(data&&data.target==='x')base.hash='x';
  return base.href;
}

self.addEventListener('notificationclick',event=>{
  const data=event.notification&&event.notification.data||{};
  event.notification.close();
  event.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){
      if('focus'in client){
        try{client.postMessage(Object.assign({type:'open'},data));}catch(e){}
        return client.focus();
      }
    }
    if(self.clients.openWindow)return self.clients.openWindow(openUrlFor(data));
  })());
});
