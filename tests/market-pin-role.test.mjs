// MARKET_PIN_ROLE_V1：真人店铺支付密码可以让情侣角色知道，忘了问他找回。
// 密码先请云端核对（改成同一个密码），对了才存在本机；只有她问情侣角色支付密码的那一轮才带给他。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, PRIV_DIR, BUNDLES } from './_helpers.mjs';

for (const [label, file] of [['web', 'commerce-ui.js'], ['private', PRIV_DIR + 'commerce-ui.js']]) {
  const src = read(file);
  const block = () => {
    const a = src.indexOf('/* MARKET_PIN_ROLE_V1'), b = src.indexOf('window.northMarketPinSave=', a), c = src.indexOf('\n', b);
    assert.ok(a > 0 && b > a, '缺少 MARKET_PIN_ROLE_V1');
    return src.slice(a, c);
  };
  const harness = (realPin) => {
    const calls = [], toasts = [];
    const ctx = vm.createContext({
      S: { me: {}, couple: { cid: 'r1' } }, getC: (id) => ({ id, name: '林深', remark: '先生' }), esc: String, save: () => {}, toast: (t) => toasts.push(t), openModal: () => {}, closeModal: () => {},
      document: { getElementById: (id) => ctx.__inputs[id] || null }, __inputs: {},
      northMarketBusy: false, northMarketEnsure: async () => {},
      northMarketRpc: async (name, args) => { calls.push([name, args]); if (args.p_old !== realPin) throw new Error('支付密码不对'); return { ok: true }; },
    });
    ctx.window = ctx; ctx.northMarketPinSettings = () => {};
    vm.runInContext('var northMarketBusy=false;' + block(), ctx);
    return { ctx, calls, toasts };
  };

  test(label + ' the current password is checked with the cloud before he is told, and only stored when right', async () => {
    const { ctx, calls } = harness('24680');
    ctx.__inputs.north_market_role_pin = { value: '11111' };
    await ctx.northMarketPinRoleOn();
    assert.equal(ctx.S.me.marketPinRole, undefined, '密码不对就不存');
    ctx.__inputs.north_market_role_pin = { value: '24680' };
    await ctx.northMarketPinRoleOn();
    assert.equal(ctx.S.me.marketPinRole.pin, '24680');
    assert.equal(JSON.stringify(calls.at(-1)), JSON.stringify(['pin', { p_old: '24680', p_new: '24680' }]), '用改成同一个密码来核对，不会真的改');
    ctx.__inputs.north_market_old_pin = { value: '24680' }; ctx.__inputs.north_market_new_pin = { value: '13579' }; ctx.__inputs.north_market_confirm_pin = { value: '13579' };
    await ctx.northMarketPinSave();
    assert.equal(ctx.S.me.marketPinRole.pin, '13579', '以后改了密码，他知道的也跟着改');
    ctx.northMarketPinRoleOff();
    assert.equal(ctx.S.me.marketPinRole, undefined);
  });

  test(label + ' only the couple role, and only when she asks about the password, gets it for that one reply', () => {
    const { ctx } = harness('24680');
    ctx.S.me.marketPinRole = { pin: '24680', cid: 'r1' };
    const note = ctx.northMarketPinRoleNote({ id: 'r1' }, '我忘了支付密码了，你还记得吗');
    assert.match(note, /24680/); assert.match(note, /不要在朋友圈、群聊、别人面前提/);
    assert.match(ctx.northMarketPinRoleNote({ id: 'r1' }, '店铺密码是多少来着'), /24680/);
    assert.equal(ctx.northMarketPinRoleNote({ id: 'r1' }, '今天好累'), '', '平时不带');
    assert.equal(ctx.northMarketPinRoleNote({ id: 'r2' }, '我忘了支付密码'), '', '别的角色不给');
    delete ctx.S.me.marketPinRole;
    assert.equal(ctx.northMarketPinRoleNote({ id: 'r1' }, '我忘了支付密码'), '', '没让他记就没有');
  });
}

for (const [label, file] of BUNDLES) {
  test(label + ' chat send passes the password note for that reply only', () => {
    assert.match(read(file), /const _pinNote=typeof window\.northMarketPinRoleNote==='function'\?window\.northMarketPinRoleNote\(c,t\):'';if\(_pinNote\)\{scheduleReply\(id,_pinNote\);return;\}/);
  });
}

