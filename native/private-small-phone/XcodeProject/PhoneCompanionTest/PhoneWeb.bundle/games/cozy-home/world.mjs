export class HouseWorld {
 constructor(L){this.layout=L;this.radius=.26;this.bodyHeight=1.8;this.maxStep=.205;this.colliders=[];this.dynamic=[];this.characters=[];
  const walls=(list,base)=>list.forEach(([x,z,u,v])=>this.colliders.push({x:Math.min(x,u)-.075,z:Math.min(z,v)-.075,w:Math.abs(x-u)+.15,d:Math.abs(z-v)+.15,base,height:2.9,kind:'wall'}));
  walls(L.walls,0);walls(L.basement.walls,-3.15);
  for(const [items,base] of [[L.furniture,0],[L.basement.furniture,-3.15]])for(const f of items){const [x,z,w,d]=f.box;this.colliders.push({x,z,w,d,base,height:f.height||(['fridge','wardrobe','shelf'].includes(f.kind)?2.2:1),id:f.id,kind:f.kind});}
  const [ox,oz]=L.stairs.offset;this.colliders.push({x:ox+1.32,z:oz+1.3,w:.16,d:3.5,base:-3.15,height:6.05,kind:'divider'});
  this.colliders.push({x:10,z:7.35,w:1.4,d:.1,base:0,height:2.3,kind:'entry'});
  this.colliders.push({id:'umbrella',x:8.797,z:6.767,w:.256,d:.256,base:0,height:1.13,kind:'furniture'});
  for(const f of L.decorations||[]){const [x,z,w,d]=f.box;this.colliders.push({x,z,w,d,base:0,height:.8,kind:'plant',id:f.id});}
 }
 inside(x,z,b,p=0){return x>=b[0]+p&&x<=b[0]+b[2]-p&&z>=b[1]+p&&z<=b[1]+b[3]-p;}
 support(x,z,y){const L=this.layout,[ox,oz]=L.stairs.offset;
  if(this.inside(x,z,L.stairs.box)){const a=x-ox,b=z-oz;if(b<=1.3)return -1.575;
   if(a>=1.5)return b>=3.54?0:-Math.min(8,Math.max(1,Math.ceil((3.54-b)/.28-1e-8)))*.175;
   if(a<=1.3)return b>=3.54?-3.15:-1.575-Math.min(8,Math.max(1,Math.ceil((b-1.3)/.28-1e-8)))*.175;
   return null;}
  const a=[];if(L.floors.some(b=>this.inside(x,z,b)))a.push(0);if(this.inside(x,z,L.basement.box,this.radius))a.push(-3.15);
  return a.length?a.sort((a,b)=>Math.abs(a-y)-Math.abs(b-y))[0]:null;
 }
 collides(x,z,y,extra=true){if(extra&&this.characters.some(b=>y+this.bodyHeight>b.base&&y<b.base+b.height&&Math.hypot(x-b.x,z-b.z)<this.radius+b.radius-1e-8))return true;return [...this.colliders,...(extra?this.dynamic:[])].some(b=>{if(y+this.bodyHeight<=b.base+.02||y>=b.base+b.height-.03)return false;const a=Math.max(b.x,Math.min(x,b.x+b.w)),c=Math.max(b.z,Math.min(z,b.z+b.d));return (x-a)**2+(z-c)**2<this.radius**2-1e-9;});}
 valid(x,z,y){const h=this.support(x,z,y);return h===null||Math.abs(h-y)>this.maxStep||this.collides(x,z,h)?null:h;}
 move(p,dx,dz){const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.035));for(let i=0;i<n;i++){const x=p.x+dx/n,z=p.z+dz/n,h=this.valid(x,z,p.y);if(h!==null){p.x=x;p.z=z;p.y=h;continue;}let y=this.valid(x,p.z,p.y);if(y!==null){p.x=x;p.y=y;}y=this.valid(p.x,z,p.y);if(y!==null){p.z=z;p.y=y;}}return p;}
 room(p){if(this.inside(p.x,p.z,this.layout.stairs.box))return '楼梯间';if(p.y<-2.5)return p.x>17.6&&p.x<21.6&&p.z>9.6&&p.z<12.1?'禁闭室':'地下皮具工作室';return this.layout.rooms.find(r=>this.inside(p.x,p.z,r.box))?.name||'侧后通道';}
}
