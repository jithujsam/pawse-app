# Supabase setup

The app needs an account to start (see `apps/web/src/App.tsx`); after that it keeps working offline and syncs when it can. The account adds backup, sync across phones and the written AI insights.

1. Create a project. The app ships with this project's public URL and publishable key (`apps/web/src/supabase.ts`); to point it elsewhere set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/web/.env`.
2. Apply the migrations in order, 0001 to 0010. Each is additive and safe to re-run. 0005 adds an urge's coping strategy and trigger; 0006 adds recovery tracks (a description, start date, status and per-track settings on each habit, and the owning track on each companion; see `docs/MULTI_TRACK_ARCHITECTURE.md`). 0007 adds dog breeds; 0008 adds each companion's adoption mode and mission memory, and a check that refuses goal-met days in the future; 0009 and 0010 add `mission_journey()`, the server's own copy of the 21-day journey rules (PRD §23; 0010 replaces 0009's version). Apps keep syncing without any of these until they are applied. Check them on a disposable database first with `tests/local-auth-stub.sql`, then `tests/rls.sql`, `tests/privacy.sql`, `tests/recovery.sql`, `tests/tracks.sql` and `tests/missions.sql`.
3. Authentication: leave email sign-in on and turn on leaked-password protection. Under Authentication → URL Configuration, add `app.detoxcompanion://auth-callback` to Redirect URLs, so confirmation and password-reset emails open the Android app (PKCE code exchange in `src/deeplink.ts`). Add your web address too if you host the web build.
4. Deploy `functions/ai` (`supabase functions deploy ai`) with JWT verification ON.
5. Secrets (Dashboard, Edge Functions, Secrets): `OPENROUTER_API_KEY` (required, and the only place the key may live: the function has no in-source fallback). Optional: `AI_MODELS` (comma-separated OpenRouter model ids, tried in order), `AI_DAILY_LIMIT` (default 80 calls a day per person), `AI_GLOBAL_DAILY_LIMIT` (default 3000 calls a day across everyone; 0 turns AI off), `ALLOWED_ORIGINS` (comma-separated, added to the built-in app and localhost origins).

The OpenRouter key lives only in that secret. It must never be put in the app, in `.env`, or in git.

## Data model

| Table | What it holds |
|---|---|
| `profiles` | One row per person: portable settings (tone, reminder time, pet rules), timezone. Also a copy of the first track's settings under the old keys, for app versions from before tracks |
| `companions` | Each companion's life: species, name, born and died dates, (0006) the track it belongs to, and (0008) its adoption mode and mission memory |
| `habits` | One recovery track each: what is being tracked, its class weight, unit and check-in questions (validated JSON array), and (0006) description, start date, status (active, paused, archived) and its own settings and pause history (`track`) |
| `entries` | One row per slip: date, optional time, answers (never photos), amount |
| `deductions` | The cost of each slip: months lost, severity, AI adjustment, body effects, explanation, source |
| `clean_days` | Days marked as goal met, keyed by habit and day |
| `urges` | Urges noticed: strength, outcome, and (0005) the strategy used and what set it off |
| `journal` | One short reflection per day |
| `weekly_reports` | Written weekly summaries, per track |
| `ai_usage`, `ai_cache` | Per-person daily AI cap and a per-person result cache (keyed by user and the exact request); service role only |

- Row level security on every table: a person reads and writes only rows with their own `user_id`, and child rows must point at parents they own.
- Ids are generated on the phone (UUIDs), so offline writes retry safely.
- `client_updated_at` is the phone's change time. A trigger ignores a write older than what is stored, so a slow phone can't overwrite a newer change. `updated_at` is server time and drives incremental pulls.
- Deletes are soft (`deleted_at`) so they reach other phones.
- `delete_my_account()` removes the auth user; every table cascades.
- Mission progress is never stored either: `mission_journey()` (0010) recomputes it from `clean_days` and `entries`, under the same row level security.
- Visible age is never stored. It is recomputed from entries, deductions and clean days, as the PRD requires.
