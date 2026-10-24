# Pawse overnight work log

Started 2026-10-24. Source of the backlog: `docs/PAWSE_PRODUCT_AND_SYSTEM_AUDIT.md` (finding ids B1–B26). The rules come from `.claude/commands/pawse-overnight.md` (on `main`).

## Setup and assumptions

- **Branch.** This session can only push to `claude/pawse-audit-6h0t1a`, so the work lives there, not on `codex/pawse-overnight`. `main` was merged in first (`f787d5a`). Nothing was merged to `main`.
- **Dependencies.** I ran `pnpm install --frozen-lockfile` (lockfile only, no new dependencies).
- **Baseline before any change:** `pnpm test` gave 68/68 passing (schema 10, engine 20, web 38). `pnpm typecheck` was clean.
- **Not done by rule:** no deploys, no migrations applied, no production data or settings touched, no APK built or published.

## Checklist

| # | Item (audit id) | Status | Commit | Verification |
|---|---|---|---|---|
| 1 | Erasing the phone's copy deleted the cloud copy (B1) | **Done** | `44d03fb` | `test/reset.test.ts` runs the real sync loop against an in-memory Supabase stand-in. It fails without the fix (rows get `deleted_at`) and passes with it |
| 2 | AI cache shared across users or stale (B2); key hard-coded in the function (B19); cache outliving the account (B20) | **Done in repo**, not deployed | `98fba1e` | `test/ai.test.ts`. Migration 0004 plus `supabase/tests/privacy.sql` run on a local Postgres 16: 11/11 PASS with 0004, 4 FAIL without it |
| 3 | AI clamp cut big slips by up to 50% (B3); AI could tip the pet into death | **Done** | `8995721` | Engine test over a baseline × adjustment grid; store test for the death guard; pacing re-run (unchanged, logged in `docs/tuning.md`) |
| 4 | Missing days treated as failure (quiet-day ageing, heart penalty, guilt copy) or as savings (money kept, pace) | **Done** (switchable) | `58904d5` | Store and health tests |
| 5 | Web reminders claimed to be on but never fired (B4) | **Done** | `79dd735` | `test/notify.test.ts` (fails before the fix) |
| 6 | Crisis check didn't cover reflections (B22) | **Done** | `79dd735` | Typecheck. No UI test harness exists |
| 7 | Widget showed slip status while a PIN was set (B21) | **Done** | `79dd735` | Typecheck. Needs a device to see it |
| 8 | Anon still held privileges on the 0001 tables (confirmed live) | **Done in repo**, not applied | `98fba1e` | `privacy.sql` |
| 9 | You could mark old days clean but couldn't log old slips (B6) | **Done** | `17e2be5` | Store test |
| 10 | An open app didn't roll over at midnight | **Done** | `943b63c` | Typecheck + build. Timer behaviour needs a device |
| 11 | Monetisation readiness | **Documented only** (below) | — | — |
| 12 | Full checks, diff review, push | **Done** | — | See "Final checks" |

## Round 1: what changed, and why

1. **Local erase is local** (`store.resetAll`, `sync.onCommit`). The wipe now commits as `"reset"`, and sync treats that as "start over". Before, it was treated as "the user deleted everything". The next sync is a first sync, which restores the account. Sign-out and account deletion were already safe (sync is stopped first). The erase copy in Me now says the account keeps its copy while you're signed in. The on-phone AI cache is cleared too.
2. **AI cache.**
   - Server: the key is `sha256(user id + whole validated request)`, so results are only reused for the same person and the same request. Cached rows carry `user_id` (cascade on account delete).
   - The `DEPLOY_KEY` fallback is gone: the OpenRouter key can only come from the secret.
   - Client: the cache key is the whole request.
   - Migration `0004_privacy_hardening.sql` adds `ai_cache.user_id`, deletes ownerless (formerly shared) cache rows, and revokes anon/authenticated privileges on `ai_cache`, `ai_usage` and `app_state`.
