import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const wood=new T.MeshStandardMaterial({name:'018 drawer interior birch',color:'#bb9a72',roughness:.74});
const paper=new T.MeshStandardMaterial({name:'018 folded drawer linen',color:'#d9d4c9',roughness:.96});
function box(p,n,x,y,z,w,h,d,m=wood){const o=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(.004,w/4,h/4,d/4)),m);o.name=n;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
const normalized=n=>n.replace(/[_/]/g,' ').replace(/\s+/g,' ').trim();
// Called while the original named meshes still exist, before static batching.
export function extractLivingMechanisms(root,id){
 if(!['chest_detail','entry_detail','tv_detail','books_detail'].includes(id))return [];
 root.updateMatrixWorld(true);root.userData.legacyEditorWorldPivot=new T.Box3().setFromObject(root).getCenter(new T.Vector3()).toArray();
 const parts=[],claimed=new Set();root.traverse(o=>{if(o.isMesh)parts.push(o)});
 const take=(name,test,pivot,kind,travel)=>{const g=new T.Group();g.name=name;g.position.fromArray(pivot);root.add(g);root.updateMatrixWorld(true);
  parts.filter(o=>!claimed.has(o)&&test(normalized(o.name),o)).forEach(o=>{claimed.add(o);g.attach(o)});
  g.userData.mechanism018={label:name,kind,travel,rest:g.position.toArray(),open:false};return g;};
 const out=[];
 if(id==='chest_detail'){
  const carcass=parts.find(o=>normalized(o.name)==='Chest carcass');carcass?.removeFromParent();
  box(root,'Open cabinet left side',-.61,.44,0,.034,.60,.44);box(root,'Open cabinet right side',.61,.44,0,.034,.60,.44);
  box(root,'Cabinet back panel',0,.44,.205,1.22,.60,.023);box(root,'Cabinet bottom',0,.16,0,1.22,.025,.44);
  for(const [i,y] of [.245,.428,.611].entries()){
   const g=take('斗柜第'+(i+1)+'层抽屉',(n,o)=>/^Chest (drawer face|handle)/.test(n)&&Math.abs(o.position.y-y)<.03,[0,y,0],'slide',-.32);
   box(g,'Drawer bottom',0,-.061,-.012,1.11,.016,.39);box(g,'Drawer left side',-.547,-.008,-.005,.018,.12,.37);box(g,'Drawer right side',.547,-.008,-.005,.018,.12,.37);box(g,'Drawer rear',0,-.008,.178,1.10,.12,.018);
   if(i===1)box(g,'Folded spare linen',-.22,-.036,-.035,.38,.03,.25,paper);
   out.push(g);box(root,'Drawer shelf runner left',-.576,y-.056,0,.012,.012,.39);box(root,'Drawer shelf runner right',.576,y-.056,0,.012,.012,.39);
  }
 }else if(id==='entry_detail'){
  parts.find(o=>normalized(o.name)==='Entry drawer recess')?.removeFromParent();
  box(root,'Entry drawer rear wall',0,.71,.17,1.44,.16,.025);box(root,'Entry drawer divider',0,.71,0,.026,.16,.37);
  for(const x of[-.4,.4]){
   const g=take(x<0?'鞋柜左抽屉':'鞋柜右抽屉',(n,o)=>/^Entry (drawer (inset face|raised panel|rail)|brass pull)/.test(n)&&Math.sign(o.position.x)===Math.sign(x),[x,.709,0],'slide',-.28);
   box(g,'Entry drawer floor',0,-.052,-.012,.68,.014,.34);for(const sx of[-.329,.329])box(g,'Entry drawer side',sx,-.007,0,.014,.10,.34);box(g,'Entry drawer back',0,-.007,.161,.67,.10,.016);
   out.push(g);
  }
 }else if(id==='books_detail'){
  for(const side of[-1,1])out.push(take(side<0?'书柜左门':'书柜右门',(n,o)=>/^Bookcase (lower door|lower louvre|handle)/.test(n)&&Math.sign(o.position.x)===side,[side*1.035,0,-.229],'hinge',-side*1.30));
  box(root,'Stored linen box',.52,.27,.02,.54,.23,.32,paper);
 }else{
  for(const side of[-1,1]){
   const hinge=side*1.22;
   const g=take(side<0?'电视柜左门':'电视柜右门',(n,o)=>/^TV (door frame|broad horizontal louvre|brass handle)/.test(n)&&Math.sign(o.position.x)===side,[hinge,0,.215],'hinge',side*1.35);
   out.push(g);
  }
 }
 for(const g of out)g.removeFromParent();return out;
}
export function installLivingInteractions(house,renderer,world,roomControls){
 let mechanisms=[],lastMechanism=null;const defaults=new Map();
 const tv=house.assets.get('tv');let screens=[];tv?.traverse(o=>{if(o.isMesh&&/Screen glass/i.test(o.material?.name)){screens.push(o.material);const g=o.geometry;g.computeBoundingBox();const b=g.boundingBox,a=g.attributes.position,uv=g.attributes.uv||new T.BufferAttribute(new Float32Array(a.count*2),2);for(let i=0;i<a.count;i++)uv.setXY(i,(a.getX(i)-b.min.x)/(b.max.x-b.min.x),(a.getY(i)-b.min.y)/(b.max.y-b.min.y));g.setAttribute('uv',uv);uv.needsUpdate=true;}});
 screens=[...new Set(screens)];screens.forEach(m=>defaults.set(m,{map:m.map,emissive:m.emissive.clone(),emissiveIntensity:m.emissiveIntensity,color:m.color.clone(),envMapIntensity:m.envMapIntensity,roughness:m.roughness}));
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');
 const sky=ctx.createLinearGradient(0,0,0,256);sky.addColorStop(0,'#687f9a');sky.addColorStop(.60,'#efc7c3');sky.addColorStop(1,'#7b9da6');ctx.fillStyle=sky;ctx.fillRect(0,0,512,256);
 ctx.fillStyle='#f4dfb1';ctx.beginPath();ctx.arc(370,115,29,0,Math.PI*2);ctx.fill();for(let i=0;i<15;i++){ctx.strokeStyle=`rgba(237,225,208,${.13+i*.014})`;ctx.beginPath();ctx.moveTo(0,164+i*6);for(let x=0;x<513;x+=8)ctx.lineTo(x,164+i*6+Math.sin(x*.019+i)*3);ctx.stroke();}
 const channel=new T.CanvasTexture(canvas);channel.colorSpace=T.SRGBColorSpace;let tvOn=false;
 const collisionCache=new WeakMap();
 function refresh(){mechanisms=[];house.root.traverse(o=>{if(o.userData.mechanism018)mechanisms.push(o)});const ids=new Set(mechanisms.map(o=>'mechanism018-'+o.uuid));world.colliders=world.colliders.filter(c=>!c.id?.startsWith('mechanism018-')||ids.has(c.id));}
 refresh();
 function near(p,camera,ndc=new T.Vector2()){const life=house.life020?.near(p,camera,ndc);if(life)return life;const ray=new T.Raycaster();ray.far=3.2;ray.setFromCamera(ndc,camera);const hits=ray.intersectObjects(mechanisms,true);const hit=hits.find(h=>h.distance<2.6);if(hit){let g=hit.object;while(g&&!g.userData.mechanism018)g=g.parent;if(g)return {kind:'mechanism',object:g,label:(g.userData.mechanism018.open?'关闭':'打开')+g.name};}
  if(lastMechanism?.userData.mechanism018.open){const b=new T.Box3().setFromObject(lastMechanism);const h=ray.intersectObject(lastMechanism.parent,true).find(h=>h.distance<2.2&&h.point.y<=b.max.y+.08);if(h)return {kind:'mechanism',object:lastMechanism,label:'关闭'+lastMechanism.name};}
  if(house.fan&&ray.intersectObject(house.fan.parent,true).some(h=>h.distance<3.2))return {kind:'fan',label:house.fan.userData.paused?'打开吊扇':'停止吊扇'};
  const fixture=roomControls.nearFixture(p,camera,ndc);if(fixture)return fixture;
  for(const [id,lamp] of [['entry_console','entry'],['living_chest','chest'],['floor_lamp','reading']]){const root=house.assets.get(id);const h=root&&ray.intersectObject(root,true).find(h=>h.distance<2.1&&/lamp (shade|diffuser)/i.test(h.object.material?.name));if(h)return {kind:'lamp',lamp,label:roomControls.fixtureLabel(lamp)};}
  for(const id of ['sofa','side_seat','dining_a','dining_b']){const o=house.assets.get(id);if(!o)continue;const b=new T.Box3().setFromObject(o),q=new T.Vector3(p.x,.48,p.z);if(p.y>-.1&&b.distanceToPoint(q)<.62&&ray.intersectObject(o,true).some(h=>h.distance<2.0)){return {kind:'seat',object:o,label:id.startsWith('dining')?'坐到餐椅上':id==='sofa'?'坐到沙发上':'坐到侧沙发上'};}}
  if(p.y>-.1&&Math.hypot(p.x-10.7,p.z-1.0)<1.5)return {kind:'tv',label:tvOn?'关闭电视':'打开电视'};
  return null;
 }
 function activate(a,p){
  if(a.kind==='life'||a.kind==='water')return house.life020.activate(a,p);
  if(a.kind==='mechanism'){const g=a.object,d=g.userData.mechanism018,slide=d.kind.startsWith('slide'),axis=d.kind.endsWith('X')?'x':slide?'z':'y',channel=slide?g.position:g.rotation,old=channel[axis],end=(slide?d.rest[axis==='x'?0:2]:0)+(d.open?0:d.travel);g.updateWorldMatrix(true,true);const sweep=new T.Box3().setFromObject(g);
   for(let i=1;i<=8;i++){channel[axis]=T.MathUtils.lerp(old,end,i/8);g.updateWorldMatrix(true,true);sweep.union(new T.Box3().setFromObject(g));}channel[axis]=old;g.updateWorldMatrix(true,true);
   const x=Math.max(sweep.min.x,Math.min(p.x,sweep.max.x)),z=Math.max(sweep.min.z,Math.min(p.z,sweep.max.z));if(p.y<sweep.max.y&&p.y+1.8>sweep.min.y&&Math.hypot(x-p.x,z-p.z)<.28)return {message:'请退后或站到侧面，给抽屉或柜门留出空间'};
   d.open=!d.open;lastMechanism=g;return {message:(d.open?'已打开':'已关闭')+g.name};}
  if(a.kind==='seat'){a.object.updateWorldMatrix(true,true);const b=new T.Box3().setFromObject(a.object),center=b.getCenter(new T.Vector3());const forward=new T.Vector3(0,0,-1).transformDirection(a.object.matrixWorld);return {seat:{x:center.x,y:0,z:center.z,yaw:Math.atan2(-forward.x,-forward.z),pitch:-.08},message:'已坐下 · 点击起身或按 E'};}
  if(a.kind==='tv'){tvOn=!tvOn;for(const m of screens){const old=defaults.get(m);m.map=tvOn?channel:old.map;m.color.copy(tvOn?new T.Color('#ffffff'):old.color);m.emissive.copy(tvOn?new T.Color('#ffffff'):old.emissive);m.emissiveMap=tvOn?channel:null;m.emissiveIntensity=tvOn?.45:old.emissiveIntensity;m.envMapIntensity=tvOn?.08:old.envMapIntensity;m.roughness=tvOn?.5:old.roughness;m.needsUpdate=true;}return {message:tvOn?'电视已打开':'电视已关闭'};}
  if(a.kind==='fan'){house.fan.userData.paused=!house.fan.userData.paused;return {message:house.fan.userData.paused?'吊扇已停止':'吊扇已打开'};}
  if(a.kind==='lamp')return {message:roomControls.toggleFixture(a.lamp)};
 }
 return {near,activate,refresh,get mechanisms(){return mechanisms},state:()=>({tvOn,drawers:mechanisms.map(o=>({name:o.name,open:o.userData.mechanism018.open}))}),
  update(dt){if(tvOn)for(const m of screens){m.color.set('#ffffff');m.envMapIntensity=.08;m.roughness=.5;}let moving=false;for(const g of mechanisms){const d=g.userData.mechanism018,slide=d.kind.startsWith('slide'),axis=d.kind.endsWith('X')?'x':slide?'z':'y',channel=slide?g.position:g.rotation,old=channel[axis],target=(slide?d.rest[axis==='x'?0:2]:0)+(d.open?d.travel:0);
    channel[axis]=T.MathUtils.damp(old,target,10,dt);moving ||=Math.abs(old-channel[axis])>.00001;
    g.updateWorldMatrix(true,false);const cached=collisionCache.get(g);if(cached&&cached.equals(g.matrixWorld))continue;collisionCache.set(g,g.matrixWorld.clone());const b=new T.Box3().setFromObject(g),id='mechanism018-'+g.uuid;let c=world.colliders.find(c=>c.id===id);if(!c){c={id,kind:'moving furniture'};world.colliders.push(c);}Object.assign(c,{x:b.min.x,z:b.min.z,w:b.max.x-b.min.x,d:b.max.z-b.min.z,base:b.min.y,height:b.max.y-b.min.y});
   }if(moving)renderer.shadowMap.needsUpdate=true;}
 };
}
