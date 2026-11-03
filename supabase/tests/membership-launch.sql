-- The official launch date (0014): accounts that exist before launch get seven days from launch; accounts registered
-- after it get seven days from registration. Re-runs 0014 over accounts that already exist, as production will.
-- Run from supabase/tests after local-auth-stub.sql and every migration (0001 to 0014):
--   psql ... -f supabase/tests/membership-launch.sql
-- Each check prints PASS or FAIL.
\set ON_ERROR_STOP 1
create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when coalesce(ok, false) then 'PASS' else 'FAIL' end, name; end $$;
create or replace function pg_temp.denied(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when insufficient_privilege then return true; end $$;
create or replace function pg_temp.raises(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return true; end $$;
grant execute on all functions in schema pg_temp to authenticated, service_role;

-- Production before 0014: accounts exist, there is no membership yet.
drop trigger on_auth_user_created_grant_trial on auth.users;
delete from membership_launch;
insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'old@x', now() - interval '400 days'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'recent@x', now() - interval '3 days');

-- 0014 applied two weeks before the official launch.
create temp table launch as select date_trunc('second', now() + interval '14 days') as at;
grant select on launch to service_role, authenticated;
select set_config('app.membership_launch', (select at::text from launch), false);
\ir ../migrations/0014_membership.sql

select pg_temp.check('the launch date is the one given', (select launch_at from membership_launch) = (select at from launch));
select pg_temp.check('every existing account gets a trial', (select count(*) from trial_grants) = 2);
select pg_temp.check('an account from 400 days ago: 7 days from launch',
  (select started_at = (select at from launch) and ends_at = (select at from launch) + interval '7 days' and source = 'launch' from trial_grants where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'));
select pg_temp.check('an account from 3 days ago: also 7 days from launch, not from registration',
  (select started_at = (select at from launch) and source = 'launch' from trial_grants where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'));
select pg_temp.check('before launch, existing accounts have full access until launch + 7 days',
  access_for('aaaaaaaa-0000-4000-8000-00000000000a') @> '{"state":"trial","app":true,"ai":true}'
  and (access_for('aaaaaaaa-0000-4000-8000-00000000000a') ->> 'valid_until')::timestamptz = (select at from launch) + interval '7 days');

-- Someone registers between the migration and launch: they start with everyone else, at launch.
insert into auth.users (id, email, created_at) values ('cccccccc-0000-4000-8000-00000000000c', 'prelaunch@x', now());
select pg_temp.check('an account registered before launch starts at launch',
  (select started_at = (select at from launch) and source = 'launch' from trial_grants where user_id = 'cccccccc-0000-4000-8000-00000000000c'));

-- Moving the launch while it is still ahead moves every trial with it.
set role service_role;
select set_membership_launch((select at from launch) + interval '7 days');
reset role;
select pg_temp.check('a later launch date moves every pre-launch trial', (select bool_and(started_at = (select at from launch) + interval '7 days') from trial_grants));
set role service_role;
select pg_temp.check('the launch date can''t be set in the past', pg_temp.raises($q$select set_membership_launch(now() - interval '1 day')$q$));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-00000000000a', false);
select pg_temp.check('a signed-in person can''t move the launch', pg_temp.denied($q$select set_membership_launch(now() + interval '90 days')$q$));
select pg_temp.check('a signed-in person can''t read the launch row', pg_temp.denied($q$select * from membership_launch$q$));
select pg_temp.check('a signed-in person can''t call trial_start', pg_temp.denied($q$select trial_start(now())$q$));
reset role;

-- Launch day has come and gone (simulated: the launch was 10 days ago, so launch trials have ended).
update membership_launch set launch_at = now() - interval '10 days';
update trial_grants set started_at = now() - interval '10 days', ends_at = now() - interval '3 days' where source = 'launch';
set role service_role;
select pg_temp.check('after launch, trial dates are fixed', pg_temp.raises($q$select set_membership_launch(now() + interval '1 day')$q$));
reset role;
select pg_temp.check('a launch trial ends like any other', access_for('aaaaaaaa-0000-4000-8000-00000000000a') @> '{"state":"expired","app":false}');

-- A new account after launch: seven days from registration.
insert into auth.users (id, email, created_at) values ('dddddddd-0000-4000-8000-00000000000d', 'new@x', now() - interval '2 days');
select pg_temp.check('an account registered after launch: 7 days from registration',
  (select started_at = (select created_at from auth.users where id = 'dddddddd-0000-4000-8000-00000000000d') and source = 'signup' from trial_grants where user_id = 'dddddddd-0000-4000-8000-00000000000d'));
select pg_temp.check('... with 5 days left', access_for('dddddddd-0000-4000-8000-00000000000d') @> '{"state":"trial"}'
  and (access_for('dddddddd-0000-4000-8000-00000000000d') ->> 'valid_until')::timestamptz < now() + interval '5 days 1 minute');

-- Running 0014 again changes no trial and no launch date.
create temp table before as select user_id, started_at, ends_at, source from trial_grants;
select set_config('app.membership_launch', '2030-01-01 00:00:00+00', false);
\ir ../migrations/0014_membership.sql
select pg_temp.check('re-running 0014 keeps the launch date', (select launch_at < now() from membership_launch));
select pg_temp.check('re-running 0014 changes no trial',
  not exists (select user_id, started_at, ends_at, source from trial_grants except select * from before)
  and (select count(*) from trial_grants) = (select count(*) from before));

-- A trial row lost after launch is rebuilt from registration or launch, never from now.
delete from trial_grants where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a';
select pg_temp.check('a lost pre-launch trial is rebuilt from launch and stays expired', access_for('aaaaaaaa-0000-4000-8000-00000000000a') @> '{"state":"expired"}');
