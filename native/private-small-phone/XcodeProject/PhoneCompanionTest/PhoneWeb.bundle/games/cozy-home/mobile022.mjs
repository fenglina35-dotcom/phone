// App-only adaptation. Existing furniture and lamp storage keys remain intact.
const KEY='cozy-private-checkpoint-v022';
const header=document.querySelector('header'),menu=document.createElement('button');
menu.id='mobileMenu';menu.textContent='菜单';menu.setAttribute('aria-expanded','false');header.append(menu);
menu.onclick=()=>{const on=header.classList.toggle('menu-open');menu.setAttribute('aria-expanded',String(on));menu.textContent=on?'收起':'菜单'};
header.querySelector('nav').addEventListener('click',e=>{if(e.target.closest('button')){header.classList.remove('menu-open');menu.setAttribute('aria-expanded','false');menu.textContent='菜单'}});
let ready=false,restoreError=null,lastSafe=null;
const wait=setInterval(()=>{if(!window.cozy?.ready)return;clearInterval(wait);const c=window.cozy;
 try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s?.schema===1){
  const p=s.player;
  if(p&&['x','y','z','yaw','pitch'].every(k=>Number.isFinite(p[k]))&&Math.abs(p.pitch)<1.6&&c.world.valid(p.x,p.z,p.y)!==null){lastSafe=p;c.setPosition(p.x,p.y,p.z,p.yaw,p.pitch)}
  if(['day','evening'].includes(s.time))c.lighting.setMode(s.time);
 }}catch(e){restoreError=String(e)}
 ready=true;
},150);
function snapshot(){const out={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('cozy-'))out[k]=localStorage.getItem(k)}return out}
function save(){if(!ready)return false;try{const c=cozy,s=c.state();if(s.started&&s.mode==='walk'&&!s.seated&&c.world.valid(c.player.x,c.player.z,c.player.y)!==null)lastSafe={...c.player};
 if(lastSafe)localStorage.setItem(KEY,JSON.stringify({schema:1,player:lastSafe,time:c.lighting.state().mode,savedAt:Date.now()}));
 const bridge=window.webkit?.messageHandlers.cozySave;if(bridge)bridge.postMessage(snapshot());return true;
 }catch(e){restoreError=String(e);return false}}
window.cozyMobile={save,snapshot,status:()=>({ready,restoreError,lastSafe})};
// Checkpoints wait for an idle hand; furniture and lamp saves remain immediate.
let lastInput=0;const heldPointers=new Set();for(const name of ['pointerdown','pointermove','pointerup','pointercancel','keydown'])addEventListener(name,e=>{lastInput=performance.now();if(name==='pointerdown')heldPointers.add(e.pointerId);if(name==='pointerup'||name==='pointercancel')heldPointers.delete(e.pointerId)},{passive:true});addEventListener('blur',()=>heldPointers.clear());
setInterval(()=>{if(!heldPointers.size&&performance.now()-lastInput>900)save()},2500);addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden){heldPointers.clear();save()}});
// A restored WebGL context can resume without discarding the scene or saves.
const view=document.querySelector('#view');let recoveryTimer=null;
view.addEventListener('webglcontextlost',e=>{
 e.preventDefault();save();clearTimeout(recoveryTimer);
 const el=document.querySelector('#error');el.hidden=false;el.dataset.graphicsLost='1';
 el.textContent='画面暂时中断，正在恢复，存档保留。';
 recoveryTimer=setTimeout(()=>{
  if(el.dataset.graphicsLost!=='1')return;
  el.textContent='画面尚未恢复，存档保留。';
  const b=document.createElement('button');b.textContent='重新打开小家';b.style.cssText='display:block;margin-top:16px;padding:14px';
  b.onclick=()=>location.reload();el.append(b);
 },15000);
});
view.addEventListener('cozy-render-restored',()=>{
 clearTimeout(recoveryTimer);const el=document.querySelector('#error');
 if(el.dataset.graphicsLost==='1'){delete el.dataset.graphicsLost;el.hidden=true;el.textContent='';}
});
