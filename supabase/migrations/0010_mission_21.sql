-- Pet missions: the 21-day journey (PRD §23). Additive and safe to run more than once.
--
-- Replaces 0009's mission_journey() with the server's own copy of packages/engine/src/missions.ts:
--   1. Recovery: 21 goal-met days in a row; a slip starts it over at 0.
--   2. Consistency: 21 more goal-met days while the pet is well.
--   3. Thriving: after that.
-- After recovery a slip gives an issue. Points: 1, +1 for a 2nd slip within 7 days, +1 for a 3rd within 7 days,
-- +1 for 3+ within 30 days, +1 if heavy (severity >= 2 or 3+ slips that day). Tier = min(3, points); a slip while
-- an issue is active raises it at least one tier. Tiers clear with 3, 7 or 14 goal-met days in a row.
-- It runs with the caller's rights, so row level security applies.

drop function if exists public.mission_journey(uuid);

create or replace function public.mission_journey(p_companion uuid)
returns table (adoption_mode text, phase text, run int, consistency int, thriving int, issue_tier int, issue_need int, issue_have int, goal_met_days int)
language plpgsql
stable
set search_path = ''
as $$
declare
  c record;
  r record;
  slips date[] := array[]::date[];
  s7 int; s30 int; pts int; t int;
begin
  select co.id, co.habit_id, co.born_on, co.died_on, coalesce(co.adoption_mode, 'raise') as mode
    into c from public.companions co where co.id = p_companion and co.deleted_at is null;
  if not found or c.habit_id is null then return; end if;
  adoption_mode := c.mode; phase := 'recovery';
  run := 0; consistency := 0; thriving := 0; issue_tier := null; issue_need := null; issue_have := null; goal_met_days := 0;
  for r in
    select d.day,
      (select count(*) from public.entries e where e.habit_id = c.habit_id and e.occurred_on = d.day and e.deleted_at is null) as n,
      exists (select 1 from public.entries e join public.deductions x on x.entry_id = e.id
              where e.habit_id = c.habit_id and e.occurred_on = d.day and e.deleted_at is null and x.severity >= 2) as severe,
      exists (select 1 from public.clean_days k where k.habit_id = c.habit_id and k.day = d.day and k.deleted_at is null) as met
    from (
      select occurred_on as day from public.entries where habit_id = c.habit_id and deleted_at is null
      union select day from public.clean_days where habit_id = c.habit_id and deleted_at is null
    ) d
    where d.day >= c.born_on and d.day <= least(coalesce(c.died_on, current_date), current_date)
    order by d.day
  loop
    if r.n > 0 then
      if phase = 'recovery' then run := 0; continue; end if;
      slips := slips || r.day;
      s7 := (select count(*) from unnest(slips) s where r.day - s < 7);
      s30 := (select count(*) from unnest(slips) s where r.day - s < 30);
      pts := 1 + (s7 >= 2)::int + (s7 >= 3)::int + (s30 >= 3)::int + (r.severe or r.n >= 3)::int;
      t := least(3, greatest(pts, coalesce(issue_tier + 1, 1)));
      issue_tier := t; issue_need := case t when 1 then 3 when 2 then 7 else 14 end; issue_have := 0;
    elsif r.met then
      goal_met_days := goal_met_days + 1;
      if phase = 'recovery' then
        run := run + 1;
        if run = 21 then phase := 'consistency'; end if;
      elsif issue_tier is not null then
        issue_have := issue_have + 1;
        if issue_have >= issue_need then issue_tier := null; issue_need := null; issue_have := null; end if;
      elsif phase = 'consistency' then
        consistency := consistency + 1;
        if consistency = 21 then phase := 'thriving'; end if;
      else
        thriving := thriving + 1;
      end if;
    end if;
  end loop;
  return next;
end;
$$;

revoke all on function public.mission_journey(uuid) from public, anon;
grant execute on function public.mission_journey(uuid) to authenticated;
