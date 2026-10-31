-- Checks for 0008. Run on a fresh local Postgres after local-auth-stub.sql and migrations 0001–0008.
-- Each check prints PASS or FAIL.
\set ON_ERROR_STOP 1
insert into auth.users values ('aaaaaaaa-0000-4000-8000-00000000080a','a8@x'), ('bbbbbbbb-0000-4000-8000-00000000080b','b8@x') on conflict do nothing;

create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, name; end $$;
create or replace function pg_temp.rejected(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when check_violation or insufficient_privilege then return true; end $$;

set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-00000000080a',false);
-- An existing pet (no mode) and a new rescue on a second track.
insert into companions (id,user_id,species,name,born_on,habit_id) values
  ('c0000000-0000-4000-8000-0000000008aa','aaaaaaaa-0000-4000-8000-00000000080a','dog','Rex','2026-09-01','d0000000-0000-4000-8000-0000000008aa');
insert into companions (id,user_id,species,name,born_on,habit_id,adoption_mode,missions) values
  ('c0000000-0000-4000-8000-0000000008ab','aaaaaaaa-0000-4000-8000-00000000080a','dog','Scout','2026-10-01','d0000000-0000-4000-8000-0000000008ab','rescue','{"v":1,"done":[],"seen":[]}');
insert into habits (id,user_id,companion_id,name,class,class_weight,unit,fields) values
  ('d0000000-0000-4000-8000-0000000008aa','aaaaaaaa-0000-4000-8000-00000000080a','c0000000-0000-4000-8000-0000000008aa','Orders','food_spending',0.7,'money','[]'),
  ('d0000000-0000-4000-8000-0000000008ab','aaaaaaaa-0000-4000-8000-00000000080a','c0000000-0000-4000-8000-0000000008ab','Smoking','smoking',1.4,'count','[]');
-- Track one: 8 goal-met days from 2026-09-02, one of them under a slip, plus one before the pet arrived.
insert into clean_days (habit_id,day) select 'd0000000-0000-4000-8000-0000000008aa', d::date from generate_series('2026-09-02'::date, '2026-09-09'::date, '1 day') d;
insert into clean_days (habit_id,day) values ('d0000000-0000-4000-8000-0000000008aa','2026-08-20');
insert into entries (id,habit_id,companion_id,occurred_on,client_created_at) values ('e0000000-0000-4000-8000-0000000008aa','d0000000-0000-4000-8000-0000000008aa','c0000000-0000-4000-8000-0000000008aa','2026-09-05',1);
-- Track two: 3 goal-met days.
insert into clean_days (habit_id,day) select 'd0000000-0000-4000-8000-0000000008ab', d::date from generate_series('2026-10-02'::date, '2026-10-04'::date, '1 day') d;

select pg_temp.check('an existing pet reads as raise', (select adoption_mode = 'raise' from mission_progress where companion_id = 'c0000000-0000-4000-8000-0000000008aa'));
select pg_temp.check('goal-met days count once each, skip slip days and days before the pet arrived', (select goal_met_days = 7 and level = 4 from mission_progress where companion_id = 'c0000000-0000-4000-8000-0000000008aa'));
select pg_temp.check('tracks are counted separately', (select goal_met_days = 3 and level = 5 and adoption_mode = 'rescue' from mission_progress where companion_id = 'c0000000-0000-4000-8000-0000000008ab'));
select pg_temp.check('the same goal-met day cannot be added twice', (select count(*) = 1 from clean_days where habit_id = 'd0000000-0000-4000-8000-0000000008ab' and day = '2026-10-02'));
do $$ begin insert into clean_days (habit_id,day) values ('d0000000-0000-4000-8000-0000000008ab','2026-10-02'); raise notice 'FAIL duplicate day accepted';
exception when unique_violation then raise notice 'PASS a duplicate goal-met day is refused'; end $$;
select pg_temp.check('a goal-met day in the future is refused', pg_temp.rejected($q$insert into clean_days (habit_id,day) values ('d0000000-0000-4000-8000-0000000008ab', current_date + 5)$q$));
select pg_temp.check('an unknown adoption mode is refused', pg_temp.rejected($q$update companions set adoption_mode = 'wild' where id = 'c0000000-0000-4000-8000-0000000008aa'$q$));
select pg_temp.check('missions must be an object', pg_temp.rejected($q$update companions set missions = '[1]' where id = 'c0000000-0000-4000-8000-0000000008aa'$q$));
update companions set adoption_mode = 'raise' where id = 'c0000000-0000-4000-8000-0000000008aa';
update companions set adoption_mode = 'rescue' where id = 'c0000000-0000-4000-8000-0000000008aa';
select pg_temp.check('a mode, once set, never changes', (select adoption_mode = 'raise' from companions where id = 'c0000000-0000-4000-8000-0000000008aa'));
-- An app from before 0008 saves the companion without the new columns: they survive.
insert into companions (id,user_id,species,name,born_on,client_updated_at) values ('c0000000-0000-4000-8000-0000000008ab','aaaaaaaa-0000-4000-8000-00000000080a','dog','Scout II','2026-10-01',9)
  on conflict (id) do update set name = excluded.name, client_updated_at = excluded.client_updated_at;
select pg_temp.check('an older app keeps the mode and missions', (select name = 'Scout II' and adoption_mode = 'rescue' and missions->>'v' = '1' from companions where id = 'c0000000-0000-4000-8000-0000000008ab'));

select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-00000000080b',false);
select pg_temp.check('another person sees no mission progress', (select count(*) = 0 from mission_progress));
select pg_temp.check('another person cannot add goal-met days to someone else''s track', pg_temp.rejected($q$insert into clean_days (habit_id,day,user_id) values ('d0000000-0000-4000-8000-0000000008ab','2026-10-05','aaaaaaaa-0000-4000-8000-00000000080a')$q$));
reset role;
set role anon;
select pg_temp.check('anonymous callers cannot read mission progress', pg_temp.rejected($q$select 1 from mission_progress$q$));
reset role;
