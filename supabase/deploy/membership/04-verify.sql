-- READ-ONLY checks after 0014, 0015 and (the three 'after 0016' lines) 0016. Every "expect" must hold. (access_for isn't called here:
-- it can create a missing trial row, which a read-only check must never do.)
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/deploy/membership/04-verify.sql
begin transaction read only;
select 'existing accounts still waiting for their first access (no trial yet; fine)' as check, count(*)::text as result from auth.users u where not exists (select 1 from public.trial_grants g where g.user_id = u.id)
union all select 'trials by source (launch = an existing account whose trial starts at its first access)', coalesce(string_agg(source || ':' || n, ', ' order by source), 'none') from (select source, count(*) n from public.trial_grants group by 1) x
union all select 'new-account trials not starting at creation (expect 0)', count(*)::text from public.trial_grants g join auth.users u on u.id = g.user_id where g.source = 'signup' and g.started_at <> u.created_at
union all select 'trials not exactly 7 days (expect 0)', count(*)::text from public.trial_grants where ends_at <> started_at + interval '7 days'
union all select 'old launch-date table and functions gone (expect true)', (to_regclass('public.membership_launch') is null and to_regprocedure('public.trial_start(timestamptz)') is null and to_regprocedure('public.set_membership_launch(timestamptz)') is null)::text
union all select 'signup limits (expect 60m:30, 1440m:100)', string_agg(window_minutes || 'm:' || max_accounts, ', ' order by window_minutes) from public.signup_limits
union all select 'membership functions present (expect 8)', count(*)::text from pg_proc where pronamespace = 'public'::regnamespace and proname in
  ('access_for','my_access','apply_payment_event','abuse_hit','network_key','network_hashes','hook_before_user_created','grant_trial')
union all select 'after 0016: apply_payment_event takes payment, customer, time and renewal (expect true)', (to_regprocedure('public.apply_payment_event(text,text,uuid,text,text,timestamptz,timestamptz,text,text,text,timestamptz,boolean)') is not null)::text
union all select 'after 0016: no eight-argument apply_payment_event left (expect true)', (to_regprocedure('public.apply_payment_event(text,text,uuid,text,text,timestamptz,timestamptz,text)') is null)::text
union all select 'after 0016: anon/authenticated can call apply_payment_event (expect false)', (has_function_privilege('authenticated', 'public.apply_payment_event(text,text,uuid,text,text,timestamptz,timestamptz,text,text,text,timestamptz,boolean)', 'execute') or has_function_privilege('anon', 'public.apply_payment_event(text,text,uuid,text,text,timestamptz,timestamptz,text,text,text,timestamptz,boolean)', 'execute'))::text
union all select 'trial trigger on auth.users (expect 1)', count(*)::text from pg_trigger where tgname = 'on_auth_user_created_grant_trial' and tgrelid = 'auth.users'::regclass
union all select 'ai_cache kinds allowed (expect slip, weekly, pet)', pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.ai_cache'::regclass and conname = 'ai_cache_kind_check'
union all select 'anon/authenticated can write membership tables (expect 0)', count(*)::text from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
  and table_name in ('trial_grants','entitlements','payment_events','abuse_salts','abuse_counters','membership_launch','signup_attempts','signup_limits');
rollback;