// MARKET_PIN_RESET_V1（2026-11-03）：忘了密码不用旧密码直接设新的；设新密码、改密码时可以让情侣角色跟着记住；问法多认几种。
for (const [label, file] of [['web', 'commerce-ui.js'], ['private', PRIV_DIR + 'commerce-ui.js']]) {
  const src = read(file);
  const harness = () => {
    const calls = [], toasts = [], modals = [];
    const ctx = vm.createContext({
      S: { me: {}, couple: { cid: 'r1' } }, getC: (id) => ({ id, name: '林深', remark: '先生' }), esc: String, save: () => {}, toast: (t) => toasts.push(t), openModal: (h) => modals.push(h), closeModal: () => {},
      document: { getElementById: (id) => ctx.__inputs[id] || null }, __inputs: {},
      northMarketEnsure: async () => {}, northMarketRpc: async (name, args) => { calls.push([name, args]); return { ok: true }; },
    });
    ctx.window = ctx;
    const a = src.indexOf('/* MARKET_PIN_ROLE_V1'), b = src.indexOf('window.northMarketPinSave=', a), c = src.indexOf('\n', b);
    assert.ok(a > 0 && src.indexOf('MARKET_PIN_RESET_V1') > 0, '缺少 MARKET_PIN_RESET_V1');
    const settings = src.slice(src.indexOf('window.northMarketPinSettings='), src.indexOf('\n', src.indexOf('window.northMarketPinSettings=')));
    vm.runInContext('var northMarketBusy=false;' + src.slice(a, c) + '\n' + settings, ctx);
    return { ctx, calls, toasts, modals };
  };

  test(label + ' forgot password sets a new one without the old one and he remembers it', async () => {
    const { ctx, calls, modals } = harness();
    ctx.northMarketPinSettings();
    assert.match(modals.at(-1), /忘记密码，直接设新密码/, '改密码页有忘记密码入口');
    ctx.northMarketPinForgot();
    assert.match(modals.at(-1), /让先生记住新密码/);
    ctx.__inputs.north_market_reset_pin = { value: '86420' }; ctx.__inputs.north_market_reset_confirm = { value: '86420' }; ctx.__inputs.north_market_reset_tell = { checked: true };
    await ctx.northMarketPinReset();
    assert.equal(JSON.stringify(calls.at(-1)), JSON.stringify(['pin_reset', { p_new: '86420' }]), '不带旧密码');
    assert.equal(ctx.S.me.marketPinRole.pin, '86420', '他记住了新密码');
    ctx.__inputs.north_market_reset_confirm = { value: '11111' };
    const before = calls.length; await ctx.northMarketPinReset(); assert.equal(calls.length, before, '两次不一致不发请求');
    ctx.__inputs.north_market_old_pin = { value: '86420' }; ctx.__inputs.north_market_new_pin = { value: '97531' }; ctx.__inputs.north_market_confirm_pin = { value: '97531' }; ctx.__inputs.north_market_pin_tell = { checked: false };
    await ctx.northMarketPinSave();
    assert.equal(ctx.S.me.marketPinRole, undefined, '取消勾选就不让他知道');
    assert.equal(ctx.S.me.marketPinRoleOff, true);
    ctx.northMarketPinSettings(); assert.doesNotMatch(modals.at(-1), /id="north_market_pin_tell" type="checkbox" checked/, '关掉过以后默认不勾');
  });

  test(label + ' more ways of asking for the password reach him', () => {
    const { ctx } = harness();
    ctx.S.me.marketPinRole = { pin: '24680', cid: 'r1' };
    for (const ask of ['外卖密码多少', '支付密码是几来着', '提醒我一下密码', '你还记得我的密码吗', '密码告诉我']) assert.match(ctx.northMarketPinRoleNote({ id: 'r1' }, ask), /24680/, ask);
    assert.equal(ctx.northMarketPinRoleNote({ id: 'r1' }, '今天吃什么'), '');
  });
}

test('cloud pin reset changes only the caller wallet and needs no old pin', async () => {
  const fs = await import('node:fs'), {createRequire}=await import('node:module'),nodePath=await import('node:path'),os=await import('node:os'),require=createRequire(import.meta.url);
  const {PGlite}=require(nodePath.join(os.homedir(),'AppData','Local','CodexHardwareTests','robot-voice-sql-runtime','node_modules','@electric-sql','pglite','dist','index.cjs'));const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create table public.phone_friend_profiles(phone_id text,secret_hash text,display_name text,allow_search boolean);create table public.phone_licenses(id uuid,status text,phone_friend_id text,created_at timestamptz default now());create table public.phone_friend_requests(from_id text,to_id text,status text);create function public.phone_friend_hash(text) returns text language sql immutable as 'select md5($1)';create schema cron;create table cron.job(jobid bigint,jobname text,command text);create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);create function storage.foldername(text) returns text[] language sql immutable as 'select string_to_array($1,''/'')';create schema extensions;create function extensions.crypt(text,text) returns text language sql immutable as 'select md5($1)';create function extensions.gen_salt(text) returns text language sql as 'select ''fixture-salt''::text';`);
    await db.exec(fs.readFileSync('supabase/migrations/202610070001_north_market.sql','utf8'));
    if(!process.env.FIX_TEST_OLD)await db.exec(fs.readFileSync('supabase/migrations/202611030001_north_market_pin_reset.sql','utf8'));
    await db.exec(`insert into public.phone_friend_profiles values('PIN_ME',md5('me-secret'),'me',false),('PIN_OTHER',md5('other-secret'),'other',false);insert into public.phone_licenses(id,status,phone_friend_id) values('11111111-1111-4111-8111-111111111111','active','PIN_ME'),('22222222-2222-4222-8222-222222222222','active','PIN_OTHER');`);
    const call=async(name,args,phone='PIN_ME',secret='me-secret')=>(await db.query('select public.north_market_'+name+'('+[...Array(args.length+2)].map((_,i)=>'$'+(i+1)).join(',')+') as d',[phone,secret,...args])).rows[0].d;
    assert.equal((await call('pin',['00000','13579'])).ok,true);
    assert.equal((await call('pin',['00000','24680'],'PIN_OTHER','other-secret')).ok,true);
    assert.equal((await call('pin_reset',['86420'])).ok,true,'不用旧密码就能设新密码');
    assert.equal((await call('pin',['86420','86420'])).ok,true,'新密码生效');
    assert.equal((await call('pin',['24680','24680'],'PIN_OTHER','other-secret')).ok,true,'别人的密码不受影响');
    await assert.rejects(()=>call('pin_reset',['12']),/market-invalid-pin/);
    await assert.rejects(()=>call('pin_reset',['11111'],'PIN_ME','wrong-secret'));
  }finally{await db.close();}
});
