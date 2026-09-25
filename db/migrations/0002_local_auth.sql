-- Self-hosted sign-in: password accounts, server-side sessions, and invitation links.

alter table users add column password_hash text;

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on sessions (user_id);

-- Invitations become single-use links. Email is optional (links are shared by hand);
-- the command-line owner invitation has no inviter.
drop table invitations;
create table invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  token_hash text not null unique,
  email text,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  invited_by uuid references principals(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz
);
create index invitations_workspace_idx on invitations (workspace_id);

-- Rate limits key on arbitrary strings (principal ids, or a sign-in email).
drop table rate_limits;
create table rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
