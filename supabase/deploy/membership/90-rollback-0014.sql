-- ROLLBACK for 0014 (docs/DEPLOY_MEMBERSHIP.md): the older membership migration as production ran it before 0014
-- (commit c2d3643). Re-running it restores the previous function bodies, including its launch date (set to the moment
-- of the rollback) and its rule that trials start at the later of registration and that date. Trials already started
-- under 0014 keep their dates (its inserts are on conflict do nothing). Tables 0014 added stay; nothing references
-- them after this. Writes no recovery data.
--   psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f supabase/deploy/membership/90-rollback-0014.sql

-- Membership: a seven-day trial per account, then an annual Basic or AI plan (docs/MONETISATION.md, PRD §24).
-- Additive only and safe to run more than once. Nothing about recovery data changes: no recovery table gains a
-- column, a policy, a check or a trigger here, so sync never refuses a recovery row because of what someone paid.
--
-- The server is the only authority. A signed-in person can read their own trial and plan, and nothing else:
--   trial_grants      one row per account, written only by the sign-up trigger (or lazily from auth.users.created_at)
--   entitlements      the current paid plan, written only by apply_payment_event() (service role)
--   payment_events    append-only audit of every payment event; (provider, event_id) unique, so replays do nothing
--   abuse_counters    short-lived counters keyed by a salted hash of an IP address, never the address itself
--   abuse_salts       one random salt per day; deleted after two days, so old hashes can't be linked to anything
-- access_for(uuid) works out what an account may do right now; my_access() is the signed-in person's own copy.

-- ---------- trial grants: one per account ----------

create table if not exists public.trial_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null default 'signup' check (source in ('signup', 'launch', 'lazy')),
  created_at timestamptz not null default now(),
  constraint trial_grants_seven_days check (ends_at = started_at + interval '7 days')
);

-- ---------- paid entitlement: the account's current annual plan ----------

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('basic', 'ai')),
  status text not null check (status in ('active', 'expired', 'refunded', 'revoked')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  provider text not null check (char_length(provider) between 1 and 40),
  provider_ref text check (provider_ref is null or char_length(provider_ref) <= 200),
  updated_at timestamptz not null default now(),
  constraint entitlements_period check (period_end > period_start)
);

-- ---------- payment events: idempotent, append-only audit ----------

create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null check (char_length(provider) between 1 and 40),
  event_id text not null check (char_length(event_id) between 1 and 200),
  -- Kept as an anonymous record if the account is deleted (refunds and accounting), never linked to anyone again.
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('purchase', 'renewal', 'payment_failed', 'expiry', 'refund', 'revocation', 'grant')),
  plan text check (plan is null or plan in ('basic', 'ai')),
  period_start timestamptz,
  period_end timestamptz,
  provider_ref text check (provider_ref is null or char_length(provider_ref) <= 200),
  outcome text not null default 'pending',
  received_at timestamptz not null default now(),
  constraint payment_events_once unique (provider, event_id)
);
create index if not exists payment_events_user on public.payment_events (user_id);

-- ---------- abuse signals: salted, hashed, short-lived ----------

create table if not exists public.abuse_salts (
  day date primary key,
  salt text not null
);
create table if not exists public.abuse_counters (
  kind text not null check (kind in ('signup', 'trial_ai')),
  ip_hash text not null check (char_length(ip_hash) = 64),
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (kind, ip_hash, window_start)
);
create index if not exists abuse_counters_window on public.abuse_counters (window_start);

-- ---------- row level security and privileges ----------

alter table public.trial_grants enable row level security;
alter table public.entitlements enable row level security;
alter table public.payment_events enable row level security; -- no policies: service role only
alter table public.abuse_salts enable row level security;    -- no policies: service role only
alter table public.abuse_counters enable row level security; -- no policies: service role only

drop policy if exists "own trial: read" on public.trial_grants;
create policy "own trial: read" on public.trial_grants for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "own plan: read" on public.entitlements;
create policy "own plan: read" on public.entitlements for select to authenticated using (user_id = (select auth.uid()));

-- Supabase grants every new public table to anon and authenticated by default. Take all of it back, then give
-- signed-in people read access to their own two rows (the policies above) and nothing more.
revoke all on public.trial_grants, public.entitlements, public.payment_events, public.abuse_salts, public.abuse_counters from anon, authenticated;
grant select on public.trial_grants, public.entitlements to authenticated;
grant all on public.trial_grants, public.entitlements, public.payment_events, public.abuse_salts, public.abuse_counters to service_role;

