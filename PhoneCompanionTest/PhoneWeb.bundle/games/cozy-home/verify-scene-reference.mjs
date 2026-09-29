import assert from 'node:assert/strict';
import {sceneReferences} from './scene-reference.mjs';
const input={player:{x:0,y:0,z:0},actor:{x:4,y:0,z:0},camera:{position:{x:0,y:1.1,z:0},direction:{x:0,y:0,z:1}},doors:[{room:'front',center:[0,2],y:0,open:false},{room:'side',center:[3,0],y:0,open:true},{room:'hidden',center:[0,3],y:0,open:false}],controls:[{id:'room:living',label:'客厅主灯',position:[0,1.1,1],on:true}],room:()=> 'living',visible:(_,b)=>b.z!==3};
const out=sceneReferences(input);
assert(out.focus.includes('front'));assert(!out.focus.includes('side'));assert(!out.focus.includes('hidden'));
assert(out.items.find(x=>x.id==='side').distanceToCharacter<out.items.find(x=>x.id==='front').distanceToCharacter);
assert.equal(out.items.find(x=>x.id==='room:living').kind,'room-light');
input.camera.direction={x:1,y:0,z:0};assert(sceneReferences(input).focus.includes('side'));assert(!sceneReferences(input).focus.includes('front'));
console.log('PASS: references distinguish camera direction, occlusion, player vs actor distance and room lights');
