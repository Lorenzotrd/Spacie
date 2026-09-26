-- Re-uploading a file under the same name adds a version, so each version keeps the
-- size and type of its own bytes (null for rows written before this migration).
alter table file_versions add column size bigint check (size >= 0);
alter table file_versions add column mime text;

-- Short-lived links an agent uses to fetch a stored file (e.g. `curl -o deck.pptx <url>`)
-- from a sandbox without a bearer token. Access is re-checked on every use.
create table download_links (
  token_hash text primary key,
  workspace_id uuid not null,
  agent_id uuid not null,
  file_id uuid not null,
  version integer,
  preview boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, agent_id) references principals (workspace_id, id),
  foreign key (workspace_id, file_id) references files (workspace_id, id)
);
create index download_links_expires_idx on download_links (expires_at);
