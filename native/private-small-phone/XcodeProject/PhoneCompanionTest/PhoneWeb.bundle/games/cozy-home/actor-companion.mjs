export function createCompanion({player,observe,command,nav,world,gate,locations,emit,cancelNavigation,pairing=()=>null}){
 let followTarget=null,routeTarget=null,joined=null,mode='off',phase='',target=null,timer=0,path=[],trail=[],failure='',stalled=0,last=null;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,a.y-b.y);
 function stop(unlock=true){cancelNavigation?.();joined=null;mode='off';phase='';path=[];trail=[];routeTarget=null;followTarget=null;if(unlock)gate.setLocked(false);emit('companion_stopped',{});}
 function accept(c){
  if(!['follow','come_to_player','escort','release','stop_follow'].includes(c.type))return null;
  if(c.type==='release'||c.type==='stop_follow'||c.type==='follow'&&c.active===false){stop();return {ok:true};}
  if(c.type==='escort'&&!locations[c.target])return {ok:false,error:'目的地不存在'};
  stop(false);failure='';mode=c.type;target=c.target;timer=0;stalled=0;
  if(mode==='escort'){phase='meeting';const r=command({type:'walk_to',x:player.x,y:player.y,z:player.z,id:c.id});if(!r.ok){stop();return r;}}
  emit('companion_started',{mode,target});return {ok:true,accepted:true};
 }
 function update(dt){
  if(mode==='off')return;timer-=dt;const ob=observe(),pos=ob.position;
  if(mode==='follow'||mode==='come_to_player'){
   const pair=mode==='follow'?pairing():null;
   const joinKey=pair?.shared?pair.playerKey:null;
   if(joined!==joinKey){cancelNavigation?.(true);joined=joinKey;timer=0;}
   if(mode==='follow'&&pair?.shared){
    if(timer>0)return;timer=.8;
    if(!pair.target){phase='waiting_for_seat';return;}
    if(ob.seat?.key===pair.target.key&&['seated','sleeping'].includes(ob.state)){phase='together';return;}
    if(!['idle','seated','sleeping'].includes(ob.state)){phase='joining';return;}
    const c={type:pair.target.bed?'sleep':'sit',target:pair.target.id,slot:pair.target.slot,_companion:true};const r=command(c);phase=r.ok?'joining':'waiting_for_seat';failure=r.ok?'':r.error;return;
   }
   if(mode==='follow'&&['seated','sleeping'].includes(ob.state)){if(timer<=0){timer=.8;command({type:'get_up',_companion:true});phase='resuming';}return;}
   phase=mode==='follow'?'following':phase;
   const retarget=mode==='follow'&&ob.state==='walking'&&followTarget&&distance(player,followTarget)>.20;
   if(timer>0||!retarget&&!['idle','seated','sleeping'].includes(ob.state))return;timer=.25;
   if(distance(pos,player)<.78){if(mode==='come_to_player'){mode='off';emit('player_found',{position:{...player},room:world.room(player)});}return;}
   try{const route=nav.route(pos,player);let remaining=.62,dest={...player};for(let i=route.length-1;i>=0;i--){const from=i?route[i-1]:pos,len=distance(from,dest);if(len>=remaining){const f=remaining/len;dest={x:dest.x+(from.x-dest.x)*f,y:dest.y+(from.y-dest.y)*f,z:dest.z+(from.z-dest.z)*f};break;}remaining-=len;dest=from;}
    if(nav.valid(dest.x,dest.z,false,dest.y)){followTarget={...player};command({type:'walk_to',...dest,_companion:true});}
   }catch(e){failure=e.message;}return;
  }
  if(phase==='locked')return;
  if(phase==='meeting'){if(distance(pos,player)<1.75){cancelNavigation();phase='leading';trail=[{...pos}];command({type:'go_room',target,arrivalOnly:true});}return;}
  if(phase==='leading'){
   if(!trail.length||distance(trail.at(-1),pos)>.035)trail.push({...pos});
   if(trail.length>2000)trail.shift();
   if(ob.state==='idle'&&distance(pos,locations[target])<.4){phase='arriving';}
  }
  if(phase==='leading'||phase==='arriving'){
   while(trail.length&&distance(player,trail[0])<.025){trail.shift();path=[];routeTarget=null;}
   let dest=trail[0]||(phase==='arriving'?(target==='cell'?{x:19.8,y:-3.15,z:11.15}:locations[target]):null);
   if(dest&&!trail.length&&phase==='arriving'&&distance(player,dest)<.27){
    if(target==='cell'){phase='exiting';command({type:'walk_to',x:20.66,y:-3.15,z:13.25});}
    else{mode='off';phase='';command({type:'go_room',target});emit('escort_arrived',{target});}return;
   }
   const gap=distance(player,pos),keepDistance=phase==='leading'&&gap<.68;
   let budget=Math.min(1.2,.85+Math.max(0,gap-.85)*.6)*dt;
   // Consume reached breadcrumbs in the same frame instead of pausing at each one.
   for(let i=0;dest&&!keepDistance&&budget>1e-5&&i<16;i++){
    if(distance(player,dest)<.45&&Math.abs(player.y-dest.y)<.22){path=[dest];routeTarget={...dest};}
    else if(!routeTarget||distance(routeTarget,dest)>.04||!path.length){routeTarget={...dest};try{path=nav.route(player,dest,true);}catch(e){path=[];failure=e.message;}}
    while(path.length>1&&distance(player,path[0])<.025)path.shift();
    const node=path[0];if(!node)break;
    const length=Math.hypot(node.x-player.x,node.z-player.z),step=Math.min(length,budget);
    if(length>.00001){const before={...player};world.move(player,(node.x-player.x)/length*step,(node.z-player.z)/length*step);if(distance(player,before)<.00001)break;budget-=step;}
    if(length<=step+.001){path.shift();if(distance(player,dest)<.025&&trail.length){trail.shift();routeTarget=null;path=[];dest=trail[0]||null;}else if(!path.length)break;}else break;
   }
   if(last&&distance(player,last)<.001&&!keepDistance)stalled+=dt;else stalled=0;last={...player};
   if(stalled>12){failure='带路通道被挡住，已结束跟随';stop();emit('failed',{reason:failure});}
  }
  if(phase==='exiting'&&ob.state==='idle'&&pos.z>12.8){phase='closing';command({type:'set_door',target:'cell',open:false});}
  if(phase==='closing'&&!gate.state().open&&Math.abs(gate.state().gateAngle)<.025){gate.setLocked(true);phase='locked';emit('cell_locked',{playerInside:true});}
 }
 return {accept,update,stop,movementScale:()=>mode==='follow'&&phase==='following'?Math.min(1.9,1+Math.max(0,distance(player,observe().position)-.8)):mode==='escort'&&phase==='leading'?Math.max(0,Math.min(1,(1.45-distance(player,observe().position))/.5)):1,controlsPlayer:()=>mode==='escort'&&['leading','arriving'].includes(phase),state:()=>({mode,phase,target,failure})};
}
