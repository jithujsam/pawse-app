-- Dodo Payments (docs/MONETISATION.md §7, docs/DEPLOY_MEMBERSHIP.md). Extends 0014's one write path for plans,
-- apply_payment_event(), instead of adding a second one. Additive and safe to run more than once. No recovery table is
-- touched: membership still never gates a recovery row or its sync.
--
-- What it adds:
--  * payment_events keeps Dodo's customer and payment ids, when the event happened, and a short note on why an event
--    was held for review. A refund names only the payment it refunds, so a refund finds its account through the
--    payment.succeeded event recorded earlier (payment id → account and subscription), never through a guess.
--  * entitlements keeps the customer id, whether the subscription renews (false once cancelled), and the time of the
--    last event applied from its subscription, so an older event delivered late can't undo a newer one.
--  * new event kinds: payment (a successful charge, kept to map refunds), cancellation (renewal switched off; the paid
--    year still runs to its end) and partial_refund (held for review, access unchanged).
--  * events that would grant or end access but can't be tied to exactly one account are recorded as needs_review
--    with a note, and change nothing. An event naming one account for a subscription or payment that belongs to
--    another is never applied to either.

-- ---------- columns ----------

alter table public.payment_events add column if not exists provider_customer text check (provider_customer is null or char_length(provider_customer) <= 200);
alter table public.payment_events add column if not exists provider_payment text check (provider_payment is null or char_length(provider_payment) <= 200);
alter table public.payment_events add column if not exists event_at timestamptz;
alter table public.payment_events add column if not exists note text check (note is null or char_length(note) <= 200);
create index if not exists payment_events_payment on public.payment_events (provider, provider_payment) where provider_payment is not null;
create index if not exists payment_events_ref on public.payment_events (provider, provider_ref) where provider_ref is not null;

alter table public.entitlements add column if not exists provider_customer text check (provider_customer is null or char_length(provider_customer) <= 200);
-- true: renews at period_end; false: cancelled, runs to period_end and stops; null: not known (manual grants, 0014 rows).
alter table public.entitlements add column if not exists renews boolean;
alter table public.entitlements add column if not exists last_event_at timestamptz;
create index if not exists entitlements_ref on public.entitlements (provider, provider_ref) where provider_ref is not null;

-- Widen the kind check in place (whatever name it has), the same way 0014 widened trial_grants.source.
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.payment_events'::regclass and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table public.payment_events drop constraint %I', c);
  end loop;
end $$;
alter table public.payment_events add constraint payment_events_kind_check check (kind in
  ('purchase', 'renewal', 'payment_failed', 'expiry', 'refund', 'revocation', 'grant', 'payment', 'cancellation', 'partial_refund'));

-- ---------- the one trusted write path, extended ----------

-- 0014's eight-argument version is replaced by this one; the first eight arguments mean the same, so manual grants
-- and every existing caller work unchanged.
drop function if exists public.apply_payment_event(text, text, uuid, text, text, timestamptz, timestamptz, text);

/**
 * Applies one verified payment event. Called only by trusted server code after the provider's signature has been
 * checked (supabase/functions/_shared/payments.ts); never by the app. Returns what happened:
 *   duplicate     this (provider, event_id) was seen before; nothing changes (webhook retries are safe)
 *   applied       the plan changed
 *   recorded      kept for the audit only (a charge, a failed charge, a cancellation: the paid period still runs)
 *   stale         about an older purchase, period or moment than the current one; kept, ignored
 *   needs_review  kept, changes nothing, with a note: a lower plan or a second subscription while one is active, a
 *                 partial refund, an event that can't be tied to an account, or one whose account disagrees with
 *                 the account its subscription or payment already belongs to
 *   no_account    the account is gone; kept anonymously, ignored
 *
 * The account is p_user (from the checkout's metadata) or, when the event carries none (renewals, refunds), the
 * account its subscription (p_provider_ref) or payment (p_payment_ref) was first recorded for. A refund that names
 * only a payment takes that payment's subscription as its p_provider_ref.
 * Raises on malformed input so the caller can answer the provider with an error and be retried.
 */
