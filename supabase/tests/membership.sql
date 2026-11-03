-- Membership checks for 0014: trial grants, effective access, privileges and row level security, payment events
-- (idempotency and plan transitions), abuse counters and the sign-up hook, and that recovery data is never gated.
-- Run on a fresh local Postgres after local-auth-stub.sql and every migration in order (0001 to 0014):
--   psql -f supabase/tests/local-auth-stub.sql -f supabase/migrations/0001_init.sql ... -f supabase/migrations/0014_membership.sql \
--        -f supabase/tests/membership.sql
-- Each check prints PASS or FAIL.
\set ON_ERROR_STOP 1
create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when coalesce(ok, false) then 'PASS' else 'FAIL' end, name; end $$;
create or replace function pg_temp.denied(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when insufficient_privilege then return true; end $$;
create or replace function pg_temp.raises(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return true; end $$;
create or replace function pg_temp.as_user(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false) $$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

-- Every account below is created after membership exists, so each is a new account: its trial starts when it is
-- created (accounts that existed before membership: membership-trials.sql).
-- A signs up now; B signed up 10 days ago; C signed up now but hasn't confirmed the email.
insert into auth.users (id, email, created_at) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'a@x', now());
insert into auth.users (id, email, created_at) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'b@x', now() - interval '10 days');
insert into auth.users (id, email, created_at, email_confirmed_at) values ('cccccccc-0000-4000-8000-00000000000c', 'c@x', now(), null);

