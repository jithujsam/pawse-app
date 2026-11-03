-- 0013 and 0015: the Brutal personality ('savage') and the AI cache accepting the pet's lines ("pet").
-- Run on a fresh local Postgres after local-auth-stub.sql and every migration in order (0001 to 0015).
-- Each check prints PASS or FAIL.
\set ON_ERROR_STOP 1
create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when coalesce(ok, false) then 'PASS' else 'FAIL' end, name; end $$;
create or replace function pg_temp.raises(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return true; end $$;
insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'a@x');

select pg_temp.check('the AI cache keeps a pet answer', not pg_temp.raises($q$insert into ai_cache (key, kind, result, user_id) values (repeat('a', 64), 'pet', '{}', 'aaaaaaaa-0000-4000-8000-00000000000a')$q$));
select pg_temp.check('... and still slip and weekly answers', not pg_temp.raises($q$insert into ai_cache (key, kind, result) values (repeat('b', 64), 'slip', '{}'), (repeat('c', 64), 'weekly', '{}')$q$));
select pg_temp.check('... and nothing else', pg_temp.raises($q$insert into ai_cache (key, kind, result) values (repeat('d', 64), 'poem', '{}')$q$));
select pg_temp.check('exactly one kind check on ai_cache', (select count(*) from pg_constraint where conrelid = 'public.ai_cache'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%kind%') = 1);
\ir ../migrations/0015_ai_cache_pet.sql
select pg_temp.check('0015 runs again cleanly, keeping one check', (select count(*) from pg_constraint where conrelid = 'public.ai_cache'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%kind%') = 1);
select pg_temp.check('the pet answer survived the re-run', (select count(*) from ai_cache where kind = 'pet') = 1);

insert into companions (id, user_id, species, name, born_on, personality) values ('c0000000-0000-4000-8000-0000000000aa', 'aaaaaaaa-0000-4000-8000-00000000000a', 'dog', 'Biscuit', '2026-10-01', 'savage');
select pg_temp.check('a Brutal (savage) pet is stored', (select personality from companions) = 'savage');
select pg_temp.check('an unknown personality is still refused', pg_temp.raises($q$update companions set personality = 'evil'$q$));
select pg_temp.check('membership gives the account a trial alongside', (select count(*) from trial_grants) = 1);
