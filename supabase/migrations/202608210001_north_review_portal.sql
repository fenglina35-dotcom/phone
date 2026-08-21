-- App Review access for the public North companion app.
--
-- The permanent reviewer login is a normal Supabase Auth user.  The mapping
-- below binds that user to one pre-created test role/target.  No owner secret,
-- device secret, password, service-role key, or permanent pairing code is
-- exposed to the browser.  Every pairing code remains single-use and expires
-- after ten minutes, exactly like the normal product flow.

create table if not exists public.phone_companion_review_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target text not null unique references public.phone_companion_links(target) on delete cascade,
  role_name text not null default 'North Review Role',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phone_companion_review_role_name_length
    check (char_length(trim(role_name)) between 1 and 80)
);

alter table public.phone_companion_review_accounts enable row level security;
revoke all on table public.phone_companion_review_accounts from anon, authenticated;

create or replace function public.phone_companion_review_session()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_account public.phone_companion_review_accounts%rowtype;
  v_link public.phone_companion_links%rowtype;
begin
  if v_user is null then
    raise exception 'review-login-required';
  end if;

  select * into v_account
  from public.phone_companion_review_accounts
  where user_id = v_user and enabled = true;

  if not found then
    raise exception 'review-account-not-configured';
  end if;

  perform public.phone_companion_expire_commands(v_account.target);

  select * into v_link
  from public.phone_companion_links
  where target = v_account.target;

  if not found then
    raise exception 'review-target-not-configured';
  end if;

  return jsonb_build_object(
    'roleName', v_account.role_name,
    'target', v_account.target,
    'linked', v_link.device_secret_hash is not null,
    'deviceName', coalesce(v_link.device_name, ''),
    'pairedAt', v_link.paired_at,
    'lastSyncAt', v_link.last_sync_at,
    'snapshot', jsonb_build_object(
      'generatedAt', v_link.snapshot->'generatedAt',
      'snapshotSequence', v_link.snapshot->'snapshotSequence',
      'screenTime', coalesce(v_link.snapshot->'screenTime', '{}'::jsonb)
    ),
    'commands', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'action', c.command->>'action',
        'externalAppId', c.command->>'externalAppId',
        'externalAppName', c.command->>'externalAppName',
        'minutes', c.command->'minutes',
        'actor', c.command->>'actor',
        'status', c.status,
        'result', c.result,
        'createdAt', c.created_at,
        'acknowledgedAt', c.acknowledged_at
      ) order by c.created_at desc)
      from (
        select *
        from public.phone_companion_commands
        where target = v_account.target
        order by created_at desc
        limit 20
      ) c
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.phone_companion_review_begin_pairing()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_account public.phone_companion_review_accounts%rowtype;
  v_code text := lpad(floor(random() * 100000000)::bigint::text, 8, '0');
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if v_user is null then
    raise exception 'review-login-required';
  end if;

  select * into v_account
  from public.phone_companion_review_accounts
  where user_id = v_user and enabled = true;

  if not found then
    raise exception 'review-account-not-configured';
  end if;

  update public.phone_companion_links
  set pair_code_hash = public.phone_companion_hash(v_account.target || ':' || v_code),
      pair_expires_at = v_expires,
      updated_at = now()
  where target = v_account.target;

  if not found then
    raise exception 'review-target-not-configured';
  end if;

  return jsonb_build_object(
    'roleName', v_account.role_name,
    'target', v_account.target,
    'pairCode', v_code,
    'expiresAt', v_expires
  );
end;
$$;

create or replace function public.phone_companion_review_enqueue_command(
  p_action text,
  p_external_app_id text default '',
  p_minutes integer default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_account public.phone_companion_review_accounts%rowtype;
  v_link public.phone_companion_links%rowtype;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_external_id text := trim(coalesce(p_external_app_id, ''));
  v_minutes integer := coalesce(p_minutes, 0);
  v_app jsonb;
  v_app_name text := '';
  v_id uuid;
  v_command jsonb;
begin
  if v_user is null then
    raise exception 'review-login-required';
  end if;
  if v_action not in ('view', 'lock', 'unlock', 'limit') then
    raise exception 'review-command-not-allowed';
  end if;

  select * into v_account
  from public.phone_companion_review_accounts
  where user_id = v_user and enabled = true;
  if not found then
    raise exception 'review-account-not-configured';
  end if;

  select * into v_link
  from public.phone_companion_links
  where target = v_account.target;
  if not found or v_link.device_secret_hash is null then
    raise exception 'review-device-not-paired';
  end if;

  if v_action in ('lock', 'unlock', 'limit') then
    if v_external_id = '' then
      raise exception 'review-app-required';
    end if;

    select row_value into v_app
    from jsonb_array_elements(
      coalesce(v_link.snapshot #> '{screenTime,apps}', '[]'::jsonb)
    ) as app_rows(row_value)
    where trim(coalesce(row_value->>'id', '')) = v_external_id
    limit 1;

    if v_app is null then
      raise exception 'review-app-not-in-latest-device-snapshot';
    end if;
    v_app_name := left(coalesce(nullif(trim(v_app->>'name'), ''), 'External App'), 120);
  else
    v_external_id := '';
  end if;

  if v_action = 'limit' and (v_minutes < 1 or v_minutes > 1440) then
    raise exception 'review-limit-out-of-range';
  end if;

  v_command := jsonb_build_object(
    'schema', 1,
    'action', v_action,
    'externalAppId', v_external_id,
    'externalAppName', v_app_name,
    'internalAppId', '',
    'minutes', case when v_action = 'limit' then v_minutes else 0 end,
    'scope', 'external',
    'actor', v_account.role_name,
    'createdAt', now()
  );

  update public.phone_companion_commands
  set status = 'failed',
      result = jsonb_build_object(
        'code', 'superseded',
        'message', 'superseded by a newer review command'
      ),
      acknowledged_at = now()
  where target = v_account.target
    and status = 'pending'
    and (
      (
        v_action in ('lock', 'unlock')
        and lower(trim(coalesce(command->>'action', ''))) in ('lock', 'unlock')
        and trim(coalesce(command->>'externalAppId', '')) = v_external_id
      )
      or (
        v_action not in ('lock', 'unlock')
        and lower(trim(coalesce(command->>'action', ''))) = v_action
        and trim(coalesce(command->>'externalAppId', '')) = v_external_id
      )
    );

  insert into public.phone_companion_commands(target, command)
  values (v_account.target, v_command)
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'queued', true,
    'message', 'Command queued. Keep North open for foreground review polling.'
  );
end;
$$;

-- Hosted Supabase projects may explicitly grant EXECUTE to `anon` through
-- default privileges. Revoking only from PUBLIC is therefore insufficient.
revoke all on function public.phone_companion_review_session() from public, anon;
revoke all on function public.phone_companion_review_begin_pairing() from public, anon;
revoke all on function public.phone_companion_review_enqueue_command(text, text, integer) from public, anon;

grant execute on function public.phone_companion_review_session() to authenticated;
grant execute on function public.phone_companion_review_begin_pairing() to authenticated;
grant execute on function public.phone_companion_review_enqueue_command(text, text, integer) to authenticated;
