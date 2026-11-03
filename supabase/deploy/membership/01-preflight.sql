-- READ-ONLY pre-flight for the membership deployment (docs/DEPLOY_MEMBERSHIP.md, step 2). Changes nothing: the whole
-- session is a read-only transaction that is rolled back. Run with:
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/deploy/membership/01-preflight.sql > preflight.txt
-- Prints no email addresses.
begin transaction read only;

\echo '== accounts and trials'
select (select count(*) from auth.users) as users,
       (select count(*) from public.trial_grants) as trials,
       (select count(*) from auth.users u where not exists (select 1 from public.trial_grants g where g.user_id = u.id)) as users_without_trial,
       (select count(*) from public.trial_grants g where not exists (select 1 from auth.users u where u.id = g.user_id)) as trials_without_user,
       (select count(*) from auth.users where email_confirmed_at is null) as unconfirmed_emails;

\echo '== trial rows by source (before 0014: an earlier version wrote launch rows in advance)'
select source, count(*), min(started_at), max(ends_at) from public.trial_grants group by 1 order by 1;
select to_regclass('public.membership_launch') is not null as old_launch_date_table_present;

\echo '== every trial (no emails)'
select g.source, u.created_at as registered, g.started_at, g.ends_at, g.created_at as granted_at,
       u.email_confirmed_at is not null as email_confirmed, g.ends_at > now() as active
from public.trial_grants g join auth.users u on u.id = g.user_id order by u.created_at;

\echo '== plans and payment events (expected 0 and 0)'
select (select count(*) from public.entitlements) as entitlements, (select count(*) from public.payment_events) as payment_events;

\echo '== membership tables, constraints, indexes, policies'
select conrelid::regclass as tbl, conname, pg_get_constraintdef(oid) as def from pg_constraint
where connamespace = 'public'::regnamespace
  and conrelid::regclass::text in ('trial_grants','entitlements','payment_events','abuse_salts','abuse_counters','membership_launch','signup_attempts','signup_limits','ai_cache')
order by 1, 2;
select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename in ('trial_grants','entitlements','payment_events','abuse_salts','abuse_counters','membership_launch','signup_attempts','signup_limits') order by 1, 2;
select tablename, policyname, cmd, roles, qual from pg_policies where schemaname = 'public' order by 1, 2;
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
  and table_name in ('trial_grants','entitlements','payment_events','abuse_salts','abuse_counters','membership_launch','signup_attempts','signup_limits')
group by 1, 2 order by 1, 2;

\echo '== public functions: owner, security definer, grants, definition fingerprint'
select p.oid::regprocedure as fn, p.prosecdef as definer, pg_get_userbyid(p.proowner) as owner, p.proacl::text as acl,
       md5(pg_get_functiondef(p.oid)) as def_md5
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' order by 1;

\echo '== triggers on auth.users, and event triggers'
select tgname, tgenabled, pg_get_triggerdef(oid) from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
select evtname, evtevent, evtenabled, evtfoid::regproc from pg_event_trigger;

\echo '== rls_auto_enable, if present'
select pg_get_functiondef(p.oid) from pg_proc p where p.proname = 'rls_auto_enable' and p.pronamespace = 'public'::regnamespace;

\echo '== personality check and Brutal pets; views; ai_cache kinds'
select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.companions'::regclass and pg_get_constraintdef(oid) ilike '%personality%';
select count(*) filter (where personality = 'savage') as brutal_pets from public.companions;
select viewname from pg_views where schemaname = 'public';
select kind, count(*) from public.ai_cache group by 1;

\echo '== recorded migration history'
select version, name from supabase_migrations.schema_migrations order by version;

rollback;
