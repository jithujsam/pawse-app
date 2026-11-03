-- Trials without a launch date (0014, PRD §25.1). A new account's seven days start when it is created. An account
-- that existed before membership gets its seven days from the first time it reaches membership, never from when it
-- registered. Either way there is one trial per account, kept on the server, and nothing restarts it.
-- Run on a fresh local Postgres after local-auth-stub.sql and every migration in order (0001 to 0015):
--   psql ... -f supabase/tests/membership-trials.sql
-- Each check prints PASS or FAIL.
\set ON_ERROR_STOP 1
create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when coalesce(ok, false) then 'PASS' else 'FAIL' end, name; end $$;
create or replace function pg_temp.raises(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return true; end $$;
grant execute on all functions in schema pg_temp to authenticated, service_role;

-- ---------- accounts that existed before membership ----------
-- Production's accounts were made before the sign-up trigger existed, so they have no trial row. Recreate that.
alter table auth.users disable trigger on_auth_user_created_grant_trial;
insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'old@x', now() - interval '400 days'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'recent@x', now() - interval '3 days'),
  ('cccccccc-0000-4000-8000-00000000000c', 'legacy@x', now() - interval '90 days');
alter table auth.users enable trigger on_auth_user_created_grant_trial;

select pg_temp.check('existing accounts have no trial until they reach membership', (select count(*) from trial_grants) = 0);

select pg_temp.check('an account from 400 days ago: its first access starts a full trial, not an expired one',
  access_for('aaaaaaaa-0000-4000-8000-00000000000a') @> '{"state":"trial","app":true}');
select pg_temp.check('... seven days from that first access, recorded as first_access',
  (select source = 'first_access' and started_at > now() - interval '1 minute' and ends_at = started_at + interval '7 days'
   from trial_grants where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'));
create temp table first_seen as select started_at from trial_grants where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a';
select access_for('aaaaaaaa-0000-4000-8000-00000000000a');
select pg_temp.check('reaching membership again (another phone, a reinstall) never restarts it',
  (select started_at from trial_grants where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a') = (select started_at from first_seen)
  and (select count(*) from trial_grants where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a') = 1);

-- The app's own path: the signed-in person asks my_access().
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-00000000000b', false);
select pg_temp.check('the app''s first my_access() starts an existing account''s trial', (select my_access() @> '{"state":"trial"}'));
reset role;
select pg_temp.check('... from that moment, not from registration 3 days ago',
  (select started_at > now() - interval '1 minute' and source = 'first_access' from trial_grants where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'));

-- Seven days later (simulated): the trial has ended and stays ended.
update trial_grants set started_at = now() - interval '8 days', ends_at = now() - interval '1 day' where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a';
select pg_temp.check('after seven days: expired, the paywall''s state', access_for('aaaaaaaa-0000-4000-8000-00000000000a') @> '{"state":"expired","app":false,"ai":false}');
select pg_temp.check('... and reaching membership again doesn''t start another trial',
  access_for('aaaaaaaa-0000-4000-8000-00000000000a') @> '{"state":"expired"}'
  and (select ends_at < now() from trial_grants where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'));

-- ---------- a row an earlier version wrote in advance ----------
-- The earlier version gave every existing account a row dated from when it was applied ('launch'), which its owner
-- never saw. It starts from first access, once, like any existing account.
insert into trial_grants (user_id, started_at, ends_at, source) values ('cccccccc-0000-4000-8000-00000000000c', now() - interval '20 days', now() - interval '13 days', 'launch');
select pg_temp.check('a pre-written row that had already "ended" starts fresh at first access', access_for('cccccccc-0000-4000-8000-00000000000c') @> '{"state":"trial"}');
select pg_temp.check('... as a first_access trial from now', (select source = 'first_access' and started_at > now() - interval '1 minute' from trial_grants where user_id = 'cccccccc-0000-4000-8000-00000000000c'));
update trial_grants set started_at = now() - interval '8 days', ends_at = now() - interval '1 day' where user_id = 'cccccccc-0000-4000-8000-00000000000c';
select pg_temp.check('... once only: after its seven days it stays ended', access_for('cccccccc-0000-4000-8000-00000000000c') @> '{"state":"expired"}');

-- ---------- new accounts ----------
insert into auth.users (id, email, created_at) values ('dddddddd-0000-4000-8000-00000000000d', 'new@x', now());
select pg_temp.check('a new account gets its trial the moment it is created',
  (select source = 'signup' and started_at = (select created_at from auth.users where id = 'dddddddd-0000-4000-8000-00000000000d') and ends_at = started_at + interval '7 days'
   from trial_grants where user_id = 'dddddddd-0000-4000-8000-00000000000d'));
select pg_temp.check('... and its first access doesn''t move it', access_for('dddddddd-0000-4000-8000-00000000000d') @> '{"state":"trial"}'
  and (select source = 'signup' from trial_grants where user_id = 'dddddddd-0000-4000-8000-00000000000d'));
insert into auth.users (id, email, created_at) values ('eeeeeeee-0000-4000-8000-00000000000e', 'made-8-days-ago@x', now() - interval '8 days');
select pg_temp.check('a new account''s seven days count from its creation (made 8 days ago: ended)', access_for('eeeeeeee-0000-4000-8000-00000000000e') @> '{"state":"expired"}');
select pg_temp.check('the database still allows one trial per account', pg_temp.raises($q$insert into trial_grants (user_id, started_at, ends_at) values ('dddddddd-0000-4000-8000-00000000000d', now(), now() + interval '7 days')$q$));

-- ---------- no launch date anywhere ----------
select pg_temp.check('the launch-date table and functions are gone',
  to_regclass('public.membership_launch') is null and to_regprocedure('public.trial_start(timestamptz)') is null and to_regprocedure('public.set_membership_launch(timestamptz)') is null);

-- ---------- re-running 0014 ----------
create temp table before as select user_id, started_at, ends_at, source from trial_grants;
\ir ../migrations/0014_membership.sql
select pg_temp.check('re-running 0014 changes no trial and adds none',
  not exists (select * from trial_grants t where not exists (select 1 from before b where b.user_id = t.user_id and b.started_at = t.started_at and b.ends_at = t.ends_at and b.source = t.source))
  and (select count(*) from trial_grants) = (select count(*) from before));