3. **AI bounds.** `applyAiAdjustment` keeps every result within ±30% of the baseline and never cuts a >12-month baseline to 12 just because the AI answered. `applyAi` keeps the baseline months whenever the AI's nudge alone would decide life or death.
4. **Missing data.**
   - A day with nothing logged is now neutral: no damage, no healing. This is controlled by `QUIET_DAYS_AGE = false` in `store.ts`; the engine rule and its tests are untouched.
   - The heart no longer drops for silence. The "lonely" condition is mild. The Home line, the health banner and the 7- and 10-day lapse notifications no longer say the pet is ageing or fading.
   - Money kept and "since you started" pace count only checked-in days (`checkedInDays`, `moneyKept`, `recentPace` in `store.ts`).
5. **Smaller fixes.** Web reminders stay off and the toggle explains why. Reflections get the crisis check and aren't saved when it triggers. The widget is neutral while a PIN is set. The calendar can log a slip for any past day since birth. The app re-renders at local midnight and on return from the background.

## Product decision taken on your behalf (please confirm)

- **Quiet days no longer age the pet.** This departs from PRD §5.3 "Missed check-ins (v3)" and from audit decision #3. I followed the overnight brief ("do not treat missing data as proof of failure"). To restore the PRD rule, set `QUIET_DAYS_AGE = true` in `apps/web/src/store.ts`. No stored data changes either way, but pets whose age included loneliness damage now show a lower age.
- **Not changed, still open:** death, the scar floor and binge scars (PRD open questions 1 and 3); single-habit scope; whether AI should adjust months at all; and whether journal text should sync.

## Round 1 checks (all actually run)

