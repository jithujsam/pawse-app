# Supabase setup

1. Create a project. Copy its URL and its publishable (anon) key into `apps/web/.env` (see `.env.example`).
2. Run `migrations/0001_init.sql` in the SQL editor.
3. Authentication: leave email sign-in on. For quick testing you can turn "Confirm email" off.
4. Deploy `functions/ai` (CLI: `supabase functions deploy ai`) with JWT verification ON.
5. Add the secret `OPENROUTER_API_KEY` (Dashboard, Edge Functions, Secrets). Optional: `AI_MODEL`, `AI_DAILY_LIMIT` (default 80 calls a day per person).

The OpenRouter key lives only in that secret. It must never be put in the app, in `.env`, or in git.