-- ---------- trial grants ----------
select pg_temp.check('sign-up grants exactly one trial', (select count(*) from trial_grants where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a') = 1);
select pg_temp.check('a new account''s trial lasts seven days from when it was created',
  (select ends_at = started_at + interval '7 days' and started_at = (select created_at from auth.users where id = user_id) from trial_grants where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'));
select pg_temp.check('a new account''s trial counts from its creation: B was created 10 days ago, so it has ended',
  (select ends_at < now() from trial_grants where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'));
select pg_temp.check('the database refuses a trial that is not exactly seven days',
  pg_temp.raises($q$update trial_grants set ends_at = ends_at + interval '30 days' where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'$q$));
select pg_temp.check('the database refuses a second trial for the same account',
  pg_temp.raises($q$insert into trial_grants (user_id, started_at, ends_at) values ('aaaaaaaa-0000-4000-8000-00000000000a', now(), now() + interval '7 days')$q$));

-- ---------- what a signed-in person can and can't do ----------
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
select pg_temp.check('A reads A''s own trial', (select count(*) from trial_grants) = 1);
select pg_temp.check('A sees no one else''s trial', (select count(*) from trial_grants where user_id <> 'aaaaaaaa-0000-4000-8000-00000000000a') = 0);
select pg_temp.check('A can''t start a new trial', pg_temp.denied($q$insert into trial_grants (user_id, started_at, ends_at) values ('aaaaaaaa-0000-4000-8000-00000000000a', now(), now() + interval '7 days')$q$));
select pg_temp.check('A can''t move the trial', pg_temp.denied($q$update trial_grants set started_at = now() + interval '1 year', ends_at = now() + interval '1 year 7 days'$q$));
select pg_temp.check('A can''t delete the trial (to get a fresh one)', pg_temp.denied($q$delete from trial_grants$q$));
select pg_temp.check('A can''t grant themselves a plan', pg_temp.denied($q$insert into entitlements (user_id, plan, status, period_start, period_end, provider) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'ai', 'active', now(), now() + interval '1 year', 'me')$q$));
select pg_temp.check('A can''t apply a payment event', pg_temp.denied($q$select apply_payment_event('x', 'e1', 'aaaaaaaa-0000-4000-8000-00000000000a', 'purchase', 'ai', now(), now() + interval '1 year', null)$q$));
select pg_temp.check('A can''t ask about another account', pg_temp.denied($q$select access_for('bbbbbbbb-0000-4000-8000-00000000000b')$q$));
select pg_temp.check('A can''t read payment events', pg_temp.denied($q$select * from payment_events$q$));
select pg_temp.check('A can''t read abuse counters', pg_temp.denied($q$select * from abuse_counters$q$));
select pg_temp.check('A can''t call the abuse counter', pg_temp.denied($q$select abuse_hit('signup', '1.2.3.4', 60, 10)$q$));
select pg_temp.check('A can''t call the sign-up hook', pg_temp.denied($q$select hook_before_user_created('{}'::jsonb)$q$));
select pg_temp.check('A in a trial: app and AI, one track', (select my_access() @> '{"state":"trial","app":true,"ai":true,"tracks":1}'));
select pg_temp.check('the answer says when the trial ends', (select (my_access() ->> 'valid_until') is not null and (my_access() ->> 'trial_ends_at') = (my_access() ->> 'valid_until')));

select pg_temp.as_user('bbbbbbbb-0000-4000-8000-00000000000b');
select pg_temp.check('B''s trial ended: no app, no AI', (select my_access() @> '{"state":"expired","app":false,"ai":false,"tracks":0}'));
select pg_temp.as_user('cccccccc-0000-4000-8000-00000000000c');
select pg_temp.check('C in a trial without a confirmed email: app yes, AI no', (select my_access() @> '{"state":"trial","app":true,"ai":false,"email_verified":false}'));
reset role;

set role anon; select pg_temp.as_user('');
select pg_temp.check('anon can''t read trials', pg_temp.denied('select * from trial_grants'));
select pg_temp.check('anon can''t read plans', pg_temp.denied('select * from entitlements'));
select pg_temp.check('anon can''t call my_access', pg_temp.denied('select my_access()'));
reset role;

-- ---------- payments (service role) ----------
set role service_role;
select pg_temp.check('purchase Basic: applied', apply_payment_event('test', 'evt-1', 'bbbbbbbb-0000-4000-8000-00000000000b', 'purchase', 'basic', now(), now() + interval '1 year', 'sub-1') = 'applied');
select pg_temp.check('Basic: app yes, AI no, 50 tracks', access_for('bbbbbbbb-0000-4000-8000-00000000000b') @> '{"state":"basic","app":true,"ai":false,"tracks":50}');
select pg_temp.check('the same event again is a duplicate', apply_payment_event('test', 'evt-1', 'bbbbbbbb-0000-4000-8000-00000000000b', 'purchase', 'basic', now(), now() + interval '1 year', 'sub-1') = 'duplicate');
select pg_temp.check('the same event id from another provider is a different event', apply_payment_event('other', 'evt-1', 'bbbbbbbb-0000-4000-8000-00000000000b', 'payment_failed', null, null, null, null) = 'recorded');
select pg_temp.check('a duplicate is stored once', (select count(*) from payment_events where provider = 'test' and event_id = 'evt-1') = 1);
select pg_temp.check('a failed payment changes nothing', access_for('bbbbbbbb-0000-4000-8000-00000000000b') @> '{"state":"basic"}');
select pg_temp.check('upgrade to AI: applied', apply_payment_event('test', 'evt-2', 'bbbbbbbb-0000-4000-8000-00000000000b', 'purchase', 'ai', now(), now() + interval '1 year', 'sub-2') = 'applied');
select pg_temp.check('AI plan: app and AI', access_for('bbbbbbbb-0000-4000-8000-00000000000b') @> '{"state":"ai","app":true,"ai":true,"tracks":50}');
select pg_temp.check('a Basic purchase while AI runs is held for review', apply_payment_event('test', 'evt-3', 'bbbbbbbb-0000-4000-8000-00000000000b', 'purchase', 'basic', now(), now() + interval '1 year', 'sub-3') = 'needs_review');
select pg_temp.check('... and AI stays', access_for('bbbbbbbb-0000-4000-8000-00000000000b') @> '{"state":"ai"}');
select pg_temp.check('a late renewal for an older period is stale', apply_payment_event('test', 'evt-4', 'bbbbbbbb-0000-4000-8000-00000000000b', 'renewal', 'ai', now() - interval '1 year', now() + interval '1 day', 'sub-2') = 'stale');
select pg_temp.check('renewal extends the year', apply_payment_event('test', 'evt-5', 'bbbbbbbb-0000-4000-8000-00000000000b', 'renewal', 'ai', now() + interval '1 year', now() + interval '2 years', 'sub-2') = 'applied');
select pg_temp.check('... to the new end', (select period_end > now() + interval '23 months' from entitlements where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'));
select pg_temp.check('an expiry for the period before the renewal is stale', apply_payment_event('test', 'evt-6', 'bbbbbbbb-0000-4000-8000-00000000000b', 'expiry', null, null, now() + interval '1 year', 'sub-2') = 'stale');
select pg_temp.check('a refund about a replaced purchase is stale', apply_payment_event('test', 'evt-7', 'bbbbbbbb-0000-4000-8000-00000000000b', 'refund', null, null, null, 'sub-1') = 'stale');
select pg_temp.check('... and access stays', access_for('bbbbbbbb-0000-4000-8000-00000000000b') @> '{"state":"ai"}');
select pg_temp.check('a refund of the current purchase: applied', apply_payment_event('test', 'evt-8', 'bbbbbbbb-0000-4000-8000-00000000000b', 'refund', null, null, null, 'sub-2') = 'applied');
select pg_temp.check('refunded: no app, no AI, said why', access_for('bbbbbbbb-0000-4000-8000-00000000000b') @> '{"state":"refunded","app":false,"ai":false}');
select pg_temp.check('a new purchase after a refund restores access', apply_payment_event('test', 'evt-9', 'bbbbbbbb-0000-4000-8000-00000000000b', 'purchase', 'basic', now(), now() + interval '1 year', 'sub-9') = 'applied'
  and access_for('bbbbbbbb-0000-4000-8000-00000000000b') @> '{"state":"basic","app":true}');
select pg_temp.check('revocation: applied', apply_payment_event('test', 'evt-10', 'bbbbbbbb-0000-4000-8000-00000000000b', 'revocation', null, null, null, null) = 'applied'
  and access_for('bbbbbbbb-0000-4000-8000-00000000000b') @> '{"state":"revoked","app":false,"ai":false}');
select pg_temp.check('a purchase without a period is refused (so the provider retries)',
  pg_temp.raises($q$select apply_payment_event('test', 'evt-bad', 'bbbbbbbb-0000-4000-8000-00000000000b', 'purchase', 'ai', null, null, null)$q$));
select pg_temp.check('... and leaves no event behind', (select count(*) from payment_events where event_id = 'evt-bad') = 0);
select pg_temp.check('an event for an unknown account is kept and ignored', apply_payment_event('test', 'evt-11', 'eeeeeeee-0000-4000-8000-00000000000e', 'purchase', 'ai', now(), now() + interval '1 year', null) = 'no_account'
  and not exists (select 1 from entitlements where user_id = 'eeeeeeee-0000-4000-8000-00000000000e'));
select pg_temp.check('every event records its outcome', not exists (select 1 from payment_events where outcome = 'pending'));

-- A paid trial account: buying during the trial, then the plan lapses, while the trial still runs.
select pg_temp.check('buy AI during the trial', apply_payment_event('test', 'evt-20', 'aaaaaaaa-0000-4000-8000-00000000000a', 'purchase', 'ai', now() - interval '2 years', now() - interval '1 year', 'sub-20') = 'applied');
select pg_temp.check('a plan whose year has passed falls back to the running trial', access_for('aaaaaaaa-0000-4000-8000-00000000000a') @> '{"state":"trial"}');
reset role;
update trial_grants set started_at = now() - interval '8 days', ends_at = now() - interval '1 day' where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a';
select pg_temp.check('a year that passed with no event reads as expired (no job needed)', access_for('aaaaaaaa-0000-4000-8000-00000000000a') @> '{"state":"expired","app":false,"ai":false}');
set role service_role;
select pg_temp.check('renewing after expiry restores access', apply_payment_event('test', 'evt-21', 'aaaaaaaa-0000-4000-8000-00000000000a', 'renewal', 'ai', now(), now() + interval '1 year', 'sub-20') = 'applied'
  and access_for('aaaaaaaa-0000-4000-8000-00000000000a') @> '{"state":"ai","ai":true}');
select pg_temp.check('an expiry event for the current period ends it', apply_payment_event('test', 'evt-22', 'aaaaaaaa-0000-4000-8000-00000000000a', 'expiry', null, null, now() + interval '1 year', 'sub-20') = 'applied'
  and access_for('aaaaaaaa-0000-4000-8000-00000000000a') @> '{"state":"expired"}');

-- ---------- abuse counters and the sign-up hook ----------
-- The hook runs as Supabase's auth role (supabase_auth_admin), which this stub doesn't have: run it as the owner.
reset role;
-- A sign-up as Supabase Auth would make it: the hook first, then (if allowed) the account is created.
create or replace function pg_temp.sign_up(ip text, create_account boolean default true) returns jsonb language plpgsql as $$
declare uid uuid := gen_random_uuid(); r jsonb;
begin
  r := public.hook_before_user_created(jsonb_build_object('metadata', jsonb_build_object('ip_address', ip), 'user', jsonb_build_object('id', uid)));
  if r = '{}'::jsonb and create_account then insert into auth.users (id, email) values (uid, uid::text || '@x'); end if;
  return r;
end $$;
select pg_temp.check('failed attempts (weak password, email taken) use nothing up: 50 in a row still allowed',
  (select bool_and(pg_temp.sign_up('203.0.113.5', false) = '{}'::jsonb) from generate_series(1, 50)));
select pg_temp.check('30 new accounts an hour from one network are allowed',
  (select bool_and(pg_temp.sign_up('203.0.113.5') = '{}'::jsonb) from generate_series(1, 30)));
select pg_temp.check('the 31st waits: 429 with the marker the app recognises',
  pg_temp.sign_up('203.0.113.5') -> 'error' @> '{"http_code":429}' and pg_temp.sign_up('203.0.113.5') -> 'error' ->> 'message' like 'signup_rate_limited:%');
select pg_temp.check('a retry of an allowed sign-up isn''t counted against itself',
  public.hook_before_user_created(jsonb_build_object('metadata', jsonb_build_object('ip_address', '198.51.100.20'), 'user', jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-00000000000a'))) = '{}'::jsonb);
select pg_temp.check('another network is unaffected', pg_temp.sign_up('198.51.100.7') = '{}'::jsonb);
select pg_temp.check('only the 30 real accounts were recorded as counting this hour',
  (select count(*) from signup_attempts a join auth.users u on u.id = a.user_id where a.ip_hash = any (network_hashes('203.0.113.5')) and a.attempted_at > now() - interval '1 hour') = 30);
-- An hour passes.
update signup_attempts set attempted_at = now() - interval '61 minutes';
select pg_temp.check('... sign-up from it works again', pg_temp.sign_up('203.0.113.5') = '{}'::jsonb);
select pg_temp.check('the daily limit still counts everything in 24 hours',
  (select count(*) from signup_attempts a join auth.users u on u.id = a.user_id where a.attempted_at > now() - interval '1 day') >= 31);
update signup_limits set max_accounts = 32 where window_minutes = 1440;
select pg_temp.check('limits are tunable without a migration: a lower daily limit takes effect at once',
  pg_temp.sign_up('203.0.113.5') = '{}'::jsonb and pg_temp.sign_up('203.0.113.5') -> 'error' @> '{"http_code":429}');
update signup_limits set max_accounts = 100 where window_minutes = 1440;
-- IPv6: one device can rotate through its whole /64, so the /64 is the network.
update signup_limits set max_accounts = 2 where window_minutes = 60;
select pg_temp.check('IPv6 addresses in one /64 count together',
  pg_temp.sign_up('2001:db8:1:1::a') = '{}'::jsonb and pg_temp.sign_up('2001:db8:1:1::b') = '{}'::jsonb
  and pg_temp.sign_up('2001:db8:1:1:ffff::c') -> 'error' @> '{"http_code":429}');
select pg_temp.check('a different /64 is a different network', pg_temp.sign_up('2001:db8:1:2::a') = '{}'::jsonb);
update signup_limits set max_accounts = 30 where window_minutes = 60;
-- Rolling windows across midnight: an attempt hashed with yesterday's salt still counts today.
insert into abuse_salts (day, salt) values ((now() at time zone 'utc')::date - 1, 'yesterday') on conflict (day) do update set salt = 'yesterday';
select pg_temp.check('a network has today''s and yesterday''s hash', cardinality(network_hashes('192.0.2.77')) = 2);
update signup_limits set max_accounts = 1 where window_minutes = 1440;
insert into auth.users (id, email) values ('eeeeeeee-0000-4000-8000-0000000000e1', 'y@x');
insert into signup_attempts (ip_hash, user_id, attempted_at) values ((network_hashes('192.0.2.77'))[2], 'eeeeeeee-0000-4000-8000-0000000000e1', now() - interval '3 hours');
select pg_temp.check('an account made before midnight (yesterday''s salt) counts in the 24-hour window', pg_temp.sign_up('192.0.2.77') -> 'error' @> '{"http_code":429}');
update signup_limits set max_accounts = 100 where window_minutes = 1440;
select pg_temp.check('no address, or one that isn''t an address, is never refused',
  hook_before_user_created('{"metadata":{}}'::jsonb) = '{}'::jsonb and pg_temp.sign_up('not-an-ip') = '{}'::jsonb and pg_temp.sign_up('') = '{}'::jsonb
  and abuse_hit('trial_ai', null, 60, 0) and abuse_hit('trial_ai', 'garbage', 60, 0));
select pg_temp.check('a malformed user id is let through, not an error', hook_before_user_created('{"metadata":{"ip_address":"192.0.2.9"},"user":{"id":"nope"}}'::jsonb) = '{}'::jsonb);
-- Fails open: the hook's own tables gone (or any other error) never blocks sign-up.
alter table signup_attempts rename to signup_attempts_away;
select pg_temp.check('a broken rate limiter lets sign-up through', pg_temp.sign_up('203.0.113.5') = '{}'::jsonb);
alter table signup_attempts_away rename to signup_attempts;
alter table signup_limits rename to signup_limits_away;
select pg_temp.check('... whichever part is broken', pg_temp.sign_up('203.0.113.6') = '{}'::jsonb);
alter table signup_limits_away rename to signup_limits;
select pg_temp.check('no raw address is stored anywhere',
  not exists (select 1 from abuse_counters where ip_hash ~ '[.:]') and not exists (select 1 from signup_attempts where ip_hash ~ '[.:]')
  and not exists (select 1 from abuse_salts where salt like '%203.0.113%'));
select pg_temp.check('stored values are hashes', (select bool_and(ip_hash ~ '^[0-9a-f]{64}$') from signup_attempts) and coalesce((select bool_and(ip_hash ~ '^[0-9a-f]{64}$') from abuse_counters), true));
set role service_role;
select pg_temp.check('service role can''t call the sign-up hook', pg_temp.denied($q$select hook_before_user_created('{}'::jsonb)$q$));
reset role;
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
select pg_temp.check('signed-in people can''t read or change sign-up attempts or limits',
  pg_temp.denied('select * from signup_attempts') and pg_temp.denied('update signup_limits set max_accounts = 1000000') and pg_temp.denied($q$select network_hashes('1.2.3.4')$q$));
reset role;
insert into abuse_counters (kind, ip_hash, window_start, hits) values ('signup', repeat('a', 64), now() - interval '3 days', 99);
insert into signup_attempts (ip_hash, user_id, attempted_at) values (repeat('b', 64), gen_random_uuid(), now() - interval '3 days');
insert into abuse_salts (day, salt) values (current_date - 5, 'old');
set role service_role;
select abuse_hit('trial_ai', '192.0.2.1', 1440, 100);
reset role;
select pg_temp.sign_up('192.0.2.200');
select pg_temp.check('counters, attempts and salts older than two days are deleted',
  not exists (select 1 from abuse_counters where window_start < now() - interval '2 days') and not exists (select 1 from abuse_salts where day < current_date - 1)
  and not exists (select 1 from signup_attempts where attempted_at < now() - interval '2 days'));

-- ---------- recovery data is never gated ----------
-- B's access is revoked, yet B's rows still sync: no recovery policy, check or trigger looks at membership.
set role authenticated; select pg_temp.as_user('bbbbbbbb-0000-4000-8000-00000000000b');
insert into companions (id, user_id, species, name, born_on) values ('c0000000-0000-4000-8000-0000000000bb', 'bbbbbbbb-0000-4000-8000-00000000000b', 'dog', 'Biscuit', '2026-10-01');
insert into habits (id, user_id, companion_id, name, class, class_weight, unit, fields) values ('d0000000-0000-4000-8000-0000000000bb', 'bbbbbbbb-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-0000000000bb', 'Scrolling', 'doomscrolling', 0.8, 'minutes', '[]');
insert into habits (id, user_id, companion_id, name, class, class_weight, unit, fields) values ('d0000000-0000-4000-8000-0000000000bc', 'bbbbbbbb-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-0000000000bb', 'Second', 'custom', 1, 'none', '[]');
select pg_temp.check('a revoked account still backs up its recovery rows, any number of tracks', (select count(*) from habits) = 2 and (select count(*) from companions) = 1);
select pg_temp.check('... and reads them back', (select my_access() @> '{"app":false}') and (select count(*) from habits where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b') = 2);
reset role;

-- ---------- account deletion ----------
delete from auth.users where id = 'bbbbbbbb-0000-4000-8000-00000000000b';
select pg_temp.check('deleting the account removes its trial and plan', not exists (select 1 from trial_grants where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b') and not exists (select 1 from entitlements where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'));
select pg_temp.check('payment events stay, unlinked from anyone', (select count(*) from payment_events where provider = 'test' and event_id like 'evt-%' and event_id::text <> 'evt-11' and user_id is null) >= 9);
