-- Pet missions as a recovery journey (PRD §23). Additive and safe to run more than once.
--
-- Replaces 0008's level view with the server's own copy of the journey rules in packages/engine/src/missions.ts,
-- so the phone is never the only authority:
--   - The goal (missions.target) is 30, 60 or 120 days; recovery takes max(21, goal / 2) goal-met days.
--   - Six conditions, healed one at a time, need days in a row split 1:2:3:4:5:6 across the recovery length.
--   - A goal-met day (no slip that day) adds a day; a slip resets the condition in treatment and, for a rescue,
--     brings back the last one healed. After recovery, 5 slips within 30 days bring the last condition back.
-- It reads only the caller's own rows: it runs with the caller's rights, so row level security applies.

drop view if exists public.mission_progress;

create or replace function public.mission_journey(p_companion uuid)
returns table (adoption_mode text, target int, recovery_days int, healed int, progress int, recovered boolean, pct int, goal_met_days int)
language plpgsql
stable
set search_path = ''
as $$
declare
  c record;
  r record;
  steps int[] := array[]::int[];
  weights int[] := array[1, 2, 3, 4, 5, 6];
  acc int := 0; prev int := 0; at int; i int;
  slips date[] := array[]::date[];
  done int;
begin
  select co.id, co.habit_id, co.born_on, co.died_on, coalesce(co.adoption_mode, 'raise') as mode,
    case when (co.missions->>'target') in ('30', '60', '120') then (co.missions->>'target')::int else 30 end as tgt
    into c from public.companions co where co.id = p_companion and co.deleted_at is null;
  if not found or c.habit_id is null then return; end if;

  adoption_mode := c.mode; target := c.tgt;
  recovery_days := greatest(21, round(c.tgt / 2.0)::int);
  for i in 1..6 loop
    acc := acc + weights[i];
    at := case when i = 6 then recovery_days else greatest(prev + 1, round(recovery_days * acc / 21.0)::int) end;
    steps := steps || (at - prev);
    prev := at;
  end loop;

  healed := 0; progress := 0; goal_met_days := 0;
  for r in
    select d.day,
      exists (select 1 from public.entries e where e.habit_id = c.habit_id and e.occurred_on = d.day and e.deleted_at is null) as slip,
      exists (select 1 from public.clean_days k where k.habit_id = c.habit_id and k.day = d.day and k.deleted_at is null) as met
    from (
      select occurred_on as day from public.entries where habit_id = c.habit_id and deleted_at is null
      union select day from public.clean_days where habit_id = c.habit_id and deleted_at is null
    ) d
    where d.day >= c.born_on and d.day <= least(coalesce(c.died_on, current_date), current_date)
    order by d.day
  loop
    if r.slip then
      if healed < 6 then
        progress := 0;
        if c.mode = 'rescue' and healed > 0 then healed := healed - 1; end if;
      else
        slips := array(select s from unnest(slips) s where r.day - s < 30) || r.day;
        if cardinality(slips) >= 5 then healed := 5; progress := 0; slips := array[]::date[]; end if;
      end if;
    elsif r.met then
      goal_met_days := goal_met_days + 1;
      if healed < 6 then
        progress := progress + 1;
        if progress >= steps[healed + 1] then healed := healed + 1; progress := 0; if healed = 6 then slips := array[]::date[]; end if; end if;
      end if;
    end if;
  end loop;

  recovered := healed = 6;
  done := coalesce((select sum(x) from unnest(steps[1:healed]) x), 0);
  pct := case when recovered then 100 else least(99, floor(100.0 * (done + progress) / recovery_days)::int) end;
  return next;
end;
$$;

revoke all on function public.mission_journey(uuid) from public, anon;
grant execute on function public.mission_journey(uuid) to authenticated;
