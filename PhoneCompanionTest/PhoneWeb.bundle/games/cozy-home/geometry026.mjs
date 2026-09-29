import {indexGeometryCompact} from './geometry-compact044.mjs';
import {lean,budget,stage} from './mobile-budget024.mjs?build=050';

export async function indexStaticGeometry(root){
 if(!lean)return;
 const groups=new Map();root.traverse(o=>{if(o.isMesh){const g=o.geometry;if(!groups.has(g))groups.set(g,[]);groups.get(g).push(o)}});
 let before=0,after=0,optimized=0;
 for(const [g,objects] of groups){
  groups.delete(g);
  const count=g.attributes.position?.count||0;before+=count;
  // Exact attribute seams survive welding. Do not touch morph targets, animated
  // buffers or tiny meshes; this changes vertex reuse, not triangle count/shape.
  if(g.index||count<3000||count>500000||Object.keys(g.morphAttributes).length||Object.values(g.attributes).some(a=>a.usage!==35044)){after+=count;continue;}
  const next=indexGeometryCompact(g,1e-6);
  if(next.attributes.position.count<count*.85){for(const o of objects)o.geometry=next;after+=next.attributes.position.count;g.dispose();optimized++;}
  else{next.dispose();after+=count;}
  if(optimized%5===0)await stage('正在准备流畅转动…');
 }
 budget.vertices={before,after,optimized};
}
