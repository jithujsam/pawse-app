-- READ-ONLY checks after 0014, 0015 and 03-set-launch.sql. Every "expect" must hold. (access_for isn't called here:
-- it can create a missing trial row, which a read-only check must never do.)
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/deploy/membership/04-verify.sql
begin transaction read only;
select 'accounts without a trial (expect 0)' as check, count(*)::text as result from auth.users u where not exists (select 1 from public.trial_grants g where g.user_id = u.id)
union all select 'trials not at greatest(registration, launch) (expect 0)', count(*)::text from public.trial_grants g join auth.users u on u.id = g.user_id where g.started_at <> public.trial_start(u.created_at)
union all select 'trials not exactly 7 days (expect 0)', count(*)::text from public.trial_grants where ends_at <> started_at + interval '7 days'
union all select 'launch date', launch_at::text from public.membership_launch
union all select 'signup limits (expect 60m:30, 1440m:100)', string_agg(window_minutes || 'm:' || max_accounts, ', ' order by window_minutes) from public.signup_limits
union all select 'membership functions present (expect 10)', count(*)::text from pg_proc where pronamespace = 'public'::regnamespace and proname in
  ('access_for','my_access','apply_payment_event','abuse_hit','network_key','network_hashes','hook_before_user_created','trial_start','set_membership_launch','grant_trial')
union all select 'trial trigger on auth.users (expect 1)', count(*)::text from pg_trigger where tgname = 'on_auth_user_created_grant_trial' and tgrelid = 'auth.users'::regclass
union all select 'ai_cache kinds allowed (expect slip, weekly, pet)', pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.ai_cache'::regclass and conname = 'ai_cache_kind_check'
union all select 'anon/authenticated can write membership tables (expect 0)', count(*)::text from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
  and table_name in ('trial_grants','entitlements','payment_events','abuse_salts','abuse_counters','membership_launch','signup_attempts','signup_limits');
rollback;
