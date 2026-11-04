-- Rollback of 0016 (Dodo Payments): puts back 0014's eight-argument apply_payment_event(), exactly as 0014 wrote it.
-- Run in one transaction:  psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f supabase/deploy/membership/90-rollback-0016.sql
-- Deploy the previous dodo-webhook first (or delete it), since the new one calls the twelve-argument version.
-- The added columns, indexes and the wider kind check stay: they are additive, nothing older reads them, and dropping
-- them would lose payment history. No plan, trial or recovery row changes.
drop view if exists public.payment_events_review;
drop function if exists public.apply_payment_event(text, text, uuid, text, text, timestamptz, timestamptz, text, text, text, timestamptz, boolean);

/**
 * Applies one verified payment event. Called only by trusted server code after the provider's signature has been
 * checked (supabase/functions/_shared/payments.ts); never by the app. Returns what happened:
 *   duplicate     this (provider, event_id) was seen before; nothing changes (webhook retries are safe)
 *   applied       the plan changed
 *   recorded      kept for the audit only (a failed payment changes nothing: the paid period still runs)
 *   stale         an event about an older purchase or period than the current one; kept, ignored
 *   needs_review  a Basic purchase while AI is active; kept, ignored (the app never offers it)
 *   no_account    the account is gone; kept anonymously, ignored
 * Raises on malformed input so the caller can answer the provider with an error and be retried.
 */
create or replace function public.apply_payment_event(
  p_provider text, p_event_id text, p_user uuid, p_kind text, p_plan text,
  p_period_start timestamptz, p_period_end timestamptz, p_provider_ref text
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
  rank_new int := case p_plan when 'ai' then 2 when 'basic' then 1 else 0 end;
  rank_cur int;
  known boolean := p_user is not null and exists (select 1 from auth.users where id = p_user);
begin
  if p_kind in ('purchase', 'renewal', 'grant') and (p_plan is null or p_period_start is null or p_period_end is null or p_period_end <= p_period_start) then
    raise exception 'a % needs a plan and a valid period', p_kind using errcode = '22023';
  end if;

  insert into public.payment_events (provider, event_id, user_id, kind, plan, period_start, period_end, provider_ref)
  values (p_provider, p_event_id, case when known then p_user end, p_kind, p_plan, p_period_start, p_period_end, p_provider_ref)
  on conflict (provider, event_id) do nothing
  returning id into ev;
  if ev is null then return 'duplicate'; end if;

  if not known then
    v_outcome := 'no_account';
  else
    -- One event at a time per account, so two webhooks racing can't both read the old row.
    select * into e from public.entitlements where user_id = p_user for update;
    rank_cur := case when e.user_id is not null and e.status = 'active' and e.period_end > now() then (case e.plan when 'ai' then 2 else 1 end) else 0 end;

    if p_kind in ('purchase', 'renewal', 'grant') then
      if e.user_id is null then
        insert into public.entitlements (user_id, plan, status, period_start, period_end, provider, provider_ref)
        values (p_user, p_plan, 'active', p_period_start, p_period_end, p_provider, p_provider_ref);
        v_outcome := 'applied';
      elsif rank_new < rank_cur then
        v_outcome := 'needs_review';
      elsif rank_new = rank_cur and p_period_end <= e.period_end then
        v_outcome := 'stale'; -- an older period arriving late: the current one already covers it
      else
        update public.entitlements set plan = p_plan, status = 'active',
          period_start = case when rank_new = rank_cur then least(e.period_start, p_period_start) else p_period_start end,
          period_end = p_period_end, provider = p_provider, provider_ref = coalesce(p_provider_ref, e.provider_ref), updated_at = now()
        where user_id = p_user;
        v_outcome := 'applied';
      end if;
    elsif p_kind = 'payment_failed' then
      v_outcome := 'recorded';
    elsif e.user_id is null then
      v_outcome := 'stale';
    elsif p_provider_ref is not null and e.provider_ref is not null and p_provider_ref <> e.provider_ref then
      v_outcome := 'stale'; -- about a purchase that has since been replaced
    elsif p_kind = 'expiry' and p_period_end is not null and p_period_end < e.period_end then
      v_outcome := 'stale'; -- the end of a period that has since been renewed
    else
      update public.entitlements set status = case p_kind when 'expiry' then 'expired' when 'refund' then 'refunded' else 'revoked' end,
        updated_at = now()
      where user_id = p_user;
      v_outcome := 'applied';
    end if;
  end if;

  update public.payment_events set outcome = v_outcome where id = ev;
  return v_outcome;
end;
$$;
revoke all on function public.apply_payment_event(text, text, uuid, text, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, uuid, text, text, timestamptz, timestamptz, text) to service_role;
