import assert from 'node:assert/strict';
import {createTalkController} from './character/talk-controller.mjs';
const face={morphTargetDictionary:{Talk:0,Blink:1},morphTargetInfluences:[0,0]};
const root={traverse:fn=>fn(face)},talk=createTalkController(()=>root);
talk.start();let closedFrames=0;
for(let i=0;i<420;i++){talk.beforeUpdate();talk.update(1/60);if(face.morphTargetInfluences[1]>.95)closedFrames++;}
assert(talk.state().mouthPeak>1);assert(talk.state().blinkPeak===1);assert(closedFrames>0&&closedFrames<25);
talk.stop();assert.equal(face.morphTargetInfluences[0],0);assert.equal(face.morphTargetInfluences[1],0);assert.equal(talk.active,false);
console.log('PASS: audible-interval mouth motion, one gentle complete blink in seven seconds, clean stop/restoration');
