// Recompose transforms only when their inputs change. Objects remain movable:
// doors, fans, layout edits and parent motion still use Three's normal world update.
export function cacheLocalTransforms(root){
 let objects=0,composed=0,reused=0;
 function visit(o){
  if(o.isSkinnedMesh||o.isBone||o.name==='Your female avatar'||o.name==='Roland model-controlled character')return;
  const original=o.updateMatrix;let x,y,z,qx,qy,qz,qw,sx,sy,sz;
  o.updateMatrix=function(){
   const p=this.position,q=this.quaternion,s=this.scale;
   if(x===p.x&&y===p.y&&z===p.z&&qx===q.x&&qy===q.y&&qz===q.z&&qw===q.w&&sx===s.x&&sy===s.y&&sz===s.z){reused++;return;}
   x=p.x;y=p.y;z=p.z;qx=q.x;qy=q.y;qz=q.z;qw=q.w;sx=s.x;sy=s.y;sz=s.z;composed++;original.call(this);
  };objects++;
  for(const child of o.children)visit(child);
 }
 visit(root);return {snapshot:()=>({objects,composed,reused})};
}
