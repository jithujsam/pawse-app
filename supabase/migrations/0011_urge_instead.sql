-- Goals and what helps. Additive only and safe to run more than once.
--
-- An urge can record what the person did instead of acting on it ("Read a few pages"), so Insights can show what works for them.
-- The goal itself (its target, and who the person wants to be) lives inside the track's plan, in habits.track (jsonb), so it needs no schema change.
-- A photo of what they did instead stays on the phone and is never stored here.
-- Apps that predate this migration keep syncing urges without the new column, and an app that is ahead of it sends urges without it (see apps/web/src/sync.ts).

alter table public.urges add column if not exists instead text;

alter table public.urges drop constraint if exists urges_instead_check;
alter table public.urges add constraint urges_instead_check check (instead is null or char_length(instead) <= 40);
