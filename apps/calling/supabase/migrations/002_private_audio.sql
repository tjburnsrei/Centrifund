-- Supabase Storage only; intentionally separate from the portable database tests.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('call-audio','call-audio',false,10485760,array['audio/mp4','audio/webm','audio/mpeg','audio/ogg','audio/wav'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- No anon/authenticated object policies. The API grants a one-object upload URL only after draft authorization.
