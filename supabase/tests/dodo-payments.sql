-- Dodo Payments lifecycle through apply_payment_event (0016): purchases, renewals, plan changes, cancellation, expiry,
-- refunds found through their payment, wrong-account mapping, duplicates, and recovery data never touched.
-- Run on a fresh local Postgres after local-auth-stub.sql and every migration in order (0001 to 0016).
-- Each check prints PASS or FAIL.
\set ON_ERROR_STOP 1
create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when coalesce(ok, false) then 'PASS' else 'FAIL' end, name; end $$;
create or replace function pg_temp.state(u uuid) returns text language sql as $$ select public.access_for(u) ->> 'state' $$;
create or replace function pg_temp.note(eid text) returns text language sql as $$ select note from public.payment_events where provider = 'dodo' and event_id = eid $$;
create temp table clock as select now() as t0;
create or replace function pg_temp.t0() returns timestamptz language sql stable as $$ select t0 from clock $$;
grant select on clock to service_role;
grant execute on all functions in schema pg_temp to service_role;

-- T: the dedicated test account. O: another account (the "wrong account"). Both past their trial.
insert into auth.users (id, email, created_at) values ('11111111-0000-4000-8000-000000000001', 'test@x', pg_temp.t0() - interval '30 days');
insert into auth.users (id, email, created_at) values ('22222222-0000-4000-8000-000000000002', 'other@x', pg_temp.t0() - interval '30 days');
-- A recovery row for T, to prove payments never touch it.
insert into public.companions (id, user_id, species, name, born_on) values ('c3333333-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', 'dog', 'Biscuit', '2026-10-01');
insert into public.habits (id, user_id, companion_id, name, class, class_weight, unit, fields) values ('33333333-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', 'c3333333-0000-4000-8000-000000000003', 'Scrolling', 'doomscrolling', 0.8, 'minutes', '[]');
-- AI text written while AI was included: a slip's explanation and a weekly summary.
insert into public.entries (id, user_id, habit_id, companion_id, occurred_on, client_created_at) values ('55555555-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000003', 'c3333333-0000-4000-8000-000000000003', '2026-10-02', 1);
insert into public.deductions (entry_id, user_id, months_lost, severity, explanation, source) values ('55555555-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000001', 1, 1, 'Biscuit noticed the late order.', 'ai');
insert into public.weekly_reports (habit_id, week_start, user_id, summary) values ('33333333-0000-4000-8000-000000000003', '2026-09-28', '11111111-0000-4000-8000-000000000001', 'A steadier week.');
create temp table recovery_before as select * from public.habits where user_id = '11111111-0000-4000-8000-000000000001';
grant select on recovery_before to service_role;

set role service_role;
\set T '''11111111-0000-4000-8000-000000000001'''
\set O '''22222222-0000-4000-8000-000000000002'''
select pg_temp.check('before paying: T is expired (trial over)', pg_temp.state(:T) = 'expired');

-- ---------- purchase: Basic ----------
select pg_temp.check('payment.succeeded is recorded and maps pay_1 to T and sub_B',
  apply_payment_event('dodo', 'msg_1', :T, 'payment', null, null, null, 'sub_B', 'pay_1', 'cus_1', pg_temp.t0() - interval '10 minutes') = 'recorded');
select pg_temp.check('... and grants nothing by itself', pg_temp.state(:T) = 'expired');
select pg_temp.check('subscription.active Basic: applied',
  apply_payment_event('dodo', 'msg_2', :T, 'purchase', 'basic', pg_temp.t0(), pg_temp.t0() + interval '1 year', 'sub_B', null, 'cus_1', pg_temp.t0() - interval '9 minutes', true) = 'applied');
select pg_temp.check('Basic: app yes, AI no', access_for(:T) @> '{"state":"basic","app":true,"ai":false}');
select pg_temp.check('customer and subscription ids are stored',
  (select provider_customer = 'cus_1' and provider_ref = 'sub_B' and renews from entitlements where user_id = :T));
