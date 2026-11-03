-- Sets the official membership launch date and re-dates every trial by the launch rule (PRD §25.1): a trial starts at
-- the later of the account's registration and the launch. Use ONLY while no build that enforces membership is live
-- (no APK with the paywall released, AI function not yet deployed), and only after 0014 is applied. Run with:
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v launch='2026-12-01 00:00:00+00' -f supabase/deploy/membership/03-set-launch.sql
-- One transaction: either every trial moves or none does. Touches only membership_launch and trial_grants.
\if :{?launch}
\else
  \echo 'Set the launch date: -v launch=''YYYY-MM-DD HH:MM:SS+00'''
  \quit
\endif
begin;
update public.membership_launch set launch_at = :'launch'::timestamptz;
update public.trial_grants g
   set started_at = public.trial_start(u.created_at),
       ends_at    = public.trial_start(u.created_at) + interval '7 days',
       source     = case when public.trial_start(u.created_at) > u.created_at then 'launch' else 'signup' end
  from auth.users u
 where u.id = g.user_id;
select launch_at from public.membership_launch;
select source, count(*), min(started_at), max(ends_at) from public.trial_grants group by 1 order by 1;
commit;
