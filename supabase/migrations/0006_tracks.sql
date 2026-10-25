-- Multi-track: one person, several independent recovery tracks. Additive only and safe to run more than once.
-- See docs/MULTI_TRACK_ARCHITECTURE.md.
--
-- A track is a habits row. It gains a description, a start date, a status, and a `track` object holding its own
-- settings (plan, starting pace, rest days, weekly focus, milestones seen, accessory, treats, savings goal) and its
-- pause history. Those settings used to sit in profiles.settings while there was one habit; apps from before this
-- migration still read them there, so new apps keep a copy of the first track's settings in the profile.
-- Companions record the track they belong to. Apps from before this migration keep syncing without these columns
-- (apps/web/src/sync.ts), and old rows read as active tracks with default settings.

alter table public.habits add column if not exists description text not null default '';
alter table public.habits add column if not exists started_on date;
alter table public.habits add column if not exists status text not null default 'active';
alter table public.habits add column if not exists track jsonb;

alter table public.habits drop constraint if exists habits_description_check;
alter table public.habits add constraint habits_description_check check (char_length(description) <= 280);
alter table public.habits drop constraint if exists habits_status_check;
alter table public.habits add constraint habits_status_check check (status in ('active', 'paused', 'archived'));
alter table public.habits drop constraint if exists habits_track_check;
alter table public.habits add constraint habits_track_check
  check (track is null or (jsonb_typeof(track) = 'object' and pg_column_size(track) < 16384));

-- The owning track. No foreign key: companions are pushed before habits, and a new companion exists before the
-- track that points at it. Row level security already limits every row to its owner.
alter table public.companions add column if not exists habit_id uuid;
create index if not exists companions_habit on public.companions (habit_id);
