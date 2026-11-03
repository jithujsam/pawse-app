# Supabase setup

The app needs an account to start (see `apps/web/src/App.tsx`); after that it keeps working offline and syncs when it can. The account adds backup, sync across phones and the written AI insights.

1. Create a project. The app ships with this project's public URL and publishable key (`apps/web/src/supabase.ts`); to point it elsewhere set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/web/.env`.
2. Apply the migrations in order, 0001 to 0013. Each is additive; all but 0002 (plain `create table`) are safe to re-run. 0005 adds an urge's coping strategy and trigger; 0006 adds recovery tracks (a description, start date, status and per-track settings on each habit, and the owning track on each companion; see `docs/MULTI_TRACK_ARCHITECTURE.md`). 0007 adds dog breeds; 0008 adds each companion's adoption mode and mission memory, and a check that refuses goal-met days in the future; 0009 and 0010 add `mission_journey()`, the server's own copy of the 21-day journey rules (PRD §23; 0010 replaces 0009's version). 0011 adds what a person did instead of acting on an urge (the goal itself lives in the track's plan, so it needs no column). 0012 makes `delete_my_account()` require a sign-in from the last 5 minutes. 0013 adds membership (PRD §24, `docs/MONETISATION.md`): a seven-day trial per account, annual Basic and AI plans, payment events, effective access and hashed abuse counters, and changes no recovery table. Apps keep syncing without any of these until they are applied. Check them on a disposable database first with `tests/local-auth-stub.sql` and every migration, then `tests/rls.sql`, `tests/privacy.sql`, `tests/recovery.sql`, `tests/tracks.sql`, `tests/missions.sql`, `tests/delete-account.sql`, `tests/membership.sql` and `tests/membership-launch.sql`. Apply 0013 with the official launch date set in the same session (`set app.membership_launch = '<date>';`): accounts registered before it get seven days from launch, later ones seven days from registration (`docs/MONETISATION.md` §3).
3. Authentication: leave email sign-in on and turn on leaked-password protection. Under Authentication → URL Configuration, add `app.detoxcompanion://auth-callback` to Redirect URLs, so confirmation and password-reset emails open the Android app (PKCE code exchange in `src/deeplink.ts`). Add your web address too if you host the web build.
4. Deploy `functions/ai` (`supabase functions deploy ai`) with JWT verification ON, **after** 0013: the function asks `access_for()` before every AI request, and refuses AI when it can't. `functions/_shared` is shared code (the payment webhook contract), never deployed on its own.
   Optional: switch on the sign-up rate limit under Authentication → Hooks → Before User Created → Postgres → `public.hook_before_user_created` (30 new accounts an hour and 100 a day per network, counting only attempts that became accounts, tunable in `signup_limits`; it lets sign-ups through if it fails; only salted hashes, deleted within two days). The function's Deno setup is `functions/ai/deno.json` with a frozen `deno.lock` (format 4, readable by Deno 2.1 and later).
5. Secrets (Dashboard, Edge Functions, Secrets): `OPENROUTER_API_KEY` (required, and the only place the key may live: the function has no in-source fallback). Optional: `AI_MODELS` (comma-separated OpenRouter model ids, tried in order), `AI_DAILY_LIMIT` (default 80 calls a day for the AI plan), `AI_TRIAL_DAILY_LIMIT` (default 20 a day during the trial), `AI_TRIAL_NETWORK_DAILY_LIMIT` (default 200 trial calls a day per network), `AI_GLOBAL_DAILY_LIMIT` (default 3000 calls a day across everyone; 0 turns AI off), `ALLOWED_ORIGINS` (comma-separated, added to the built-in app and localhost origins).

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
| `urges` | Urges noticed: strength, outcome, (0005) the strategy used and what set it off, and (0011) what they did instead. Photos never leave the phone |
| `journal` | One short reflection per day |
| `weekly_reports` | Written weekly summaries, per track |
| `ai_usage`, `ai_cache` | Per-person daily AI cap and a per-person result cache (keyed by user and the exact request); service role only |
| `trial_grants` | (0013) One seven-day trial per account, dated from registration. Readable by its owner; written only by the sign-up trigger |
| `entitlements` | (0013) The account's annual plan (`basic` or `ai`), its period and status. Readable by its owner; written only by `apply_payment_event()` (service role) |
| `payment_events` | (0013) Every payment event once, by provider and event id, with what it did. Service role only; kept, unlinked, after an account is deleted |
| `abuse_salts`, `abuse_counters`, `signup_attempts`, `signup_limits` | (0013) Short-lived, salted-hash counters for trial AI and sign-ups per network, and the sign-up limits. Service role only; nothing older than two days is kept |

- Row level security on every table: a person reads and writes only rows with their own `user_id`, and child rows must point at parents they own.
- Ids are generated on the phone (UUIDs), so offline writes retry safely.
- `client_updated_at` is the phone's change time. A trigger ignores a write older than what is stored, so a slow phone can't overwrite a newer change. `updated_at` is server time and drives incremental pulls.
- Deletes are soft (`deleted_at`) so they reach other phones.
- `delete_my_account()` removes the auth user; every table cascades.
- Mission progress is never stored either: `mission_journey()` (0010) recomputes it from `clean_days` and `entries`, under the same row level security.
- Membership (0013) never touches a recovery table: no policy, check or trigger on them looks at a trial or plan, so sync never refuses a row because access ended. `my_access()` tells the signed-in person what they may do; `access_for()` is the server's copy for the AI function.
- Visible age is never stored. It is recomputed from entries, deductions and clean days, as the PRD requires.

## Free plan and backups

Everything here runs on Supabase's Free plan. Its limits that matter (inactive projects are paused, no automatic backups, capped invocations, size and egress) and the off-site backup and restore procedure to follow before accepting real customers are in `docs/MONETISATION.md` §8. Production deployment steps for membership are in §9 there.
