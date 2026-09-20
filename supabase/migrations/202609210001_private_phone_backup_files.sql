-- Large private-phone backups belong in object storage.  Keeping a 50+ MiB
-- JSON document in one Postgres jsonb row makes every daily backup parse and
-- rewrite the entire value, which can exhaust the small project's DB I/O and
-- block unrelated account/push RPCs.  The legacy row remains untouched so the
-- 2026-09-02 backup is still available as a restore fallback.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'private-phone-backups',
  'private-phone-backups',
  false,
  6291456,
  array['application/octet-stream']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "private phone backup object select" on storage.objects;
create policy "private phone backup object select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'private-phone-backups'
    and owner_id = (select auth.uid()::text)
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "private phone backup object insert" on storage.objects;
create policy "private phone backup object insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'private-phone-backups'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "private phone backup object delete" on storage.objects;
create policy "private phone backup object delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'private-phone-backups'
    and owner_id = (select auth.uid()::text)
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create table if not exists public.private_phone_backup_files (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1,
  captured_at timestamptz not null,
  uploaded_at timestamptz not null default now(),
  source_build text not null default '',
  checksum text not null,
  byte_count bigint not null check (byte_count > 0),
  storage_prefix text not null,
  part_count integer not null check (part_count between 1 and 256),
  chunk_size integer not null check (chunk_size between 1 and 6291456)
);

alter table public.private_phone_backup_files enable row level security;

revoke all on public.private_phone_backup_files from public, anon;
grant select, insert, update on public.private_phone_backup_files to authenticated;

drop policy if exists "private phone backup file owner select"
  on public.private_phone_backup_files;
create policy "private phone backup file owner select"
  on public.private_phone_backup_files
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "private phone backup file owner insert"
  on public.private_phone_backup_files;
create policy "private phone backup file owner insert"
  on public.private_phone_backup_files
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "private phone backup file owner update"
  on public.private_phone_backup_files;
create policy "private phone backup file owner update"
  on public.private_phone_backup_files
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.save_private_phone_backup_manifest(
  p_captured_at timestamptz,
  p_source_build text,
  p_checksum text,
  p_byte_count bigint,
  p_storage_prefix text,
  p_part_count integer,
  p_chunk_size integer
)
returns table(
  saved boolean,
  revision bigint,
  captured_at timestamptz,
  uploaded_at timestamptz,
  previous_storage_prefix text,
  previous_part_count integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.private_phone_backup_files%rowtype;
  v_previous_prefix text := '';
  v_previous_parts integer := 0;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_captured_at is null
     or p_checksum !~ '^[0-9a-f]{64}$'
     or p_byte_count <= 0
     or p_part_count not between 1 and 256
     or p_chunk_size not between 1 and 6291456
     or p_byte_count > p_part_count::bigint * p_chunk_size::bigint
     or (p_part_count > 1 and p_byte_count <= (p_part_count - 1)::bigint * p_chunk_size::bigint)
     or p_storage_prefix is null
     or p_storage_prefix not like v_user_id::text || '/%'
     or p_storage_prefix like '%..%'
     or right(p_storage_prefix, 1) = '/' then
    raise exception 'invalid backup manifest' using errcode = '22023';
  end if;

  select storage_prefix, part_count
    into v_previous_prefix, v_previous_parts
  from public.private_phone_backup_files
  where user_id = v_user_id;

  insert into public.private_phone_backup_files (
    user_id, revision, captured_at, uploaded_at, source_build,
    checksum, byte_count, storage_prefix, part_count, chunk_size
  ) values (
    v_user_id, 1, p_captured_at, now(), left(coalesce(p_source_build, ''), 80),
    p_checksum, p_byte_count, p_storage_prefix, p_part_count, p_chunk_size
  )
  on conflict (user_id) do update
    set revision = private_phone_backup_files.revision + 1,
        captured_at = excluded.captured_at,
        uploaded_at = now(),
        source_build = excluded.source_build,
        checksum = excluded.checksum,
        byte_count = excluded.byte_count,
        storage_prefix = excluded.storage_prefix,
        part_count = excluded.part_count,
        chunk_size = excluded.chunk_size
    where private_phone_backup_files.captured_at <= excluded.captured_at
  returning private_phone_backup_files.* into v_row;

  if found then
    return query select true, v_row.revision, v_row.captured_at,
      v_row.uploaded_at, nullif(v_previous_prefix, ''),
      nullif(v_previous_parts, 0);
  end if;

  select * into v_row
  from public.private_phone_backup_files
  where user_id = v_user_id;
  return query select false, v_row.revision, v_row.captured_at,
    v_row.uploaded_at, null::text, null::integer;
end;
$$;

revoke all on function public.save_private_phone_backup_manifest(
  timestamptz, text, text, bigint, text, integer, integer
) from public, anon;
grant execute on function public.save_private_phone_backup_manifest(
  timestamptz, text, text, bigint, text, integer, integer
) to authenticated;