create or replace function public.apply_payment_event(
  p_provider text, p_event_id text, p_user uuid, p_kind text, p_plan text,
  p_period_start timestamptz, p_period_end timestamptz, p_provider_ref text,
  p_payment_ref text default null, p_customer_ref text default null, p_event_at timestamptz default null, p_renews boolean default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev bigint;
  e public.entitlements%rowtype;
  v_outcome text;
  v_note text;
  v_user uuid := p_user;
  v_ref text := p_provider_ref;
  linked uuid;
  linked_ref text;
  known boolean;
  same_sub boolean := false;
  rank_new int := case p_plan when 'ai' then 2 when 'basic' then 1 else 0 end;
  rank_cur int;
begin
  if p_kind in ('purchase', 'renewal', 'grant') and (p_plan is null or p_period_start is null or p_period_end is null or p_period_end <= p_period_start) then
    raise exception 'a % needs a plan and a valid period', p_kind using errcode = '22023';
  end if;

  -- Whose subscription or payment is this, from what was recorded before?
  if p_provider_ref is not null then
    select user_id into linked from public.entitlements where provider = p_provider and provider_ref = p_provider_ref;
    if linked is null then
      select user_id into linked from public.payment_events
      where provider = p_provider and provider_ref = p_provider_ref and user_id is not null order by id limit 1;
    end if;
  end if;
  if linked is null and p_payment_ref is not null then
    select user_id, provider_ref into linked, linked_ref from public.payment_events
    where provider = p_provider and provider_payment = p_payment_ref and kind = 'payment' and user_id is not null order by id limit 1;
    v_ref := coalesce(v_ref, linked_ref);
  end if;
  if v_user is not null and linked is not null and linked <> v_user then
    -- Never apply to either account: the metadata and the history disagree.
    v_outcome := 'needs_review'; v_note := 'account_mismatch'; v_user := null;
  elsif v_user is null then
    v_user := linked;
  end if;
  known := v_user is not null and exists (select 1 from auth.users where id = v_user);

  insert into public.payment_events (provider, event_id, user_id, kind, plan, period_start, period_end, provider_ref,
    provider_customer, provider_payment, event_at)
  values (p_provider, p_event_id, case when known then v_user end, p_kind, p_plan, p_period_start, p_period_end, v_ref,
    p_customer_ref, p_payment_ref, p_event_at)
  on conflict (provider, event_id) do nothing
  returning id into ev;
  if ev is null then return 'duplicate'; end if;

  if v_outcome is not null then
    null; -- decided above
  elsif not known then
    if v_user is null and p_kind in ('purchase', 'renewal', 'payment', 'refund', 'partial_refund', 'revocation') then
      v_outcome := 'needs_review'; v_note := 'no_account_link';
    else
      v_outcome := 'no_account';
    end if;
  else
    -- One event at a time per account, so two webhooks racing can't both read the old row.
    select * into e from public.entitlements where user_id = v_user for update;
    rank_cur := case when e.user_id is not null and e.status = 'active' and e.period_end > now() then (case e.plan when 'ai' then 2 else 1 end) else 0 end;
    same_sub := e.user_id is not null and v_ref is not null and e.provider_ref is not null and e.provider = p_provider and v_ref = e.provider_ref;

    if same_sub and p_event_at is not null and e.last_event_at is not null and p_event_at < e.last_event_at
       and p_kind in ('purchase', 'renewal', 'cancellation', 'expiry') then
      v_outcome := 'stale'; -- older than the last event applied from this subscription
    elsif p_kind in ('purchase', 'renewal', 'grant') then
      if e.user_id is null then
        insert into public.entitlements (user_id, plan, status, period_start, period_end, provider, provider_ref, provider_customer, renews, last_event_at)
        values (v_user, p_plan, 'active', p_period_start, p_period_end, p_provider, v_ref, p_customer_ref, p_renews, p_event_at);
        v_outcome := 'applied';
      elsif rank_new < rank_cur and not same_sub then
        v_outcome := 'needs_review'; v_note := 'lower_plan_while_active';
      elsif rank_new = rank_cur and p_kind = 'purchase' and not same_sub and v_ref is not null and e.provider_ref is not null and e.provider = p_provider then
        v_outcome := 'needs_review'; v_note := 'second_subscription';
      elsif rank_new = rank_cur and p_period_end <= e.period_end then
        v_outcome := 'stale'; -- an older period arriving late: the current one already covers it
      else
        -- A higher plan, a later period, or (same subscription) a plan change down: apply it.
        update public.entitlements set plan = p_plan, status = 'active',
          period_start = case when rank_new = rank_cur then least(e.period_start, p_period_start) else p_period_start end,
          period_end = p_period_end, provider = p_provider, provider_ref = coalesce(v_ref, e.provider_ref),
          provider_customer = coalesce(p_customer_ref, case when same_sub then e.provider_customer end),
          renews = coalesce(p_renews, case when same_sub then e.renews end),
          last_event_at = case when same_sub then greatest(e.last_event_at, p_event_at) else p_event_at end,
          updated_at = now()
        where user_id = v_user;
        v_outcome := 'applied';
      end if;
    elsif p_kind in ('payment', 'payment_failed', 'cancellation') then
      v_outcome := 'recorded';
    elsif p_kind = 'partial_refund' then
      v_outcome := 'needs_review'; v_note := 'partial_refund';
    elsif e.user_id is null then
      v_outcome := 'stale';
    elsif v_ref is null and p_payment_ref is not null and e.provider_ref is not null then
      v_outcome := 'needs_review'; v_note := 'refund_without_subscription'; -- can't tell which purchase it was for
    elsif v_ref is not null and e.provider_ref is not null and v_ref <> e.provider_ref then
      v_outcome := 'stale'; -- about a purchase that has since been replaced
    elsif p_kind = 'expiry' and p_period_end is not null and p_period_end < e.period_end then
      v_outcome := 'stale'; -- the end of a period that has since been renewed
    else
      update public.entitlements set status = case p_kind when 'expiry' then 'expired' when 'refund' then 'refunded' else 'revoked' end,
        renews = false,
        updated_at = now()
      where user_id = v_user;
      v_outcome := 'applied';
    end if;

    -- Whether the subscription renews (a cancellation, or subscription.updated), when nothing else changed the row.
    if p_renews is not null and same_sub and v_outcome in ('recorded', 'stale')
       and (p_event_at is null or e.last_event_at is null or p_event_at >= e.last_event_at) then
      update public.entitlements set renews = p_renews, last_event_at = greatest(e.last_event_at, p_event_at), updated_at = now()
      where user_id = v_user;
    end if;
  end if;

  update public.payment_events set outcome = v_outcome, note = v_note where id = ev;
  return v_outcome;
end;
$$;
revoke all on function public.apply_payment_event(text, text, uuid, text, text, timestamptz, timestamptz, text, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, uuid, text, text, timestamptz, timestamptz, text, text, text, timestamptz, boolean) to service_role;

-- Events held for review, newest first, for the owner (service role / SQL editor only; RLS has no policy for it).
create or replace view public.payment_events_review with (security_invoker = true) as
  select id, provider, event_id, kind, plan, provider_ref, provider_payment, provider_customer, note, event_at, received_at
  from public.payment_events where outcome = 'needs_review' order by id desc;
revoke all on public.payment_events_review from public, anon, authenticated;
grant select on public.payment_events_review to service_role;
