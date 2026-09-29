// Layer-aware floor and stair navigation; each edge checks step height and collisions.
export function createNavigation(world){
 const radius=.28,step=.20;
 function valid(x,z,doors=false,y=0,padding=0){const h=world.support(x,z,y);if(h===null||Math.abs(h-y)>.205)return false;
  for(const b of world.colliders.concat(world.dynamic)){if(y+1.8<=b.base+.02||y>=b.base+b.height-.03||(!doors&&(b.kind==='door'||b.id==='cell gate')&&!b.navigationOpen))continue;
   const dx=x-Math.max(b.x,Math.min(x,b.x+b.w)),dz=z-Math.max(b.z,Math.min(z,b.z+b.d));if(dx*dx+dz*dz<(radius+padding)*(radius+padding))return false;
  }return true;
 }
 function line(a,b,doors=false){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.025));let y=a.y??0;
  for(let i=0;i<=n;i++){const f=i/n,x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f,h=world.support(x,z,y);if(h===null||Math.abs(h-y)>.205||!valid(x,z,doors,h,.015*Math.min(1,i/4,(n-i)/4)))return false;y=h;}
  return Math.abs(y-(b.y??world.support(b.x,b.z,a.y??0)))<.21;
 }
 function route(a,b,doors=false){a={...a,y:a.y??0};b={...b,y:b.y??world.support(b.x,b.z,a.y)};
  if(b.y===null||!valid(a.x,a.z,doors,a.y)||!valid(b.x,b.z,doors,b.y))throw Error('起点或目标被家具占用，或不在地面上');
  if(line(a,b,doors))return [b];
  const key=(x,z,y)=>x+','+z+','+Math.round(y*1000),heap=[],seen=new Map(),closed=new Set();
  function push(n){heap.push(n);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;}
  function pop(){const top=heap[0],v=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=v.f)break;heap[i]=heap[c];i=c;}heap[i]=v;}return top;}
  const sx=Math.round(a.x/step),sz=Math.round(a.z/step);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const x=sx+dx,z=sz+dz,y=world.support(x*step,z*step,a.y),p={x:x*step,z:z*step,y};if(y===null||!line(a,p,doors))continue;const n={x,z,y,g:Math.hypot(p.x-a.x,p.z-a.z),f:0,p:null};n.f=n.g+Math.hypot(p.x-b.x,p.z-b.z);seen.set(key(x,z,y),n);push(n);}
  let end=null;
  while(heap.length){const n=pop(),k=key(n.x,n.z,n.y);if(closed.has(k))continue;closed.add(k);const pos={x:n.x*step,z:n.z*step,y:n.y};
   if(Math.abs(n.y-b.y)<.21&&Math.hypot(pos.x-b.x,pos.z-b.z)<.3&&line(pos,b,doors)){end=n;break;}
   for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=n.x+dx,z=n.z+dz;if(x<1||x>130||z<1||z>89)continue;const y=world.support(x*step,z*step,n.y);if(y===null||Math.abs(y-n.y)>.205)continue;const kk=key(x,z,y),p={x:x*step,z:z*step,y};if(closed.has(kk)||!line(pos,p,doors))continue;const g=n.g+Math.hypot(dx,dz)*step+Math.abs(y-n.y)*.5;if(seen.has(kk)&&seen.get(kk).g<=g)continue;const q={x,z,y,g,f:g+Math.hypot(p.x-b.x,p.z-b.z),p:n};seen.set(kk,q);push(q);}
  }
  if(!end)throw Error('没有可通行路线');
  const raw=[b];for(let n=end;n;n=n.p)raw.unshift({x:n.x*step,z:n.z*step,y:n.y});raw.unshift(a);
  const result=[];let i=0;while(i<raw.length-1){let j=raw.length-1;while(j>i+1&&!line(raw[i],raw[j],doors))j--;result.push(raw[j]);i=j;}return result;
 }
 return {valid,line,route};
}
