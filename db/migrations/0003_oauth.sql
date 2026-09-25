-- OAuth 2.1 for MCP clients such as Claude connectors: dynamic client registration,
-- authorization codes with PKCE, and rotating refresh tokens. Access tokens are
-- short-lived rows in agent_tokens, so revocation and auditing stay in one place.

create table oauth_clients (
  id text primary key,
  name text not null,
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
  secret_hash text,
  created_at timestamptz not null default now()
);

-- The human who connected an agent, and the OAuth client it was connected through.
alter table principals add column created_by uuid references principals(id);
alter table principals add column oauth_client_id text references oauth_clients(id);
create index principals_oauth_idx on principals (oauth_client_id, created_by) where oauth_client_id is not null;

create table oauth_codes (
  code_hash text primary key,
  client_id text not null references oauth_clients(id),
  agent_id uuid not null references principals(id),
  redirect_uri text not null,
  code_challenge text not null,
  scope text,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table oauth_refresh_tokens (
  token_hash text primary key,
  client_id text not null references oauth_clients(id),
  agent_id uuid not null references principals(id),
  scope text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index oauth_refresh_agent_idx on oauth_refresh_tokens (agent_id) where revoked_at is null;
