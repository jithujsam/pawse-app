# Deploying membership to production

The runbook for taking membership (PRD §25, docs/MONETISATION.md) from this repository to production project `syysftnaubbpolrmicvd`. Nothing here has been run against production. Every write step needs the owner's go-ahead at the time.

Scripts: `supabase/deploy/membership/`. Migrations: `0014_membership.sql`, `0015_ai_cache_pet.sql`. Release: app 5.1.0 (code 81).

## What production has today (read-only audit, 2026-11-03)

| | State | Evidence |
|---|---|---|
| Migration history | 4 rows (`init_app_state_and_ai_usage`, `0007_breed`, `0011_urge_instead`, `0012_delete_needs_recent_signin`); the rest of 0002–0012 is in the schema but unrecorded | `list_migrations`, `list_tables` |
| Brutal personality (0013) | Applied (the personality check allows `savage`), unrecorded | `list_tables` |
| Membership | An earlier version of 0014 (commit `c2d3643`): tables except `signup_attempts` and `signup_limits`; functions except `network_key` and `network_hashes`; unrecorded | generated types, `list_tables` |
| Launch date | Unknown; most likely the moment that version was applied (about 2026-11-03 11:17–11:38 UTC), which would end every existing trial about 2026-11-10 | inferred; `01-preflight.sql` settles it |
| AI function | v14 (deployed 2026-10-25), no membership checks, no `pet` kind, rejects slips that carry `personality` | `get_edge_function` |
| App | 5.0.20 (code 80): no membership UI, no pet lines | `pawse-releases/latest.json` |

## Why this order

1. **Database first.** Production already has `my_access()`. Any 5.1.0 phone would enforce whatever trial dates are stored now, so the launch date must be right before 5.1.0 exists anywhere.
2. **AI function second.** 5.1.0 sends `personality` on slips and asks for pet lines. v14 refuses both (400), so 5.1.0 would get no AI wording until the new function is live. The new function still accepts 5.0.20's requests unchanged, so deploying it first is safe for everyone on 5.0.20. They keep AI while their trial runs, which after step 1 is until the launch date + 7 days. Only accounts with an unconfirmed email stop getting AI wording (trial AI needs a confirmed email), and they quietly keep the hand-written text.
3. **App last.** 5.1.0 then works fully from its first launch.

## Before anything: owner decisions

1. **The official launch date.** Every trial ends 7 days after it. Without a payment provider, nobody can buy, so after launch + 7 days every account meets a paywall with no way through (data and export stay available). **Don't pick a date until the provider decision makes buying possible by then**, or pick one far enough out.
2. Who runs production SQL, from which machine, and with which connection string (the session pooler; the direct host is IPv6-only on the Free plan).
3. Whether to record 0013/0014/0015 in `supabase_migrations.schema_migrations` (see "Migration history" below).

## Step 1. Back up (no writes)

```bash
mkdir -p backup && supabase login && supabase link --project-ref syysftnaubbpolrmicvd
```
```bash
supabase db dump --linked --role-only -f backup/roles.sql
```
```bash
supabase db dump --linked -f backup/schema.sql
```
```bash
supabase db dump --linked --data-only --use-copy -f backup/data.sql
```
```bash
mkdir -p backup/ai-v14 && (cd backup/ai-v14 && supabase functions download ai --project-ref syysftnaubbpolrmicvd)
```
Check that the data dump includes `auth.users` (trial dates come from account creation times); see `supabase db dump --help`. Encrypt the folder (`age` or `gpg`) and keep it off Supabase: the Free plan has no automatic backups. The v14 source also matches this repository at commit `54b4d81`.

## Step 2. Read-only pre-flight

```bash
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/deploy/membership/01-preflight.sql > preflight.txt
```
It runs inside `begin transaction read only … rollback` and prints no email addresses. Stop and review if:
- `users_without_trial` or `trials_without_user` isn't 0;
- the function fingerprints for `access_for`, `my_access`, `apply_payment_event`, `grant_trial`, `set_membership_launch` and `trial_start` don't match `c2d3643`'s (`bb8977f2…`, `a91d4215…`, `d40365d3…`, `655ad56b…`, `16d8d10c…`, `e9ceb70d…`, measured on Postgres 16, so check that formatting matches);
- a trigger on `auth.users` other than `on_auth_user_created_grant_trial` exists;
- `ai_cache` has rows whose kind isn't `slip` or `weekly`;
- `rls_auto_enable` isn't Supabase's documented event-trigger function.

## Step 3. Apply 0014 and 0015 (one transaction each)

