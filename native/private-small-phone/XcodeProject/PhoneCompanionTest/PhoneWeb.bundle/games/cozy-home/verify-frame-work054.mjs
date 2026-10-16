import assert from 'node:assert/strict';
import * as T from './vendor/three/build/three.module.js';
import {cacheLocalTransforms} from './transform-cache054.mjs';
import {createViewportSizer} from './viewport054.mjs';
const a=new T.Group(),b=new T.Group(),p=new T.Group(),q=new T.Group();a.add(p);b.add(q);const cache=cacheLocalTransforms(a);
for(let i=0;i<200;i++){
 for(const o of [a,b]){o.position.set(Math.sin(i),i%7,-i);o.rotation.y=i*.02;o.scale.set(1,i%2?1:-1,.5);}
 for(const o of [p,q]){o.position.set(i%4,Math.cos(i),2);o.rotation.z=i*.01;}
 a.updateMatrixWorld();b.updateMatrixWorld();assert.deepEqual(p.matrixWorld.elements,q.matrixWorld.elements);
 const count=cache.snapshot().composed;a.updateMatrixWorld();assert.equal(cache.snapshot().composed,count);
 a.updateMatrixWorld(true);assert.deepEqual(p.matrixWorld.elements,q.matrixWorld.elements);
}
let size={width:852,height:393},dpr=3,calls=[];const c={updateProjectionMatrix(){}};
const v=createViewportSizer({renderer:{setDrawingBufferSize(...a){calls.push(a)}},camera:c,interactionCamera:{...c},resolution:()=>dpr,readSize:()=>size,onHeight(){}});
v.resize();for(let i=0;i<100;i++)v.resize();assert.equal(calls.length,1);
size={width:393,height:852};v.resize();assert.deepEqual(calls.at(-1),[393,852,3]);assert.equal(c.aspect,393/852);
dpr=2;v.resize();assert.deepEqual(calls.at(-1),[393,852,2]);v.resize(true);assert.equal(calls.length,4);
console.log('054 dynamic transform equivalence and unchanged viewport/rotation/DPR/recovery tests passed');