| Check | Result |
|---|---|
| `pnpm test` | **81/81 pass** (schema 10, engine 21, web 50), up from 68 |
| `pnpm typecheck` (also the repo's `lint`) | Clean |
| `pnpm build` | Succeeds. The >500 kB chunk warnings (`Pet3D`, `index`) were already there before this work |
| `pnpm simulate` | Pacing unchanged |
| Migrations 0001–0004 + `rls.sql` + `privacy.sql` on a local Postgres 16 | All expected results; 0004 re-runs cleanly |
| Secret scan of the diff | No keys or tokens |
| Not run | `e2e-live.cjs` (touches the live project), Android build, any device test, Deno type-check of the edge function (no Deno installed; changes reviewed by hand) |

## Round 2: release-readiness pass (2026-10-24)

PR #12 (round 1) was merged into `main` at `d8837ea`. This branch was restarted from `main` (`228951d`), so round 2 is new work on top.

### Review of round 1 (verified against the code)

| Area | Verdict | Evidence |
|---|---|---|
| Local erase never deletes the account | Holds | `reset.test.ts`; but see the race fix below |
| AI cache isolation | Holds | `ai.test.ts` (client + server key) |
| AI clamp ±30% | Holds | engine grid test |
| Missing days | Holds | `store.test.ts`, `health.test.ts` |
| Historical slip logging | Holds | `store.test.ts` |
| Midnight rollover | Code holds; timer behaviour needs a device | — |
| PIN/widget privacy | Widget didn't refresh on PIN change, **fixed** | `backup.test.ts` |
| Migration 0004 | Holds; re-runs cleanly | local Postgres 16 |
| Docs accuracy | Round-1 log was accurate. Its manual steps said "rotate the key now", which conflicts with this round's instruction to keep the key, so the steps are updated below. Status note added to the audit | — |

### Problems found and fixed in round 2

| Commit | Change |
|---|---|
| `4c5aa9f` | **Sync race.** A cycle in flight when the user signed out or wiped the phone carried on afterwards. It could put the account's rows back on a just-wiped, signed-out phone, or write old cursors into the fresh sync state. A generation counter now makes a stale cycle stop at its next step, and the restore runs straight after an erase. The sign-out race test fails without the fix. The erase-mid-pull test passes with or without it, because per-table cursors mean the other tables still get pulled in full; it stays as coverage. |
| `4c5aa9f` | After an erase while signed in, the app showed onboarding until the restore landed, which invited a duplicate pet. It now shows "checking your account". Status stays "off" when a cycle finishes after sign-out. |
| `4c5aa9f` | Money kept counted spending from a previous companion's life against days counted only since the current one was born. Now it counts this life only. |
| `d7e7369` | The widget didn't change until the next data edit after the PIN was turned on or off; it now updates immediately. A failed PIN-length write no longer aborts setting a PIN. |
| `fcfea1d` | The server AI cache key moved into `supabase/functions/ai/cache.ts` (same logic, imported by `index.ts`) so it can be unit tested. |

### Tests added in round 2

- **Sync** (`reset.test.ts`, with an in-memory Supabase stand-in that honours incremental pulls): erase mid-pull; sign-out mid-pull; offline edits wait and go up later; a newer remote edit wins over an older unsent local one; a newer local edit wins and is pushed.
- **AI** (`ai.test.ts`):
  - the server key is per person and changes with any request field;
  - network errors, the limit, out-of-range or unsafe answers, unknown tags, extra fields and non-JSON all fall back and are never cached;
  - signed out means no call;
  - the weekly summary must cite a number.
- **Dates** (`dates.test.ts`): day arithmetic across DST in New York, London, Kolkata and Sydney (it checks the zone is really applied); `today()` turns over at local midnight; late night = 22:00–03:59.
- **Days** (`store.test.ts`): a slip ages, a clean day heals, a quiet day does neither; clean is refused on a slip day and is idempotent; money kept after rebirth.
- **Backup and PIN** (`backup.test.ts`): a round trip with photos and reflections; bad files refused with data untouched; damaged rows salvaged; the sealed copy contains no readable text; a fresh IV every time; PIN-change notifications.
- **Local erase vs account deletion:** account deletion is the `delete_my_account` RPC, which is covered by `supabase/tests/rls.sql` and `privacy.sql` (cascade, including the AI cache). Its client sequence (stop sync → sign out → wipe the phone) is covered by the sign-out test. No UI test harness exists, so the button flows themselves aren't automated.

### Commands run in round 2 and results

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK, lockfile unchanged |
| `pnpm lint` (= `tsc --noEmit` per package) | Clean |
| `pnpm typecheck` | Clean |
| `pnpm test` | **115/115 pass**: engine 21, schema 10, web 84 (10 files). No pre-existing failures |
| `pnpm build` | Succeeds. The >500 kB chunk warnings (`Pet3D`, `index`) were already there |
| `pnpm simulate` | Pacing table unchanged |
| Local Postgres 16: stub + migrations 0001–0004, 0004 re-run, `rls.sql`, `privacy.sql` | Migrations OK and idempotent; RLS output as expected; privacy 11/11 PASS |
| Not run | `test/e2e-live.cjs` (hits the live project), Android build (no SDK here), Deno type-check of the function (no Deno; edits reviewed by hand), any device test |

## Security and privacy status

- **Fixed in the repo:** local erase propagating to the cloud (B1); the shared AI cache (B2); an AI cache that outlived the account (B20); no in-source key fallback (B19, repo only); widget status while locked (B21); the crisis check on reflections (B22); stale sync cycles after sign-out; and (in 0004) privileges that anon and authenticated still held on the 0001 tables.
- **Still true in production until you act:** the deployed `ai` function still contains a hard-coded OpenRouter key and the old shared cache; leaked-password protection is off; the anon grants are unchanged; the migration history lists only 0001.
- **Still open by design:** 4–6 digit PINs can be brute-forced offline if someone copies the app's storage; the Supabase session, on-phone AI cache and widget name aren't encrypted; cloud rows are plaintext under RLS (no end-to-end encryption); notification text can show on the lock screen.

## Steps required before release (in order)

None of these can be done from this session.

1. **Make sure the function will still have a key once its source no longer contains one.** You asked to keep the current OpenRouter key for now, so put that same key into the `OPENROUTER_API_KEY` secret (Dashboard → Edge Functions → Secrets) and check that it's well formed. An earlier commit added the in-source fallback because the secret was malformed. If the secret is missing or malformed, the redeployed function answers `upstream`/`not_configured` errors: the app keeps working on the deterministic baseline, but every AI line and weekly summary stops.
2. **Deploy the `ai` function from `main` after this PR merges:** `supabase functions deploy ai`, with `verify_jwt` on. Check the dashboard copy no longer contains a key.
3. **Then apply `0004_privacy_hardening.sql`** to production. That order matters: if 0004 goes first, the old function keeps writing shared, ownerless cache rows until it's redeployed. Afterwards, consider recording 0002–0004 in the migration history (the live project lists only 0001).
4. Turn on leaked-password protection (Auth settings).
5. Bump `apps/web/version.json` (the code must go up), build a signed release APK (`pnpm --filter web build`, `npx cap sync android`, `./gradlew assembleRelease` with the keystore), then publish it and update `latest.json` in `pawse-releases`. The data-loss fix only reaches users through a new APK.
6. **Device testing on a real Android phone** (none of this could be done here):
   - sign up, confirm by email link, sign in, sign out, reset the password;
   - a second phone signing in to an existing account (first sync restores, no duplicate pet);
   - airplane-mode check-ins that sync later;
   - "Delete all data on this phone" while signed in (the history comes back), and account deletion (it doesn't);
   - set a PIN, background the app, wait for the auto-lock, then use "Forgot PIN" (the history comes back);
   - widget: it shows status without a PIN and "Tap to check in" with one, updating right after a PIN change;
   - daily reminder, care notes, risky-hour and lapse notifications, including the Android 13+ permission prompt and the daily count;
   - midnight rollover with the app open;
   - the 3D pet on a low-end phone;
   - AI unavailable (airplane mode during a slip): the baseline line stands.
7. Confirm or reverse the quiet-day decision (`QUIET_DAYS_AGE`).

**Release-ready verdict:** not yet. The code and automated checks are in good shape, but steps 1–6 above (production function and migration, auth setting, signed APK, device testing) are essential and still outstanding.

## Follow-ups

- **Rotate the OpenRouter key.** Deliberately not done in this round, at your instruction. The current key has appeared in plaintext in the deployed function source and in an earlier session transcript. Once the secret-only deployment works, revoke it in OpenRouter, create a new one, and update the secret.
- **B17:** a new phone that logs data before its first successful sync still keeps two companions side by side. This needs a product rule for merging histories.
- **B12:** `deductions.baseline_months` is still sent as null.
- **B11:** some lines aren't in all three tones (e.g. `dyingBanner`, the LogSheet absorbed/binge notes).
- **B5b:** notification volume can exceed two a day; measure it on a device first.
- Pet death is still permanent (a product decision).
- Large bundle chunks (`Pet3D` ~1 MB); consider further splitting.
- **Subscription and pricing validation:** test willingness to pay ₹99/month with target users, decide on distribution (store billing vs sideloaded plus a payment provider), and specify what would be gated before any billing or entitlement code is written. No payment code was added (see below).

## Monetisation readiness (no billing added)

**Current state:** there's no subscription, payment, entitlement or paywall code anywhere, and the app is distributed as a sideloaded APK.

**Hypothesis:** a ₹99/month paid-only plan would need:

1. A distribution decision. A store listing would mean store billing; sideloading would mean a third-party provider and webhooks.
2. A server-owned `entitlements` table (user_id, plan, status, current_period_end, source), writable only by the service role from verified provider webhooks or receipts, readable by its owner under RLS.
3. One client boundary, e.g. `useEntitlement()`, that reads it, caches it for offline grace, and gates features. **Never gate access to the person's existing data or export:** paid status should unlock features, not hold history hostage.
4. Server-side enforcement for anything that costs money (the `ai` function should check entitlement next to `bump_ai_usage`).
5. A preview path. The existing Simulator, a sandbox using the real engine that touches no logs, is a ready-made interactive demo.

I didn't add an entitlement stub, because there's no product spec for what would be gated, and a half-built gate would be dead or misleading code.