select pg_temp.check('duplicate webhook (same id): duplicate, stored once', apply_payment_event('dodo', 'msg_2', :T, 'purchase', 'basic', pg_temp.t0(), pg_temp.t0() + interval '1 year', 'sub_B', null, 'cus_1', pg_temp.t0() - interval '9 minutes', true) = 'duplicate');
select pg_temp.check('duplicate webhook (same id): duplicate, stored once: after', (select count(*) from payment_events where event_id = 'msg_2') = 1);
select pg_temp.check('one entitlement row per account, always', (select count(*) from entitlements where user_id = :T) = 1);
select pg_temp.check('a second Basic subscription while Basic runs: held for review, not stacked', apply_payment_event('dodo', 'msg_3', :T, 'purchase', 'basic', pg_temp.t0(), pg_temp.t0() + interval '1 year', 'sub_B2', null, 'cus_1', pg_temp.t0() - interval '8 minutes', true) = 'needs_review');
select pg_temp.check('a second Basic subscription while Basic runs: held for review, not stacked: after', pg_temp.note('msg_3') = 'second_subscription' and (select provider_ref from entitlements where user_id = :T) = 'sub_B');

-- ---------- upgrade and downgrade on the same subscription ----------
select pg_temp.check('subscription.plan_changed to AI: applied at once', apply_payment_event('dodo', 'msg_4', null, 'purchase', 'ai', pg_temp.t0(), pg_temp.t0() + interval '1 year', 'sub_B', null, null, pg_temp.t0() - interval '7 minutes', true) = 'applied');
select pg_temp.check('subscription.plan_changed to AI: applied at once: after', access_for(:T) @> '{"state":"ai","ai":true}');
select pg_temp.check('... found T through its subscription (no metadata needed)', (select user_id from payment_events where event_id = 'msg_4') = :T::uuid);
select pg_temp.check('an older subscription.active (Basic) delivered late is stale and doesn''t downgrade', apply_payment_event('dodo', 'msg_5', :T, 'purchase', 'basic', pg_temp.t0(), pg_temp.t0() + interval '1 year', 'sub_B', null, null, pg_temp.t0() - interval '9 minutes', true) = 'stale');
select pg_temp.check('an older subscription.active (Basic) delivered late is stale and doesn''t downgrade: after', pg_temp.state(:T) = 'ai');
select pg_temp.check('subscription.plan_changed down to Basic (newer, same subscription): applied', apply_payment_event('dodo', 'msg_6', null, 'purchase', 'basic', pg_temp.t0(), pg_temp.t0() + interval '1 year', 'sub_B', null, null, pg_temp.t0() - interval '6 minutes', true) = 'applied');
select pg_temp.check('subscription.plan_changed down to Basic (newer, same subscription): applied: after', pg_temp.state(:T) = 'basic');
select pg_temp.check('a Basic purchase on another subscription while AI runs is still held for review', apply_payment_event('dodo', 'msg_7', null, 'purchase', 'ai', pg_temp.t0(), pg_temp.t0() + interval '1 year', 'sub_B', null, null, pg_temp.t0() - interval '5 minutes', true) = 'applied');
select pg_temp.check('a Basic purchase on another subscription while AI runs is still held for review (2)', apply_payment_event('dodo', 'msg_8', :T, 'purchase', 'basic', pg_temp.t0(), pg_temp.t0() + interval '1 year', 'sub_X', null, null, pg_temp.t0() - interval '5 minutes', true) = 'needs_review');
select pg_temp.check('a Basic purchase on another subscription while AI runs is still held for review: after', pg_temp.note('msg_8') = 'lower_plan_while_active' and pg_temp.state(:T) = 'ai');

-- ---------- renewal ----------
select pg_temp.check('subscription.renewed (no metadata) extends the year, found by subscription', apply_payment_event('dodo', 'msg_9', null, 'renewal', 'ai', pg_temp.t0() + interval '1 year', pg_temp.t0() + interval '2 years', 'sub_B', null, null, pg_temp.t0() - interval '4 minutes', true) = 'applied');
select pg_temp.check('subscription.renewed (no metadata) extends the year, found by subscription: after', (select period_end > pg_temp.t0() + interval '23 months' from entitlements where user_id = :T));
select pg_temp.check('subscription.updated with the same period: stale, nothing changes',
  apply_payment_event('dodo', 'msg_10', null, 'purchase', 'ai', pg_temp.t0() + interval '1 year', pg_temp.t0() + interval '2 years', 'sub_B', null, null, pg_temp.t0() - interval '3 minutes', true) = 'stale');
