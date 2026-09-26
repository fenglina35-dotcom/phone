import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function fn(name){const start=source.indexOf(`function ${name}`),brace=source.indexOf('{',start);assert.ok(start>=0);let depth=0,quote='',esc=false;for(let i=brace;i<source.length;i++){const ch=source[i];if(quote){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch===quote)quote='';continue;}if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);}throw new Error('unterminated');}

const contacts=[{id:'bound',relation:'情侣'},{id:'other',relation:'情侣'}];
const context=vm.createContext({S:{couple:{cid:'bound'},contacts},getC:id=>contacts.find(c=>c.id===id)});
vm.runInContext(fn('taskRelationAllowed'),context);
vm.runInContext(fn('coupleTasksEnabled'),context);
vm.runInContext(fn('taskC'),context);
assert.equal(context.taskC(),null,'tasks default to off');
context.S.couple.tasksEnabled=true;
assert.equal(context.taskRelationAllowed(contacts[0]),true);
assert.equal(context.taskRelationAllowed(contacts[1]),false,'another romance-labelled role must never assign tasks');
assert.equal(context.taskC().id,'bound');
context.S.couple=null;
assert.equal(context.taskC(),null,'there is no fallback task owner without a bound couple');

const auto=fn('autoAssignTasks'),generate=fn('genTasks');
assert.match(auto,/taskAutoState\(c\)/);
assert.match(auto,/genTasks\(\{automatic:true\}\)/);
assert.match(generate,/if\(!Array\.isArray\(arr\)\)arr=\[\]/,'invalid model JSON must fall back to built-in tasks');
assert.match(generate,/if\(!automatic\)toast\('没布置成功，再点一次'\)/,'automatic failures must stay silent');
assert.match(generate,/st\.nextAt=Date\.now\(\)\+Math\.min\(6\*3600000,15\*60000\*Math\.pow\(2,attempts-1\)\)/,'automatic retries must back off persistently');

console.log('task couple lock tests passed');
