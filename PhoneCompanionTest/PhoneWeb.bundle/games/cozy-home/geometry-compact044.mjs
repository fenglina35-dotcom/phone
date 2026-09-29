import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

// Same 1e-6 attribute equivalence as mergeVertices, without per-vertex strings,
// JS index arrays, temporary full-sized attributes or cloning the source mesh.
export function indexGeometryCompact(g,tolerance=1e-6){
 const names=Object.keys(g.attributes),attrs=names.map(n=>g.attributes[n]);
 if(g.index||Object.keys(g.morphAttributes).length||attrs.some(a=>a.isInterleavedBufferAttribute||a.normalized||!(a.array instanceof Float32Array)))return mergeVertices(g,tolerance);
 const n=g.attributes.position.count,multiplier=1/tolerance;
 let capacity=1;while(capacity<n*2)capacity*=2;
 const table=new Uint32Array(capacity),representatives=new Uint32Array(n),indices=new Uint32Array(n);let count=0;
 function same(a,b){for(const attr of attrs)for(let k=0;k<attr.itemSize;k++)if((attr.array[a*attr.itemSize+k]*multiplier+.5|0)!==(attr.array[b*attr.itemSize+k]*multiplier+.5|0))return false;return true;}
 for(let i=0;i<n;i++){
  let hash=2166136261;
  for(const attr of attrs)for(let k=0;k<attr.itemSize;k++)hash=Math.imul(hash^(attr.array[i*attr.itemSize+k]*multiplier+.5|0),16777619);
  let slot=hash&(capacity-1);
  while(table[slot]&&!same(i,representatives[table[slot]-1]))slot=(slot+1)&(capacity-1);
  if(!table[slot]){representatives[count]=i;table[slot]=++count;}
  indices[i]=table[slot]-1;
 }
 const result=new T.BufferGeometry();result.name=g.name;result.userData={...g.userData};result.groups=g.groups.map(x=>({...x}));result.setDrawRange(g.drawRange.start,g.drawRange.count);
 for(let j=0;j<names.length;j++){
  const a=attrs[j],values=new Float32Array(count*a.itemSize);
  for(let i=0;i<count;i++)for(let k=0;k<a.itemSize;k++)values[i*a.itemSize+k]=a.array[representatives[i]*a.itemSize+k];
  const next=new T.BufferAttribute(values,a.itemSize,a.normalized);next.name=a.name;next.usage=a.usage;next.gpuType=a.gpuType;result.setAttribute(names[j],next);
 }
 result.setIndex(new T.BufferAttribute(count>65535?indices:new Uint16Array(indices),1));
 result.boundingBox=g.boundingBox?.clone()||null;result.boundingSphere=g.boundingSphere?.clone()||null;
 return result;
}