select pg_temp.check('subscription.on_hold / failed / payment.failed: recorded, access runs to the paid end', apply_payment_event('dodo', 'msg_11', null, 'payment_failed', 'ai', null, null, 'sub_B', 'pay_f', null, pg_temp.t0() - interval '3 minutes') = 'recorded');
select pg_temp.check('subscription.on_hold / failed / payment.failed: recorded, access runs to the paid end: after', pg_temp.state(:T) = 'ai');

-- ---------- cancellation and expiry ----------
select pg_temp.check('subscription.cancelled: recorded, renewal off, access kept to the end of the year', apply_payment_event('dodo', 'msg_12', null, 'cancellation', 'ai', null, null, 'sub_B', null, null, pg_temp.t0() - interval '2 minutes', false) = 'recorded');
select pg_temp.check('subscription.cancelled: recorded, renewal off, access kept to the end of the year: after', (select renews = false from entitlements where user_id = :T) and pg_temp.state(:T) = 'ai');
select pg_temp.check('subscription.expired for an earlier period: stale', apply_payment_event('dodo', 'msg_13', null, 'expiry', null, null, pg_temp.t0() + interval '1 year', 'sub_B', null, null, pg_temp.t0() - interval '1 minute') = 'stale');
select pg_temp.check('subscription.expired for an earlier period: stale: after', pg_temp.state(:T) = 'ai');
select pg_temp.check('subscription.expired for the current period: access ends', apply_payment_event('dodo', 'msg_14', null, 'expiry', null, null, pg_temp.t0() + interval '2 years', 'sub_B', null, null, pg_temp.t0()) = 'applied');
select pg_temp.check('subscription.expired for the current period: access ends: after', access_for(:T) @> '{"state":"expired","app":false,"ai":false}');

-- ---------- refunds ----------
select pg_temp.check('resubscribe (new subscription sub_C) restores access', apply_payment_event('dodo', 'msg_20', :T, 'payment', null, null, null, 'sub_C', 'pay_2', 'cus_1', pg_temp.t0()) = 'recorded');
select pg_temp.check('resubscribe (new subscription sub_C) restores access (2)', apply_payment_event('dodo', 'msg_21', :T, 'purchase', 'ai', pg_temp.t0(), pg_temp.t0() + interval '1 year', 'sub_C', null, 'cus_1', pg_temp.t0(), true) = 'applied');
select pg_temp.check('resubscribe (new subscription sub_C) restores access: after', pg_temp.state(:T) = 'ai');
select pg_temp.check('a partial refund: held for review, access unchanged', apply_payment_event('dodo', 'msg_22', null, 'partial_refund', null, null, null, null, 'pay_2', 'cus_1', pg_temp.t0()) = 'needs_review');
select pg_temp.check('a partial refund: held for review, access unchanged: after', pg_temp.note('msg_22') = 'partial_refund' and pg_temp.state(:T) = 'ai');
select pg_temp.check('a refund of an old payment (pay_1, replaced subscription sub_B): stale, access kept', apply_payment_event('dodo', 'msg_23', null, 'refund', null, null, null, null, 'pay_1', 'cus_1', pg_temp.t0()) = 'stale');
select pg_temp.check('a refund of an old payment (pay_1, replaced subscription sub_B): stale, access kept: after', pg_temp.state(:T) = 'ai');
select pg_temp.check('a refund nobody can trace (unknown payment): held for review, nobody loses access', apply_payment_event('dodo', 'msg_24', null, 'refund', null, null, null, null, 'pay_unknown', 'cus_9', pg_temp.t0()) = 'needs_review');
select pg_temp.check('a refund nobody can trace (unknown payment): held for review, nobody loses access: after', pg_temp.note('msg_24') = 'no_account_link' and pg_temp.state(:T) = 'ai' and (select user_id from payment_events where event_id = 'msg_24') is null);
select pg_temp.check('a refund of the current payment (pay_2 → sub_C → T): access ends at once', apply_payment_event('dodo', 'msg_25', null, 'refund', null, null, null, null, 'pay_2', 'cus_1', pg_temp.t0()) = 'applied');
select pg_temp.check('a refund of the current payment (pay_2 → sub_C → T): access ends at once: after', access_for(:T) @> '{"state":"refunded","app":false,"ai":false}');
select pg_temp.check('... recorded against T and sub_C', (select user_id = :T::uuid and provider_ref = 'sub_C' from payment_events where event_id = 'msg_25'));
select pg_temp.check('the refund stays: the plan reads refunded',
  (select status from entitlements where user_id = :T) = 'refunded');

