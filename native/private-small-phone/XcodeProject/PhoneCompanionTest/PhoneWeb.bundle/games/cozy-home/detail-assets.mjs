import {extractLivingMechanisms} from './living-interactions-v018.mjs';
import * as T from 'three';
import {installSofa012} from './sofa-ai-v012.mjs';
import {refineUmbrella} from './entry-handle.mjs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Furniture remains independent. Merge only compatible static parts within
// each furniture root; editable named parts remain in the Blender master.
function batch(root){
 root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),buckets=new Map(),parts=[];
 root.traverse(o=>{if(!o.isMesh)return;parts.push(o.name);const source=o.geometry,mats=Array.isArray(o.material)?o.material:[o.material];
  for(const g of source.groups.length?source.groups:[{start:0,count:source.index?.count||source.attributes.position.count,materialIndex:0}]){
   const m=Array.isArray(o.material)?mats[g.materialIndex||0]:o.material;let geo=source.index?source.toNonIndexed():source.clone();
   const sliced=new T.BufferGeometry();for(const [name,a] of Object.entries(geo.attributes)){if(name==='tangent')continue;const data=a.array.slice(g.start*a.itemSize,(g.start+g.count)*a.itemSize);sliced.setAttribute(name,new T.BufferAttribute(data,a.itemSize,a.normalized));}geo.dispose();
   sliced.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
   const key=m.uuid+'|'+Object.keys(sliced.attributes).sort().join(',');if(!buckets.has(key))buckets.set(key,{m,geos:[]});buckets.get(key).geos.push(sliced);
  }
 });
 root.clear();for(const {m,geos} of buckets.values()){const merged=mergeGeometries(geos,false);if(!merged)throw Error('家具合并失败');const mesh=new T.Mesh(merged,m);mesh.name=m.name;mesh.castShadow=!m.transparent;mesh.receiveShadow=true;root.add(mesh);geos.forEach(g=>g.dispose());
  for(const key of ['map','normalMap','roughnessMap'])if(m[key])m[key].anisotropy=4;
 }
 root.userData.sourceParts=parts;root.userData.drawBatches=buckets.size;
}
export async function applyDetailAssets(house){
 const {scene}=await new GLTFLoader().loadAsync('./models/furniture-v009.glb',e=>{const el=document.getElementById('start');if(el?.disabled)el.textContent=e.lengthComputable?'正在下载家具 '+Math.round(e.loaded/e.total*100)+'%…':'正在下载家具 '+(e.loaded/1048576).toFixed(1)+' MB…';});scene.updateMatrixWorld(true);
 const mapping={sofa_detail:'sofa',coffee_detail:'coffee',tv_detail:'tv',workbench_detail:'workbench',work_chair_detail:'work_chair',books_detail:'living_books',chest_detail:'living_chest',entry_detail:'entry_console',side_seat_detail:'side_seat',floor_lamp_detail:'floor_lamp'};
 const ids=['sofa_detail','coffee_detail','tv_detail','curtain_left','curtain_right','rug_detail','workbench_detail','work_chair_detail','books_detail','chest_detail','entry_detail','side_seat_detail','floor_lamp_detail','wall_decor','wall_pictures','botanicals','ceiling_fan'];
 const report=[];
 for(const sourceId of ids){const root=scene.getObjectByName(sourceId);if(!root)throw Error('家具资产缺少 '+sourceId);
  const transform=root.matrixWorld.clone(),id=mapping[sourceId],old=id?house.assets.get(id):null;
  if(id&&!old)throw Error('户型家具缺少 '+id);root.removeFromParent();transform.decompose(root.position,root.quaternion,root.scale);
  const parent=sourceId.startsWith('work')?house.basement:house.main;parent.add(root);
  if(old){root.userData={...old.userData,sourceAsset:sourceId};root.name=id;old.removeFromParent();house.assets.set(id,root);}
  else root.userData.sourceAsset=sourceId;
  if(sourceId==='sofa_detail'){root.updateMatrixWorld(true);root.userData.legacyEditorWorldPivot=new T.Box3().setFromObject(root).getCenter(new T.Vector3()).toArray();}
  if(sourceId==='ceiling_fan'){
   house.fan=root.getObjectByName('fan_rotor');root.updateMatrixWorld(true);
   house.fan.userData.spinAxis=new T.Vector3(0,1,0).applyQuaternion(house.fan.getWorldQuaternion(new T.Quaternion()).invert());
   root.userData.sourceParts=[];root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;root.userData.sourceParts.push(o.name)}});root.userData.drawBatches=root.userData.sourceParts.length;
  }else{
   if(sourceId==='entry_detail')refineUmbrella(root);
   const movable=[];
   for(const [fragment,key,label,kind] of [['Sofa / Melody cushion','pillow_melody','印花抱枕','pillow'],['Sofa / sage cushion','pillow_sage','绿色抱枕','pillow'],['Side seat / supported cushion','pillow_side','侧沙发白抱枕','pillow'],['Side wall','art_side','侧沙发墙画','decor'],['Entry rack','entry_rack','挂衣架与外套','decor'],['Umbrella','umbrella','雨伞与伞筒','furniture']]){
    const selected=[];root.traverse(o=>{if(o.isMesh&&o.name.replace(/[_/]/g,' ').replace(/\s+/g,' ').includes(fragment.replaceAll('/',' ').replace(/\s+/g,' ')))selected.push(o)});
    if(!selected.length)continue;
    const g=new T.Group();g.name=key;g.userData.editablePart={id:key,label,kind};root.add(g);root.updateMatrixWorld(true);
    const bounds=new T.Box3();selected.forEach(o=>bounds.expandByObject(o));const pivot=key==='umbrella'&&root.userData.umbrellaPivot?new T.Vector3(...root.userData.umbrellaPivot):bounds.getCenter(new T.Vector3());g.position.copy(root.worldToLocal(pivot));g.quaternion.copy(root.getWorldQuaternion(new T.Quaternion()).invert());g.updateMatrixWorld(true);selected.forEach(o=>g.attach(o));batch(g);movable.push(g);g.removeFromParent();
   }
   const mechanisms=extractLivingMechanisms(root,sourceId);batch(root);for(const g of mechanisms)root.add(g);if(sourceId==='sofa_detail')await installSofa012(root);for(const g of movable){root.add(g);root.userData.sourceParts.push(...g.userData.sourceParts);root.userData.drawBatches+=g.userData.drawBatches;if(['decor','furniture'].includes(g.userData.editablePart.kind)){house.main.attach(g);g.userData.sourceAsset=g.userData.editablePart.id;}}
  }
  report.push({id:root.name,parts:root.userData.sourceParts.length,drawBatches:root.userData.drawBatches});
 }
 house.root.getObjectByName('LivingRug')?.removeFromParent();house.detailAssets=report;
}

