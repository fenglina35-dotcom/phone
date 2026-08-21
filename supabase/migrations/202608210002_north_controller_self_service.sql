create or replace function public.phone_companion_delete_controller(
  p_target text,
  p_owner_secret text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_target text := trim(coalesce(p_target, ''));
  v_deleted integer := 0;
begin
  if not public.phone_companion_owner_ok(v_target, p_owner_secret) then
    return false;
  end if;

  delete from public.phone_companion_links
  where target = v_target
    and owner_secret_hash = public.phone_companion_hash(p_owner_secret);
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;

-- The operation is available to a controller only after it proves knowledge
-- of the random owner secret. The database stores only its SHA-256 hash.
revoke all on function public.phone_companion_delete_controller(text, text)
  from public, anon;
grant execute on function public.phone_companion_delete_controller(text, text)
  to anon, authenticated;
