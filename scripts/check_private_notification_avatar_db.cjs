// Isolated PostgreSQL regression; never reads live accounts or changes a remote DB.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const {PGlite}=require(process.env.PHONE_AVATAR_PGLITE_PATH||path.join(root,'.qa/avatar-db/node_modules/@electric-sql/pglite'));
(async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create schema extensions; create role anon; create role authenticated;
 create function public.phone_companion_owner_ok(text,text) returns boolean language sql as $$select $1='target-a' and $2='fixture-secret'$$;
 create table public.phone_role_push_profiles(target text,role_id text,role_name text,relation text,persona text,user_name text,avatar_data text not null default '',recent_context text,memory_context text,last_user_at timestamptz,enabled boolean,timezone text,start_hour int,end_hour int,daily_limit int,idle_minutes int,message_min int,message_max int,quiet_until_at timestamptz,next_due_at timestamptz,time_aware boolean,app_watch_enabled boolean,app_watch_daily_limit int,automation_config jsonb,updated_at timestamptz,claimed_until timestamptz,primary key(target,role_id));`);
 const source=fs.readFileSync(path.join(root,'supabase/migrations/202608120002_background_role_tasks.sql'),'utf8');
 await db.exec(source.slice(source.indexOf('create or replace function public.phone_role_push_upsert_profile(')));
 const migration=fs.readFileSync(path.join(root,'native/private-small-phone/migrations/202609090001_notification_avatar_preserve.sql'),'utf8');
 const photo='data:image/jpeg;base64,UEhPVE8=',emoji='data:image/jpeg;base64,RU1PSkk=';
 const sync=async(profile,secret='fixture-secret')=>(await db.query('select phone_role_push_upsert_profile($1,$2,$3::jsonb) as ok',['target-a',secret,JSON.stringify({roleId:'role-a',enabled:true,automationConfig:{notificationAvatarPreserve:true},...profile})])).rows[0].ok;
 const row=async(id='role-a')=>(await db.query('select * from phone_role_push_profiles where target=$1 and role_id=$2',['target-a',id])).rows[0];
 await sync({avatarData:photo});await sync({avatarData:''});assert.equal((await row()).avatar_data,'','old SQL reproduces destructive empty overwrite');
 await db.exec(migration);await db.exec(migration); // repeat migration remains safe
 await sync({avatarData:photo});const due=(await row()).next_due_at;
 await sync({avatarData:'',roleName:'新昵称',memoryContext:'new memory'});
 let saved=await row();assert.equal(saved.avatar_data,photo);assert.equal(saved.role_name,'新昵称');assert.equal(saved.memory_context,'new memory');assert.equal(+saved.next_due_at,+due);
 await sync({avatarData:'',enabled:false});saved=await row();assert.equal(saved.avatar_data,photo);assert.equal(saved.enabled,false);assert.equal(saved.next_due_at,null);
 await sync({avatarData:emoji});assert.equal((await row()).avatar_data,emoji,'explicit replacement still works');
 await sync({avatarData:'invalid-image'});assert.equal((await row()).avatar_data,emoji,'RPC invalid-image sanitization preserves good photo');
 assert.equal(await sync({avatarData:photo},'wrong-secret'),false);assert.equal((await row()).avatar_data,emoji);
 await sync({roleId:'role-b',avatarData:''});assert.equal((await row('role-b')).avatar_data,'','never borrow another role avatar');
 await sync({avatarData:'',automationConfig:{}});assert.equal((await row()).avatar_data,'','unmarked older/public client behavior unchanged');
 console.log('PASS: old overwrite reproduced; real PostgreSQL RPC + trigger, retry migration, same-row preservation, explicit replacement, auth, role isolation, memory and scheduler unchanged');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
