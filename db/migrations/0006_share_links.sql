-- Public share links: read-only access to a file, a folder (with subfolders) or a
-- whole project, for anyone holding the URL. Each link can expire, forbid download,
-- require a password, and be revoked. The token is stored as-is so the link can be
-- shown again in the Share dialog; reading it requires database access, which
-- already grants the files themselves.
create table share_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  token text not null unique,
  resource_type text not null check (resource_type in ('file', 'folder', 'project')),
  project_id uuid not null,
  folder_id uuid,
  file_id uuid,
  created_by uuid not null,
  allow_download boolean not null default true,
  password_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  -- Wrong passwords in a row; reaching the limit locks the link for a while.
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, created_by) references principals (workspace_id, id),
  foreign key (workspace_id, project_id) references projects (workspace_id, id),
  foreign key (project_id, folder_id) references folders (project_id, id),
  foreign key (workspace_id, file_id) references files (workspace_id, id),
  check ((resource_type = 'file') = (file_id is not null)),
  check ((resource_type = 'folder') = (folder_id is not null and file_id is null))
);
create index share_links_resource_idx on share_links (workspace_id, resource_type, project_id, folder_id, file_id)
  where revoked_at is null;

-- Server-generated secrets (e.g. the key that signs unlocked-share access tokens).
create table app_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
