import * as T from 'three';
export function createHousehold({house,world,roomControls,livingInteractions,nav}){
 const furnitureIds=new WeakMap();let nextFurnitureId=0;function furnitureId(o){if(!furnitureIds.has(o))furnitureIds.set(o,nextFurnitureId++);return furnitureIds.get(o);}
 function entries(){const items=[];
  for(const s of roomControls.switches)items.push({id:'room:'+s.id,label:s.label+'主灯',point:s.object.getWorldPosition(new T.Vector3()),get:()=>roomControls.state()[s.id],set:()=>roomControls.toggle(s.index)});
  for(const [id,f]of roomControls.fixtures)items.push({id:'lamp:'+id,label:f.label,point:f.anchor.clone(),get:()=>f.on,set:()=>roomControls.toggleFixture(id)});
  livingInteractions.mechanisms.forEach((o,i)=>items.push({id:'furniture:'+furnitureId(o),label:o.name,point:new T.Box3().setFromObject(o).getCenter(new T.Vector3()),get:()=>o.userData.mechanism018.open,set:p=>livingInteractions.activate({kind:'mechanism',object:o},p)}));
  items.push({id:'device:tv',label:'客厅电视',point:new T.Vector3(10.7,1.1,1.0),get:()=>livingInteractions.state().tvOn,set:p=>livingInteractions.activate({kind:'tv'},p)});
  if(house.officeComputer021){const c=house.officeComputer021;items.push({id:'device:office-computer',label:'书房电脑',point:c.hit.getWorldPosition(new T.Vector3()),get:()=>c.on,set:p=>house.life020.activate({kind:'life',verb:'computer'},p)});}
  return items;
 }
 function visible(a,b){const origin=new T.Vector3(a.x,a.y+1.25,a.z),dir=b.clone().sub(origin),distance=dir.length(),ray=new T.Ray(origin,dir.normalize());
  for(const c of world.colliders){if(!['wall','divider','entry'].includes(c.kind))continue;const hit=ray.intersectBox(new T.Box3(new T.Vector3(c.x,c.base,c.z),new T.Vector3(c.x+c.w,c.base+c.height,c.z+c.d)),new T.Vector3());if(hit&&origin.distanceTo(hit)<distance-.12)return false;}return true;
 }
 function approaches(item,from){const y=item.point.y<0?-3.15:0,candidates=[];
  for(const r of [.65,.9,1.2,1.5])for(let i=0;i<16;i++){const a=i*Math.PI/8,p={x:item.point.x+Math.cos(a)*r,z:item.point.z+Math.sin(a)*r,y};if(nav.valid(p.x,p.z,false,y)&&visible(p,item.point))candidates.push(p);}
  return candidates.sort((a,b)=>Math.hypot(a.x-from.x,a.z-from.z)-Math.hypot(b.x-from.x,b.z-from.z));
 }
 function resolve(id,on,from){if(typeof on!=='boolean')throw Error('开关目标必须是 true 或 false');const item=entries().find(e=>e.id===id);if(!item)throw Error('未找到可控制的灯或柜门');
  for(const p of approaches(item,from)){try{const path=nav.route(from,p);return {path,point:item.point,label:item.label,perform(actor){if(Math.hypot(actor.x-item.point.x,actor.z-item.point.z)>1.8||Math.abs(actor.y-p.y)>.2)throw Error('人物还未走到物件旁');if(item.get()!==on)item.set(actor);if(item.get()!==on)throw Error('开合范围被挡住，未执行');return {target:id,on};}};}catch{}}
  throw Error('物件前没有可抵达的操作位置');
 }
 return {resolve,list:()=>entries().map(e=>({id:e.id,label:e.label,on:e.get(),position:e.point.toArray()}))};
}

