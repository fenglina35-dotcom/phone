import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { read } from './_helpers.mjs';
const code=read('browser-diagnostics.js');
function fixture(store=new Map()){
 const handlers={},timers=[],intervals=[];let now=10000;
 const ctx={console,Date:class extends Date{static now(){return now;}},setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},setInterval(fn){intervals.push(fn);},document:{hidden:false,images:[],scripts:[],addEventListener(n,fn){handlers['doc:'+n]=fn;}},navigator:{userAgent:'fixture'},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},addEventListener(n,fn){handlers[n]=fn;},__NORTH_SHELL_BUILD__:'1271'};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,store,handlers,timers,intervals,advance(ms){now+=ms;},report(){return JSON.parse(ctx.NorthBrowserDiagnostics.report());}};
}
test('diagnostics persist bounded sanitized stack frames and survive reload',()=>{
 const f=fixture();const error={name:'RangeError',message:'Maximum call stack size exceeded PRIVATE_TEXT token=secret',stack:'RangeError PRIVATE_TEXT\n'+Array(30).fill('    at cohabAdvance (https://private.invalid/app.js?v=1271&key=secret:6967:42)').join('\n')};
 for(let i=0;i<100;i++)f.ctx.NorthBrowserDiagnostics.error('cohab-enter',error);
 const raw=f.ctx.NorthBrowserDiagnostics.report();assert(!/PRIVATE_TEXT|private.invalid|secret/.test(raw));const d=JSON.parse(raw);assert.equal(d.current.events.at(-1).data.category,'stack-overflow');assert.equal(d.current.events.at(-1).data.frames[0].line,6967);assert(d.current.events.length<=64);assert([...f.store.values()][0].length<=48000);
 const after=fixture(f.store).report();assert(after.previous.events.some(e=>e.kind==='error'));assert.equal(after.previous.events.at(-1).data.frames[0].fn,'cohabAdvance');
});
test('only foreground gaps are evidence and storage failure cannot break app hooks',()=>{
 const f=fixture();f.advance(4000);f.intervals[0]();assert(f.report().current.events.some(e=>e.kind==='event-loop-gap'));
 const before=f.report().current.events.length;f.ctx.document.hidden=true;f.handlers['doc:visibilitychange']();f.advance(100000);f.intervals[0]();assert.equal(f.report().current.events.length,before+1);
 f.ctx.localStorage.setItem=()=>{throw new Error('quota');};assert.doesNotThrow(()=>f.ctx.NorthBrowserDiagnostics.error('fixture',new Error('quota')));
});
test('stage hooks do not synchronously write storage for each image',()=>{
 const f=fixture();let writes=0;f.ctx.localStorage.setItem=()=>writes++;
 for(let i=0;i<1000;i++){f.ctx.NorthBrowserDiagnostics.mark('backup-image-read');f.ctx.NorthBrowserDiagnostics.mark('backup-serialize');}
 assert.equal(writes,0);assert(f.report().current.events.length<=64);
});

test('Safari source location survives a missing stack without recording private error text',()=>{
 const f=fixture();f.handlers.error({error:{name:'ReferenceError',message:"Can't find variable: missingHelper SECRET"},filename:'https://private.example/pet-game.js?v=1&key=SECRET',lineno:77,colno:9});
 const raw=f.ctx.NorthBrowserDiagnostics.report(),row=JSON.parse(raw).current.events.at(-1).data;
 assert.equal(row.category,'undefined-reference');assert.equal(row.frames[0].file,'pet-game.js');assert.equal(row.frames[0].line,77);assert(!raw.includes('SECRET'));assert(!raw.includes('private.example'));
});

test('input diagnostics distinguish overlay interception without storing typed text',()=>{
 const f=fixture(),input={id:'cinput',value:'PRIVATE_MESSAGE',isConnected:true,getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:40,width:100,height:40}),contains:()=>false};
 f.ctx.document.getElementById=()=>input;f.ctx.document.elementFromPoint=()=>({tagName:'DIV',id:'PRIVATE_ROLE'});
 f.handlers['doc:pointerdown']({clientX:30,clientY:20});let raw=f.ctx.NorthBrowserDiagnostics.report();
 assert.equal(JSON.parse(raw).chatInput.covered,true);assert(!/PRIVATE_MESSAGE|PRIVATE_ROLE/.test(raw));
 f.ctx.document.elementFromPoint=()=>input;f.ctx.document.activeElement=input;
 f.handlers['doc:focusin']({target:input});assert.equal(f.report().chatInput.focused,true);assert.equal(f.report().chatInput.covered,false);
});
