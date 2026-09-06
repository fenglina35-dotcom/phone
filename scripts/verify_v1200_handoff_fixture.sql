-- Transaction-only verification; all fixture data is rolled back.
begin;
insert into public.phone_companion_links(target,owner_secret_hash) values ('handoff-fixture-v1200',public.phone_companion_hash('fixture-only-not-a-credential'));
insert into public.phone_role_background_tasks(id,target,role_id,kind,payload,due_at,status) values
('00001200-0000-4000-8000-000000000001','handoff-fixture-v1200','role','reply_handoff','{"messageId":"old-user","accountId":"main"}',now(),'claimed'),
('00001200-0000-4000-8000-000000000002','handoff-fixture-v1200','role','reply_handoff','{"messageId":"new-user","accountId":"main"}',now(),'pending'),
('00001200-0000-4000-8000-000000000003','handoff-fixture-v1200','role','device_handoff','{"messageId":"old-user"}',now(),'pending');
insert into public.phone_role_push_outbox(target,role_id,role_name,body,trigger_kind,dedupe_key) values
('handoff-fixture-v1200','role','fixture','fixture handoff','reply_handoff','task:00001200-0000-4000-8000-000000000001'),
('handoff-fixture-v1200','role','fixture','fixture proactive','scheduled','handoff-fixture-scheduled-v1200');
do $$ declare rows jsonb; begin
rows=public.phone_role_push_pull('handoff-fixture-v1200','fixture-only-not-a-credential',20);
if jsonb_array_length(rows)<>2 then raise exception 'pull row count changed'; end if;
if not exists(select 1 from jsonb_array_elements(rows) r where r->>'triggerKind'='reply_handoff' and r->>'replyToMessageId'='old-user' and r->>'replyToAccountId'='main') then raise exception 'source identity missing'; end if;
if exists(select 1 from jsonb_array_elements(rows) r where r->>'triggerKind'='scheduled' and r->>'replyToMessageId' is not null) then raise exception 'scheduled message misassociated'; end if;
if public.phone_role_background_complete_turn('handoff-fixture-v1200','wrong-owner','role','old-user') then raise exception 'bad owner accepted'; end if;
perform public.phone_role_background_complete_turn('handoff-fixture-v1200','fixture-only-not-a-credential','role','old-user');
if (select count(*) from public.phone_role_background_tasks where target='handoff-fixture-v1200' and status='canceled')<>1 then raise exception 'incorrect cancellation scope'; end if;
if not exists(select 1 from public.phone_role_background_tasks where id='00001200-0000-4000-8000-000000000002' and status='pending') then raise exception 'new turn canceled'; end if;
if not exists(select 1 from public.phone_role_background_tasks where id='00001200-0000-4000-8000-000000000003' and status='pending') then raise exception 'device task canceled'; end if;
end $$;
select true as metadata_identity_and_cancel_scope_passed;

rollback;
