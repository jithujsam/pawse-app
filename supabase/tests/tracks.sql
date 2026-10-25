-- Checks for 0006. Run on a fresh local Postgres after local-auth-stub.sql and migrations 0001–0006.
-- Each check prints PASS or FAIL.
\set ON_ERROR_STOP 1
insert into auth.users values ('aaaaaaaa-0000-4000-8000-00000000000a','a@x'), ('bbbbbbbb-0000-4000-8000-00000000000b','b@x') on conflict do nothing;

create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, name; end $$;
create or replace function pg_temp.rejected(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when check_violation or insufficient_privilege then return true; end $$;

set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-00000000000a',false);
-- Two tracks, each with its own companion.
insert into companions (id,user_id,species,name,born_on,habit_id) values
  ('c0000000-0000-4000-8000-0000000006aa','aaaaaaaa-0000-4000-8000-00000000000a','dog','Rex','2026-10-01','d0000000-0000-4000-8000-0000000006aa'),
  ('c0000000-0000-4000-8000-0000000006ab','aaaaaaaa-0000-4000-8000-00000000000a','cat','Miso','2026-10-02','d0000000-0000-4000-8000-0000000006ab');
insert into habits (id,user_id,companion_id,name,class,class_weight,unit,fields,description,started_on,status,track) values
  ('d0000000-0000-4000-8000-0000000006aa','aaaaaaaa-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-0000000006aa','Orders','food_spending',0.7,'money','[]','Late night','2026-10-01','paused','{"pauses":[{"from":"2026-10-20","to":null}],"restDays":[]}'),
  ('d0000000-0000-4000-8000-0000000006ab','aaaaaaaa-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-0000000006ab','Smoking','smoking',1.4,'count','[]','','2026-10-02','active',null);
select pg_temp.check('a person can keep two tracks with their own state', (select count(*) from habits where (id = 'd0000000-0000-4000-8000-0000000006aa' and status = 'paused' and track->'pauses'->0->>'from' = '2026-10-20') or (id = 'd0000000-0000-4000-8000-0000000006ab' and status = 'active' and track is null)) = 2);
insert into habits (id,user_id,companion_id,name,class,class_weight,unit,fields)
  values ('d0000000-0000-4000-8000-0000000006ac','aaaaaaaa-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-0000000006ab','Old app','custom',1,'none','[]');
select pg_temp.check('older apps can still insert habits without the new columns, as active tracks', (select status = 'active' and description = '' from habits where id = 'd0000000-0000-4000-8000-0000000006ac'));
select pg_temp.check('unknown status is rejected', pg_temp.rejected($q$update habits set status = 'deleted' where id = 'd0000000-0000-4000-8000-0000000006aa'$q$));
select pg_temp.check('a track state that is not an object is rejected', pg_temp.rejected($q$update habits set track = '[1]' where id = 'd0000000-0000-4000-8000-0000000006aa'$q$));
select pg_temp.check('an over-long description is rejected', pg_temp.rejected($q$update habits set description = repeat('x', 281) where id = 'd0000000-0000-4000-8000-0000000006aa'$q$));
update habits set status = 'archived', archived_at = '2026-10-25', client_updated_at = 5 where id = 'd0000000-0000-4000-8000-0000000006ab';
select pg_temp.check('a track can be archived', (select status = 'archived' from habits where id = 'd0000000-0000-4000-8000-0000000006ab'));

select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-00000000000b',false);
select pg_temp.check('another person cannot read tracks or companion owners', (select count(*) from habits) = 0 and (select count(*) from companions) = 0);
select pg_temp.check('another person cannot change a track', (select count(*) from (select 1 from habits where id = 'd0000000-0000-4000-8000-0000000006aa') x) = 0);
reset role;
