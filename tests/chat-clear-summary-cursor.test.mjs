import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import {read, fnSource, BUNDLES} from './_helpers.mjs';

for(const [label,file] of BUNDLES){
 test(label+': a removed summary anchor recovers the covered range without repeating older messages',()=>{
  const all=Array.from({length:7},(_,i)=>({id:'m'+i})),role={id:'role'},x=vm.createContext({memoryScopeKey:v=>v||'main',save(){},Set,Array,Math,String});
  for(const n of ['summaryState','summaryStateSave','summaryStateDone'])vm.runInContext(fnSource(read(file),n),x);
  x.summaryStateSave(role,'main',5,all);x.summaryStateSave(role,'alt',2,all);
  const reopened=JSON.parse(JSON.stringify(role)),kept=all.filter(m=>m.id!=='m4'),done=x.summaryStateDone(reopened,'main',kept);
  assert.equal(done,4);assert.deepEqual(kept.slice(done).map(m=>m.id),['m5','m6']);assert.equal(reopened._accountSummaryState.alt.count,2);
 });
 test(label+': an untraceable summary boundary is flagged instead of silently restarting automatic summaries',()=>{
  const role={id:'role',_accountSummaryState:{main:{count:3,cursorV2:true,lastMessageId:'missing'}}},x=vm.createContext({memoryScopeKey:v=>v||'main',save(){},Set,Array,Math,String});
  for(const n of ['summaryState','summaryStateSave','summaryStateDone'])vm.runInContext(fnSource(read(file),n),x);
  assert.equal(x.summaryStateDone(role,'main',[{id:'remaining'}]),0);assert.equal(role._accountSummaryState.main.cursorUncertain,true);
  x.summaryStateSave(role,'main',0,[]);assert.equal(role._accountSummaryState.main.cursorUncertain,undefined);
 });
}

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') { depth += 1; opened = true; }
    if (source[i] === '}' && opened && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

function runtime(role) {
  const sandbox = vm.createContext({
    Set,
    Array,
    Math,
    memoryScopeKey: value => value || 'main',
  });
  vm.runInContext([
    functionSource('summaryState'),
    functionSource('summaryStateSave'),
    functionSource('summaryStateDone'),
    functionSource('summaryCursorRebaseAfterMessagePrune'),
    'this.rebase=summaryCursorRebaseAfterMessagePrune;',
  ].join('\n'), sandbox);
  return rows => sandbox.rebase(role, rows.aid || 'main', rows.before, rows.after);
}

test('clearing old messages rebases the positional summary cursor instead of hiding future chat', () => {
  const before = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}` }));
  const after = before.slice(6);
  const role = { _sumCount: 8, _summaryCursorV2: true, _accountSummaryState: { main: { count: 8, cursorV2: true } }, _autoSummaryError: 'old', _autoSummaryErrorAt: 123 };
  const next = runtime(role)({ before, after });
  assert.equal(next, 2);
  assert.equal(role._accountSummaryState.main.count, 2);
  assert.deepEqual(after.slice(next).map(row => row.id), ['m8', 'm9']);
  assert.equal(role._autoSummaryErrorAt, undefined);
  assert.equal(role._accountSummaryState.main.lastMessageId, 'm7');
});

test('an already-broken cursor from an older clear self-heals when it points beyond current chat', () => {
  const all = [{ id: 'new1' }, { id: 'new2' }];
  const role = { id: 'c1', _accountSummaryState: { main: { count: 88, cursorV2: true } } };
  let saves = 0;
  const sandbox = vm.createContext({ Set, Array, Math, String, memoryScopeKey: value => value || 'main', msgsForAccount: () => all, save: () => { saves += 1; } });
  vm.runInContext(`${functionSource('summaryState')}\n${functionSource('summaryStateSave')}\n${functionSource('summaryStateDone')}\nthis.done=summaryStateDone;`, sandbox);
  assert.equal(sandbox.done(role, 'main', all), 0);
  assert.equal(role._accountSummaryState.main.count, 0);
  assert.equal(saves, 1);
});

test('preserved call rows remain before the next unsummarized message after clearing text', () => {
  const call = { id: 'call', _call: true };
  const before = [{ id: 'u1' }, call, { id: 'a1' }, { id: 'u2' }];
  const after = [call];
  const role = { _accountSummaryState: { main: { count: 3, cursorV2: true } } };
  const next = runtime(role)({ before, after });
  assert.equal(next, 1);
  assert.equal(role._accountSummaryState.main.count, 1);
});

test('chat clear path invokes cursor rebasing before replacing the message list', () => {
  const clear = functionSource('doClear');
  assert.match(clear, /summaryCursorRebaseAfterMessagePrune\(c,aid,list,keep\);S\.messages\[mkey\(id\)\]=keep/);
});
