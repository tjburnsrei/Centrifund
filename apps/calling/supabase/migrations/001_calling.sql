-- Dedicated CRM project only. No changes to Zendra or the calculator database.
create schema if not exists crm;
revoke all on schema crm from public, anon, authenticated;
create table crm.workspaces (id text primary key, name text not null);
insert into crm.workspaces values ('zendra','Zendra'),('centrifund','Centrifund'),('shared','Shared calling');
create table crm.contacts (
 id uuid primary key default gen_random_uuid(), source text, source_id text,
 owner_workspace text not null references crm.workspaces, name text not null,
 company text not null default '', city text not null default '', county text not null default '',
 email text not null default '', background jsonb not null default '{}', revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(source,source_id)
);
create table crm.contact_access (
 contact_id uuid references crm.contacts on delete cascade, workspace_id text references crm.workspaces,
 primary key(contact_id,workspace_id)
);
create table crm.phones (
 id uuid primary key default gen_random_uuid(), contact_id uuid not null references crm.contacts,
 value text not null, normalized text not null, is_bad boolean not null default false,
 unique(contact_id,normalized)
);
create table crm.private_notes (
 contact_id uuid references crm.contacts, workspace_id text references crm.workspaces,
 body text not null default '', primary key(contact_id,workspace_id),
 check (workspace_id in ('zendra','centrifund'))
);
create table crm.contact_state (
 contact_id uuid references crm.contacts, workspace_id text references crm.workspaces,
 do_not_call boolean not null default false, outcome text, last_called_at timestamptz,
 next_action text, follow_up_date date, primary key(contact_id,workspace_id)
);
create table crm.sessions (
 token_hash text primary key, owner_id text not null, role text not null check(role in ('admin','caller')),
 password_version text, expires_at timestamptz not null, revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create table crm.rate_limits (bucket text primary key, window_start timestamptz not null, attempts integer not null);
create table crm.drafts (
 id uuid primary key, contact_id uuid not null references crm.contacts, owner_id text not null,
 revision integer not null default 1, raw_text text not null default '', transcript text not null default '',
 last_mutation_id uuid, fields jsonb not null default '{"summary":"","outcome":"","nextAction":"","followUpDate":""}',
 status text not null default 'editing' check(status in ('editing','processing','ready','failed','saved','discarded')),
 phone_id uuid references crm.phones, audio_path text, audio_delete_pending boolean not null default false,
 lease_token uuid, lease_until timestamptz, error_code text, saved_activity_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table crm.activities (
 id uuid primary key default gen_random_uuid(), contact_id uuid not null references crm.contacts,
 workspace_id text not null references crm.workspaces, draft_id uuid not null unique references crm.drafts,
 author text not null, summary text not null, outcome text not null, phone_id uuid references crm.phones,
 next_action text not null default '', follow_up_date date, created_at timestamptz not null default now()
);
create table crm.imports (
 id uuid primary key default gen_random_uuid(), source_hash text not null,
 rows jsonb not null, preview jsonb not null, status text not null default 'preview',
 result jsonb, created_at timestamptz not null default now()
);
create unique index on crm.imports(source_hash) where status='committed';
create index on crm.drafts(owner_id,updated_at);
create index on crm.activities(contact_id,created_at desc);
create index on crm.contact_access(workspace_id,contact_id);
create index on crm.contact_state(workspace_id,follow_up_date);
create index on crm.phones(normalized);
create index on crm.contacts(lower(email));
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='crm' loop
  execute format('alter table crm.%I enable row level security',t.tablename);
  execute format('revoke all on crm.%I from public, anon, authenticated',t.tablename);
 end loop;
end $$;

create function public.crm_rate_limit(p_bucket text,p_max integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path=crm,pg_temp as $$
declare n integer;
begin
 insert into crm.rate_limits(bucket,window_start,attempts) values(p_bucket,now(),1)
 on conflict(bucket) do update set
 attempts=case when crm.rate_limits.window_start < now()-make_interval(secs=>p_seconds) then 1 else crm.rate_limits.attempts+1 end,
 window_start=case when crm.rate_limits.window_start < now()-make_interval(secs=>p_seconds) then now() else crm.rate_limits.window_start end
 returning attempts into n;
 return n<=p_max;
end $$;
create function public.crm_create_session(p_token_hash text,p_owner_id text,p_role text,p_password_version text)
returns void language sql security definer set search_path=crm,pg_temp as $$
 insert into crm.sessions(token_hash,owner_id,role,password_version,expires_at)
 values(p_token_hash,p_owner_id,p_role,p_password_version,now()+interval '30 days');
$$;
create function crm.normalize_phone(value text) returns text
language sql immutable set search_path=crm,pg_temp as $$
 select case when length(n)=10 then '1'||n else n end from (select regexp_replace(value,'[^0-9]','','g') n) digits;
$$;
create function crm.contact_json(p_id uuid,p_admin boolean) returns jsonb
language sql stable set search_path=crm,pg_temp as $$
 select jsonb_build_object(
 'id',c.id,'name',c.name,'company',c.company,'city',c.city,'county',c.county,'email',c.email,
 'background',c.background,'revision',c.revision,
 'phones',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'value',p.value,'is_bad',p.is_bad) order by p.value) from crm.phones p where p.contact_id=c.id),'[]'),
 'do_not_call',coalesce(s.do_not_call,false),'outcome',s.outcome,'last_called_at',s.last_called_at,
 'next_action',s.next_action,'follow_up_date',s.follow_up_date
 ) || case when p_admin then jsonb_build_object(
 'shared',exists(select 1 from crm.contact_access a where a.contact_id=c.id and a.workspace_id='shared'),
 'private_notes',coalesce((select jsonb_agg(jsonb_build_object('workspace_id',n.workspace_id,'body',n.body)) from crm.private_notes n where n.contact_id=c.id),'[]')) else '{}'::jsonb end
 from crm.contacts c left join crm.contact_state s on s.contact_id=c.id and s.workspace_id='shared' where c.id=p_id;
