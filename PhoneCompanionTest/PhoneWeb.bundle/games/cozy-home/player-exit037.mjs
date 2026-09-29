// Find a nearby, supported standing point without crossing a structural wall.
// A saved approach point may have been occupied since the player sat down.
export function findStandingPoint(world,seat,preferred=seat){
 const level=seat.y,origin=preferred&&Math.abs(preferred.y-level)<.21?preferred:seat;
 const walls=world.colliders.filter(b=>['wall','divider','entry'].includes(b.kind));
 function crossesWall(a,b){const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.06));for(let i=0;i<=steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(walls.some(w=>level+world.bodyHeight>w.base+.02&&level<w.base+w.height-.03&&x>w.x-.02&&x<w.x+w.w+.02&&z>w.z-.02&&z<w.z+w.d+.02))return true;}return false;}
 function crossesPerson(a,b){const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.03));for(let i=1;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if((world.characters||[]).some(c=>level+world.bodyHeight>c.base&&level<c.base+c.height&&Math.hypot(x-c.x,z-c.z)<world.radius+c.radius))return true;}return false;}
 function valid(p){const y=world.valid(p.x,p.z,level);return y!==null&&Math.abs(y-level)<.21&&!crossesWall(seat,p)&&!crossesPerson(seat,p)?{...p,y}:null;}
 const old=valid(origin);if(old)return old;
 const candidates=[];for(const center of [origin,seat])for(let r=.18;r<=2.4;r+=.15)for(let i=0;i<32;i++){const a=i*Math.PI/16,p={x:center.x+Math.cos(a)*r,z:center.z+Math.sin(a)*r,y:level,yaw:origin.yaw??seat.yaw,pitch:origin.pitch??0};candidates.push(p);}
 candidates.sort((a,b)=>Math.hypot(a.x-origin.x,a.z-origin.z)-Math.hypot(b.x-origin.x,b.z-origin.z));
 for(const p of candidates){const result=valid(p);if(result)return result;}return null;
}
