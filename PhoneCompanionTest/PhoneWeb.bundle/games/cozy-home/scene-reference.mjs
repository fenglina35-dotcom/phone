// Observations for language-model reference resolution; never interpret user text here.
export function sceneReferences({player,actor,camera,doors,controls,room,visible}){
 const eye=camera.position,forward=camera.direction;
 const describe=(id,label,kind,position,on)=>{
  const [x,y,z]=position,dx=x-eye.x,dy=y-eye.y,dz=z-eye.z,length=Math.hypot(dx,dy,dz)||1;
  return {id,label,kind,position,on,room:room({x,y:y<-.5?-3.15:0,z}),
   distanceToPlayer:+Math.hypot(x-player.x,y-(player.y+1.2),z-player.z).toFixed(2),
   distanceToCharacter:+Math.hypot(x-actor.x,y-(actor.y+1.2),z-actor.z).toFixed(2),
   viewAngleDegrees:+(Math.acos(Math.max(-1,Math.min(1,(dx*forward.x+dy*forward.y+dz*forward.z)/length)))*180/Math.PI).toFixed(1),
   visibleToPlayer:length<8&&visible(eye,{x,y,z})};
 };
 const items=[...doors.map(d=>describe(d.room,d.label||d.room+'门','door',[d.center[0],d.y+1.1,d.center[1]],d.open)),
  ...controls.map(c=>describe(c.id,c.label,c.id.startsWith('room:')?'room-light':c.id.startsWith('lamp:')?'lamp':'furniture',c.position,c.on))];
 const nearby=items.filter(i=>i.visibleToPlayer&&i.distanceToPlayer<5).sort((a,b)=>a.viewAngleDegrees-b.viewAngleDegrees||a.distanceToPlayer-b.distanceToPlayer);
 const focus=nearby.filter(i=>i.viewAngleDegrees<16);
 return {items,focus:focus.slice(0,3).map(i=>i.id),playerRoom:room(player),characterRoom:room(actor),
  guidance:'我面前/这个优先参考玩家视线和可见性；你旁边优先角色距离；这里的灯优先玩家当前房间主灯。附近有多个同类且无明确指向时先询问，不按固定口令匹配。坐下来工作直接选择对应座位。'};
}
