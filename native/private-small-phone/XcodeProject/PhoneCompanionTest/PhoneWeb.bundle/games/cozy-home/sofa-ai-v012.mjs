import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Keep the old static child slots: saved duplicate poses use child indices.
export async function installSofa012(root){
 const raw=(await new GLTFLoader().loadAsync('./models/sofa-game-v001.glb')).scene;
 raw.rotation.y=Math.PI;raw.updateMatrixWorld(true);
 const b=new T.Box3().setFromObject(raw),s=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());
 const fit=new T.Matrix4().makeScale(3/s.x,1.075/s.y,1.02/s.z).multiply(new T.Matrix4().makeTranslation(-c.x,-b.min.y,-c.z));
 const geos=[];let material;
 raw.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone();g.applyMatrix4(new T.Matrix4().multiplyMatrices(fit,o.matrixWorld));geos.push(g);material=o.material;});
 const geometry=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());
 if(!geometry||!material||Array.isArray(material))throw Error('沙发模型格式需要人工检查');
 // Depress the supporting cloth, not the user's independent pillow transforms.
 const pos=geometry.attributes.position;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
  const contact=(.029*Math.exp(-(((x+.99)/.32)**2))+.024*Math.exp(-(((x-.98)/.32)**2)))*Math.exp(-(((z+.045)/.20)**2))*Math.exp(-(((y-.63)/.15)**4));
  pos.setY(i,y-contact);
 }
 pos.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 material=material.clone();material.name='Anime ivory linen sofa 012';material.roughness=.96;material.metalness=0;
 if(material.map)material.map.anisotropy=4;
 const slots=root.children.filter(o=>o.isMesh);if(!slots.length)throw Error('缺少沙发原静态槽位');
 slots[0].geometry=geometry;slots[0].material=material;slots[0].castShadow=true;slots[0].receiveShadow=true;
 for(const slot of slots.slice(1)){slot.visible=false;slot.geometry=new T.BufferGeometry();slot.geometry.setAttribute('position',new T.Float32BufferAttribute([],3));}
 root.userData.aiSofa012={asset:'sofa-game-v001.glb',size:[3,1.075,1.02],style:'soft anime; matte linen; existing fine contour',legacySlots:slots.length};
}
