-- Office files (pptx, docx, xlsx) get a PDF rendition for in-app preview, produced
-- by a background worker. The rendition follows the file's current storage key.
alter table files add column preview_key text;
alter table files add column preview_status text not null default 'none'
  check (preview_status in ('none', 'pending', 'processing', 'ready', 'failed'));
create index files_preview_pending_idx on files (updated_at) where preview_status = 'pending';
-- Queue files uploaded before previews existed.
update files set preview_status = 'pending'
where storage_key is not null and not deleted and mime in (
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
