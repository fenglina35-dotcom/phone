import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
const require=createRequire(import.meta.url),engine=process.env.NORTH_RUNNER_TEST_OLD?(()=>{const ctx={module:{exports:{}}};vm.runInNewContext(require('node:child_process').execFileSync('git',['show','HEAD:north-runner.js'],{encoding:'utf8'}),ctx);return ctx.module.exports;})():require('../north-runner.js');
const privateDir='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
test('game status and rewards preserve unrelated store snapshots while purchases still invalidate them',async()=>{
 for(const dir of ['',privateDir]){
  const source=fs.readFileSync(dir+'commerce-ui.js','utf8');let resets=0;
  const identity={id:'SPFIXTURE',secret:'fixture'},ctx={S:{},actId:()=> 'main',phoneFriendState:()=>identity,GATE_URL:'https://fixture.invalid',pfHeaders:()=>({}),fetchT:async()=>({ok:true,status:200,json:async()=>({ok:true})}),northMarketPageReset:()=>resets++};
  vm.runInNewContext(source.slice(source.indexOf('  async function northMarketRpc('),source.indexOf('  function northMarketImage('))+';this.rpc=northMarketRpc;',ctx);
  for(const name of ['runner_status','runner_start','runner_claim'])await ctx.rpc(name,{},true);
  assert.equal(resets,0);await ctx.rpc('order_create',{},true);assert.equal(resets,1);
 }
});
test('remaining in the middle lane cannot survive the first 23 seconds without any control',()=>{const g=engine.create(42);while(!g.done&&g.tick<1400)engine.step(g);assert.equal(g.hearts,0);});
test('difficulty advances world speed and no stationary lane remains safe',()=>{
 assert.equal(engine.speed(0),160);assert(engine.speed(1800)>engine.speed(600));assert.equal(engine.speed(6000),660);assert(engine.speed(5400)>engine.speed(4800));assert.equal(engine.speed(6000,1),400);
 for(const seed of [1,7,42,109,98765])for(const lane of [0,1,2]){const g=engine.create(seed);g.lane=lane;g.x=lane*1000;while(!g.done&&g.tick<1400)engine.step(g);assert.equal(g.hearts,0,'standing still must fail: '+seed+'/'+lane);}
});
test('physics 3 starts at 2.5x, keeps accelerating and has 32 solvable full routes',()=>{assert.equal(engine.speed(0,3),400);assert.equal(engine.speed(6000,3),900);for(let seed=1;seed<=32;seed++){const g=finish(seed,true,3);assert.equal(g.hearts,3,'new route '+seed);assert.equal(g.tick,6000);assert.equal(g.distance,engine.distanceAt(6000,3));}assert.equal(engine.speed(0,1),160);assert.equal(engine.speed(0,2),160);});
test('ground projection uses the same world distance as collision and multi-lane routes remain solvable',()=>{
 assert.equal(engine.project(0),1);assert(engine.project(14000)<engine.project(7000));
 for(let seed=1;seed<=32;seed++){const rows=engine.track(seed);assert(rows.some(r=>r.objects.length===3));for(const row of rows){assert(row.objects.length>=1&&row.objects.length<=3);assert(!row.objects.some(o=>o.lane===row.safeLane&&o.type===2));}const g=finish(seed);assert.equal(g.hearts,3,'route must be solvable: '+seed);assert.equal(g.distance,engine.distanceAt(g.tick));}
});
function finish(seed,safe=true,version=2){const g=engine.create(seed,version);let moved=-1,acted=-1;while(!g.done){const o=g.rows[g.row];if(safe&&o){const gap=o.distance-g.distance;if(gap<=engine.speed(g.tick,g.physicsVersion)*40&&moved!==g.row){if(g.lane!==o.safeLane)engine.input(g,g.lane>o.safeLane?'l':'r');moved=g.row;}if(gap<=engine.speed(g.tick,g.physicsVersion)*18&&acted!==g.row&&o.action){engine.input(g,o.action);acted=g.row;}}engine.step(g);}return g;}
test('runner fixed simulation has repeatable tracks, three hearts, bounded controls and terminal reward count',()=>{
 assert.deepEqual(engine.track(1),engine.track(1));assert.notDeepEqual(engine.track(1),engine.track(2));
 const safe=finish(42);assert.equal(safe.tick,6000);assert.equal(safe.orders,10);assert.equal(safe.hearts,3);
 const g=engine.create(42);assert(engine.input(g,'l'));assert(!engine.input(g,'r'));for(let i=0;i<6;i++)engine.step(g);assert(engine.input(g,'r'));assert.equal(g.lane,1);
 const dead=finish(42,false);assert.equal(dead.hearts,0);assert(dead.tick<6000);assert.equal(dead.orders,Math.floor(dead.tick/600));assert(!engine.input(dead,'u'));
});
test('jump and slide avoid only matching obstacles and collisions grant a short shield',()=>{
 for(const [type,action] of [[0,'u'],[1,'d']]){const g=engine.create(1);g.rows=[{distance:2400,objects:[{lane:1,type}]}];engine.input(g,action);for(let i=0;i<15;i++)engine.step(g);assert.equal(g.hearts,3);}
 const g=engine.create(1);g.rows=[{distance:1600,objects:[{lane:1,type:2}]},{distance:3200,objects:[{lane:1,type:2}]},{distance:14000,objects:[{lane:1,type:2}]}];engine.input(g,'u');for(let i=0;i<90;i++)engine.step(g);assert.equal(g.hearts,1);
});
test('both runtimes include the independent runner, existing back route and separate reward ledger label',()=>{
 assert.equal(fs.readFileSync('north-runner.js','utf8'),fs.readFileSync(privateDir+'north-runner.js','utf8'));for(const f of ['rider','street','van'])assert.deepEqual(fs.readFileSync('assets/north-runner-'+f+'.png'),fs.readFileSync(privateDir+'assets/north-runner-'+f+'.png'));assert.match(fs.readFileSync('north-runner.js','utf8'),/gap:10px;color:#ef4b4f/);
 for(const dir of ['',privateDir]){assert.match(fs.readFileSync(dir+'小手机.html','utf8'),/north-runner\.js/);assert.match(fs.readFileSync(dir+'app.js','utf8'),/NorthRunner\.back\(\)/);assert.match(fs.readFileSync(dir+'commerce-ui.js','utf8'),/runner_reward:'跑腿游戏奖励'/);}
});
test('real PostgreSQL reward replay verifies time, identity, idempotency, daily cap and wallet isolation',async()=>{
 let library;try{library=require('@electric-sql/pglite');}catch(error){library=require(process.env.NORTH_PGLITE_MODULE||path.join(os.homedir(),'AppData','Local','CodexHardwareTests','robot-voice-sql-runtime','node_modules','@electric-sql','pglite','dist','index.cjs'));}const {PGlite}=library;const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;
 create table public.phone_friend_profiles(phone_id text,secret_hash text);create table public.phone_licenses(id uuid,status text,phone_friend_id text,created_at timestamptz default now());
 create function public.phone_friend_hash(text) returns text language sql immutable as 'select md5($1)';
 create table public.north_market_wallets(owner_id text primary key,balance bigint default 0,income bigint default 0,updated_at timestamptz default now());
 create table public.north_market_ledger(owner_id text,kind text constraint north_market_ledger_kind_check check(kind in ('grant','admin_credit','purchase','refund','income','withdraw','allocate','coupon','restock','stock_return','startup')),amount bigint,request_id uuid,target text,unique(owner_id,kind,request_id));
 insert into public.phone_friend_profiles values('SPRUNNER',md5('runner-test')),('SPOTHER',md5('other-test'));insert into public.phone_licenses(id,status,phone_friend_id) values('11111111-1111-4111-8111-111111111111','active','SPRUNNER'),('22222222-2222-4222-8222-222222222222','active','SPOTHER');`);
 const base=fs.readFileSync('supabase/migrations/202610070001_north_market.sql','utf8');await db.exec(base.slice(base.indexOf('create or replace function public.north_market_identity('),base.indexOf('create or replace function public.north_market_image_valid(')));
 await db.exec(fs.readFileSync('supabase/migrations/202610080002_north_runner_rewards.sql','utf8'));await db.exec(fs.readFileSync('supabase/migrations/202610080003_north_runner_continuous_speed.sql','utf8'));await db.exec(fs.readFileSync('supabase/migrations/202610080004_north_runner_initial_speed.sql','utf8'));
 const call=async(name,args=[],phone='SPRUNNER',secret='runner-test')=>(await db.query(`select public.north_market_runner_${name}(${Array.from({length:args.length+2},(_,i)=>'$'+(i+1)).join(',')}) as d`,[phone,secret,...args])).rows[0].d;
 await assert.rejects(()=>call('status',[],'SPRUNNER','bad'),/market-auth-required/);
 let used=0;
 for(let round=0;round<4;round++){
  const client=crypto.randomUUID(),s=await call('start',[client,2]);assert.equal((await call('start',[client,2])).id,s.id);const g=finish(s.seed);
  await assert.rejects(()=>call('claim',[s.id,g.tick,JSON.stringify(g.inputs)]),/runner-too-fast/);
  await db.query("update public.north_runner_sessions set started_at=now()-interval '110 seconds' where id=$1",[s.id]);
  await assert.rejects(()=>call('claim',[s.id,g.tick,JSON.stringify(g.inputs)],'SPOTHER','other-test'),/runner-invalid/);
  await assert.rejects(()=>call('claim',[s.id,6000,JSON.stringify([{t:0,a:null}])]),/runner-invalid/);await assert.rejects(()=>call('claim',[s.id,6000,'[]']),/runner-invalid/);
  const reward=await call('claim',[s.id,g.tick,JSON.stringify(g.inputs)]);assert.equal(reward.reward,round===3?0:1000);used+=reward.reward;assert.equal(reward.used,used);assert.equal((await call('claim',[s.id,g.tick,JSON.stringify(g.inputs)])).reward,reward.reward);
 }
 const fast=await call('start',[crypto.randomUUID(),3]);assert.equal(fast.physicsVersion,3);const replay=finish(fast.seed,true,3);await db.query("update public.north_runner_sessions set started_at=now()-interval '110 seconds' where id=$1",[fast.id]);const fastReward=await call('claim',[fast.id,replay.tick,JSON.stringify(replay.inputs)]);assert.equal(fastReward.orders,10);assert.equal(fastReward.reward,0);assert.equal((await call('start',[crypto.randomUUID(),2])).physicsVersion,2);
 const wallet=(await db.query('select * from public.north_market_wallets')).rows;assert.equal(wallet.length,1);assert.equal(Number(wallet[0].balance),3000);assert.equal(Number(wallet[0].income),0);
 assert.equal(Number((await db.query('select count(*) as n from public.north_market_ledger')).rows[0].n),3);
 const legacy=await call('start',[crypto.randomUUID()]);const legacyGame=finish(legacy.seed,true,1);assert.equal(legacyGame.tick,6000);await db.query("update public.north_runner_sessions set started_at=now()-interval '110 seconds' where id=$1",[legacy.id]);assert.equal((await call('claim',[legacy.id,legacyGame.tick,JSON.stringify(legacyGame.inputs)])).reward,0);
 const stale=await call('start',[crypto.randomUUID()]);await call('start',[crypto.randomUUID()]);await assert.rejects(()=>call('claim',[stale.id,6000,'[]']),/runner-expired/);
 const acl=(await db.query("select has_table_privilege('anon','public.north_runner_sessions','INSERT') as write,has_function_privilege('anon','public.north_market_runner_claim(text,text,uuid,integer,jsonb)','EXECUTE') as claim")).rows[0];assert.equal(acl.write,false);assert.equal(acl.claim,true);
 }finally{await db.close();}
});

test('runner music switches one player, loops gameplay, stops on pause and handles blocked playback',async()=>{
 for(const file of ['north-runner.js',privateDir+'north-runner.js']){
  const code=fs.readFileSync(file,'utf8'),start=code.indexOf(' function music('),end=code.indexOf(' function valid(',start),document={hidden:false};
  class Audio {constructor(){this.paused=true;this.currentTime=0;this.plays=0;}pause(){this.paused=true;}play(){this.paused=false;this.plays++;return this.block?Promise.reject(new Error('blocked')):Promise.resolve();}setAttribute(){} }
  const ctx={Audio,document};vm.createContext(ctx);vm.runInContext(code.slice(start,end)+';globalThis.music=music;globalThis.primeMusic=primeMusic;',ctx);
  const v={};ctx.primeMusic(v);await Promise.resolve();assert.equal(v.audio.paused,true);
  ctx.music(v,'game',true);assert.equal(v.audio.src,'assets/north-runner-game.mp3');assert.equal(v.audio.loop,true);assert.equal(v.audio.muted,false);
  v.audio.currentTime=9;ctx.music(v,null);assert.equal(v.audio.paused,true);ctx.music(v,'game');assert.equal(v.audio.currentTime,9);
  const player=v.audio;ctx.music(v,'result',true);assert.equal(v.audio,player);assert.equal(v.audio.loop,false);assert.equal(v.audio.currentTime,0);assert.equal(v.audio.src,'assets/north-runner-result.mp3');
  ctx.music(v,'game',true);assert.equal(v.audio.loop,true);assert.equal(v.audio.currentTime,0);
  document.hidden=true;ctx.music(v,'result');assert.equal(v.audio.paused,true);document.hidden=false;v.audio.block=true;ctx.music(v,'game');await Promise.resolve();
 }
 for(const kind of ['game','result'])assert.deepEqual(fs.readFileSync('assets/north-runner-'+kind+'.mp3'),fs.readFileSync(privateDir+'assets/north-runner-'+kind+'.mp3'));
});
