import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');
const chats = app.match(/function wxChats\(\)\{[\s\S]*?(?=\nfunction gpreview)/)?.[0] || '';

test('role, real friend, and real group chats share one time-sorted list', () => {
  assert.match(chats, /const entries=\[\],add=/);
  assert.match(chats, /list\.forEach\(c=>/);
  assert.match(chats, /\(p\.friends\|\|\[\]\)\.forEach\(f=>/);
  assert.match(chats, /\(p\.groups\|\|\[\]\)\.forEach\(g=>/);
  assert.match(chats, /entries\.slice\(0,motionAt\)\.map\(x=>x\.html\)/);
  assert.match(chats, /entries\.slice\(motionAt\)\.map\(x=>x\.html\)/);
});

test('pinned chats remain above recent unpinned chats', () => {
  assert.match(chats, /entries\.sort\(\(a,b\)=>\(b\.pinned\?1:0\)-\(a\.pinned\?1:0\)\|\|b\.time-a\.time\|\|a\.order-b\.order\)/);
  assert.match(chats, /add\(lm&&lm\.time,c\.pinned,roleRow\(c\)\)/);
  assert.match(chats, /add\(lm&&lm\.time,f\.pinned,/);
  assert.match(chats, /add\(lm&&lm\.time,g\.pinned,/);
});

test('WeChat Motion stays below every pinned chat and above regular chats', () => {
  assert.match(chats, /const firstRegular=entries\.findIndex\(x=>!x\.pinned\),motionAt=firstRegular<0\?entries\.length:firstRegular/);
  assert.match(chats, /entries\.slice\(0,motionAt\)[\s\S]*wxStepsChatRow\(\)[\s\S]*entries\.slice\(motionAt\)/);
});
