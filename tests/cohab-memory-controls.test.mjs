import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {read, fnSource, BUNDLES} from './_helpers.mjs';

for(const [label,file] of BUNDLES){
 test(label+': memory scroll follows the inner list and exact-star cleanup keeps every other star',()=>{
  const code=read(file),list={scrollTop:420,scrollHeight:1800,clientHeight:300,isConnected:true},outer={scrollTop:0,scrollHeight:700,clientHeight:650};
  const x=vm.createContext({$:sel=>sel==='[data-cohab-memory-list]'?list:outer,requestAnimationFrame:f=>f(),Math,Array});
  for(const name of ['cohabMemoryScrollTop','cohabMemoryRestoreScroll','memoryPruneLowStars'])vm.runInContext(fnSource(code,name),x);
  assert.equal(x.cohabMemoryScrollTop(),420,'must capture the list, not the outer sheet');
  list.scrollTop=0;x.cohabMemoryRestoreScroll(420);assert.equal(list.scrollTop,420);
  const rows=[1,2,3,4,5].map(imp=>({imp}));assert.equal(x.memoryPruneLowStars(rows,2,true),1);assert.deepEqual(rows.map(m=>m.imp),[1,3,4,5]);
 });
 test(label+': life search keeps the composing input and does not rebuild the page',()=>{
  const view={},el={selectionStart:1,focus(){},setSelectionRange(){}};let renders=0,results=0;
  const x=vm.createContext({spyLifeNoteView:()=>view,document:{getElementById:()=>el},render:()=>renders++,spyLifeNoteRenderResults:()=>results++,String});
  vm.runInContext(fnSource(read(file),'spyLifeNoteSearch'),x);
  x.spyLifeNoteSearch('role','家',{isComposing:true});assert.equal(renders,0);assert.equal(results,0);
  x.spyLifeNoteSearch('role','家庭');assert.equal(renders,0);assert.equal(results,1);assert.equal(view.query,'家庭');
 });
 test(label+': switching accounts while confirming exact-star cleanup cannot delete another account memory',async()=>{
  let account='main',removed=0;const original={memory:[{id:'original',imp:4}]},other={memory:[{id:'other',imp:4}]};
  const x=vm.createContext({S:{},Math,offData:()=>account==='main'?original:other,memoryScopeKey:()=>account,offMemoryScrollTop:()=>0,uiConfirm:async()=>{account='other';return true;},offMemoryRemoveAt:()=>removed++,save(){},offMemory(){},toast(){}});
  vm.runInContext(fnSource(read(file),'offMemoryPruneExactStar'),x);await x.offMemoryPruneExactStar('role',4);
  assert.equal(removed,0);assert.equal(original.memory.length,1);assert.equal(other.memory.length,1);
 });
}

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const bundledApp = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');

function functionSource(source, name) {
  const marker = `function ${name}(`;
  const found = source.indexOf(marker);
  assert.notEqual(found, -1, `missing ${name}`);
  const start = source.slice(Math.max(0, found - 6), found) === 'async ' ? found - 6 : found;
  const brace = source.indexOf('{', found);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

for (const source of [app, bundledApp]) {
  test('cohab memory controls use stable ids and HTML datasets', () => {
    const view = functionSource(source, 'cohabMemoryOpen');
    assert.match(source, /function cohabMemoryEnsureIds\(d\)/);
    assert.match(view, /data-cohab-memory-id=/);
    assert.match(view, /data-mid="\$\{esc\(key\)\}"/);
    assert.match(view, /cohabMemoryDelete\(this\.dataset\.cid,this\.dataset\.mid\)/);
    assert.doesNotMatch(view, /cohabMemoryDelete\('\$\{id\}','\$\{key\}'\)/);
  });

  test('cohab memory deletion and star changes preserve the modal reading position', () => {
    assert.match(functionSource(source, 'cohabMemoryDelete'), /const top=cohabMemoryScrollTop\(\)/);
    assert.match(functionSource(source, 'cohabMemoryDelete'), /cohabMemoryOpen\(id,\{scrollTop:top\}\)/);
    assert.match(functionSource(source, 'cohabMemorySetImp'), /cohabMemoryOpen\(id,\{scrollTop:top\}\)/);
    const restore = functionSource(source, 'cohabMemoryRestoreScroll');
    assert.match(restore, /requestAnimationFrame\(\(\)=>\{restore\(\);requestAnimationFrame\(restore\);\}\)/);
  });

  test('cohab memories expose direct 1-5 star controls and importance-aware recall', () => {
    const view = functionSource(source, 'cohabMemoryOpen');
    assert.match(view, /\[1,2,3,4,5\]\.map/);
    assert.match(view, /aria-label="设为\$\{v\}星"/);
    assert.match(view, /5 星不会被容量清理/);
    assert.match(functionSource(source, 'cohabMemoryPrompt'), /星级越高越重要/);
    assert.match(functionSource(source, 'cohabMemoryPrompt'), /\(\+b\.imp\|\|3\)-\(\+a\.imp\|\|3\)/);
  });
}

test('stable ids distinguish otherwise identical cohab memories', () => {
  const sandbox = {};
  vm.runInNewContext(
    `${functionSource(app, 'cohabMemoryKey')}\n${functionSource(app, 'cohabMemoryFindIndex')}\nthis.find=cohabMemoryFindIndex;`,
    sandbox
  );
  const d = {summaries: [
    {id: 'first', ts: 1, text: "we can't forget"},
    {id: 'second', ts: 1, text: "we can't forget"}
  ]};
  assert.equal(sandbox.find(d, 'second'), 1);
});

test('five-star cohab memories survive capacity pruning', () => {
  const sandbox = {};
  vm.runInNewContext(`${functionSource(app, 'cohabMemoryPrune')}\nthis.prune=cohabMemoryPrune;`, sandbox);
  const d = {summaries: [
    {id: 'treasured', imp: 5},
    {id: 'old-low', imp: 2},
    {id: 'new-low', imp: 4}
  ]};
  sandbox.prune(d, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(d.summaries)).map(x => x.id), ['treasured', 'new-low']);
});

test('web and private bundle share the same cohab memory control block', () => {
  const start = source => source.indexOf('function cohabMemoryKey(');
  const end = source => source.indexOf('function cohabPushMessage(', start(source));
  assert.equal(app.slice(start(app), end(app)).replace(/\r\n/g, '\n'), bundledApp.slice(start(bundledApp), end(bundledApp)).replace(/\r\n/g, '\n'));
});
