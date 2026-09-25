-- Spacie schema. Plain PostgreSQL 15+: runs on a self-hosted server, Supabase, or embedded PGlite.
-- Everything lives in the `spacie` schema, which PostgREST does not expose, so a Supabase
-- anon key can never read these tables. All access is authorized by the application server.
-- Composite foreign keys keep every record inside its own workspace.

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  revision bigint not null default 1,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  email text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table principals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  type text not null check (type in ('human', 'agent')),
  user_id uuid references users(id),
  name text not null,
  initials text not null,
  color text not null,
  provider text,
  status text not null default 'idle' check (status in ('online', 'working', 'idle', 'offline')),
  role text check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, user_id),
  check ((type = 'human') = (role is not null))
);
create index principals_workspace_idx on principals (workspace_id);
create index principals_user_idx on principals (user_id) where user_id is not null;

create table invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  email text not null,
  role text not null check (role in ('admin', 'member', 'viewer')),
  invited_by uuid not null references principals(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  unique (workspace_id, email)
);
create index invitations_email_idx on invitations (lower(email));

create table projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  name text not null,
  description text not null default '',
  color text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index projects_workspace_idx on projects (workspace_id);

create table folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  parent_id uuid,
  name text not null,
  created_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (workspace_id, project_id) references projects (workspace_id, id),
  foreign key (project_id, parent_id) references folders (project_id, id),
  check (parent_id is distinct from id)
);
create index folders_workspace_idx on folders (workspace_id);

create table files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  folder_id uuid,
  name text not null,
  mime text not null,
  size bigint not null default 0 check (size >= 0),
  content text not null default '',
  storage_key text,
  version integer not null default 1 check (version > 0),
  deleted boolean not null default false,
  updated_by uuid not null references principals(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Markup is stripped and the indexed text is capped: tsvector has a 1 MB limit.
  search tsvector generated always as (
    to_tsvector('simple', name || ' ' || left(regexp_replace(content, '<[^>]+>', ' ', 'g'), 200000))
  ) stored,
  unique (workspace_id, id),
  foreign key (workspace_id, project_id) references projects (workspace_id, id),
  foreign key (project_id, folder_id) references folders (project_id, id)
);
create index files_location_idx on files (workspace_id, project_id, folder_id);
create index files_search_idx on files using gin (search);

create table file_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  file_id uuid not null,
  number integer not null check (number > 0),
  content text not null default '',
  storage_key text,
  actor_id uuid not null references principals(id),
  message text not null,
  created_at timestamptz not null default now(),
  unique (file_id, number),
  foreign key (workspace_id, file_id) references files (workspace_id, id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  file_id uuid not null,
  parent_id uuid,
  actor_id uuid not null references principals(id),
  content text not null check (length(content) between 1 and 10000),
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (file_id, id),
  foreign key (workspace_id, file_id) references files (workspace_id, id),
  -- A reply can only point at a comment on the same file.
  foreign key (file_id, parent_id) references comments (file_id, id)
);
create index comments_file_idx on comments (file_id, created_at);

create table comment_reactions (
  comment_id uuid not null references comments(id),
  principal_id uuid not null references principals(id),
  created_at timestamptz not null default now(),
  primary key (comment_id, principal_id)
);

create table activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  actor_id uuid not null references principals(id),
  project_id uuid,
  file_id uuid,
  action text not null,
  name text not null,
  created_at timestamptz not null default now()
);
create index activity_workspace_idx on activity_events (workspace_id, created_at desc);

create table grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  principal_id uuid not null,
  resource_type text not null check (resource_type in ('workspace', 'project', 'folder')),
  resource_id uuid not null,
  allow text[] not null default '{}',
  full_access boolean not null default false,
  unique (principal_id, resource_type, resource_id),
  foreign key (workspace_id, principal_id) references principals (workspace_id, id)
);
create index grants_workspace_idx on grants (workspace_id);

create table agent_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  principal_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, principal_id) references principals (workspace_id, id)
);
create index agent_tokens_principal_idx on agent_tokens (principal_id) where revoked_at is null;

create table presence (
  workspace_id uuid not null references workspaces(id),
  principal_id uuid not null references principals(id),
  resource_id uuid,
  state text not null check (state in ('viewing', 'editing', 'working', 'idle')),
  last_seen_at timestamptz not null default now(),
  primary key (workspace_id, principal_id)
);

create table rate_limits (
  principal_id uuid primary key,
  window_start timestamptz not null,
  hits integer not null
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  principal_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index audit_logs_workspace_idx on audit_logs (workspace_id, created_at desc);

create function reject_history_change() returns trigger language plpgsql as $$
begin
  raise exception 'History is immutable';
end;
$$;
create trigger immutable_versions before update or delete on file_versions
  for each row execute function reject_history_change();
create trigger immutable_activity before update or delete on activity_events
  for each row execute function reject_history_change();
create trigger immutable_audit before update or delete on audit_logs
  for each row execute function reject_history_change();
