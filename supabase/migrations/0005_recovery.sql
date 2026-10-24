-- PAWSE 3.0 recovery layer. Additive only and safe to run more than once.
--
-- Urges can record which coping strategy the person was using and what they said set it off.
-- The recovery plan, rest days and weekly focus live in profiles.settings (jsonb), so they need no schema change.
-- Apps that predate this migration keep syncing urges without the new columns (see apps/web/src/sync.ts).

alter table public.urges add column if not exists strategy text;
alter table public.urges add column if not exists trigger text;

alter table public.urges drop constraint if exists urges_strategy_check;
alter table public.urges add constraint urges_strategy_check
  check (strategy is null or strategy in ('observe', 'name', 'move', 'friction', 'breathe', 'replace', 'reach'));
alter table public.urges drop constraint if exists urges_trigger_check;
alter table public.urges add constraint urges_trigger_check check (trigger is null or char_length(trigger) <= 40);