-- ---------- the official launch date ----------

-- One row: when membership officially launches. Every trial starts at the later of the account's registration and
-- this date, so accounts that exist before launch get seven days from launch and later accounts seven days from
-- registration. Set it while applying this migration, in the same session:
--   set app.membership_launch = '2026-12-01 00:00:00+00';
-- Without it, launch is the moment the migration runs. Before launch it can be moved with set_membership_launch().
create table if not exists public.membership_launch (
  id boolean primary key default true check (id),
  launch_at timestamptz not null
);
alter table public.membership_launch enable row level security; -- no policies: service role only
revoke all on public.membership_launch from anon, authenticated;
grant all on public.membership_launch to service_role;
insert into public.membership_launch (id, launch_at)
values (true, coalesce(nullif(current_setting('app.membership_launch', true), '')::timestamptz, now()))
on conflict (id) do nothing;

/** When a trial starts for an account registered at `registered`: registration, or launch if that is later. */
create or replace function public.trial_start(registered timestamptz)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(coalesce(registered, now()), coalesce((select launch_at from public.membership_launch where id), now()))
$$;
revoke all on function public.trial_start(timestamptz) from public, anon, authenticated;

-- ---------- trial: granted when the account is created ----------

-- Runs inside the sign-up transaction. It only inserts, never fails on a second run (one grant per account), and
-- counts from the account's own creation time (or launch, if that is later), so reinstalling the app or signing in
-- again can't restart it.
create or replace function public.grant_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare t timestamptz := public.trial_start(new.created_at);
begin
  insert into public.trial_grants (user_id, started_at, ends_at, source)
  values (new.id, t, t + interval '7 days', case when t > coalesce(new.created_at, now()) then 'launch' else 'signup' end)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.grant_trial() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_grant_trial on auth.users;
create trigger on_auth_user_created_grant_trial after insert on auth.users for each row execute function public.grant_trial();

-- Accounts that exist before membership launches get a fresh seven days from the official launch date, not from the
-- day they signed up, so nobody is locked out the moment the paywall ships (owner decision, docs/MONETISATION.md).
insert into public.trial_grants (user_id, started_at, ends_at, source)
select u.id, public.trial_start(u.created_at), public.trial_start(u.created_at) + interval '7 days',
  case when public.trial_start(u.created_at) > u.created_at then 'launch' else 'signup' end
from auth.users u
on conflict (user_id) do nothing;

/**
 * Moves the official launch date, and every trial with it, while launch is still ahead. Service role only. Once the
 * launch date has passed, trial dates are fixed: moving it then would restart or shorten trials people are using.
 */
