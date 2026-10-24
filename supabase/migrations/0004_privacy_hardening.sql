-- Companion v2.1 privacy hardening. Additive and safe to run more than once.
--
-- 1. The AI result cache becomes per person. Rows carry the user id and go with the account.
--    The edge function now keys results by user + exact request (see functions/ai/index.ts).
-- 2. Tables from 0001 lose the blanket privileges anon and authenticated were granted by default.
--    RLS already blocked them; this removes the reliance on RLS alone.

-- ---------- ai_cache: per person ----------

alter table public.ai_cache add column if not exists user_id uuid references auth.users (id) on delete cascade;
create index if not exists ai_cache_user on public.ai_cache (user_id);

-- Rows written before this migration have no owner and were shared between people. They can never be
-- hit again (the key now includes the user), so remove them. This only drops cached AI text.
delete from public.ai_cache where user_id is null;

-- ---------- privileges ----------

revoke all on public.ai_cache, public.ai_usage from anon, authenticated;
revoke all on public.app_state from anon;
