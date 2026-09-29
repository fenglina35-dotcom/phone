import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

async function fitted(file,height){
 const raw=(await new GLTFLoader().loadAsync(file)).scene;raw.updateMatrixWorld(true);
 const b=new T.Box3().setFromObject(raw),s=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());
 const k=height/s.y;raw.scale.multiplyScalar(k);raw.position.set(-c.x*k,-b.min.y*k,-c.z*k);
 raw.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.map)m.map.anisotropy=4;}});
 return raw;
}
export async function installMelody012(roots){
 const display=roots.find(r=>r.name==='bedroom_desk_display'),old=display?.getObjectByName('Painted sailor collectible');
 if(!old)throw Error('未找到卧室原手办，保留场景供检查');
 const model=await fitted('./models/my-melody-game-v001.glb',.30);
 old.clear();old.name='My Melody collectible 012';old.position.y=.014;old.add(model);
 old.userData={asset:'my-melody-game-v001.glb',heightMetres:.30,source:'Tripo image-to-3D v2.5',support:'Shelf top + 1 mm',static:true};
}
export async function installTeddy012(roots){
 const group=roots.find(r=>r.name==='kitchen_teddy_corner_v002');if(!group)throw Error('未找到餐厅小熊位置');
 const raw=await fitted('./models/teddy-ai-v001.glb',.47);
 for(const o of [...group.children])if(o.name.startsWith('Teddy'))o.removeFromParent();
 raw.position.y+=.385;raw.position.z+=.01;raw.name='AI teddy 001';group.add(raw);
}
