-- Project context every agent reads before it acts, edited from the project's Settings tab.
alter table projects add column instructions text not null default '';
