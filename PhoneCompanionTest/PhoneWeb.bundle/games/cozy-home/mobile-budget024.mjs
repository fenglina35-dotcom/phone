import * as T from 'three';

export const mobile = matchMedia('(pointer:coarse)').matches;
let recovery = false;
try {
  // Retire the sticky reload/quality fallback; context restoration keeps HD.
  localStorage.removeItem('cozy-graphics-recovery-v025');
  if(mobile)localStorage.setItem('cozy-boot-pending-v025','1');
} catch {}
let sharp=!recovery;try{const q=localStorage.getItem('cozy-quality-034');if(q)sharp=q==='native';}catch{}
export function qualityName(){return sharp?'高清':'省电';}
export function toggleSharp(){sharp=!sharp;try{localStorage.setItem('cozy-quality-034',sharp?'native':'standard');}catch{}return sharp;}
export function isSharp(){return sharp;}
export const lean = true; // Isolated integration test uses the proven mobile render path.
export const budget = {lean, recovery, postprocessing:false, reflectionCapture:!lean, texturesResized:0};
export function bootComplete(){try{localStorage.removeItem('cozy-boot-pending-v025');}catch{}}
export async function stage(text) {
  const el=document.getElementById('start');
  if(el?.disabled) el.textContent=text;
  // Give Safari a paint and let temporary model-build allocations be collected.
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
}
export function prepareMobileScene(scene) {
  if(!lean)return;
  const textures=new Set(),materials=new Set(),images=new Map(),sources=new Map();
  scene.traverse(o=>{
    // One directional shadow, no additional full-room shadow renders for task lights.
    if(o.isLight && !o.isDirectionalLight)o.castShadow=false;
    if(!o.isMesh)return;
    for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);
  });
  for(const m of materials){
    // Keep color, roughness and highlights; avoid full-screen transmission buffers.
    if(m.transmission>0){m.transmission=0;m.opacity=Math.min(m.opacity,.38);m.transparent=true;}
    for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
  }
  for(const t of textures){
    t.anisotropy=8;
    const im=t.image,w=im?.width,h=im?.height,limit=recovery?1024:2048;
    if(!w||!h||Math.max(w,h)<=limit||t.isDataTexture||t.isCubeTexture)continue;
    try{
      let c=images.get(im);
      if(!c){c=document.createElement('canvas');const k=limit/Math.max(w,h);c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));c.getContext('2d').drawImage(im,0,0,c.width,c.height);images.set(im,c);}
      // Keep one GPU source for one resized image; UV transforms stay on each texture.
      if(!sources.has(c))sources.set(c,new T.Source(c));
      t.source=sources.get(c);t.needsUpdate=true;budget.texturesResized++;
    }catch{/* Unsupported image source keeps its original appearance. */}
  }
}
// The two animated characters account for the largest group of textures visible
// in the entry view. On a phone, their 2048px body sheets exceed their maximum
// projected size while consuming 4x the memory of 1024px sheets. Resize only
// those character sheets before their first GPU upload; house artwork, furniture
// textures, geometry and output resolution remain unchanged.
export function prepareMobileCharacter(root) {
  if(!mobile)return 0;
  const textures=new Set(),images=new Map(),sources=new Map(),limit=1024;
  root.traverse(o=>{
    if(!o.isMesh)return;
    for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))
      for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
  });
  let resized=0;
  for(const t of textures){
    const im=t.image,w=im?.width,h=im?.height;
    if(!w||!h||Math.max(w,h)<=limit||t.isDataTexture||t.isCubeTexture)continue;
    let c=images.get(im);
    if(!c){c=document.createElement('canvas');const k=limit/Math.max(w,h);c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));c.getContext('2d').drawImage(im,0,0,c.width,c.height);images.set(im,c);}
    if(!sources.has(c))sources.set(c,new T.Source(c));
    t.source=sources.get(c);t.needsUpdate=true;resized++;
  }
  // ImageBitmap pixels are no longer referenced by character textures. Releasing
  // them avoids retaining the original decoded 2048px copies beside the canvases.
  for(const im of images.keys())if(typeof im.close==='function')try{im.close();}catch{}
  budget.characterTexturesResized=(budget.characterTexturesResized||0)+resized;
  return resized;
}
export function resolution(width=innerWidth,height=innerHeight){const native=Math.max(1,devicePixelRatio||1),pixels=sharp?3200000:1900000;return Math.min(native,sharp?3:1.5,Math.sqrt(pixels/(Math.max(1,width)*Math.max(1,height))));}
