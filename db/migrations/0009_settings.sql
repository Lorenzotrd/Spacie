-- Settings pages. Sessions get a public id (the token hash never leaves the server),
-- the device they were opened on and when they were last used, so people can see and
-- end them. Workspaces keep the defaults applied to new public links.
alter table sessions add column id uuid not null default gen_random_uuid();
alter table sessions add column user_agent text;
alter table sessions add column last_seen_at timestamptz;
create unique index sessions_id_idx on sessions (id);

alter table workspaces add column link_defaults jsonb not null default '{}'::jsonb;
