-- Pet missions (PRD §23). Additive only and safe to run more than once. Nothing existing is rewritten.
--
-- A companion gains an adoption mode (raise or rescue) and a small missions object holding only what can't be
-- recomputed: mission ids completed once (so a correction never takes a completion back) and milestones already
-- celebrated. Levels, condition values, setbacks and the pet's look are always recomputed from the track's own
-- goal-met days and slips, on the phone and here on the server (mission_progress), so the phone is never the only
-- authority and a day can never count twice: clean_days is keyed by (habit_id, day).
--
-- Existing companions keep adoption_mode null, which every app reads as "raise". Apps from before this migration
-- keep syncing without these columns (apps/web/src/sync.ts).

alter table public.companions add column if not exists adoption_mode text;
alter table public.companions drop constraint if exists companions_adoption_mode_check;
alter table public.companions add constraint companions_adoption_mode_check check (adoption_mode is null or adoption_mode in ('raise', 'rescue'));

alter table public.companions add column if not exists missions jsonb;
alter table public.companions drop constraint if exists companions_missions_check;
alter table public.companions add constraint companions_missions_check
  check (missions is null or (jsonb_typeof(missions) = 'object' and pg_column_size(missions) < 8192));

-- A pet's adoption mode is chosen once. Null (an existing pet) may become a mode; a mode never changes after that.
create or replace function public.keep_adoption_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.adoption_mode is not null and new.adoption_mode is distinct from old.adoption_mode then
    new.adoption_mode := old.adoption_mode;
  end if;
  return new;
end;
$$;
drop trigger if exists companions_keep_adoption_mode on public.companions;
create trigger companions_keep_adoption_mode before update on public.companions for each row execute function public.keep_adoption_mode();

-- Goal-met days can't be recorded for the future. One day of slack covers time zones ahead of the server.
-- The phone also limits corrections to the last few days (EDIT_DAYS in apps/web/src/progress.ts).
alter table public.clean_days drop constraint if exists clean_days_not_future;
alter table public.clean_days add constraint clean_days_not_future check (day <= (now() at time zone 'utc')::date + 1) not valid;

-- The server's own reading of mission progress, from the same rule as packages/engine/src/missions.ts:
-- distinct goal-met days on the companion's track, from the day it arrived, without a slip that day, read against
-- the cumulative thresholds 3, 7, 12, 18, 24, 30. security_invoker keeps row level security in force: a person
-- only ever sees their own companions.
create or replace view public.mission_progress
with (security_invoker = true)
as
with counted as (
  select c.id as companion_id, c.user_id, c.habit_id, coalesce(c.adoption_mode, 'raise') as adoption_mode,
    (select count(*) from public.clean_days k
      where k.habit_id = c.habit_id and k.deleted_at is null and k.day >= c.born_on
        and (c.died_on is null or k.day <= c.died_on)
        and not exists (select 1 from public.entries e where e.habit_id = k.habit_id and e.occurred_on = k.day and e.deleted_at is null)
    )::int as goal_met_days,
    coalesce(c.missions -> 'done', '[]'::jsonb) as completed
  from public.companions c
  where c.deleted_at is null and c.habit_id is not null
)
select companion_id, user_id, habit_id, adoption_mode, goal_met_days,
  6 - ((goal_met_days >= 3)::int + (goal_met_days >= 7)::int + (goal_met_days >= 12)::int
     + (goal_met_days >= 18)::int + (goal_met_days >= 24)::int + (goal_met_days >= 30)::int) as level,
  completed
from counted;

grant select on public.mission_progress to authenticated;
revoke all on public.mission_progress from anon;
