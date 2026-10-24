-- Companion: normalised storage (PRD section 9), replacing the single app_state blob.
--
-- Every row id is generated on the phone, so an offline write can be retried without duplicates.
-- Every table carries client_updated_at (ms since epoch, set by the phone) and updated_at (set here).
-- Sync pulls by updated_at; a stale write (older client_updated_at) never overwrites a newer one.
-- Deletes are soft (deleted_at) so they reach the person's other devices.
-- Photos never leave the phone; the app strips them before upload.

-- ---------- helpers ----------

create or replace function public.touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.client_updated_at < old.client_updated_at then
    return old; -- stale write from a slower device: keep the newer row
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- profiles: one per person, holds their settings ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 8192),
  timezone text check (char_length(timezone) <= 64),
  client_updated_at bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- companions ----------

create table public.companions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  species text not null check (species in ('dog', 'cat', 'rabbit')),
  name text not null check (char_length(name) between 1 and 20),
  born_on date not null,
  died_on date check (died_on is null or died_on >= born_on),
  final_age numeric(5, 2) check (final_age is null or final_age between 0 and 100),
  client_updated_at bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index companions_user_updated on public.companions (user_id, updated_at);

-- ---------- habits (questions kept with the habit as a validated array) ----------

create table public.habits (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  companion_id uuid not null references public.companions (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  class text not null check (class in ('food_spending', 'impulse_buying', 'doomscrolling', 'smoking', 'alcohol', 'custom')),
  class_weight numeric(4, 2) not null check (class_weight between 0.1 and 3),
  unit text not null check (unit in ('money', 'count', 'minutes', 'none')),
  fields jsonb not null check (jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) <= 20 and pg_column_size(fields) < 8192),
  position int not null default 0,
  client_updated_at bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);
create index habits_user_updated on public.habits (user_id, updated_at);
create index habits_companion on public.habits (companion_id);

-- ---------- entries (one slip) and their deduction ----------

create table public.entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  companion_id uuid not null references public.companions (id) on delete cascade,
  occurred_on date not null,
  occurred_at time,
  "values" jsonb not null default '{}'::jsonb check (jsonb_typeof("values") = 'object' and pg_column_size("values") < 4096),
  amount numeric(12, 2) check (amount is null or amount between 0 and 10000000),
  client_created_at bigint not null,
  client_updated_at bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index entries_user_updated on public.entries (user_id, updated_at);
create index entries_habit_day on public.entries (habit_id, occurred_on);
create index entries_companion on public.entries (companion_id);

create table public.deductions (
  entry_id uuid primary key references public.entries (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  months_lost numeric(6, 3) not null check (months_lost between 0 and 24),
  severity numeric(4, 2) not null check (severity between 0.5 and 3),
  baseline_months numeric(6, 3) check (baseline_months is null or baseline_months between 0 and 24),
  ai_adjust_pct numeric(5, 2) check (ai_adjust_pct is null or ai_adjust_pct between -30 and 30),
  body_effects text[] not null default '{}' check (cardinality(body_effects) <= 6),
  explanation text not null default '' check (char_length(explanation) <= 200),
  source text not null check (source in ('baseline', 'ai')),
  client_updated_at bigint not null default 0,
  updated_at timestamptz not null default now()
);
create index deductions_user_updated on public.deductions (user_id, updated_at);

-- ---------- clean days ----------

create table public.clean_days (
  habit_id uuid not null references public.habits (id) on delete cascade,
  day date not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (habit_id, day)
);
create index clean_days_user_updated on public.clean_days (user_id, updated_at);

-- ---------- weekly reports ----------

create table public.weekly_reports (
  habit_id uuid not null references public.habits (id) on delete cascade,
  week_start date not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stats jsonb not null default '{}'::jsonb check (pg_column_size(stats) < 4096),
  summary text check (summary is null or char_length(summary) <= 800),
  client_updated_at bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (habit_id, week_start)
);
create index weekly_reports_user_updated on public.weekly_reports (user_id, updated_at);

-- ---------- triggers ----------

create trigger profiles_touch before insert or update on public.profiles for each row execute function public.touch_row();
create trigger companions_touch before insert or update on public.companions for each row execute function public.touch_row();
create trigger habits_touch before insert or update on public.habits for each row execute function public.touch_row();
create trigger entries_touch before insert or update on public.entries for each row execute function public.touch_row();
create trigger deductions_touch before insert or update on public.deductions for each row execute function public.touch_row();
create trigger clean_days_touch before insert or update on public.clean_days for each row execute function public.touch_row();
create trigger weekly_reports_touch before insert or update on public.weekly_reports for each row execute function public.touch_row();

-- ---------- row level security: a person sees and writes only their own rows ----------

alter table public.profiles enable row level security;
alter table public.companions enable row level security;
alter table public.habits enable row level security;
alter table public.entries enable row level security;
alter table public.deductions enable row level security;
alter table public.clean_days enable row level security;
alter table public.weekly_reports enable row level security;

create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own companions" on public.companions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Child rows must also point at parents the same person owns.
create policy "own habits" on public.habits for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.companions c where c.id = companion_id and c.user_id = (select auth.uid())));

create policy "own entries" on public.entries for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
    and exists (select 1 from public.companions c where c.id = companion_id and c.user_id = (select auth.uid())));

create policy "own deductions" on public.deductions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid())));

create policy "own clean days" on public.clean_days for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid())));

create policy "own weekly reports" on public.weekly_reports for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid())));

-- Anonymous visitors get nothing at all.
revoke all on public.profiles, public.companions, public.habits, public.entries, public.deductions, public.clean_days, public.weekly_reports from anon;

-- ---------- delete my account: removes the auth user, everything else cascades ----------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- server-side AI cache (service role only) ----------

create table public.ai_cache (
  key text primary key check (char_length(key) = 64),
  kind text not null check (kind in ('slip', 'weekly')),
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ai_cache enable row level security; -- no policies: only the edge function touches it
create index ai_cache_created on public.ai_cache (created_at);

-- The old app_state table from 0001 is left in place (empty, RLS on); drop it by hand once nothing references it.
