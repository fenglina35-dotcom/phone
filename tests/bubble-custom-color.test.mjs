import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < app.length; i += 1) {
    if (app[i] === '{') { depth += 1; opened = true; }
    if (app[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return app.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('an explicitly selected font color is not replaced on a custom gray bubble', () => {
  const source = [
    functionSource('bubbleSolid'),
    functionSource('bubbleReadableText'),
  ].join('\n');
  const readable = Function('contrastRatio', `${source};return bubbleReadableText;`)(() => 1);
  assert.equal(readable('#b9bdc6', '#f15bb5', '#111111'), '#f15bb5');
  assert.equal(readable('#b9bdc6', '#ffffff', '#111111'), '#ffffff');
});

test('web and private-App bubble renderers stay aligned', () => {
  const bundled = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'PhoneWeb.bundle', 'app.js'), 'utf8');
  assert.ok(bundled.includes(functionSource('bubbleReadableText')));
});


test('logged-in role WeChat keeps bubble style bound to the sender when message sides reverse',()=>{
  const calls=[],role={id:'role',bubbleStyle:{themBg:'#123456',meBg:'#abcdef'}};
  const render=Function('getC','bubbleLook','bubbleIconFor','msgToText','esc',functionSource('hisChatMessageHTML')+';return hisChatMessageHTML;')(
    id=>id==='role'?role:null,
    (c,user)=>{calls.push({c,user});return {cls:' bpretty',css:'--bbg:'+c.bubbleStyle[user?'meBg':'themBg']};},
    (c,user)=>user?'PLAYER_ICON':'ROLE_ICON',m=>m.content,String);
  const outgoing=render('role','__me',{type:'text',content:'role message'},true);
  const incoming=render('role','__me',{type:'text',content:'player message'},false);
  assert.match(outgoing,/#123456/);assert.match(outgoing,/ROLE_ICON/);
  assert.match(incoming,/#abcdef/);assert.match(incoming,/PLAYER_ICON/);
  assert.equal(calls[0].c,role);assert.equal(calls[0].user,false);assert.equal(calls[1].user,true);
  assert.match(render('role','friend',{type:'text',c:'friend chat'},true),/#123456/);
  const privateSource=readFileSync(join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'),'utf8');
  assert.ok(privateSource.includes(functionSource('hisChatMessageHTML')));
});
