-- Companion v2: more species, a coat and a personality per companion, urges ridden out, and a short journal.
-- Additive only: nothing existing is dropped or rewritten. Safe to run more than once.

-- ---------- companions: six species, coat and personality ----------

alter table public.companions drop constraint if exists companions_species_check;
alter table public.companions add constraint companions_species_check
  check (species in ('dog', 'cat', 'rabbit', 'fox', 'owl', 'panda'));
alter table public.companions add column if not exists coat text check (coat is null or coat ~ '^[a-z_]{1,20}$');
alter table public.companions add column if not exists personality text check (personality is null or personality in ('playful', 'calm', 'sassy', 'wise'));

-- ---------- urges: a craving that was noticed, with how it ended ----------

create table if not exists public.urges (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  occurred_on date not null,
  occurred_at time,
  strength smallint not null check (strength between 1 and 5),
  outcome text not null check (outcome in ('rode_it_out', 'slipped')),
  client_created_at bigint not null,
  client_updated_at bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists urges_user_updated on public.urges (user_id, updated_at);
create index if not exists urges_habit_day on public.urges (habit_id, occurred_on);

-- ---------- journal: one short reflection, at most one per day ----------

create table if not exists public.journal (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  mood smallint not null check (mood between 1 and 5),
  body text not null default '' check (char_length(body) <= 600),
  client_updated_at bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, day)
);
create index if not exists journal_user_updated on public.journal (user_id, updated_at);

drop trigger if exists urges_touch on public.urges;
create trigger urges_touch before insert or update on public.urges for each row execute function public.touch_row();
drop trigger if exists journal_touch on public.journal;
create trigger journal_touch before insert or update on public.journal for each row execute function public.touch_row();

alter table public.urges enable row level security;
alter table public.journal enable row level security;

drop policy if exists "own urges" on public.urges;
create policy "own urges" on public.urges for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid())));

drop policy if exists "own journal" on public.journal;
create policy "own journal" on public.journal for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.urges, public.journal from anon;
