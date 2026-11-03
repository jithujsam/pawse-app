-- The AI result cache accepts the pet's own lines (PRD §24.3, request kind "pet"). 0002 limited ai_cache.kind to
-- 'slip' and 'weekly', so the AI function's cache write for a "pet" answer was refused (quietly: the function doesn't
-- fail on a cache write) and every pet request reached the AI provider. Widens the check; no row changes.
-- Safe to run more than once.

do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.ai_cache'::regclass and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table public.ai_cache drop constraint %I', c);
  end loop;
end $$;

alter table public.ai_cache add constraint ai_cache_kind_check check (kind in ('slip', 'weekly', 'pet'));
