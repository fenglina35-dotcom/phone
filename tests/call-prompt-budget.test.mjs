import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false,regex=false,regexClass=false,prev='';
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(regex){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='[')regexClass=true;else if(ch===']')regexClass=false;else if(ch==='/'&&!regexClass)regex=false;continue;}
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='/'&&source[i+1]!=='/'&&source[i+1]!=='*'&&/[=(,:;!&|?\[{]/.test(prev)){regex=true;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
    if(!/\s/.test(ch))prev=ch;
  }
  throw new Error(`unterminated ${name}`);
}

const context=vm.createContext({Array,Math,Number,String,Object});
vm.runInContext(functionSource('callPromptHistory'),context);

const rows=Array.from({length:100},(_,i)=>({role:i%2?'assistant':'user',content:`row-${i}-`+'字'.repeat(390)}));
const original=rows.map(row=>row.content);
const bounded=context.callPromptHistory(rows,48,5000);
assert.ok(bounded.length>=8&&bounded.length<=48,'phone history keeps a useful recent window inside the row cap');
assert.equal(bounded.at(-1).content,rows.at(-1).content,'the newest phone turn must never be discarded');
assert.equal(rows[0].content,original[0],'history budgeting must not mutate stored chat messages');
assert.ok(bounded.reduce((sum,row)=>sum+row.content.length+24,0)<=5000,'phone history stays inside its character budget');

// CALL_CONTEXT_ROUNDS_V1: the newest part of the call stays whole; only an oversized older message is compacted.
const oversized=context.callPromptHistory([{role:'user',content:'开'.repeat(5000)},{role:'assistant',content:'近'.repeat(8000)}],48,12000);
assert.ok(oversized[0].content.length<1900,'a single oversized older message is compacted');
assert.match(oversized[0].content,/较早内容已压缩/);
assert.equal(oversized[1].content,'近'.repeat(8000),'the newest call content is kept whole');

const callStart=source.indexOf('async function callAI(');
const callEnd=source.indexOf('/* =================== 天气',callStart);
const callAI=source.slice(callStart,callEnd);
assert.match(callAI,/const bounded=callPromptHistory\(hist\);hist\.splice\(0,hist\.length,\.\.\.bounded\)/,'call requests use bounded recent history');
assert.match(callAI,/_callMemory=selectRelevantMemory\(c,_callQuery,5\)/,'call requests retrieve only memories relevant to the live turn');
assert.match(callAI,/selectiveMemory:true,memoryItems:_callMemory\.items/,'call system prompt no longer injects every accumulated memory');
assert.match(callAI,/memoryRetrievalPrompt\(c,_callMemory\)\+cf/,'selected memories remain available to the role');

console.log('call prompt budget tests passed');