create or replace function public.set_membership_launch(p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare cur timestamptz;
begin
  if p_at is null or p_at < now() then raise exception 'the launch date must be now or later' using errcode = '22023'; end if;
  select launch_at into cur from public.membership_launch where id for update;
  if cur <= now() then raise exception 'membership has launched; trial dates are fixed' using errcode = '55000'; end if;
  update public.membership_launch set launch_at = p_at where id;
  update public.trial_grants g set started_at = public.trial_start(u.created_at), ends_at = public.trial_start(u.created_at) + interval '7 days',
    source = case when public.trial_start(u.created_at) > u.created_at then 'launch' else 'signup' end
  from auth.users u where u.id = g.user_id and g.source in ('launch', 'signup');
end;
$$;
revoke all on function public.set_membership_launch(timestamptz) from public, anon, authenticated;
grant execute on function public.set_membership_launch(timestamptz) to service_role;

-- ---------- effective access ----------

/**
 * What an account may do right now, worked out on the server from its trial and plan:
 *   state  trial | basic | ai | expired | refunded | revoked | none
 *   app    normal use of the app (check-ins, slips, urges, edits)
 *   ai     new AI requests
 * A paid plan in its period wins; then a trial in its seven days; then why access ended. Expiry needs no job: it is
 * read against now() every time. An account without a trial row gets one from its own creation time or launch (never later),
 * which only happens if the sign-up trigger was missing when it registered.
 */
create or replace function public.access_for(p_user uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.trial_grants%rowtype;
  e public.entitlements%rowtype;
  created timestamptz;
  verified boolean;
  n timestamptz := now();
  state text;
  valid timestamptz;
begin
  if p_user is null then return null; end if;
  select u.created_at, (u.email_confirmed_at is not null) into created, verified from auth.users u where u.id = p_user;
  if not found then return null; end if;

  select * into t from public.trial_grants where user_id = p_user;
  if not found then
    insert into public.trial_grants (user_id, started_at, ends_at, source)
    values (p_user, public.trial_start(created), public.trial_start(created) + interval '7 days', 'lazy')
    on conflict (user_id) do nothing;
    select * into t from public.trial_grants where user_id = p_user;
  end if;
  select * into e from public.entitlements where user_id = p_user;

  if e.user_id is not null and e.status = 'active' and e.period_end > n then
    state := e.plan; valid := e.period_end;
  elsif t.user_id is not null and t.ends_at > n then
    state := 'trial'; valid := t.ends_at;
  elsif e.user_id is not null and e.status in ('refunded', 'revoked') then
    state := e.status;
  elsif e.user_id is not null or t.user_id is not null then
    state := 'expired';
  else
    state := 'none';
  end if;

  return jsonb_build_object(
    'state', state,
    'app', state in ('trial', 'basic', 'ai'),
    -- A trial's AI needs a confirmed email: a throwaway address can't run up the AI bill.
    'ai', state = 'ai' or (state = 'trial' and coalesce(verified, false)),
    'email_verified', coalesce(verified, false),
    'tracks', case when state = 'trial' then 1 when state in ('basic', 'ai') then 50 else 0 end,
    'valid_until', valid,
    'trial_ends_at', t.ends_at,
    'plan', e.plan,
    'plan_status', e.status,
    'period_end', e.period_end,
    'server_time', n
  );
end;
$$;
revoke all on function public.access_for(uuid) from public, anon, authenticated;
grant execute on function public.access_for(uuid) to service_role;

/** The signed-in person's own access. Reads only their own rows; can't be pointed at anyone else. */
create or replace function public.my_access()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  return public.access_for(uid);
end;
$$;
revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- ---------- payments: the one trusted write path ----------

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

-- ---------- abuse signals ----------

/**
 * Counts one hit for a kind of request from an IP address, in fixed windows, and says whether it is within the limit.
 * The address is never stored: only sha256(daily random salt || address). Salts and counters older than two days are
 * deleted, after which no stored hash can be matched to any address. No address (or an empty one) is never refused:
 * an IP is a weak signal, many people share one, and this only rate-limits, it never bans.
 */
create or replace function public.abuse_hit(p_kind text, p_ip text, p_window_minutes int, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
  s text;
  h text;
  w timestamptz := date_bin(make_interval(mins => greatest(1, p_window_minutes)), now(), timestamptz '2000-01-01 00:00:00+00');
  n int;
begin
  if p_ip is null or btrim(p_ip) = '' then return true; end if;
  insert into public.abuse_salts (day, salt) values (today, gen_random_uuid()::text || gen_random_uuid()::text) on conflict (day) do nothing;
  select salt into s from public.abuse_salts where day = today;
  h := encode(sha256(convert_to(s || '|' || btrim(p_ip), 'UTF8')), 'hex');
  insert into public.abuse_counters (kind, ip_hash, window_start, hits) values (p_kind, h, w, 1)
  on conflict (kind, ip_hash, window_start) do update set hits = public.abuse_counters.hits + 1
  returning hits into n;
  delete from public.abuse_counters where window_start < now() - interval '2 days';
  delete from public.abuse_salts where day < today - 1;
  return n <= p_limit;
end;
$$;
revoke all on function public.abuse_hit(text, text, int, int) from public, anon, authenticated;
grant execute on function public.abuse_hit(text, text, int, int) to service_role;

/**
 * Supabase Auth "Before User Created" hook (Postgres function). At most 10 sign-ups an hour from one address; past
 * that, sign-up from it waits for the next hour. Only takes effect once it is switched on in the dashboard
 * (Authentication → Hooks); docs/MONETISATION.md. Shared addresses (mobile carriers, offices) are why the limit is
 * generous and short.
 */
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.abuse_hit('signup', event -> 'metadata' ->> 'ip_address', 60, 10) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 429,
      'message', 'Too many new accounts from this network in the last hour. Please try again later.'));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin';
  end if;
end $$;
