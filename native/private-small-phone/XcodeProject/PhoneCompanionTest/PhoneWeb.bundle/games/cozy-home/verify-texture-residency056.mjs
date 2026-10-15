import assert from 'node:assert/strict';
import {installTextureResidency} from './gpu-residency056.mjs';
let lost=false,freed=0;const properties=new Map(),source={data:{width:512,height:512}};
const texture=()=>{const t={isTexture:true,image:source.data,source,mapping:300,generateMipmaps:true,dispose(){freed++;properties.delete(this)}};properties.set(t,{__webglTexture:{}});return t};
const a=texture(),b=texture(),materials=[{version:1,map:a},{version:1,map:b}],objects=materials.map(material=>({isMesh:true,userData:{},material,onAfterRender(){}}));
const scene={traverse(fn){objects.forEach(fn)}},renderer={properties:{get:t=>properties.get(t)||{}},info:{memory:{textures:2,geometries:2},programs:[]},getContext:()=>({isContextLost:()=>lost}),domElement:{addEventListener(){}}};
const r=installTextureResidency(scene,renderer,{idleMs:5000,byteBudget:1});
r.begin(10000);objects[0].onAfterRender(renderer,scene,null,null,materials[0]);r.end();assert.equal(freed,0,'shared but invisible sibling cannot free a visible image');
r.begin(20000);lost=true;r.end();assert.equal(freed,0,'do not mutate allocations during context loss');
lost=false;r.begin(23000);r.end();assert.equal(freed,2,'both idle source variants are released together');assert.equal(a.image.width,512,'CPU pixels survive eviction');assert.equal(r.snapshot().invalidSources,0);
properties.set(a,{__webglTexture:{}});r.begin(30000);objects[0].onAfterRender(renderer,scene,null,null,materials[0]);r.end();assert.equal(freed,2,'re-entered texture remains resident');
for(let i=1;i<=200;i++){r.begin(30000+i*2100);objects[0].onAfterRender(renderer,scene,null,null,materials[0]);r.end()}assert.equal(r.report().history.length,180,'diagnostics are bounded');
console.log('texture residency: shared ownership, loss, eviction, return and bounded history passed');

// The same idle age must NOT evict a working set that fits the memory budget.
const compressed={...texture(),isCompressedTexture:true,generateMipmaps:false,mipmaps:[{data:new Uint8Array(256)}]};
const cm={version:1,map:compressed},co={isMesh:true,userData:{},material:cm,onAfterRender(){}};
properties.set(compressed,{__webglTexture:{}});
const keep=installTextureResidency({traverse(fn){fn(co)}},renderer,{idleMs:5000,byteBudget:1024});
const before=freed;keep.begin(100000);keep.end();assert.equal(freed,before);assert.equal(keep.snapshot().imageTextureBytes,256);
// A compressed source keeps every CPU mip byte after a pressure eviction.
const pressure=installTextureResidency({traverse(fn){fn(co)}},renderer,{idleMs:5000,byteBudget:128});
pressure.begin(100000);pressure.end();assert.equal(freed,before+1);assert.equal(compressed.mipmaps[0].data.byteLength,256);
console.log('056 compressed byte accounting, budget retention and recoverable mip ownership passed');
