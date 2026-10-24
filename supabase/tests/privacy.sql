-- Privacy checks for 0003 and 0004. Run on a fresh local Postgres after local-auth-stub.sql and migrations 0001–0004:
--   psql -f supabase/tests/local-auth-stub.sql -f supabase/migrations/0001_init.sql -f supabase/migrations/0002_normalized.sql \
--        -f supabase/migrations/0003_v2.sql -f supabase/migrations/0004_privacy_hardening.sql -f supabase/tests/privacy.sql
-- Each check prints PASS or FAIL.
\set ON_ERROR_STOP 1
insert into auth.users values ('aaaaaaaa-0000-4000-8000-00000000000a','a@x'), ('bbbbbbbb-0000-4000-8000-00000000000b','b@x');

create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, name; end $$;
create or replace function pg_temp.denied(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when insufficient_privilege then return true; end $$;

-- A owns a companion, habit, urge and journal entry.
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-00000000000a',false);
insert into companions (id,user_id,species,name,born_on) values ('c0000000-0000-4000-8000-0000000000aa','aaaaaaaa-0000-4000-8000-00000000000a','fox','Ember','2026-10-01');
insert into habits (id,user_id,companion_id,name,class,class_weight,unit,fields) values ('d0000000-0000-4000-8000-0000000000aa','aaaaaaaa-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-0000000000aa','Scrolling','doomscrolling',0.8,'minutes','[]');
insert into urges (id,user_id,habit_id,occurred_on,strength,outcome,client_created_at) values ('e0000000-0000-4000-8000-0000000000aa','aaaaaaaa-0000-4000-8000-00000000000a','d0000000-0000-4000-8000-0000000000aa','2026-10-02',3,'rode_it_out',1);
insert into journal (user_id,day,mood,body) values ('aaaaaaaa-0000-4000-8000-00000000000a','2026-10-02',2,'private words');

-- B sees none of it and cannot attach to it.
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-00000000000b',false);
select pg_temp.check('B cannot read A urges', (select count(*) from urges) = 0);
select pg_temp.check('B cannot read A journal', (select count(*) from journal) = 0);
select pg_temp.check('B cannot attach an urge to A habit', pg_temp.denied($q$insert into urges (id,user_id,habit_id,occurred_on,strength,outcome,client_created_at) values ('e0000000-0000-4000-8000-0000000000bb','bbbbbbbb-0000-4000-8000-00000000000b','d0000000-0000-4000-8000-0000000000aa','2026-10-02',3,'slipped',1)$q$));
select pg_temp.check('B cannot write a journal row as A', pg_temp.denied($q$insert into journal (user_id,day,mood) values ('aaaaaaaa-0000-4000-8000-00000000000a','2026-10-03',3)$q$));

-- The AI tables are for the edge function (service role) only.
select pg_temp.check('signed-in users cannot read ai_cache', pg_temp.denied('select * from ai_cache'));
select pg_temp.check('signed-in users cannot touch ai_usage', pg_temp.denied('select * from ai_usage'));
reset role; set role anon;
select pg_temp.check('anon cannot read ai_cache', pg_temp.denied('select * from ai_cache'));
select pg_temp.check('anon cannot read app_state', pg_temp.denied('select * from app_state'));
select pg_temp.check('anon cannot read journal', pg_temp.denied('select * from journal'));

-- Cached AI text goes with the account.
reset role;
insert into ai_cache (key,user_id,kind,result) values (repeat('a',64),'aaaaaaaa-0000-4000-8000-00000000000a','slip','{"explanation":"x"}');
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-00000000000a',false);
select public.delete_my_account();
reset role;
select pg_temp.check('account deletion removes cached AI text', (select count(*) from ai_cache) = 0);
select pg_temp.check('account deletion removes urges and journal', (select count(*) from urges) + (select count(*) from journal) = 0);
