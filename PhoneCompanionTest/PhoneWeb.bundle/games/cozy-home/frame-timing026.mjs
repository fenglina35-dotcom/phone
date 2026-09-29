export function createFrameTiming(){
 const values=new Float32Array(600);let cursor=0,count=0;
 const read=()=>{let ms=0,n=0,long=0;for(let i=0;i<count&&ms<5000;i++){const v=values[(cursor-1-i+600)%600];ms+=v;n++;if(v>50)long++;}return {fps:ms?Math.round(n*1000/ms):0,longFrames:long,samples:n,windowMs:Math.round(ms)};};
 const button=document.createElement('button'),label=document.createElement('div');button.textContent='帧率';button.id='frameRateButton';button.setAttribute('aria-pressed','false');label.id='frameRateLabel';label.hidden=true;label.style.cssText='position:absolute;top:90px;left:18px;padding:7px 10px;border-radius:10px;background:#fff9f1ef;color:#594d45;font-size:12px;pointer-events:none;z-index:6';
 document.querySelector('header nav').append(button);document.body.append(label);
 const paint=()=>{const s=read();label.textContent=`${window.cozy?.revision??41} · 近5秒：${s.fps} 帧/秒 · 超过50毫秒的帧 ${s.longFrames} 次`;};
 button.onclick=()=>{label.hidden=!label.hidden;button.setAttribute('aria-pressed',String(!label.hidden));paint();};
 setInterval(()=>{if(!label.hidden&&!document.hidden)paint()},1000);
 return {read,reset(){count=0;cursor=0;},record(ms){if(ms<=0)return;values[cursor]=ms;cursor=(cursor+1)%600;count=Math.min(count+1,600);}};
}
