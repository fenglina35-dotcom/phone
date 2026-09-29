import * as T from 'three';

// Refine the unbatched sofa source, retaining movable pillow IDs and original pivots.
export function refineSofa012(root){
 root.updateMatrixWorld(true);
 root.userData.legacyEditorWorldPivot=new T.Box3().setFromObject(root).getCenter(new T.Vector3()).toArray();
 const materials=new Map();
 const cloth=m=>{if(materials.has(m))return materials.get(m);const c=m.clone();c.name=m.name+' / soft tailoring 012';c.roughness=.96;c.metalness=0;if(c.normalScale)c.normalScale.multiplyScalar(.6);materials.set(m,c);return c;};
 const clean=s=>s.replace(/[_/.]/g,' ').replace(/\s+/g,' ').trim();
 const old=[];root.traverse(o=>{if(o.isMesh)old.push(o)});
 const sp=(v,e)=>Math.sign(v)*Math.abs(v)**e;
 function seatPoint(sy,a,side){
  const r=Math.max(0,1-sy*sy)**.18,x=.65*sp(Math.cos(a),.22)*r,z=.375*sp(Math.sin(a),.24)*r;
  const upper=Math.max(0,sy),edge=Math.abs(x)/.65;
  const depression=.019*Math.exp(-(((x+side*.035)/.30)**2+((z+.015)/.24)**2))*upper;
  const creases=.004*Math.sin(z*38+side*.6+x*4)*Math.exp(-(((edge-.8)/.17)**2))*upper*(1-edge);
  const support=.006*Math.exp(-(((x-side*.32)/.13)**2+((z-.03)/.12)**2))*upper;
  const y=sy>=0?.115*sy-depression+creases+support:-.115*(1-(sy+1)**3);
  return [x,y,z];
 }
 for(const o of old){const name=clean(o.name);
  if(name.includes('separate seat cushion')){
   const side=o.position.x<0?-1:1,g=new T.SphereGeometry(1,96,56),p=g.attributes.position;
   for(let i=0;i<p.count;i++)p.setXYZ(i,...seatPoint(p.getY(i),Math.atan2(p.getZ(i),p.getX(i)),side));
   g.computeVertexNormals();o.geometry=g;o.material=cloth(o.material);o.userData.construction='Closed stuffed shell; compressed underside and local seat depression';
   const points=Array.from({length:161},(_,i)=>new T.Vector3(...seatPoint(.64,i/160*Math.PI*2,side)).add(o.position));
   const seam=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),160,.0012,5,false),o.material);seam.name='Sofa / tailored seat seam 012';seam.castShadow=false;seam.receiveShadow=true;root.add(seam);
  }else if(name.includes('seat welt'))o.removeFromParent();
  else if(name.includes('stuffed back cushion')){
   const g=o.geometry.clone(),p=g.attributes.position;
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),cx=x<0?-.665:.665,nx=(x-cx)/.645,ny=(y-.80)/.275;
    const mask=Math.max(0,1-nx*nx)**2*Math.max(0,1-ny*ny)**2;
    const front=T.MathUtils.smoothstep(.27-z,0,.12);
    const dent=.023*Math.exp(-(((x-cx)/.18)**2+((y-.84)/.10)**2));
    const tension=.0045*Math.cos(Math.atan2((y-.84)*1.8,x-cx)*4)*Math.exp(-(((x-cx)/.35)**2+((y-.84)/.17)**2));
    p.setZ(i,z+(dent+tension)*front*mask);
   }g.computeVertexNormals();o.geometry=g;o.material=cloth(o.material);
  }
 }
 root.userData.refinement012='Seat cushion shell rebuilt; local compression and back cushion tension; throw pillows preserved';
 return root;
}
