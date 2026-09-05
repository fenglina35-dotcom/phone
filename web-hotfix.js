(function(){
  'use strict';
  if(typeof privateNativeAppOn==='function'&&privateNativeAppOn())return;

  /* Web-only repair: persisted images use idb:<key>. Treat those references as
     renderable so every sticker bubble leaves a hydration target in the DOM. */
  const baseIsImg=isImg;
  function withBaseImageCheck(render,receiver,args){
    const activeIsImg=isImg;
    isImg=baseIsImg;
    try{return render.apply(receiver,args);}
    finally{isImg=activeIsImg;}
  }

  /* isImg is also used by avatar renderers. Those renderers already have a
     dedicated idb branch, so keep their original ordering instead of emitting
     an invalid <img src="idb:..."> URL. */
  if(typeof av==='function'){
    const baseAvatarHTML=av;
    av=function(){return withBaseImageCheck(baseAvatarHTML,this,arguments);};
  }
  if(typeof _mAvHTML==='function'){
    const baseMusicAvatarHTML=_mAvHTML;
    _mAvHTML=function(){return withBaseImageCheck(baseMusicAvatarHTML,this,arguments);};
  }
  if(typeof spyLockAvatar==='function'){
    const baseSpyAvatarHTML=spyLockAvatar;
    spyLockAvatar=function(){return withBaseImageCheck(baseSpyAvatarHTML,this,arguments);};
  }
  if(typeof callStoredImageSource==='function'){
    const baseCallStoredImageSource=callStoredImageSource;
    callStoredImageSource=function(){return withBaseImageCheck(baseCallStoredImageSource,this,arguments);};
  }
  if(typeof coAvatar==='function'){
    const baseCohabAvatarHTML=coAvatar;
    coAvatar=function(contact){
      const value=contact&&contact.avatar;
      if(!isStoredImgRef(value))return withBaseImageCheck(baseCohabAvatarHTML,this,arguments);
      const key=String(value).slice(4),src=_imgCache[key];
      if(src)return `<img src="${src}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex:none">`;
      return `<div class="avatar" data-idb-avatar="${esc(key)}" style="width:34px;height:34px;border-radius:50%;background:#3a2f36;display:flex;align-items:center;justify-content:center;flex:none">${_avIc('user')}</div>`;
    };
  }
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
    const workerUrl='sw.js?v=1181&r=v1181-theater-presence-release-1';
    navigator.serviceWorker.register(workerUrl,{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});
  }
  setTimeout(()=>{
    reconcileExpiredWxLogin();
    if(typeof render==='function'){
      const route=typeof cur==='function'?cur():null;
      if(route&&['chat','group','pfchat','pfgroup'].includes(route.p))render();
    }
  },0);

  window.__NORTH_WEB_HOTFIX__='v1181-theater-presence-release-1';
})();
