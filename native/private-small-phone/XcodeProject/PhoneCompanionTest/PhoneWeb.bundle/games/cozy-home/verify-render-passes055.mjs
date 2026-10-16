import assert from 'node:assert/strict';
import {createRenderPassStats} from './render-passes055.mjs';
const draw={calls:0,triangles:0};let reflection={passes:0,calls:0,triangles:0,pixels:0};
const surface=new EventTarget();
const renderer={domElement:surface,info:{render:draw},shadowMap:{render(throwAfter=false){draw.calls+=12;draw.triangles+=80;if(throwAfter)throw Error('test');}}};
const stats=createRenderPassStats(renderer,{read:()=>reflection});
for(let i=0;i<305;i++){
 stats.begin();draw.calls=draw.triangles=0;
 if(i%2)renderer.shadowMap.render();
 reflection={passes:1,calls:4,triangles:20,pixels:400};draw.calls+=14;draw.triangles+=120;
 stats.end();const last=stats.read().last;
 assert.equal(last.mainCalls,10);assert.equal(last.mainTriangles,100);
 assert.equal(last.shadowCalls,i%2?12:0);assert.equal(last.reflectionPasses,1);
}
assert.equal(stats.read().samples,300);assert.equal(stats.read().mean.mainCalls.toFixed(6),'10.000000');
stats.begin();draw.calls=draw.triangles=0;assert.throws(()=>renderer.shadowMap.render(true));reflection={passes:0,calls:0,triangles:0,pixels:0};stats.end();assert.equal(stats.read().last.shadowCalls,12);
renderer.shadowMap={render(){draw.calls+=7;draw.triangles+=14}};surface.dispatchEvent(new Event('webglcontextrestored'));surface.dispatchEvent(new Event('webglcontextrestored'));stats.begin();draw.calls=draw.triangles=0;renderer.shadowMap.render();stats.end();assert.equal(stats.read().last.shadowCalls,7);assert.equal(stats.read().last.shadowPasses,1);
console.log('055 actual shadow/reflection/color accounting and bounded history passed');
