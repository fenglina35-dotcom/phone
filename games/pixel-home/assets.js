'use strict';
window.PixelHomeAssets=(()=>{
  const base=new URL('.',document.currentScript?.src||location.href),scripts=new Map();
  function loadScript(path,timeout=90000){
    const url=new URL(path,base).href;
    if(scripts.has(url))return scripts.get(url);
    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');let done=false;
      const finish=error=>{if(done)return;done=true;clearTimeout(timer);script.onload=script.onerror=null;script.remove();error?reject(error):resolve();};
      const timer=setTimeout(()=>finish(new Error('资源读取超时：'+path)),timeout);
      script.onload=()=>finish();script.onerror=()=>finish(new Error('资源下载失败：'+path));script.src=url;document.head.append(script);
    });
    scripts.set(url,promise);promise.catch(()=>scripts.delete(url));return promise;
  }
  function loadImage(url,label='图片',timeout=45000){
    return new Promise((resolve,reject)=>{
      const image=new Image();let done=false;
      const finish=error=>{if(done)return;done=true;clearTimeout(timer);image.onload=image.onerror=null;error?reject(error):resolve(image);};
      const timer=setTimeout(()=>finish(new Error('图片读取超时：'+label)),timeout);
      image.onload=()=>finish(image.naturalWidth>0?null:new Error('图片内容为空：'+label));
      image.onerror=()=>finish(new Error('图片读取失败：'+label));
      // onload also works when decode() is absent or unreliable in a WebView.
      image.src=url;
      if(image.complete&&image.naturalWidth>0)finish();
    });
  }
  async function load(name){
    if(!/^[a-z0-9-]+\.png$/.test(name))throw new Error('Invalid bundled image');
    if(location.protocol!=='file:')return loadImage(new URL('assets/'+name,base).href,name);
    // Keep native asset-data loads serial: these files share one temporary slot.
    try{
      await loadScript('asset-data/'+name+'.js',15000);
      if(!window.PixelHomeLocalImage?.startsWith('data:image/png;base64,'))throw new Error('素材数据缺失：'+name);
      return await loadImage(window.PixelHomeLocalImage,name);
    }finally{delete window.PixelHomeLocalImage;scripts.delete(new URL('asset-data/'+name+'.js',base).href);}
  }
  async function loadCatalog(){
    if(!window.PixelWardrobeData)await loadScript('wardrobe/data.js?v=1206');
    const data=window.PixelWardrobeData;
    if(!data?.catalog||!data.images)throw new Error('衣柜数据未能读取');
    const entries=Object.entries(data.images),images={};let cursor=0;
    // Bound concurrent image decodes to avoid a large startup memory spike.
    await Promise.all(Array.from({length:3},async()=>{
      while(cursor<entries.length){const [name,url]=entries[cursor++];images[name]=await loadImage(url,name);}
    }));
    return{catalog:data.catalog,images};
  }
  function createCanvas(width,height){
    if(typeof OffscreenCanvas==='function'){try{const canvas=new OffscreenCanvas(width,height);if(canvas.getContext('2d'))return canvas;}catch(_){}}
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;
  }
  function showFailure(container,error){
    if(!container)return;
    container.replaceChildren();container.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;font-size:15px;line-height:1.6;letter-spacing:0';
    const label=document.createElement('span');label.textContent='素材暂时没打开，可重试加载。已保存的进度不会清除。';
    const detail=document.createElement('small');detail.textContent=error?.message||'请检查网络后重试';
    const button=document.createElement('button');button.type='button';button.textContent='重新加载游戏';
    button.onclick=async()=>{
      if(!window.PixelHomeBridge)return location.reload(); // Standalone wardrobe has no parent save sequence.
      button.disabled=true;
      try{await window.PixelHomeBridge.request('restart');}catch(e){detail.textContent=e.message||'重试失败，请返回游戏大厅重新进入';button.disabled=false;}
    };
    container.append(label,detail,button);
  }
  return Object.freeze({load,loadScript,loadImage,loadCatalog,createCanvas,showFailure});
})();
