import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import * as T from './vendor/three/build/three.module.js';
const src=readFileSync(new URL('./actor-gaze.mjs?build=035',import.meta.url),'utf8').replace("'three'",JSON.stringify(new URL('./vendor/three/build/three.module.js',import.meta.url).href));
const {createGaze}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const actor=new T.Group(),root=new T.Group(),head=new T.Bone(),eyes=new T.Group();actor.add(root);root.add(head);head.position.y=1.58;eyes.name='Armature';eyes.position.set(0,.1,.08);head.add(eyes);actor.updateMatrixWorld(true);const initial=eyes.position.clone(),g=createGaze(root,head);
function tick(player,state='idle'){for(let i=0;i<120;i++){g.restore();g.update(1/60,actor,player,state);}}
tick({x:0,y:0,z:1});assert(g.state().tracking);assert(g.state().pitchDegrees>0);assert(eyes.position.distanceTo(initial)<1e-9,'Eye rig must follow its head parent only once');
tick({x:0,y:0,z:1,eyeY:1.42},'speaking');assert(g.state().tracking);assert(g.state().pitchDegrees>0);
tick({x:0,y:0,z:-1});assert(!g.state().tracking);assert(Math.abs(g.state().turnDegrees)<.1);assert(Math.abs(g.state().pitchDegrees)<.1);
tick({x:0,y:0,z:1},'sleeping');assert(!g.state().tracking);
console.log('PASS: front downward gaze; rear neutral return; sleeping disabled; child eye rig not double transformed');

// Calibrate an authored eye plane tilted down independently of the head bone.
g.restore();const authored=.25,reference={center:new T.Vector3(0,.08,0),forward:new T.Vector3(0,0,1).applyAxisAngle(new T.Vector3(1,0,0),authored)};
const calibrated=createGaze(root,head,new T.Quaternion(),reference);for(let i=0;i<180;i++){calibrated.restore();calibrated.update(1/60,actor,{x:0,y:0,z:1,eyeY:1.42},'idle');}
const expected=Math.atan2(1.66-1.42,1);assert(Math.abs(T.MathUtils.degToRad(calibrated.state().pitchDegrees)+authored-expected)<.01,'Use actual eye-plane direction instead of adding head pitch twice');
console.log('PASS: authored iris-plane calibration');

for(const z of [.3,.1,.01]){tick({x:0,y:0,z,eyeY:1.42});assert(g.state().tracking,'Close gaze stays active');assert(g.state().pitchDegrees>0,'Close gaze stays downward');}
for(const x of [-1,1]){tick({x,y:0,z:0,eyeY:1.42});assert(g.state().tracking,'Side gaze stays active');assert(Math.abs(g.state().turnDegrees)>45,'Head follows lateral user');}
tick({x:.2,y:0,z:-1,eyeY:1.42});assert(!g.state().tracking,'Rear user excluded');
console.log('PASS close downward and both lateral gaze, rear exclusion');
