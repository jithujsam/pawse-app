-- Account deletion needs a recent sign-in (0012). Run on a fresh local Postgres:
--   psql -f supabase/tests/local-auth-stub.sql -f supabase/migrations/0001_init.sql -f supabase/migrations/0002_normalized.sql \
--        -f supabase/migrations/0003_v2.sql -f supabase/migrations/0004_privacy_hardening.sql -f supabase/migrations/0012_delete_needs_recent_signin.sql \
--        -f supabase/tests/delete-account.sql
-- Each check prints PASS or FAIL.
\set ON_ERROR_STOP 1
insert into auth.users values ('aaaaaaaa-0000-4000-8000-00000000000a','a@x'), ('bbbbbbbb-0000-4000-8000-00000000000b','b@x'), ('cccccccc-0000-4000-8000-00000000000c','c@x'), ('dddddddd-0000-4000-8000-00000000000d','d@x');
-- A has a fresh session, B only an old one, C a fresh session that belongs to someone else, D has no session claim at all.
insert into auth.sessions (id, user_id, created_at) values
  ('a1000000-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-00000000000a', now() - interval '1 minute'),
  ('b1000000-0000-4000-8000-00000000000b','bbbbbbbb-0000-4000-8000-00000000000b', now() - interval '2 hours'),
  ('c1000000-0000-4000-8000-00000000000c','aaaaaaaa-0000-4000-8000-00000000000a', now() - interval '1 minute');

create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, name; end $$;
create or replace function pg_temp.refused(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when insufficient_privilege then return true; end $$;

set role authenticated;

-- B: signed in, but the session is two hours old.
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-00000000000b',false);
select set_config('request.jwt.claims','{"session_id":"b1000000-0000-4000-8000-00000000000b"}',false);
select pg_temp.check('an old session cannot delete the account', pg_temp.refused('select public.delete_my_account()'));

-- C: a fresh session id that belongs to A does not count for C.
select set_config('request.jwt.claim.sub','cccccccc-0000-4000-8000-00000000000c',false);
select set_config('request.jwt.claims','{"session_id":"c1000000-0000-4000-8000-00000000000c"}',false);
select pg_temp.check('someone else''s fresh session cannot delete the account', pg_temp.refused('select public.delete_my_account()'));

-- D: no session claim.
select set_config('request.jwt.claim.sub','dddddddd-0000-4000-8000-00000000000d',false);
select set_config('request.jwt.claims','{}',false);
select pg_temp.check('a token with no session cannot delete the account', pg_temp.refused('select public.delete_my_account()'));

reset role;
select pg_temp.check('refused deletes left the accounts alone', (select count(*) from auth.users where id in ('bbbbbbbb-0000-4000-8000-00000000000b','cccccccc-0000-4000-8000-00000000000c','dddddddd-0000-4000-8000-00000000000d')) = 3);

-- A: a session made a minute ago may delete.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-00000000000a',false);
select set_config('request.jwt.claims','{"session_id":"a1000000-0000-4000-8000-00000000000a"}',false);
select public.delete_my_account();
reset role;
select pg_temp.check('a recent sign-in can delete the account', (select count(*) from auth.users where id = 'aaaaaaaa-0000-4000-8000-00000000000a') = 0);
