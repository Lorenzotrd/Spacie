-- Spacie MVP. Run through Supabase CLI migrations.
-- Domain records use a JSONB payload with indexed generated relational keys.
-- Browser roles cannot access payload tables. All domain access is authorized by the server.
create extension if not exists pgcrypto;
create table public.workspaces (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null,
 revision bigint not null default 1, created_at timestamptz not null default now()
);
create table public.users (id uuid primary key references auth.users(id) on delete cascade, email text not null, name text not null, created_at timestamptz not null default now());
create table public.workspace_members (id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspaces(id),user_id uuid not null references auth.users(id),principal_id uuid not null,role text not null check(role in ('owner','admin','member','viewer')),unique(workspace_id,user_id));
create table public.invitations (id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspaces(id),email text not null,role text not null check(role in ('admin','member','viewer')),invited_by uuid not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '7 days',unique(workspace_id,email));
create table public.principals (
 id uuid primary key, workspace_id uuid not null references workspaces(id), payload jsonb not null,
 constraint principals_id_matches check ((payload->>'id')::uuid=id)
);
create index principals_workspace_idx on public.principals(workspace_id);
create table public.projects (
 id uuid primary key, workspace_id uuid not null references workspaces(id), payload jsonb not null,
 constraint projects_id_matches check ((payload->>'id')::uuid=id)
);
create index projects_workspace_idx on public.projects(workspace_id);
create table public.folders (
 id uuid primary key, workspace_id uuid not null references workspaces(id), payload jsonb not null,
 constraint folders_id_matches check ((payload->>'id')::uuid=id)
);
create index folders_workspace_idx on public.folders(workspace_id);
create table public.files (
 id uuid primary key, workspace_id uuid not null references workspaces(id), payload jsonb not null,
 constraint files_id_matches check ((payload->>'id')::uuid=id)
);
create index files_workspace_idx on public.files(workspace_id);
create table public.file_versions (
 id uuid primary key, workspace_id uuid not null references workspaces(id), payload jsonb not null,
 constraint file_versions_id_matches check ((payload->>'id')::uuid=id)
);
create index file_versions_workspace_idx on public.file_versions(workspace_id);
create table public.comments (
 id uuid primary key, workspace_id uuid not null references workspaces(id), payload jsonb not null,
 constraint comments_id_matches check ((payload->>'id')::uuid=id)
);
create index comments_workspace_idx on public.comments(workspace_id);
create table public.activity_events (
 id uuid primary key, workspace_id uuid not null references workspaces(id), payload jsonb not null,
 constraint activity_events_id_matches check ((payload->>'id')::uuid=id)
);
create index activity_events_workspace_idx on public.activity_events(workspace_id);
create table public.permissions (
 id uuid primary key, workspace_id uuid not null references workspaces(id), payload jsonb not null,
 constraint permissions_id_matches check ((payload->>'id')::uuid=id)
);
create index permissions_workspace_idx on public.permissions(workspace_id);
alter table principals add column principal_type text generated always as (payload->>'type') stored;
alter table principals add constraint principal_type_check check (principal_type in ('human','agent'));
alter table projects add column name text generated always as (payload->>'name') stored;
alter table folders add column project_id uuid generated always as ((payload->>'projectId')::uuid) stored;
alter table folders add column parent_folder_id uuid generated always as ((payload->>'parentId')::uuid) stored;
alter table files add column project_id uuid generated always as ((payload->>'projectId')::uuid) stored;
alter table files add column folder_id uuid generated always as ((payload->>'folderId')::uuid) stored;
alter table files add column name text generated always as (payload->>'name') stored;
alter table file_versions add column file_id uuid generated always as ((payload->>'fileId')::uuid) stored;
alter table file_versions add column version_number integer generated always as ((payload->>'number')::integer) stored;
alter table file_versions add constraint unique_version unique(file_id,version_number);
alter table comments add column file_id uuid generated always as ((payload->>'fileId')::uuid) stored;
alter table permissions add column principal_id uuid generated always as ((payload->>'principalId')::uuid) stored;
alter table permissions add column resource_type text generated always as (payload->>'resourceType') stored;
alter table permissions add column resource_id uuid generated always as ((payload->>'resourceId')::uuid) stored;
alter table permissions add constraint unique_scope unique(principal_id,resource_type,resource_id);
create index files_search_idx on files using gin(to_tsvector('english',coalesce(payload->>'name','') || ' ' || coalesce(payload->>'content','')));
create index comments_file_idx on comments(file_id);
create index versions_file_idx on file_versions(file_id);
create view agents with (security_invoker=true) as select id,workspace_id,payload from principals where principal_type='agent';
create table public.agent_tokens (
 id uuid primary key,workspace_id uuid not null references workspaces(id),principal_id uuid not null,
 token_hash text not null unique,expires_at timestamptz not null,revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.presence (id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspaces(id),principal_id uuid not null,resource_id uuid,state text not null check(state in ('viewing','editing','working','idle')),last_seen_at timestamptz not null default now(),unique(workspace_id,principal_id));
create table public.notifications(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspaces(id),principal_id uuid not null,event_id uuid not null,read_at timestamptz,created_at timestamptz not null default now());
create table public.rate_limits(principal_id uuid primary key,window_start timestamptz not null,hits integer not null);
create or replace function public.spacie_rate_limit(actor_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare count_now integer;
begin
 insert into rate_limits(principal_id,window_start,hits) values(actor_id,now(),1)
 on conflict(principal_id) do update set
 hits=case when rate_limits.window_start<now()-interval '1 minute' then 1 else rate_limits.hits+1 end,
 window_start=case when rate_limits.window_start<now()-interval '1 minute' then now() else rate_limits.window_start end
 returning hits into count_now;
 return count_now<=120;
end;$$;
create or replace function public.reject_history_change() returns trigger language plpgsql as $$ begin raise exception 'History is immutable';end;$$;
create trigger immutable_activity before update or delete on activity_events for each row execute function reject_history_change();
create trigger immutable_versions before update or delete on file_versions for each row execute function reject_history_change();
create or replace function public.spacie_load(wid uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 select jsonb_build_object('workspace',jsonb_build_object('id',id,'name',name,'slug',slug),'revision',revision) into result from workspaces where id=wid;
 if result is null then raise exception 'Workspace not found';end if;
 result=result||jsonb_build_object('principals',coalesce((select jsonb_agg(payload) from principals where workspace_id=wid),'[]'::jsonb));
 result=result||jsonb_build_object('projects',coalesce((select jsonb_agg(payload) from projects where workspace_id=wid),'[]'::jsonb));
 result=result||jsonb_build_object('folders',coalesce((select jsonb_agg(payload) from folders where workspace_id=wid),'[]'::jsonb));
 result=result||jsonb_build_object('files',coalesce((select jsonb_agg(payload) from files where workspace_id=wid),'[]'::jsonb));
 result=result||jsonb_build_object('versions',coalesce((select jsonb_agg(payload) from file_versions where workspace_id=wid),'[]'::jsonb));
 result=result||jsonb_build_object('comments',coalesce((select jsonb_agg(payload) from comments where workspace_id=wid),'[]'::jsonb));
 result=result||jsonb_build_object('activity',coalesce((select jsonb_agg(payload) from activity_events where workspace_id=wid),'[]'::jsonb));
 result=result||jsonb_build_object('grants',coalesce((select jsonb_agg(payload) from permissions where workspace_id=wid),'[]'::jsonb));
 result=result||jsonb_build_object('tokens',coalesce((select jsonb_agg(jsonb_build_object('id',id,'principalId',principal_id,'hash',token_hash,'expiresAt',expires_at,'revokedAt',revoked_at)) from agent_tokens where workspace_id=wid),'[]'::jsonb));
 return result;
end;$$;
create or replace function public.spacie_commit(wid uuid,expected_revision bigint,document jsonb) returns void language plpgsql security definer set search_path=public as $$
declare current_revision bigint; entry jsonb;
begin
 select revision into current_revision from workspaces where id=wid for update;
 if current_revision is null or current_revision<>expected_revision then raise exception 'CONFLICT: Workspace changed. Retry the operation.';end if;
 if (document->'workspace'->>'id')::uuid<>wid then raise exception 'Workspace mismatch';end if;
 delete from principals where workspace_id=wid and id not in (select (value->>'id')::uuid from jsonb_array_elements(document->'principals'));
 for entry in select value from jsonb_array_elements(document->'principals') loop
 if exists(select 1 from principals where id=(entry->>'id')::uuid and workspace_id<>wid) then raise exception 'Cross-workspace record';end if;
 if (entry->>'workspaceId')::uuid<>wid then raise exception 'Workspace mismatch';end if;
 insert into principals(id,workspace_id,payload) values((entry->>'id')::uuid,wid,entry) on conflict(id) do update set payload=excluded.payload;
 end loop;
 delete from projects where workspace_id=wid and id not in (select (value->>'id')::uuid from jsonb_array_elements(document->'projects'));
 for entry in select value from jsonb_array_elements(document->'projects') loop
 if exists(select 1 from projects where id=(entry->>'id')::uuid and workspace_id<>wid) then raise exception 'Cross-workspace record';end if;
 if (entry->>'workspaceId')::uuid<>wid then raise exception 'Workspace mismatch';end if;
 insert into projects(id,workspace_id,payload) values((entry->>'id')::uuid,wid,entry) on conflict(id) do update set payload=excluded.payload;
 end loop;
 delete from folders where workspace_id=wid and id not in (select (value->>'id')::uuid from jsonb_array_elements(document->'folders'));
 for entry in select value from jsonb_array_elements(document->'folders') loop
 if exists(select 1 from folders where id=(entry->>'id')::uuid and workspace_id<>wid) then raise exception 'Cross-workspace record';end if;
 if (entry->>'workspaceId')::uuid<>wid then raise exception 'Workspace mismatch';end if;
 insert into folders(id,workspace_id,payload) values((entry->>'id')::uuid,wid,entry) on conflict(id) do update set payload=excluded.payload;
 end loop;
 delete from files where workspace_id=wid and id not in (select (value->>'id')::uuid from jsonb_array_elements(document->'files'));
 for entry in select value from jsonb_array_elements(document->'files') loop
 if exists(select 1 from files where id=(entry->>'id')::uuid and workspace_id<>wid) then raise exception 'Cross-workspace record';end if;
 if (entry->>'workspaceId')::uuid<>wid then raise exception 'Workspace mismatch';end if;
 insert into files(id,workspace_id,payload) values((entry->>'id')::uuid,wid,entry) on conflict(id) do update set payload=excluded.payload;
 end loop;
 for entry in select value from jsonb_array_elements(document->'versions') loop
 if exists(select 1 from file_versions where id=(entry->>'id')::uuid and workspace_id<>wid) then raise exception 'Cross-workspace record';end if;
 insert into file_versions(id,workspace_id,payload) values((entry->>'id')::uuid,wid,entry) on conflict(id) do nothing;
 end loop;
 delete from comments where workspace_id=wid and id not in (select (value->>'id')::uuid from jsonb_array_elements(document->'comments'));
 for entry in select value from jsonb_array_elements(document->'comments') loop
 if exists(select 1 from comments where id=(entry->>'id')::uuid and workspace_id<>wid) then raise exception 'Cross-workspace record';end if;
 insert into comments(id,workspace_id,payload) values((entry->>'id')::uuid,wid,entry) on conflict(id) do update set payload=excluded.payload;
 end loop;
 for entry in select value from jsonb_array_elements(document->'activity') loop
 if exists(select 1 from activity_events where id=(entry->>'id')::uuid and workspace_id<>wid) then raise exception 'Cross-workspace record';end if;
 insert into activity_events(id,workspace_id,payload) values((entry->>'id')::uuid,wid,entry) on conflict(id) do nothing;
 end loop;
 delete from permissions where workspace_id=wid and id not in (select (value->>'id')::uuid from jsonb_array_elements(document->'grants'));
 for entry in select value from jsonb_array_elements(document->'grants') loop
 if exists(select 1 from permissions where id=(entry->>'id')::uuid and workspace_id<>wid) then raise exception 'Cross-workspace record';end if;
 insert into permissions(id,workspace_id,payload) values((entry->>'id')::uuid,wid,entry) on conflict(id) do update set payload=excluded.payload;
 end loop;
 for entry in select value from jsonb_array_elements(document->'tokens') loop
 if exists(select 1 from agent_tokens where id=(entry->>'id')::uuid and workspace_id<>wid) then raise exception 'Cross-workspace token';end if;
 insert into agent_tokens(id,workspace_id,principal_id,token_hash,expires_at,revoked_at) values((entry->>'id')::uuid,wid,(entry->>'principalId')::uuid,entry->>'hash',(entry->>'expiresAt')::timestamptz,(entry->>'revokedAt')::timestamptz)
 on conflict(id) do update set revoked_at=excluded.revoked_at;
 end loop;
 update workspaces set revision=revision+1 where id=wid;
end;$$;
create or replace function public.spacie_bootstrap(uid uuid,email_address text,display_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare wid uuid; pid uuid:=gen_random_uuid(); invited invitations; member_role text;
begin
 perform pg_advisory_xact_lock(hashtext(uid::text));
 select workspace_id into wid from workspace_members where user_id=uid limit 1;
 if wid is not null then return wid;end if;
 insert into users(id,email,name) values(uid,email_address,display_name) on conflict(id) do nothing;
 select * into invited from invitations where lower(email)=lower(email_address) and expires_at>now() order by created_at desc limit 1;
 if invited.id is not null then wid=invited.workspace_id;member_role=invited.role;
 else
 wid=gen_random_uuid();member_role='owner';
 insert into workspaces(id,name,slug) values(wid,display_name||'’s workspace','workspace-'||substr(wid::text,1,8));
 end if;
 insert into principals(id,workspace_id,payload) values(pid,wid,jsonb_build_object('id',pid,'workspaceId',wid,'type','human','name',display_name,'initials',upper(substr(display_name,1,2)),'color','#8a73d5','status','online','role',member_role));
 insert into workspace_members(workspace_id,user_id,principal_id,role) values(wid,uid,pid,member_role);
 if invited.id is not null then delete from invitations where id=invited.id;end if;
 return wid;
end;$$;
alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon,authenticated;
alter table public.users enable row level security;
revoke all on public.users from anon,authenticated;
alter table public.workspace_members enable row level security;
revoke all on public.workspace_members from anon,authenticated;
alter table public.invitations enable row level security;
revoke all on public.invitations from anon,authenticated;
alter table public.principals enable row level security;
revoke all on public.principals from anon,authenticated;
alter table public.projects enable row level security;
revoke all on public.projects from anon,authenticated;
alter table public.folders enable row level security;
revoke all on public.folders from anon,authenticated;
alter table public.files enable row level security;
revoke all on public.files from anon,authenticated;
alter table public.file_versions enable row level security;
revoke all on public.file_versions from anon,authenticated;
alter table public.comments enable row level security;
revoke all on public.comments from anon,authenticated;
alter table public.activity_events enable row level security;
revoke all on public.activity_events from anon,authenticated;
alter table public.permissions enable row level security;
revoke all on public.permissions from anon,authenticated;
alter table public.agent_tokens enable row level security;
revoke all on public.agent_tokens from anon,authenticated;
alter table public.presence enable row level security;
revoke all on public.presence from anon,authenticated;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon,authenticated;
-- Realtime exposes only workspace revision signals, never files or unfiltered activity.
grant select(id,revision) on public.workspaces to authenticated;
grant select(workspace_id,user_id) on public.workspace_members to authenticated;
create policy own_memberships on workspace_members for select to authenticated using(user_id=auth.uid());
create policy member_workspace_signal on workspaces for select to authenticated using(exists(select 1 from workspace_members m where m.workspace_id=workspaces.id and m.user_id=auth.uid()));
do $$ begin alter publication supabase_realtime add table public.workspaces;exception when duplicate_object then null;end;$$;
revoke all on function public.spacie_load(uuid) from public,anon,authenticated;
revoke all on function public.spacie_commit(uuid,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.spacie_bootstrap(uuid,text,text) from public,anon,authenticated;
revoke all on function public.spacie_rate_limit(uuid) from public,anon,authenticated;
grant execute on function public.spacie_load(uuid),public.spacie_commit(uuid,bigint,jsonb),public.spacie_bootstrap(uuid,text,text),public.spacie_rate_limit(uuid) to service_role;
create table public.audit_logs(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspaces(id),principal_id uuid not null,action text not null,created_at timestamptz not null default now());
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon,authenticated;
create trigger immutable_audit before update or delete on public.audit_logs for each row execute function public.reject_history_change();
