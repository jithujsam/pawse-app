-- Detox Companion: account storage and AI usage limits.

-- One saved copy of each person's data, readable and writable only by them.
create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_state enable row level security;

create policy "own state: select" on public.app_state for select to authenticated using (auth.uid() = user_id);
create policy "own state: insert" on public.app_state for insert to authenticated with check (auth.uid() = user_id);
create policy "own state: update" on public.app_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own state: delete" on public.app_state for delete to authenticated using (auth.uid() = user_id);

-- Daily cap on AI calls, so a leaked token or a loop cannot run up the bill.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  calls int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security; -- no policies: only the service role touches it

create or replace function public.bump_ai_usage(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare c int;
begin
  insert into public.ai_usage (user_id, day, calls) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into c;
  return c <= p_limit;
end;
$$;
revoke all on function public.bump_ai_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.bump_ai_usage(uuid, int) to service_role;
