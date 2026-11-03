-- Membership: a seven-day trial per account, then an annual Basic or AI plan (docs/MONETISATION.md, PRD §25).
-- Additive only and safe to run more than once. Nothing about recovery data changes: no recovery table gains a
-- column, a policy, a check or a trigger here, so sync never refuses a recovery row because of what someone paid.
--
-- The server is the only authority. A signed-in person can read their own trial and plan, and nothing else:
--   trial_grants      one row per account, written only by the sign-up trigger (or lazily from auth.users.created_at)
--   entitlements      the current paid plan, written only by apply_payment_event() (service role)
--   payment_events    append-only audit of every payment event; (provider, event_id) unique, so replays do nothing
--   abuse_counters    short-lived counters keyed by a salted hash of a network, never the address itself
--   signup_attempts   sign-ups per network (salted hash), for the sign-up rate limit; kept two days
--   signup_limits     how many accounts one network may create per window (tunable)
--   abuse_salts       one random salt per day; deleted after two days, so old hashes can't be linked to anything
-- access_for(uuid) works out what an account may do right now; my_access() is the signed-in person's own copy.

-- ---------- trial grants: one per account ----------

create table if not exists public.trial_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ends_at timestamptz not null,
  -- signup: a new account, from its creation. first_access: an account that existed before membership, from the first
  -- time it reached it. launch/lazy: written by an earlier version of this migration (launch = not started yet).
  source text not null default 'signup' check (source in ('signup', 'first_access', 'launch', 'lazy')),
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

-- ---------- trials: one per account, never restarted ----------

-- An earlier version of this migration allowed only 'signup', 'launch' and 'lazy'. Widen the check in place, so a
-- database that has that version accepts 'first_access' too. Nothing else about the table changes.
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.trial_grants'::regclass and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%source%'
  loop
    execute format('alter table public.trial_grants drop constraint %I', c);
  end loop;
end $$;
alter table public.trial_grants add constraint trial_grants_source_check check (source in ('signup', 'first_access', 'launch', 'lazy'));

-- A new account: its seven days start when it is created, inside the sign-up transaction. It only inserts and never
-- fails on a second run (one grant per account), so reinstalling the app or signing in again can't restart it.
create or replace function public.grant_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare t timestamptz := coalesce(new.created_at, now());
begin
  insert into public.trial_grants (user_id, started_at, ends_at, source)
  values (new.id, t, t + interval '7 days', 'signup')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.grant_trial() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_grant_trial on auth.users;
create trigger on_auth_user_created_grant_trial after insert on auth.users for each row execute function public.grant_trial();

-- Accounts that already exist get no trial here. Theirs starts the first time they reach membership: when the app asks
-- my_access(), or the AI function asks access_for() (both below). No date is ever taken from when they registered.

-- ---------- effective access ----------

/**
 * What an account may do right now, worked out on the server from its trial and plan:
 *   state  trial | basic | ai | expired | refunded | revoked | none
 *   app    normal use of the app (check-ins, slips, urges, edits)
 *   ai     new AI requests
 * A paid plan in its period wins; then a trial in its seven days; then why access ended. Expiry needs no job: it is
 * read against now() every time.
 *
 * The first call for an account that has no trial (one that existed before membership) grants its seven days from
 * now, once. A row an earlier version wrote in advance for such an account (source 'launch') was never seen by its
 * owner, so it starts from now the same way, once. After that, nothing here restarts a trial.
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
    values (p_user, n, n + interval '7 days', 'first_access')
    on conflict (user_id) do nothing;
    select * into t from public.trial_grants where user_id = p_user;
  elsif t.source = 'launch' then
    update public.trial_grants set started_at = n, ends_at = n + interval '7 days', source = 'first_access'
    where user_id = p_user and source = 'launch';
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
 * The part of an address that identifies a network: an IPv4 address as is, an IPv6 address by its /64 (one home
 * connection or one phone's prefix, which a single device can otherwise rotate through freely). Null when the text
 * isn't an address.
 */
