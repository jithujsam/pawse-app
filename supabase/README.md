# Supabase setup

The app needs an account to start (see `apps/web/src/App.tsx`); after that it keeps working offline and syncs when it can. The account adds backup, sync across phones and the written AI insights.

1. Create a project. The app ships with this project's public URL and publishable key (`apps/web/src/supabase.ts`); to point it elsewhere set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/web/.env`.
2. Apply the migrations in order, 0001 to 0006. Each is additive and safe to re-run. 0005 adds an urge's coping strategy and trigger; 0006 adds recovery tracks (a description, start date, status and per-track settings on each habit, and the owning track on each companion; see `docs/MULTI_TRACK_ARCHITECTURE.md`). Apps keep syncing without either until it is applied. Check them on a disposable database first with `tests/local-auth-stub.sql`, then `tests/rls.sql`, `tests/privacy.sql`, `tests/recovery.sql` and `tests/tracks.sql`.
3. Authentication: leave email sign-in on and turn on leaked-password protection. Under Authentication → URL Configuration, add `app.detoxcompanion://auth-callback` to Redirect URLs, so confirmation and password-reset emails open the Android app (PKCE code exchange in `src/deeplink.ts`). Add your web address too if you host the web build.
4. Deploy `functions/ai` (`supabase functions deploy ai`) with JWT verification ON. After this change the function **answers only people who turned AI writing on**: it reads `aiConsent` from their `profiles.settings` (so it holds for every app version), asks the model for one sentence (never a number), and ignores any typed notes an older app sends. Until it is redeployed, apps up to 3.1.0 still send requests without asking and still receive an adjustment; redeploying makes them fall back to the app's own text. Answers cached before this change are never served again (the cache key carries a version).
5. Secrets (Dashboard, Edge Functions, Secrets): `OPENROUTER_API_KEY` (required, and the only place the key may live: the function has no in-source fallback). Optional: `AI_MODELS` (comma-separated OpenRouter model ids, tried in order), `AI_DAILY_LIMIT` (default 80 calls a day per person), `AI_GLOBAL_DAILY_LIMIT` (default 3000 calls a day across everyone; 0 turns AI off), `ALLOWED_ORIGINS` (comma-separated, added to the built-in app and localhost origins).

The OpenRouter key lives only in that secret. It must never be put in the app, in `.env`, or in git.

## Data model

| Table | What it holds |
|---|---|
| `profiles` | One row per person: portable settings (tone, reminder time, pet rules), timezone. Also a copy of the first track's settings under the old keys, for app versions from before tracks |
| `companions` | Each companion's life: species, name, born and died dates, and (0006) the track it belongs to |
| `habits` | One recovery track each: what is being tracked, its class weight, unit and check-in questions (validated JSON array), and (0006) description, start date, status (active, paused, archived) and its own settings and pause history (`track`) |
| `entries` | One row per slip: date, optional time, answers (never photos), amount |
| `deductions` | The cost of each slip: months lost, severity, body effects, explanation, source. `ai_adjust_pct` and `source: 'ai'` appear only on slips saved by apps up to 3.1.0; newer slips are always the engine's number |
| `clean_days` | Days marked as goal met, keyed by habit and day |
| `urges` | Urges noticed: strength, outcome, and (0005) the strategy used and what set it off |
| `journal` | One short reflection per day |
| `weekly_reports` | Written weekly summaries, per track |
| `ai_usage`, `ai_cache` | Per-person daily AI cap and a per-person result cache (keyed by user and the exact request); service role only. Cache rows hold the AI's sentence, which can quote the pet's name and amounts. They are kept **7 days**: the function ignores older rows and deletes expired ones on each cache write (no scheduler, no migration), and stamps `created_at` afresh when an answer is refreshed. Rows of people who stop using AI are only deleted when someone else next triggers a write, or with the account |

- Row level security on every table: a person reads and writes only rows with their own `user_id`, and child rows must point at parents they own.
- Ids are generated on the phone (UUIDs), so offline writes retry safely.
- `client_updated_at` is the phone's change time. A trigger ignores a write older than what is stored, so a slow phone can't overwrite a newer change. `updated_at` is server time and drives incremental pulls.
- Deletes are soft (`deleted_at`) so they reach other phones.
- `delete_my_account()` removes the auth user; every table cascades.
- Visible age is never stored. It is recomputed from entries, deductions and clean days, as the PRD requires.

## Proposed, NOT applied: account deletion needs a recent password sign-in

The app now asks for the password and signs in again before it calls `delete_my_account()` (`deleteAccount` in `apps/web/src/sync.ts`). That check lives in the app, so anyone holding a session token can still call the function directly. Real enforcement needs this change to the function, which is a database migration and so needs the owner's approval and a staging check first:

```sql
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  -- the token must carry a password sign-in from the last 5 minutes (a refresh keeps the original sign-in time)
  if not exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' = 'password' and (a ->> 'timestamp')::bigint > extract(epoch from now())::bigint - 300
  ) then raise exception 'recent password sign-in required'; end if;
  delete from auth.users where id = uid;
end; $$;
```

To verify on staging before applying: that the access token's `amr` claim holds the password sign-in time, that a token refresh keeps the original time, and that `supabase/tests/rls.sql` and `privacy.sql` (which call the function) still pass with a fresh sign-in. Until it is applied, deletion is protected against casual use of the app, not against a stolen session.
