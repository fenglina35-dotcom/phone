(function(){
  'use strict';
  if(typeof privateNativeAppOn==='function'&&privateNativeAppOn())return;

  /* Web-only repair: persisted images use idb:<key>. Treat those references as
     renderable so every sticker bubble leaves a hydration target in the DOM. */
  const baseIsImg=isImg;
  isImg=function(value){
    return baseIsImg(value)||(typeof isStoredImgRef==='function'&&isStoredImgRef(value));
  };

  /* The visible countdown is the permission boundary. A slow model response
     must not silently keep the owner's WeChat locked for another 45 seconds. */
  wxLoginActive=function(){
    const login=S&&S.wxLogin;
    return !!(login&&Date.now()<login.until);
  };

  function reconcileExpiredWxLogin(){
    if(S&&S.wxLogin&&Date.now()>=S.wxLogin.until&&typeof wxLogout==='function')wxLogout();
  }

  window.addEventListener('pageshow',reconcileExpiredWxLogin,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconcileExpiredWxLogin();});
  if('serviceWorker'in navigator&&location.protocol!=='file:'){
    const workerUrl='sw.js?v=1122&r=v1122-sticker-login-expiry-hotfix-2';
    navigator.serviceWorker.register(workerUrl,{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});
  }
  setTimeout(()=>{
    reconcileExpiredWxLogin();
    if(typeof render==='function'){
      const route=typeof cur==='function'?cur():null;
      if(route&&['chat','group','pfchat','pfgroup'].includes(route.p))render();
    }
  },0);

  window.__NORTH_WEB_HOTFIX__='v1122-sticker-login-expiry-2';
})();
