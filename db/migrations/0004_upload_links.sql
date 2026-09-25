-- Single-use upload links: an agent asks for one over MCP, then sends the file bytes
-- straight from its sandbox (e.g. `curl -T deck.pptx <url>`), without a bearer token.
create table upload_links (
  token_hash text primary key,
  workspace_id uuid not null,
  agent_id uuid not null,
  project_id uuid not null,
  folder_id uuid,
  name text not null,
  mime text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  file_id uuid,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, agent_id) references principals (workspace_id, id),
  foreign key (workspace_id, project_id) references projects (workspace_id, id)
);
