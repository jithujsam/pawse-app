-- The Brutal personality: a pet that roasts the habit, never the person (PRD §24). Stored as 'savage' so it can't be
-- confused with the Voice id 'brutal'. Widens the check on companions.personality; nothing else changes.
-- Safe to run more than once.

do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public' and rel.relname = 'companions' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%personality%'
  loop
    execute format('alter table public.companions drop constraint %I', c);
  end loop;
end $$;

alter table public.companions add constraint companions_personality_check
  check (personality is null or personality in ('playful', 'calm', 'sassy', 'wise', 'savage'));
