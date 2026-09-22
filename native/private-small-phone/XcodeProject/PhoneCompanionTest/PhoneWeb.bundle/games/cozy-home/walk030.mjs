// Use elapsed time for locomotion, independent of the visual animation clamp.
// A suspended/stalled frame is discarded; normal slow frames retain distance.
export function walkSeconds(seconds){return Number.isFinite(seconds)&&seconds>0&&seconds<=.25?seconds:0;}
export function advanceWalk(world,player,side,forward,seconds){
 const dt=walkSeconds(seconds),mag=Math.max(1,Math.hypot(side,forward));
 if(!dt||(!side&&!forward))return 0;
 side/=mag;forward/=mag;const x=player.x,z=player.z;
 world.move(player,(-Math.sin(player.yaw)*forward+Math.cos(player.yaw)*side)*2.15*dt,(-Math.cos(player.yaw)*forward-Math.sin(player.yaw)*side)*2.15*dt);
 return Math.hypot(player.x-x,player.z-z);
}
