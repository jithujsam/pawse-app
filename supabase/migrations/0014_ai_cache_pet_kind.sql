-- The AI function also caches a day of pet lines (kind 'pet', PRD §24). Widens the check on ai_cache.kind so those
-- answers are cached like slips and weekly summaries; nothing else changes. Safe to run more than once.

alter table public.ai_cache drop constraint if exists ai_cache_kind_check;
alter table public.ai_cache add constraint ai_cache_kind_check check (kind in ('slip', 'weekly', 'pet'));
