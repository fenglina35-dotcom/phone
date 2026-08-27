const BUILD='1089';
const HOTFIX='v1089-group-leave-care-progress-1';
const SHELL_CACHE='north-shell-v1089';
const GLASS_ICON_CACHE='north-glass-icons-v1';
const GLASS_ICON_PACKS=['black','gray','pink','blue'];
const GLASS_ICON_KEYS=['aiaccount','browser','calendar','cinema','couple','douyin','dread','food','games','mail','moments','music','offline','phoneapp','roleplay','settings','shop','spy','tale','tasks','travel','wechat','worldbook','x'];
const GLASS_ICON_FILES=GLASS_ICON_PACKS.flatMap(pack=>GLASS_ICON_KEYS.map(key=>'./assets/app-icons/glass/'+pack+'/'+key+'.webp'));
const CORE_FILES=[
  {url:'./小手机.html?v='+BUILD+'&r='+HOTFIX,kind:'html'},
  {url:'./license-gate.js?v='+BUILD,kind:'license'},
  {url:'./app.js?v='+BUILD+'&r='+HOTFIX,kind:'app'},
  {url:'./ai-account.js?v='+BUILD,kind:'ai'}
];
const OPTIONAL_FILES=[
  './icon.png',
  './assets/incoming-wechat-call-default-v2.mp3',
  './assets/message-notification-user-v1.mp3',
  './assets/pet-room-v1.webp',
  './commerce-ui.js?v='+BUILD,
  './delivery.js?v='+BUILD,
  './gift-effects.js?v='+BUILD,
  './thought-card-effects.js?v='+BUILD,
  './pet-game.js?v='+BUILD,
  './pet-game.css?v='+BUILD,
  './wechat-me.css?v='+BUILD,
  './wechat-me.js?v='+BUILD,
  './vendor/qr/qrcode.js?v='+BUILD,
  './vendor/qr/jsQR.js?v='+BUILD,
  './vendor/mp4box.all.mjs?v='+BUILD,
  './vendor/rolldown-runtime-w6R9maHv.mjs',
  './vendor/styp-9TIZZDLN.mjs',
  './vendor/MP4BOX-LICENSE.txt'
];

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
  if(kind==='html')return text.length>80000
    &&text.includes("window.__NORTH_SHELL_BUILD__='"+BUILD+"'")
    &&text.includes('app.js?v='+BUILD)
    &&text.includes('</style>')
    &&text.includes('</html>');
  if(kind==='app')return text.length>1200000
    &&text.includes("const APP_VER='v"+BUILD+' ')
    &&text.includes("window.__NORTH_SHELL_BUILD__!=='"+BUILD+"'")
    &&text.includes('showGate();');
  if(kind==='license')return text.length>10000
    &&text.includes('window.NorthLicense')
    &&text.includes('restorePasskey')
    &&text.includes('supportsPasskey');
  if(kind==='ai')return text.length>30000
    &&text.includes('function renderAIAccount()')
    &&text.includes('function aiAccountApplyResult(');
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

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    const core=await Promise.all(CORE_FILES.map(async item=>{
      const response=await checkedResponse(item.url,item.kind,3);
      return {item,response};
    }));
    for(const entry of core)await cache.put(entry.item.url,entry.response);
    await Promise.all(OPTIONAL_FILES.map(async url=>{
      try{
        const response=await fetchRetry(url,{cache:'no-cache'},2);
        if(response&&response.ok)await cache.put(url,response);
      }catch(_){}
    }));
    const iconCache=await caches.open(GLASS_ICON_CACHE);
    for(let i=0;i<GLASS_ICON_FILES.length;i+=8){
      await Promise.all(GLASS_ICON_FILES.slice(i,i+8).map(async url=>{
        try{const response=await fetchRetry(url,{cache:'no-cache'},2);if(response&&response.ok)await iconCache.put(url,response);}catch(_){}
      }));
    }
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
    await self.clients.claim();
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    windows.forEach(client=>{try{client.postMessage({type:'north-update-ready',build:BUILD});}catch(_){}});
  })());
});

self.addEventListener('message',event=>{
  if(!event.data||event.data.type!=='north-version-query')return;
  try{if(event.source)event.source.postMessage({type:'north-update-ready',build:BUILD});}catch(_){}
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  let url;
  try{url=new URL(request.url);}catch(_){return;}
  if(url.origin!==self.location.origin)return;

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

  // Local visual previews must always load the exact requested document.
  // Otherwise an old cached app shell can replace the preview with the gate.
  if(request.mode==='navigate'&&(
    /\/theme-real-preview\.html$/.test(url.pathname)||
    (/\/小手机\.html$/.test(url.pathname)&&url.searchParams.has('northPreview'))
  )){
    event.respondWith(fetch(request,{cache:'no-store'}));
    return;
  }

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(SHELL_CACHE);
      const cached=await currentCore(cache,'html');
      if(cached)return cached;
      try{
        const response=await checkedResponse(request,'html',1);
        await cache.put(CORE_FILES[0].url,response.clone());
        return response;
      }catch(_){
        return new Response(
          '<meta charset="utf-8"><body style="background:#111;color:#eee;font-family:sans-serif;padding:30px;text-align:center">页面文件没有完整下载，请连接可访问 GitHub Pages 的网络后重新打开。聊天和角色数据不会丢失。</body>',
          {headers:{'Content-Type':'text/html;charset=utf-8'}}
        );
      }
    })());
    return;
  }

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
  if(/\/ai-account\.js$/.test(url.pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(SHELL_CACHE);
      return (await currentCore(cache,'ai'))||checkedResponse(request,'ai',2);
    })());
    return;
  }
  if(/\/commerce-ui\.js$/.test(url.pathname)||/\/(?:gift-effects|thought-card-effects)\.js$/.test(url.pathname)||/\/pet-game\.js$/.test(url.pathname)||/\/pet-game\.css$/.test(url.pathname)||/\/assets\/pet-room-v1\.webp$/.test(url.pathname)||/\/icon\.png$/.test(url.pathname)||/\/vendor\//.test(url.pathname)){
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
