-- People removed from a workspace keep their principal (history shows their name)
-- but lose the link to their account.
alter table principals add column removed_at timestamptz;
