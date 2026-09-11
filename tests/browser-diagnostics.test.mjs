import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../browser-diagnostics.js',import.meta.url),'utf8');
function fixture(store=new Map()){
 const handlers={},timers=[],intervals=[];let now=10000;
 const ctx={console,Date:class extends Date{static now(){return now;}},setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},setInterval(fn){intervals.push(fn);},document:{hidden:false,images:[],scripts:[],addEventListener(n,fn){handlers['doc:'+n]=fn;}},navigator:{userAgent:'fixture'},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},addEventListener(n,fn){handlers[n]=fn;},__NORTH_SHELL_BUILD__:'1239'};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,store,handlers,timers,intervals,advance(ms){now+=ms;},report(){return JSON.parse(ctx.NorthBrowserDiagnostics.report());}};
}
test('diagnostics persist bounded sanitized stack frames and survive reload',()=>{
 const f=fixture();const error={name:'RangeError',message:'Maximum call stack size exceeded PRIVATE_TEXT token=secret',stack:'RangeError PRIVATE_TEXT\n'+Array(30).fill('    at cohabAdvance (https://private.invalid/app.js?v=1239&key=secret:6967:42)').join('\n')};
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
