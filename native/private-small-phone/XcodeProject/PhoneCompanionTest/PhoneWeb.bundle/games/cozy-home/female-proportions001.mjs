import * as T from 'three';
// Change the bind geometry and skeleton together. The head is translated, not scaled.
export function makeHeightAdapter(model,bones,rest,clips){
 const originals={},skeletons=new Set(),tracks=[];
 model.updateMatrixWorld(true);
 for(const[n,b]of Object.entries(bones))originals[n]={p:b.getWorldPosition(new T.Vector3()),local:b.position.clone(),parentQ:b.parent.getWorldQuaternion(new T.Quaternion()),parentP:b.parent.getWorldPosition(new T.Vector3())};
 model.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton)});
 for(const clip of clips)for(const track of clip.tracks){const n=track.name.replace(/\.position$/,'');if(track.name.endsWith('.position')&&bones[n])tracks.push({track,n,src:track.values.slice()})}
 let previous=0;
 const map=(p,h)=>new T.Vector3(p.x,p.y+Math.min(p.y,1.30)*h,p.z);
 return h=>{if(h===previous)return;previous=h;
  for(const[n,b]of Object.entries(bones)){const o=originals[n],parent=b.parent.isBone?map(o.parentP,h):o.parentP;const local=map(o.p,h).sub(parent).applyQuaternion(o.parentQ.clone().invert());rest[n].p.copy(local);b.position.copy(local);b.quaternion.copy(rest[n].q)}
  model.updateMatrixWorld(true);for(const s of skeletons)s.calculateInverses();
  for(const{track,n,src}of tracks){const delta=rest[n].p.clone().sub(originals[n].local);for(let i=0;i<src.length;i+=3){track.values[i]=src[i]+delta.x;track.values[i+1]=src[i+1]+delta.y;track.values[i+2]=src[i+2]+delta.z}}
 };
}
