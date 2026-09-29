// Independent mouth motion plus occasional gentle blinks while speaking.
export function createTalkController(getRoot){
 let enabled=false,time=0,elapsed=0,root,faces=[],eyes=[],applied=[],nextBlink=3.8,blinkStart=-1,cycle=0,mouthPeak=0,blinkPeak=0; 
 const ts=[0,.10,.22,.34,.44,.58,.70,.82,.94,1.08,1.20,1.34,1.46,1.60],vs=[0,.25,.65,.1,0,.5,.15,0,.7,.3,0,.4,.1,0];
 function bind(){if(root===getRoot())return;root=getRoot();faces=[];eyes=[];root?.traverse(o=>{const d=o.morphTargetDictionary;if(!d)return;if(d.Talk!==undefined)faces.push([o,d.Talk]);if(d.Blink!==undefined)eyes.push([o,d.Blink]);});}
 function restore(){for(const[o,i,v]of applied)o.morphTargetInfluences[i]=v;applied=[];}
 function write(v){mouthPeak=Math.max(mouthPeak,v);bind();for(const[o,i]of faces)o.morphTargetInfluences[i]=v;}
 function smooth(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
 return {
 start(){mouthPeak=0;blinkPeak=0;enabled=true;time=0;elapsed=0;nextBlink=3.8;blinkStart=-1;cycle=0;},
 stop(){enabled=false;time=0;restore();write(0);},
 beforeUpdate:restore,
 get active(){return enabled;},
 state(){return {active:enabled,mouthPeak,blinkPeak,elapsed};},
 update(dt){restore();if(!enabled){write(0);return;}dt=Math.max(0,dt);elapsed+=dt;time=(time+dt)%1.6;
 let i=0;while(i<ts.length-2&&time>ts[i+1])i++;const f=(time-ts[i])/(ts[i+1]-ts[i]);write(Math.min(1.12,(vs[i]+(vs[i+1]-vs[i])*f)*1.6));
 if(elapsed>=nextBlink){blinkStart=elapsed;nextBlink=elapsed+[5.2,4.6,6.1,5.6][cycle++%4];}
 const b=elapsed-blinkStart;let closure=0;
 if(blinkStart>=0&&b<.56)closure=b<.20?smooth(b/.20):b<.26?1:1-smooth((b-.26)/.30);
 blinkPeak=Math.max(blinkPeak,closure);if(closure>0)for(const[o,j]of eyes){const v=o.morphTargetInfluences[j];applied.push([o,j,v]);o.morphTargetInfluences[j]=Math.max(v,closure);}
 }
 };
}