create or replace function public.network_key(p_ip text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare ip inet;
begin
  if p_ip is null or btrim(p_ip) = '' then return null; end if;
  ip := btrim(p_ip)::inet;
  return case when family(ip) = 6 then host(network(set_masklen(ip, 64))) || '/64' else host(ip) end;
exception when others then
  return null;
end;
$$;
revoke all on function public.network_key(text) from public, anon, authenticated;

/**
 * The salted hashes a network can be stored under right now: today's salt first, then yesterday's if it still exists,
 * so a rolling 24-hour window works across midnight. Empty for no address. A salt is random and is deleted after two
 * days, after which no stored hash can be matched to any address.
 */
create or replace function public.network_hashes(p_ip text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
  k text := public.network_key(p_ip);
begin
  if k is null then return '{}'; end if;
  insert into public.abuse_salts (day, salt) values (today, gen_random_uuid()::text || gen_random_uuid()::text) on conflict (day) do nothing;
  delete from public.abuse_salts where day < today - 1;
  return array(select encode(sha256(convert_to(s.salt || '|' || k, 'UTF8')), 'hex') from public.abuse_salts s where s.day >= today - 1 order by s.day desc);
end;
$$;
revoke all on function public.network_hashes(text) from public, anon, authenticated;

/**
 * Counts one hit for a kind of request from a network, in fixed windows, and says whether it is within the limit.
 * Only a salted hash of the network is stored (network_hashes). No address (or an unreadable one) is never refused:
 * an IP is a weak signal, many people share one, and this only rate-limits, it never bans.
 */
create or replace function public.abuse_hit(p_kind text, p_ip text, p_window_minutes int, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  hs text[] := public.network_hashes(p_ip);
  w timestamptz := date_bin(make_interval(mins => greatest(1, p_window_minutes)), now(), timestamptz '2000-01-01 00:00:00+00');
  n int;
begin
  if cardinality(hs) = 0 then return true; end if;
  insert into public.abuse_counters (kind, ip_hash, window_start, hits) values (p_kind, hs[1], w, 1)
  on conflict (kind, ip_hash, window_start) do update set hits = public.abuse_counters.hits + 1
  returning hits into n;
  delete from public.abuse_counters where window_start < now() - interval '2 days';
  return n <= p_limit;
end;
$$;
revoke all on function public.abuse_hit(text, text, int, int) from public, anon, authenticated;
grant execute on function public.abuse_hit(text, text, int, int) to service_role;

-- ---------- sign-up rate limit (Supabase Auth "Before User Created" hook) ----------

-- Accounts created per network, so the limit counts real sign-ups, not attempts: a mistyped password or an email
-- that's already taken uses nothing up. Each row links a salted network hash to the id the new account would get,
-- for at most two days; nothing links it to an address once the salt is gone.
create table if not exists public.signup_attempts (
  ip_hash text not null check (char_length(ip_hash) = 64),
  user_id uuid not null,
  attempted_at timestamptz not null default now(),
  primary key (ip_hash, user_id)
);
create index if not exists signup_attempts_recent on public.signup_attempts (ip_hash, attempted_at);
create index if not exists signup_attempts_age on public.signup_attempts (attempted_at);
alter table public.signup_attempts enable row level security; -- no policies: service role only

-- How many new accounts one network may create per rolling window. Generous on purpose: mobile carriers put
-- thousands of people behind one IPv4 address, and pawse's whole sign-up rate is far below these numbers, so only
-- scripted account farming reaches them. Tune with an update; no migration needed.
create table if not exists public.signup_limits (
  window_minutes int primary key check (window_minutes between 1 and 10080),
  max_accounts int not null check (max_accounts >= 1)
);
alter table public.signup_limits enable row level security; -- no policies: service role only
insert into public.signup_limits (window_minutes, max_accounts) values (60, 30), (1440, 100) on conflict (window_minutes) do nothing;
revoke all on public.signup_attempts, public.signup_limits from anon, authenticated;
grant all on public.signup_attempts, public.signup_limits to service_role;

/**
 * Supabase Auth "Before User Created" hook (Postgres function). Refuses a sign-up only when the network has already
 * created as many accounts as a window in signup_limits allows (30 an hour and 100 a day by default); otherwise it
 * records the attempt and lets it through. Only takes effect once it is switched on in the dashboard
 * (Authentication → Hooks); docs/MONETISATION.md.
 *
 * It fails open: any error inside it (an unexpected payload, a lock it can't get quickly, a missing table) lets the
 * sign-up through and leaves a warning in the database log, without the address. A broken rate limiter must never
 * keep real people out.
 *
 * A refusal is HTTP 429 with a message that starts "signup_rate_limited:", which the app recognises and replaces with
 * its own wording (account.errors.signup_network, src/authErrors.ts).
 */
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '500ms'
as $$
declare
  hs text[];
  uid uuid;
  lim record;
  made int;
begin
  begin
    hs := public.network_hashes(event -> 'metadata' ->> 'ip_address');
    if cardinality(hs) = 0 then return '{}'::jsonb; end if;
    uid := nullif(event -> 'user' ->> 'id', '')::uuid;
    for lim in select window_minutes, max_accounts from public.signup_limits order by window_minutes loop
      -- Only attempts that became accounts count, and never this one (a retry of the same request).
      select count(*) into made from public.signup_attempts a join auth.users u on u.id = a.user_id
      where a.ip_hash = any (hs) and a.attempted_at > now() - make_interval(mins => lim.window_minutes)
        and (uid is null or a.user_id <> uid);
      if made >= lim.max_accounts then
        return jsonb_build_object('error', jsonb_build_object('http_code', 429,
          'message', 'signup_rate_limited: Too many new accounts from this network recently. Please try again later.'));
      end if;
    end loop;
    if uid is not null then
      insert into public.signup_attempts (ip_hash, user_id) values (hs[1], uid) on conflict do nothing;
    end if;
    delete from public.signup_attempts where attempted_at < now() - interval '2 days';
    return '{}'::jsonb;
  exception when others then
    raise warning 'sign-up rate limit skipped (%): sign-up allowed', sqlstate;
    return '{}'::jsonb;
  end;
end;
$$;
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin';
  end if;
end $$;

-- ---------- no global launch date ----------

-- An earlier version of this migration kept one launch date for everyone. Trials no longer depend on it, and nothing
-- above uses it any more, so it goes (on a database that never had it, these do nothing).
drop function if exists public.set_membership_launch(timestamptz);
drop function if exists public.trial_start(timestamptz);
drop table if exists public.membership_launch;
