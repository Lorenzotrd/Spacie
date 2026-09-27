-- A person can belong to several workspaces (one human principal each). The session
-- remembers which one is open; null means the oldest membership.
alter table sessions add column workspace_id uuid references workspaces(id);
