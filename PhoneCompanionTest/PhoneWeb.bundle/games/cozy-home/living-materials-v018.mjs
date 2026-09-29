import * as T from 'three';
function pattern(type){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),im=ctx.createImageData(256,256);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4;let v=type==='wood'?128+19*Math.sin(y*.32+2*Math.sin(x*.016))+7*Math.sin(y*.93+x*.008):128+13*Math.sin(x*Math.PI/2)+13*Math.sin(y*Math.PI/2);im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}ctx.putImageData(im,0,0);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(type==='wood'?2:5,type==='wood'?2:5);t.anisotropy=4;return t;}
export function refineLivingMaterials018(house){const wood=pattern('wood'),fabric=pattern('fabric'),changed=new Set();
 for(const id of ['sofa','coffee','tv','living_books','living_chest','entry_console','side_seat','floor_lamp'])house.assets.get(id)?.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m.isMeshStandardMaterial||changed.has(m))continue;changed.add(m);const n=m.name.toLowerCase();
   if(/oak|wood|birch/.test(n)){if(!m.normalMap&&!m.bumpMap){m.bumpMap=wood;m.bumpScale=.0011;}m.roughness=Math.max(.51,m.roughness);}
   if(/linen|cotton|woven|upholster|cloth|fabric/.test(n)){if(!m.normalMap&&!m.bumpMap){m.bumpMap=fabric;m.bumpScale=.00065;}m.roughness=.93;m.metalness=0;}
   if(/brass|nickel/.test(n)){m.roughness=Math.max(.3,m.roughness);}
   m.needsUpdate=true;
 }});house.materials018={refined:changed.size,style:'subtle oak grain, woven cloth and restrained metal highlights'};
}
export async function installWindowPictures018(house,lighting){
 const loader=new T.TextureLoader(),[day,night]=await Promise.all([loader.loadAsync('./textures/window-day-user.jpg'),loader.loadAsync('./textures/window-night-user.jpg')]);
 for(const t of [day,night]){t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;}
 // The supplied pictures are opaque glass imagery, placed only on existing panes.
 const material=new T.MeshBasicMaterial({name:'User day and night window picture',map:day,side:T.DoubleSide,toneMapped:false});
 const panes=[];house.main.traverse(o=>{if(o.name==='Window'&&o.isMesh){o.material=material;o.castShadow=o.receiveShadow=false;panes.push(o);}if(o.name==='Sealed opaque mist backing')o.visible=false;});
 let last;return {panes,update(){const next=lighting.state().mode;if(next!==last){material.map=next==='evening'?night:day;material.needsUpdate=true;last=next;}},state:()=>({panes:panes.length,mode:last,day:'window-day-user.jpg',night:'window-night-user.jpg'})};
}
