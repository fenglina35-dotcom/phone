// A nearby door matters only when the remaining route crosses its doorway.
export function crossingDoor(position,path,doors){
 let a=position;
 for(const b of path){
  for(const door of doors){
   if(Math.abs(door.angle)>=1.35||Math.abs((a.y??0)-door.y)>.4)continue;
   const sin=Math.sin(door.closedYaw),cos=Math.cos(door.closedYaw);
   const normal=p=>sin*(p.x-door.center[0])+cos*(p.z-door.center[1]);
   const na=normal(a),nb=normal(b);
   if(na*nb>0||Math.abs(na-nb)<1e-6)continue;
   const t=na/(na-nb),x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
   const across=cos*(x-door.center[0])-sin*(z-door.center[1]);
   if(Math.abs(across)>(door.width??1.25)/2+.05)continue;
   const side=normal(position)>=0?1:-1;
   return {door,approach:{x:door.center[0]+sin*.95*side,y:door.y,z:door.center[1]+cos*.95*side}};
  }
  a=b;
 }
 return null;
}
export function centeredAtDoor(p,d){
 const dx=p.x-d.center[0],dz=p.z-d.center[1];
 return Math.abs(p.y-d.y)<.2&&Math.abs(Math.cos(d.closedYaw)*dx-Math.sin(d.closedYaw)*dz)<.12&&Math.abs(Math.sin(d.closedYaw)*dx+Math.cos(d.closedYaw)*dz)<1.05;
}
