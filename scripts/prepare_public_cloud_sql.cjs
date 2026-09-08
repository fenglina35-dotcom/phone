// Construct transactional deployment/rollback checks from reviewed migrations only.
const fs=require('fs');
const common=['202609080002_phone_shortcuts.sql','202609080003_public_north_history.sql'];
const publicOnly=['202609040001_phone_role_push_attempt_diagnostics.sql','202609060001_reply_handoff_source_identity.sql'];
const check=`
do $$ declare r uuid; a jsonb; b jsonb; j jsonb; ok boolean; begin
 insert into phone_shortcut_rules(owner_id,client_id,role_id,role_name,name,mode,preset,token_hash,config_cipher)
 values('release-fixture','fixture-client','fixture-role','fixture','fixture','user_message','fixture input','release-fixture-token','encrypted-fixture') returning id into r;
 a:=phone_shortcut_accept('release-fixture-token','fixture_event_01','');
 b:=phone_shortcut_accept('release-fixture-token','fixture_event_01','');
 if a->>'jobId' is distinct from b->>'jobId' or (b->>'duplicate')::boolean is not true then raise exception 'dedup regression'; end if;
 b:=phone_shortcut_accept('release-fixture-token','fixture_event_02','');
 if b->>'error' is distinct from 'rate-limited' then raise exception 'quota regression'; end if;
 j:=phone_shortcut_claim((a->>'jobId')::uuid);
 if j->>'status' is distinct from 'running' then raise exception 'claim regression'; end if;
 b:=phone_shortcut_claim((a->>'jobId')::uuid);
 if b is not null then raise exception 'duplicate claim'; end if;
 update phone_shortcut_rules set enabled=false where id=r;
 ok:=phone_shortcut_finish((j->>'id')::uuid,(j->>'claim_token')::uuid,'fixture reply',null);
 if not ok or (select status from phone_shortcut_jobs where id=(j->>'id')::uuid)<>'canceled' then raise exception 'revocation regression'; end if;
 if has_table_privilege('anon','phone_shortcut_rules','select') or has_table_privilege('authenticated','phone_shortcut_jobs','select') then raise exception 'RLS privilege regression'; end if;
end $$;
`;
for(const kind of ['public','private']){const ddl=[...(kind==='public'?publicOnly:[]),...common].map(n=>fs.readFileSync('supabase/migrations/'+n,'utf8')).join('\n');fs.writeFileSync('.qa/'+kind+'-cloud-check.sql','begin;\n'+ddl+'\n'+check+'\nrollback;\nselect true as transaction_and_shortcut_checks_passed;');fs.writeFileSync('.qa/'+kind+'-cloud-deploy.sql','begin;\n'+ddl+'\ncommit;');}
