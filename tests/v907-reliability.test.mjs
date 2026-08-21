import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const pet=fs.readFileSync(new URL('../pet-game.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/phone-role-push/index.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202608130002_background_handoff_reliability.sql',import.meta.url),'utf8');

test('immediate app test is independent from formal daily quota',()=>{
  const preflight=app.match(/async function roleBackgroundPreflight[\s\S]*?function roleBackgroundShowFailure/)?.[0]||'';
  assert.match(preflight,/needWatch&&\(!c\.proactive\.appWatch\)/);
  assert.doesNotMatch(preflight,/appWatchDailyLimit/);
});

test('durable reply is saved before its server handoff is canceled',()=>{
  const reply=app.match(/if\(delivered\)\{\/\* 先把回复真正落盘[\s\S]*?roleBackgroundCancel\(id,\['reply_handoff'\]\);\}/)?.[0]||'';
  assert.ok(reply.indexOf('persistWechatMessagesNow()')>=0);
  assert.ok(reply.indexOf('persistWechatMessagesNow()')<reply.indexOf('roleBackgroundCancel'));
  assert.match(app,/if\(!document\.hidden\)roleBackgroundCancel\(id,\['device_handoff'\]\)/);
});

test('explicit tests and handoffs survive transient profile state',()=>{
  assert.match(edge,/const explicitHandoff = \["reply_handoff", "device_handoff", "one_minute_test", "app_watch_test", "delivery_status"\]/);
  assert.match(edge,/!explicitHandoff && \(!profile\.enabled \|\| profileTemporarilySuspended\(profile\)\)/);
  assert.match(migration,/and kind = v_kind and status in \('pending','claimed'\)/);
  assert.doesNotMatch(migration,/kind in \('reply_handoff','device_handoff'\)/);
  assert.match(edge,/!explicitHandoff,/);
  assert.match(edge,/if \(!allowSilent\)/);
  assert.match(edge,/本次不允许输出 \[保持安静\]/);
});

test('service-worker license integrity follows biometric-only recovery',()=>{
  assert.match(sw,/text\.includes\('restorePasskey'\)/);
  assert.match(sw,/text\.includes\('supportsPasskey'\)/);
  assert.doesNotMatch(sw,/redeemTransfer/);
});

test('pet growth, regression and nest sleeping rules are present',()=>{
  assert.match(pet,/Math\.floor\(days\/30\)/);
  assert.match(pet,/function petRegress\(\)/);
  assert.match(pet,/function petRestoreGrowth\(\)/);
  assert.match(pet,/const PET_SLEEP_LAYOUTS=/);
  assert.match(pet,/1:\[\{x:20\.5,y:45\.0\}\]/);
  assert.match(pet,/4:\[\{x:15\.1,y:42\.7\},\{x:25\.9,y:42\.7\},\{x:15\.1,y:47\.1\},\{x:25\.9,y:47\.1\}\]/);
  assert.match(pet,/function petSleepWidth\(species,total\)/);
  assert.match(pet,/closeModal\(\);petReaction\(p,reaction,bubble,1600\)/);
});

test('voice translation colors and role-message deletion are exposed',()=>{
  assert.match(app,/语音翻译框（单独配色）/);
  assert.match(app,/function voiceTranslationLook\(c,me\)/);
  assert.match(app,/删除这条角色消息/);
  assert.match(app,/function deleteRoleMsg\(cid,mid\)/);
});
