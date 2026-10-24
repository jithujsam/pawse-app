# Supabase setup

The app works fully offline without any of this. An account adds backup, sync across phones and the written AI insights.

1. Create a project. The app ships with this project's public URL and publishable key (`apps/web/src/supabase.ts`); to point it elsewhere set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/web/.env`.
2. Apply the migrations in order: `migrations/0001_init.sql`, then `migrations/0002_normalized.sql`.
3. Authentication: leave email sign-in on and turn on leaked-password protection. Under Authentication → URL Configuration, add `app.detoxcompanion://auth-callback` to Redirect URLs, so confirmation and password-reset emails open the Android app (PKCE code exchange in `src/deeplink.ts`). Add your web address too if you host the web build.
4. Deploy `functions/ai` (`supabase functions deploy ai`) with JWT verification ON.
5. Secrets (Dashboard, Edge Functions, Secrets): `OPENAI_API_KEY` (uses OpenAI directly, model `gpt-4.1-mini`, with `store: false`) or `OPENROUTER_API_KEY` (used when there's no OpenAI key). Optional: `OPENAI_MODEL`, `AI_MODELS` (comma-separated OpenRouter model ids, tried in order), `AI_DAILY_LIMIT` (default 80 calls a day per person), `ALLOWED_ORIGINS` (comma-separated, added to the built-in app and localhost origins).

The provider key lives only in that secret. It must never be put in the app, in `.env`, or in git. Paste it straight from the provider's copy button: the function strips invisible characters, but it can't repair a typo. On a failed call the function logs the provider's error code and the key's length, never the key.

## Data model

| Table | What it holds |
|---|---|
| `profiles` | One row per person: portable settings (tone, tint, reminder time, goal), timezone |
| `companions` | Each companion's life: species, name, born and died dates |
| `habits` | What is being tracked, its class weight, unit and check-in questions (validated JSON array) |
| `entries` | One row per slip: date, optional time, answers (never photos), amount |
| `deductions` | The cost of each slip: months lost, severity, AI adjustment, body effects, explanation, source |
| `clean_days` | Days marked clean, keyed by habit and day |
| `weekly_reports` | Written weekly summaries |
| `ai_usage`, `ai_cache` | Per-person daily AI cap and a shared result cache; service role only |

- Row level security on every table: a person reads and writes only rows with their own `user_id`, and child rows must point at parents they own.
- Ids are generated on the phone (UUIDs), so offline writes retry safely.
- `client_updated_at` is the phone's change time. A trigger ignores a write older than what is stored, so a slow phone can't overwrite a newer change. `updated_at` is server time and drives incremental pulls.
- Deletes are soft (`deleted_at`) so they reach other phones.
- `delete_my_account()` removes the auth user; every table cascades.
- Visible age is never stored. It is recomputed from entries, deductions and clean days, as the PRD requires.
