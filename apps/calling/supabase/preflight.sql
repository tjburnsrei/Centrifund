-- Read-only: run in the intended dedicated project before either migration.
-- Every row below is a collision: stop and review; never overwrite or drop it.
select 'schema' as kind, nspname as name from pg_namespace where nspname='centrifund_crm'
union all
select 'function', p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and starts_with(p.proname,'centrifund_crm_')
union all
select 'bucket', id from storage.buckets where id='centrifund-call-audio'
union all
select 'storage policy', policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname='centrifund_audio_server_only';
-- Also confirm the selected project's organization/plan and current backup in the dashboard.
-- These migrations never change project-wide Auth, signup, SMTP, API-schema or existing table settings.