```bash
psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f supabase/migrations/0014_membership.sql
```
```bash
psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f supabase/migrations/0015_ai_cache_pet.sql
```
0014 over the older version: creates `signup_attempts`, `signup_limits`, `network_key`, `network_hashes`; replaces `abuse_hit` and the sign-up hook; re-creates the trial trigger on `auth.users` (a lock of a moment); fills in trials only for accounts that have none; keeps the stored launch date. It changes no existing trial, plan, payment event or recovery row. 0015 widens one check on `ai_cache`. Never use `supabase db push`: the repository's `00NN_` versions don't match production's timestamp versions.

## Step 4. Set the official launch date

Only after step 3, and only while no build that enforces membership is live (5.1.0 not released, AI function not yet deployed):
```bash
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v launch='YYYY-MM-DD HH:MM:SS+00' -f supabase/deploy/membership/03-set-launch.sql
```
It moves the launch date and every trial with it in one transaction (each trial starts at the later of registration and launch). Once the date is set and still ahead, `select public.set_membership_launch('<date>');` can move it again; after it passes, trial dates are fixed.

## Step 5. Verify (read-only)

```bash
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/deploy/membership/04-verify.sql
```
Every line must show its expected value. Then run the security advisors (Dashboard → Advisors) and compare with the audit: no new warnings.

## Step 6. Deploy the AI function

From this repository at the release commit:
```bash
supabase functions deploy ai --project-ref syysftnaubbpolrmicvd
```
It uses `supabase/functions/ai/deno.json` and the frozen `deno.lock`. JWT verification stays on by default (don't pass `--no-verify-jwt`). No new secrets are required. The defaults are 20 AI calls a day during a trial, 200 trial calls a day per network and 80 a day on the AI plan; set `AI_TRIAL_DAILY_LIMIT` or `AI_TRIAL_NETWORK_DAILY_LIMIT` to change them.

Smoke test: `curl -s -X POST https://syysftnaubbpolrmicvd.supabase.co/functions/v1/ai -d '{}' -w ' %{http_code}\n'` → 401. Then, on a 5.0.20 phone signed in to a test account with a confirmed email, log a slip in full: the explanation comes back AI-written. In the function's logs, check that the caller's address arrives in `x-forwarded-for`. If no address header arrives, the per-network trial limit is inactive; it fails open, and the per-account limit still applies.

## Step 7. Release 5.1.0

Build it on GitHub: Actions → Android APK → Run workflow → `release`. The `apk` job builds, signs and verifies it (package, version 5.1.0/81, embedded web version, not debuggable, release certificate). Publish only once steps 3–6 are verified, with `publish` ticked on `main` and the one-line notes from `docs/RELEASE_NOTES_5.1.0.md`.

## Optional, any time after step 5

- Sign-up rate limit: Authentication → Hooks → Before User Created → Postgres → `public.hook_before_user_created` (Free plan: available). Then sign up one test account and check its trial row.
- Leaked-password protection: Authentication → Policies.
- `rls_auto_enable()`: if it is Supabase's documented event-trigger function, revoke `anon` execute on it if not wanted.

## Rollback

| What | How | Effect |
|---|---|---|
| AI function | Deploy `backup/ai-v14` (or this repository at `54b4d81`) | Immediate; back to no membership checks |
| 0014 functions | `psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f supabase/deploy/membership/90-rollback-0014.sql` | Restores production's previous `abuse_hit` and sign-up hook; changes no trial or data (rehearsed: fingerprints back to `600f5961…` and `a954fdda…`) |
| 0015 | Not needed: a wider check never blocks anything | — |
| Launch date | Before it passes: `set_membership_launch()`; after: `03-set-launch.sql` again, before any enforcing build is live | Moves every trial |
| Sign-up hook | Switch it off in Authentication → Hooks | Immediate |
| Anything else | Restore from step 1's backup | Downtime; last resort |

Not reversible: AI text already generated; trial dates once a build that enforces them has been live (people will have seen them).

## Migration history

Production records only 4 of 15 migrations, under timestamp versions created by whatever applied them. Recording 0013–0015 is optional. Nothing reads the table except the Supabase CLI (`db push`, `migration list`), which can't be used as-is anyway. If wanted, decide on one convention first (for example the repository's numbers, `0013`/`0014`/`0015`, as versions) and record all three at once with the owner's approval, rather than mixing styles.

## Rehearsal (2026-11-03, local Postgres 16)

Simulated production: 0001–0012, main's 0013, 10 accounts (one unconfirmed), a Brutal pet, then the `c2d3643` membership with no launch date. Results:
- `01-preflight.sql` ran read-only.
- 0014 and 0015 applied in one transaction each.
- `03-set-launch.sql` moved all 10 trials to the launch date.
- `04-verify.sql`: every expectation held.
- `90-rollback-0014.sql` restored the previous function fingerprints with no data change, and 0014 re-applied cleanly.
