begin;
-- Supabase Storage only; intentionally separate from the portable database tests.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('centrifund-call-audio','centrifund-call-audio',false,10485760,array['audio/mp4','audio/webm','audio/mpeg','audio/ogg','audio/wav']);
-- Preserve other apps' policies, while preventing broad existing policies from exposing this bucket.
create policy centrifund_audio_server_only on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id <> 'centrifund-call-audio')
with check (bucket_id <> 'centrifund-call-audio');
-- Service-role API grants a one-object upload URL only after draft authorization.

commit;
