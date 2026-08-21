drop index if exists public.phone_role_background_tasks_external_key_idx;

create unique index phone_role_background_tasks_external_key_idx
  on public.phone_role_background_tasks(external_key);
