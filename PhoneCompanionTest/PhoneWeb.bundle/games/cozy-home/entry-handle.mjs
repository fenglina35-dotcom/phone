import * as T from 'three';
// Called on unbatched GLB geometry. Retain the original editable pivot even when silhouette changes.
export function refineUmbrella(root){
 const parts=[];root.traverse(o=>{if(o.isMesh&&/Umbrella/i.test(o.name))parts.push(o)});if(!parts.length)return;
 root.updateMatrixWorld(true);const bounds=new T.Box3();parts.forEach(o=>bounds.expandByObject(o));root.userData.umbrellaPivot=bounds.getCenter(new T.Vector3()).toArray();
 const handle=parts.find(o=>/curved.*wooden.*handle/i.test(o.name.replaceAll('_',' ')));if(!handle)return;
 const b=new T.Box3().setFromObject(handle),shaft=parts.find(o=>/shaft/i.test(o.name));if(!shaft)return;
 const sb=new T.Box3().setFromObject(shaft),x=(sb.min.x+sb.max.x)/2,z=(sb.min.z+sb.max.z)/2,y=sb.max.y,r=.042;
 const pts=[];for(let i=0;i<=36;i++){const a=i/36*Math.PI*1.04;pts.push(new T.Vector3(x+r*(1-Math.cos(a)),y+r*Math.sin(a),z));}
 const geometry=new T.TubeGeometry(new T.CatmullRomCurve3(pts),64,.0095,10,false),o=new T.Mesh(geometry,handle.material);o.name=handle.name+' 010 compact J';
 root.updateMatrixWorld(true);geometry.applyMatrix4(root.matrixWorld.clone().invert());root.add(o);handle.removeFromParent();
}
