'use strict';
window.PixelHomeBridge=(()=>{
  const token=new URLSearchParams(location.search).get('session'),pending=new Map();let sequence=0,revision=0,live=true;
  const origin=location.protocol==='file:'?'*':location.origin;
  function request(method,data){return new Promise((resolve,reject)=>{
    if(!live||!token||parent===window)return reject(new Error('请从小手机游戏大厅进入，绑定情侣空间角色后玩耍。'));
    const id=String(++sequence),timer=setTimeout(()=>{pending.delete(id);reject(new Error('小屋连接暂时中断，请返回游戏大厅重进；未重复调用模型。'));},method==='care'?80000:10000);
    pending.set(id,{resolve,reject,timer});parent.postMessage({type:'pixel-home-request',token,id,method,data,revision:method==='save'?++revision:undefined},origin);
  });}
  addEventListener('message',e=>{
    const m=e.data;if(e.source!==parent||e.origin!==(location.protocol==='file:'?'null':location.origin)||m?.type!=='pixel-home-response'||m.token!==token)return;
    if(m.id==='invalid'){live=false;document.dispatchEvent(new Event('pixel-home:invalid'));return;}
    if(m.id==='morning'){document.dispatchEvent(new CustomEvent('pixel-home:morning',{detail:m.data}));return;}
    const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(m.error)):p.resolve(m.data);
  });
  return Object.freeze({request});
})();
