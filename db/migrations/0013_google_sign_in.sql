-- Sign in with Google: the stable Google account id (`sub`), linked on first use to the
-- account with the same verified email. Google-only accounts have no password_hash.
alter table users add column google_sub text unique;
