-- Independent automation storage. Never widen the private companion RPC permissions.
create table public.phone_shortcut_rules (
 id uuid primary key default gen_random_uuid(),
 owner_id text not null,
 client_id text not null,
 role_id text not null,
 role_name text not null,
 name text not null check(length(name) between 1 and 80),
 mode text not null check(mode in ('user_message','role_event')),
 preset text not null check(length(preset) between 1 and 2000),
 allow_event_text boolean not null default false,
 token_hash text not null unique,
 config_cipher text not null,
 enabled boolean not null default true,
 revision integer not null default 1,
 cooldown_seconds integer not null default 300 check(cooldown_seconds between 60 and 86400),
 daily_limit integer not null default 24 check(daily_limit between 1 and 100),
 daily_day date,
 daily_count integer not null default 0,
 last_trigger_at timestamptz,
 synced_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create index phone_shortcut_owner_idx on public.phone_shortcut_rules(owner_id,client_id);
create table public.phone_shortcut_jobs (
 id uuid primary key default gen_random_uuid(),
 rule_id uuid not null references public.phone_shortcut_rules(id) on delete cascade,
 owner_id text not null,
 client_id text not null,
 role_id text not null,
 role_name text not null,
 revision integer not null,
 event_id text not null check(length(event_id) between 8 and 100),
 mode text not null check(mode in ('user_message','role_event')),
 input_text text not null,
 config_cipher text not null,
 status text not null default 'pending' check(status in ('pending','running','completed','failed','canceled')),
 claim_token uuid,
 received_at timestamptz not null default now(),
 started_at timestamptz,
 completed_at timestamptz,
 reply_text text,
 error_code text,
 consumed_at timestamptz,
 unique(rule_id,event_id)
);
create index phone_shortcut_jobs_due_idx on public.phone_shortcut_jobs(received_at) where status='pending';
create index phone_shortcut_jobs_owner_idx on public.phone_shortcut_jobs(owner_id,client_id,received_at);
alter table public.phone_shortcut_rules enable row level security;
alter table public.phone_shortcut_jobs enable row level security;
revoke all on public.phone_shortcut_rules, public.phone_shortcut_jobs from public,anon,authenticated;
grant all on public.phone_shortcut_rules, public.phone_shortcut_jobs to service_role;

create function public.phone_shortcut_accept(p_token_hash text,p_event_id text,p_event_text text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare r public.phone_shortcut_rules; j public.phone_shortcut_jobs; day_now date;
begin
 select * into r from public.phone_shortcut_rules where token_hash=p_token_hash and enabled for update;
 if not found then return jsonb_build_object('error','unauthorized'); end if;
 select * into j from public.phone_shortcut_jobs where rule_id=r.id and event_id=p_event_id;
 if found then return jsonb_build_object('ok',true,'duplicate',true,'jobId',j.id,'status',j.status); end if;
 if p_event_id !~ '^[A-Za-z0-9_-]{8,100}$' or length(coalesce(p_event_text,''))>2000 then return jsonb_build_object('error','invalid-event'); end if;
 day_now:=(now() at time zone 'Asia/Shanghai')::date;
 if r.last_trigger_at>now()-make_interval(secs=>r.cooldown_seconds) or r.daily_day=day_now and r.daily_count>=r.daily_limit then return jsonb_build_object('error','rate-limited'); end if;
 insert into public.phone_shortcut_jobs(rule_id,owner_id,client_id,role_id,role_name,revision,event_id,mode,input_text,config_cipher)
 values(r.id,r.owner_id,r.client_id,r.role_id,r.role_name,r.revision,p_event_id,r.mode,r.preset||case when r.allow_event_text and length(trim(coalesce(p_event_text,'')))>0 then E'\n'||p_event_text else '' end,r.config_cipher) returning * into j;
 update public.phone_shortcut_rules set last_trigger_at=now(),daily_day=day_now,daily_count=case when daily_day=day_now then daily_count+1 else 1 end where id=r.id;
 return jsonb_build_object('ok',true,'duplicate',false,'jobId',j.id,'status','pending');
end $$;

create function public.phone_shortcut_claim(p_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare j public.phone_shortcut_jobs;
begin
 -- Unknown model outcomes are NOT automatically regenerated, avoiding duplicate spend/replies.
 update public.phone_shortcut_jobs set status='failed',error_code='worker-timeout',completed_at=now(),config_cipher=''
 where status='running' and started_at<now()-interval '3 minutes';
 update public.phone_shortcut_jobs pending_job set status='canceled',completed_at=now(),config_cipher=''
 where pending_job.status='pending' and not exists(select 1 from public.phone_shortcut_rules enabled_rule where enabled_rule.id=pending_job.rule_id and enabled_rule.enabled and enabled_rule.revision=pending_job.revision);
 select * into j from public.phone_shortcut_jobs where status='pending' and (p_id is null or id=p_id) order by received_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.phone_shortcut_jobs set status='running',started_at=now(),claim_token=gen_random_uuid() where id=j.id returning * into j;
 return to_jsonb(j);
end $$;

create function public.phone_shortcut_finish(p_id uuid,p_claim uuid,p_reply text,p_error text default null)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare j public.phone_shortcut_jobs; r public.phone_shortcut_rules;
begin
 select * into j from public.phone_shortcut_jobs where id=p_id and status='running' and claim_token=p_claim;
 if not found then return false; end if;
 select * into r from public.phone_shortcut_rules where id=j.rule_id for update;
 update public.phone_shortcut_jobs set
 status=case when not r.enabled or r.revision<>j.revision then 'canceled' when p_error is not null or length(trim(coalesce(p_reply,'')))=0 then 'failed' else 'completed' end,
 reply_text=case when r.enabled and r.revision=j.revision and p_error is null then left(p_reply,30000) else null end,
 error_code=p_error,completed_at=clock_timestamp(),config_cipher=''
 where id=p_id and status='running' and claim_token=p_claim;
 return found;
end $$;
revoke all on function public.phone_shortcut_accept(text,text,text), public.phone_shortcut_claim(uuid), public.phone_shortcut_finish(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.phone_shortcut_accept(text,text,text), public.phone_shortcut_claim(uuid), public.phone_shortcut_finish(uuid,uuid,text,text) to service_role;

-- A separate pg_cron job must invoke the new worker with its own dispatch secret.
-- Do not alter the existing role-push schedule; deployment steps are in the runbook.