-- ---------- wrong account mapping ----------
select pg_temp.check('an event claiming O for T''s subscription: held for review, applied to neither', apply_payment_event('dodo', 'msg_30', :O, 'purchase', 'ai', pg_temp.t0(), pg_temp.t0() + interval '1 year', 'sub_C', null, null, pg_temp.t0(), true) = 'needs_review');
select pg_temp.check('an event claiming O for T''s subscription: held for review, applied to neither: after', pg_temp.note('msg_30') = 'account_mismatch'
  and not exists (select 1 from entitlements where user_id = :O) and pg_temp.state(:T) = 'refunded'
  and (select user_id from payment_events where event_id = 'msg_30') is null);
select pg_temp.check('a payment claiming O for T''s payment id: held for review', apply_payment_event('dodo', 'msg_31', :O, 'refund', null, null, null, null, 'pay_2', null, pg_temp.t0()) = 'needs_review');
select pg_temp.check('a payment claiming O for T''s payment id: held for review: after', pg_temp.note('msg_31') = 'account_mismatch');
select pg_temp.check('a paid subscription with no account at all: held for review, nothing granted', apply_payment_event('dodo', 'msg_32', null, 'purchase', 'ai', pg_temp.t0(), pg_temp.t0() + interval '1 year', 'sub_orphan', null, 'cus_7', pg_temp.t0(), true) = 'needs_review');
select pg_temp.check('a paid subscription with no account at all: held for review, nothing granted: after', not exists (select 1 from entitlements where provider_ref = 'sub_orphan'));
select pg_temp.check('O''s own purchase still works', apply_payment_event('dodo', 'msg_33', :O, 'purchase', 'basic', pg_temp.t0(), pg_temp.t0() + interval '1 year', 'sub_O', null, 'cus_O', pg_temp.t0(), true) = 'applied');
select pg_temp.check('O''s own purchase still works: after', pg_temp.state(:O) = 'basic');
select pg_temp.check('the review list shows what needs a person', (select count(*) from payment_events_review) >= 6);

-- ---------- the success URL without paying ----------
-- Opening the return URL calls nothing on the server: only signed events reach apply_payment_event. Nothing above
-- ran for "returned"; the account's access is what the events made it.
select pg_temp.check('every event records its outcome', not exists (select 1 from payment_events where outcome = 'pending'));
reset role;

-- ---------- recovery data and privileges ----------
select pg_temp.check('T''s recovery rows are exactly as before every payment event',
  (select count(*) from public.habits h join recovery_before b using (id) where h is not distinct from b) = (select count(*) from recovery_before));
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-0000-4000-8000-000000000001', false);
select pg_temp.check('a refunded account still reads and writes its recovery rows',
  (select count(*) from public.habits) = 1);
insert into public.habits (id, user_id, companion_id, name, class, class_weight, unit, fields) values ('44444444-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000001', 'c3333333-0000-4000-8000-000000000003', 'Second', 'smoking', 1, 'count', '[]');
select pg_temp.check('... insert accepted', (select count(*) from public.habits) = 2);
select pg_temp.check('a refunded account still reads its past AI slip explanation', (select explanation from public.deductions) = 'Biscuit noticed the late order.');
select pg_temp.check('a refunded account still reads its past weekly AI summary', (select summary from public.weekly_reports) = 'A steadier week.');
create or replace function pg_temp.denied(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when insufficient_privilege then return true; end $$;
select pg_temp.check('the app can''t call apply_payment_event',
  pg_temp.denied($q$select apply_payment_event('dodo', 'x', '11111111-0000-4000-8000-000000000001', 'grant', 'ai', pg_temp.t0(), pg_temp.t0() + interval '1 year', null)$q$));
select pg_temp.check('the app can''t read payment events or the review list',
  pg_temp.denied('select * from payment_events') and pg_temp.denied('select * from payment_events_review'));
select pg_temp.check('the app reads its own plan with the new columns', (select renews = false from entitlements) and (select count(*) from entitlements) = 1);
reset role;
