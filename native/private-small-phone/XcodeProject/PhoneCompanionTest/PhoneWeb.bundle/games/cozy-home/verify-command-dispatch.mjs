import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Exercise the real dispatcher with scene/animation dependencies stubbed.
const source=readFileSync(new URL('./house-character.mjs?build=035',import.meta.url),'utf8');
const dispatcher=source.slice(source.indexOf(' function command(c){'),source.indexOf(' function startDoor('));
const context=vm.createContext({companion:null,state:'seated',lastCommand:null,pendingCommand:null,completed:new Map(),
 anchor:{id:'sofa',slot:1},roaming:true,events:[],feedback:'',available:['sofa','work_chair'],
 describe:c=>c.target||c.type,emit(type,details){context.events.push({type,...details});},
 tell(message){context.feedback=message;},seating:{release(){}},
 getUp(){context.state='getting_up';},finish(){context.lastCommand=null;},
});
vm.runInContext(dispatcher,context);
const run=c=>context.command(c);
assert.equal(run({id:'a',type:'sit',target:'work_chair'}).queued,true);
assert.equal(context.pendingCommand.target,'work_chair');
assert.match(context.feedback,/先自动起身/);
assert.equal(context.roaming,false);
context.state='walking';context.lastCommand={id:'active',type:'sit',target:'work_chair'};
run({id:'b',type:'go_room',target:'kitchen'});
assert.equal(context.pendingCommand.target,'dining_a');
run({id:'c',type:'go_room',target:'office'});
assert.equal(context.pendingCommand.target,'boss_chair');
assert.ok(context.events.some(e=>e.type==='superseded'&&e.command.id==='b'));
run({id:'d',type:'sit',target:'work_chair'});
assert.equal(context.pendingCommand,null,'Repeated active target removes stale pending intent');
context.state='seated';context.lastCommand=null;context.anchor={id:'work_chair',slot:0};
assert.equal(run({id:'e',type:'sit',target:'work_chair'}).ok,true);
assert.equal(context.pendingCommand,null,'Already seated must not stand up again');
assert.equal(context.state,'seated');
assert.equal(run({type:'unsupported'}).ok,false);
assert.equal(context.feedback,'不支持的动作');
console.log('PASS: seated auto-stand intent, busy queue replacement, repeated target deduplication, persistent error feedback');