$$;

create function public.crm_request(p_session_hash text,p_password_version text,p_action text,p_args jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=crm,pg_temp as $$
declare
 actor crm.sessions; contact crm.contacts; draft crm.drafts; imp crm.imports;
 cid uuid; did uuid; pid uuid; activity_id uuid; v_result jsonb; fields jsonb; item jsonb;
 cid2 uuid; v_normalized text; phone text; checks jsonb:='[]'; rows_data jsonb; reason text;
 inserted integer:=0; updated integer:=0; skipped integer:=0; follow_date date;
 is_admin boolean; pvr jsonb; note text; v_outcome text;
begin
 select * into actor from crm.sessions where token_hash=p_session_hash and revoked_at is null and expires_at>now();
 if actor.token_hash is null or (actor.role='caller' and actor.password_version is distinct from p_password_version) then
  raise exception 'UNAUTHORIZED' using errcode='P0001';
 end if;
 is_admin:=actor.role='admin';
 if p_action='session.me' then return jsonb_build_object('role',actor.role,'expiresAt',actor.expires_at); end if;
 if p_action='session.logout' then update crm.sessions set revoked_at=now() where token_hash=p_session_hash; return '{"ok":true}'; end if;
 if p_action='session.revoke' then
  if not is_admin then raise exception 'FORBIDDEN'; end if;
  update crm.sessions set revoked_at=now() where role='caller'; return '{"ok":true}';
 end if;
 if p_action='contacts.list' then
  select coalesce(jsonb_agg(cj order by priority,due,name),'[]') into v_result from (
   select crm.contact_json(c.id,is_admin) cj,c.name,
   case when s.follow_up_date<=timezone('America/New_York',now())::date then 0 when s.last_called_at is null or s.outcome='bad_number' then 1 else 2 end priority,
   s.follow_up_date due
   from crm.contacts c left join crm.contact_state s on s.contact_id=c.id and s.workspace_id='shared'
   where (is_admin or exists(select 1 from crm.contact_access a where a.contact_id=c.id and a.workspace_id='shared'))
   and (coalesce(p_args->>'q','')='' or c.name ilike '%'||(p_args->>'q')||'%' or c.company ilike '%'||(p_args->>'q')||'%' or c.email ilike '%'||(p_args->>'q')||'%')
   and (coalesce(p_args->>'view','queue')='all' or (
     not coalesce(s.do_not_call,false) and exists(select 1 from crm.phones p where p.contact_id=c.id and not p.is_bad)
     and (s.last_called_at is null or s.outcome='bad_number' or s.follow_up_date<=timezone('America/New_York',now())::date)
   ))
   order by priority,due,c.name limit 2000
  ) selected;
  return v_result;
 end if;
 if p_action like 'import.%' then
  if not is_admin then raise exception 'FORBIDDEN'; end if;
  if p_action='import.preview' then
   select * into imp from crm.imports where source_hash=p_args->>'sourceHash' and status='committed';
   if imp.id is not null then return jsonb_build_object('id',imp.id,'preview',imp.preview,'status',imp.status,'result',imp.result,'sourceHash',imp.source_hash); end if;
   rows_data:=p_args->'rows';
   for item in select value from jsonb_array_elements(rows_data) loop
    select * into contact from crm.contacts where source='call-list' and source_id=item->>'source_id';
    reason:=null;
    if contact.id is not null and lower(trim(contact.name))<>lower(trim(item->>'name')) then
     reason:='Source ID now refers to a different name; review before importing.';
    elsif contact.id is null then
     if exists(select 1 from crm.contacts c where (item->>'email'<>'' and lower(c.email)=lower(item->>'email')) or lower(trim(c.name))=lower(trim(item->>'name')) or exists(select 1 from crm.phones p where p.contact_id=c.id and p.normalized in (select crm.normalize_phone(value) from jsonb_array_elements_text(item->'phones')))) then
      reason:='Possible existing contact. Review the identity; automatic merging is disabled.';
     end if;
     if exists(select 1 from jsonb_array_elements(rows_data) other where other->>'source_id'<>item->>'source_id' and
       (lower(other->>'name')=lower(item->>'name') or (item->>'email'<>'' and lower(other->>'email')=lower(item->>'email')) or exists(select 1 from jsonb_array_elements_text(other->'phones') p where crm.normalize_phone(p.value) in (select crm.normalize_phone(value) from jsonb_array_elements_text(item->'phones'))))) then
      reason:='Name, email, or phone is shared by another import row. Review both records.';
     end if;
    end if;
    checks:=checks||jsonb_build_array(jsonb_build_object('sourceId',item->>'source_id','name',item->>'name','action',
      case when reason is not null then 'review' when contact.id is null then 'insert' else 'update' end,
      'reason',reason,'data',item,'contactId',contact.id,'revision',contact.revision));
   end loop;
   insert into crm.imports(source_hash,rows,preview) values(p_args->>'sourceHash',rows_data,checks) returning * into imp;
   return jsonb_build_object('id',imp.id,'preview',checks,'status','preview','sourceHash',p_args->>'sourceHash');
  elsif p_action='import.confirm' then
   select * into imp from crm.imports where id=(p_args->>'id')::uuid for update;
   if imp.id is null then raise exception 'NOT_FOUND'; end if;
   if imp.status='committed' then return imp.result; end if;
   perform pg_advisory_xact_lock(17611582);
   select result into v_result from crm.imports where source_hash=imp.source_hash and status='committed';
   if found then return v_result; end if;
   for item in select value from jsonb_array_elements(imp.rows) loop
    select value into pvr from jsonb_array_elements(imp.preview) where value->>'sourceId'=item->>'source_id';
    if pvr->>'action'='review' then skipped:=skipped+1; continue; end if;
    select * into contact from crm.contacts where source='call-list' and source_id=item->>'source_id' for update;
    if (contact.id is null) is distinct from (pvr->>'contactId' is null) or contact.revision is distinct from (pvr->>'revision')::integer then
      raise exception 'IMPORT_CHANGED: Create a fresh reviewed import after contact changes.';
    end if;
    if contact.id is null then
     if exists(select 1 from crm.contacts c where lower(trim(c.name))=lower(trim(item->>'name')) or (item->>'email'<>'' and lower(c.email)=lower(item->>'email')) or exists(select 1 from crm.phones p where p.contact_id=c.id and p.normalized in (select crm.normalize_phone(value) from jsonb_array_elements_text(item->'phones')))) then raise exception 'IMPORT_CHANGED'; end if;
     insert into crm.contacts(source,source_id,owner_workspace,name,company,city,county,email,background)
     values('call-list',item->>'source_id','zendra',item->>'name',item->>'company',item->>'city',item->>'county',item->>'email',item->'background') returning id into cid2;
     insert into crm.contact_access values(cid2,'zendra'),(cid2,'shared');
     inserted:=inserted+1;
    else
     cid2:=contact.id;
     update crm.contacts set name=item->>'name',company=item->>'company',city=item->>'city',county=item->>'county',email=item->>'email',background=item->'background',revision=revision+1,updated_at=now() where id=cid2;
     updated:=updated+1;
    end if;
    for phone in select jsonb_array_elements_text(item->'phones') loop
     v_normalized:=regexp_replace(phone,'[^0-9]','','g');
     if length(v_normalized)=10 then v_normalized:='1'||v_normalized; end if;
     if length(v_normalized)>=7 then insert into crm.phones(contact_id,value,normalized) values(cid2,phone,v_normalized) on conflict(contact_id,normalized) do nothing; end if;
    end loop;
   end loop;
   v_result:=jsonb_build_object('inserted',inserted,'updated',updated,'skipped',skipped,'total',jsonb_array_length(imp.rows));
   update crm.imports set status='committed',result=v_result where id=imp.id;
   return v_result;
  end if;
 end if;
 if p_action='admin.health' then
  if not is_admin then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object('failedDrafts',(select count(*) from crm.drafts where status='failed'),
   'stalledDrafts',(select count(*) from crm.drafts where status='processing' and lease_until<now()),
   'contacts',(select count(*) from crm.contacts),'sharedContacts',(select count(*) from crm.contact_access where workspace_id='shared'));
 end if;
 if p_action like 'draft.%' and p_action<>'draft.ensure' then
  did:=(p_args->>'id')::uuid;
  select * into draft from crm.drafts where id=did and owner_id=actor.owner_id for update;
  if draft.id is null then raise exception 'NOT_FOUND'; end if;
  cid:=draft.contact_id;
 else cid:=(p_args->>'contactId')::uuid;
 end if;
 select * into contact from crm.contacts where id=cid;
 if contact.id is null then raise exception 'NOT_FOUND'; end if;
 if not is_admin then
  perform 1 from crm.contact_access where contact_id=cid and workspace_id='shared' for key share;
  if not found then raise exception 'NOT_FOUND'; end if;
 end if;
 if p_action='contact.get' then
  return crm.contact_json(cid,is_admin)||jsonb_build_object('history',coalesce((
   select jsonb_agg(to_jsonb(a) order by a.created_at desc) from
    (select id,created_at,author,summary,outcome,next_action,follow_up_date from crm.activities
     where contact_id=cid and workspace_id='shared' order by created_at desc limit 100) a),'[]'));
 elsif p_action='contact.edit' then
  if not is_admin then raise exception 'FORBIDDEN'; end if;
  update crm.contacts set name=p_args->>'name',company=p_args->>'company',city=p_args->>'city',county=p_args->>'county',email=p_args->>'email',revision=revision+1,updated_at=now()
    where id=cid and revision=(p_args->>'revision')::integer returning id into cid2;
  if cid2 is null then raise exception 'STALE'; end if;
  return crm.contact_json(cid,true);
 elsif p_action='contact.addPhone' then
  if not is_admin then raise exception 'FORBIDDEN'; end if;
  v_normalized:=regexp_replace(p_args->>'value','[^0-9]','','g');
  if length(v_normalized)=10 then v_normalized:='1'||v_normalized; end if;
  insert into crm.phones(contact_id,value,normalized) values(cid,p_args->>'value',v_normalized) on conflict(contact_id,normalized) do nothing;
  return crm.contact_json(cid,true);
 elsif p_action='contact.phoneFlag' then
  if not is_admin then raise exception 'FORBIDDEN'; end if;
  update crm.phones set is_bad=(p_args->>'isBad')::boolean where contact_id=cid and id=(p_args->>'phoneId')::uuid;
  if not found then raise exception 'INVALID_PHONE'; end if;
  return crm.contact_json(cid,true);
 elsif p_action='contact.share' then
  if not is_admin then raise exception 'FORBIDDEN'; end if;
  if (p_args->>'shared')::boolean then insert into crm.contact_access values(cid,'shared') on conflict do nothing;
  else delete from crm.contact_access where contact_id=cid and workspace_id='shared'; end if;
  return crm.contact_json(cid,true);
 elsif p_action='contact.privateNote' then
  if not is_admin then raise exception 'FORBIDDEN'; end if;
  insert into crm.private_notes(contact_id,workspace_id,body) values(cid,p_args->>'workspaceId',p_args->>'body')
   on conflict(contact_id,workspace_id) do update set body=excluded.body;
  return '{"ok":true}';
 elsif p_action='draft.ensure' then
  did:=(p_args->>'id')::uuid;
  insert into crm.drafts(id,contact_id,owner_id) values(did,cid,actor.owner_id) on conflict(id) do nothing;
  select * into draft from crm.drafts where id=did and contact_id=cid and owner_id=actor.owner_id;
  if draft.id is null then raise exception 'NOT_FOUND'; end if;
  return to_jsonb(draft)-'owner_id'-'lease_token';
 elsif p_action='draft.get' then return to_jsonb(draft)-'owner_id'-'lease_token';
 elsif p_action='draft.update' then
  if draft.last_mutation_id=(p_args->>'mutationId')::uuid then return to_jsonb(draft)-'owner_id'-'lease_token'; end if;
  if draft.status in ('saved','discarded') then raise exception 'CLOSED'; end if;
  if draft.revision<>(p_args->>'revision')::integer then raise exception 'STALE'; end if;
  pid:=nullif(p_args->>'phoneId','')::uuid;
  if pid is not null and not exists(select 1 from crm.phones where id=pid and contact_id=cid) then raise exception 'INVALID_PHONE'; end if;
  update crm.drafts set last_mutation_id=(p_args->>'mutationId')::uuid,raw_text=p_args->>'rawText',fields=p_args->'fields',phone_id=pid,
   revision=revision+1,status='editing',lease_token=null,lease_until=null,error_code=null,updated_at=now()
   where id=did returning * into draft;
  return to_jsonb(draft)-'owner_id'-'lease_token';
 elsif p_action='draft.audio' then
  if draft.status in ('saved','discarded','processing') then raise exception 'CLOSED'; end if;
  if draft.revision<>(p_args->>'revision')::integer then raise exception 'STALE'; end if;
  if draft.audio_path is not null then raise exception 'AUDIO_EXISTS'; end if;
  update crm.drafts set audio_path=p_args->>'path',updated_at=now() where id=did returning * into draft;
  return to_jsonb(draft)-'owner_id'-'lease_token';
 elsif p_action='draft.start' then
  if draft.status in ('saved','discarded') then raise exception 'CLOSED'; end if;
  if draft.status='processing' and draft.lease_until>now() then raise exception 'BUSY'; end if;
  if draft.revision<>(p_args->>'revision')::integer then raise exception 'STALE'; end if;
  update crm.drafts set status='processing',lease_token=gen_random_uuid(),lease_until=now()+interval '240 seconds',error_code=null,updated_at=now() where id=did returning * into draft;
  return to_jsonb(draft);
 elsif p_action in ('draft.transcript','draft.complete','draft.fail') then
  if draft.status<>'processing' or draft.lease_token is distinct from (p_args->>'lease')::uuid then raise exception 'STALE'; end if;
  if p_action='draft.transcript' then
   update crm.drafts set transcript=p_args->>'transcript',updated_at=now() where id=did;
  elsif p_action='draft.complete' then
   update crm.drafts set fields=p_args->'fields',status='ready',revision=revision+1,lease_token=null,lease_until=null,updated_at=now() where id=did;
  else update crm.drafts set status='failed',lease_token=null,lease_until=null,error_code='PROCESSING_FAILED',updated_at=now() where id=did;
  end if;
  select * into draft from crm.drafts where id=did;
  return to_jsonb(draft)-'owner_id'-'lease_token';
 elsif p_action='draft.discard' then
  if draft.status='saved' then raise exception 'CLOSED'; end if;
  update crm.drafts set status='discarded',audio_delete_pending=(audio_path is not null),lease_token=null,lease_until=null,updated_at=now() where id=did;
  return '{"ok":true}';
 elsif p_action='draft.save' then
  if draft.status='saved' then return jsonb_build_object('activityId',draft.saved_activity_id,'alreadySaved',true); end if;
  if draft.status='discarded' then raise exception 'CLOSED'; end if;
  if draft.status='processing' then raise exception 'BUSY'; end if;
  if draft.revision<>(p_args->>'revision')::integer then raise exception 'STALE'; end if;
  fields:=draft.fields; note:=trim(coalesce(fields->>'summary','')); v_outcome:=fields->>'outcome';
  if v_outcome not in ('interested','callback','voicemail','no_answer','not_interested','bad_number','do_not_call') then raise exception 'OUTCOME_REQUIRED'; end if;
  if v_outcome='interested' and note='' then raise exception 'NOTE_REQUIRED'; end if;
  if v_outcome='bad_number' and draft.phone_id is null then raise exception 'INVALID_PHONE'; end if;
  follow_date:=nullif(fields->>'followUpDate','')::date;
  if v_outcome='callback' and follow_date is null then raise exception 'DATE_REQUIRED'; end if;
  if follow_date is not null and trim(coalesce(fields->>'nextAction',''))='' then raise exception 'ACTION_REQUIRED'; end if;
  insert into crm.activities(contact_id,workspace_id,draft_id,author,summary,outcome,phone_id,next_action,follow_up_date)
  values(cid,'shared',did,case when is_admin then 'Administrator' else 'Centrifund caller' end,note,v_outcome,draft.phone_id,coalesce(fields->>'nextAction',''),follow_date) returning id into activity_id;
  insert into crm.contact_state(contact_id,workspace_id) values(cid,'shared') on conflict do nothing;
  update crm.contact_state set last_called_at=now(),outcome=fields->>'outcome',
   do_not_call=do_not_call or v_outcome='do_not_call',
   next_action=case when v_outcome='do_not_call' then null when coalesce(fields->>'nextAction','')<>'' then fields->>'nextAction' when coalesce((p_args->>'completeFollowUp')::boolean,false) then null else next_action end,
   follow_up_date=case when v_outcome='do_not_call' then null when coalesce(fields->>'nextAction','')<>'' then follow_date when coalesce((p_args->>'completeFollowUp')::boolean,false) then null else follow_up_date end
   where contact_id=cid and workspace_id='shared';
  if v_outcome='bad_number' then update crm.phones set is_bad=true where id=draft.phone_id and contact_id=cid; end if;
  update crm.drafts set status='saved',saved_activity_id=activity_id,audio_delete_pending=(audio_path is not null),updated_at=now() where id=did;
  return jsonb_build_object('activityId',activity_id,'alreadySaved',false);
 end if;
 raise exception 'UNKNOWN_ACTION';
end $$;

create function public.crm_audio_cleanup(p_completed uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path=crm,pg_temp as $$
begin
 update crm.drafts set audio_path=null,audio_delete_pending=false where id=any(p_completed) and updated_at<now()-interval '3 hours';
 update crm.drafts set audio_delete_pending=true where audio_path is not null and updated_at<now()-interval '7 days';
 delete from crm.rate_limits where window_start<now()-interval '2 days';
 delete from crm.sessions where expires_at<now()-interval '60 days';
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'path',audio_path)) from crm.drafts
  where audio_path is not null and (audio_delete_pending or updated_at<now()-interval '7 days')),'[]');
end $$;
revoke all on all functions in schema crm from public,anon,authenticated;
revoke all on function public.crm_rate_limit(text,integer,integer),public.crm_create_session(text,text,text,text),
 public.crm_request(text,text,text,jsonb),public.crm_audio_cleanup(uuid[]) from public,anon,authenticated;
grant execute on function public.crm_rate_limit(text,integer,integer),public.crm_create_session(text,text,text,text),
 public.crm_request(text,text,text,jsonb),public.crm_audio_cleanup(uuid[]) to service_role;
