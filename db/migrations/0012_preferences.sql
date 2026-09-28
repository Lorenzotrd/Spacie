-- Settings > Preferences and Settings > General. A person's display preferences (density,
-- default sort, side panel, time zone) follow their account across workspaces; each
-- workspace keeps the defaults new agents start from.
alter table users add column preferences jsonb not null default '{}'::jsonb;
alter table workspaces add column agent_defaults jsonb not null default '{}'::jsonb;
