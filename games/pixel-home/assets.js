'use strict';
window.PixelHomeAssets=Object.freeze({
  async load(name){
    if(!/^[a-z0-9-]+\.png$/.test(name))throw new Error('Invalid bundled image');
    const image=new Image();
    if(location.protocol==='file:'){
      // Native file URLs may taint canvas. Encode the exact bundled PNG instead
      // of weakening WKWebView file permissions or patching the native bridge.
      const script=document.createElement('script');script.src='asset-data/'+name+'.js';
      try{
        await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('素材读取超时')),10000);script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);reject(new Error('素材未能读取'));};document.head.append(script);});
        if(!window.PixelHomeLocalImage?.startsWith('data:image/png;base64,'))throw new Error('素材数据缺失');
        image.src=window.PixelHomeLocalImage;
      }finally{delete window.PixelHomeLocalImage;script.remove();}
    }else image.src='assets/'+name;
    await image.decode();return image;
  }
});
