// Resample irregular touch events on animation frames. This smooths input only;
// it does not conceal a low render frame rate or change resolution.
export function createTouchLook(){
 let yaw=0,pitch=0,active=false,settleUntil=0;
 return {
  begin(p){yaw=p.yaw;pitch=p.pitch;active=true;},
  end(time){active=false;settleUntil=time+160;},
  reset(p){yaw=p.yaw;pitch=p.pitch;active=false;settleUntil=0;},
  sample(p,dt,time){
   if(!active&&time>=settleUntil){yaw=p.yaw;pitch=p.pitch;}
   else{const a=1-Math.exp(-dt/.025);yaw+=(p.yaw-yaw)*a;pitch+=(p.pitch-pitch)*a;}
   return {yaw,pitch};
  }
 };
}
