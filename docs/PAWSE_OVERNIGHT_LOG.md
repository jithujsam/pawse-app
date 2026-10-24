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

## What changed, and why

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

## Final checks (all actually run)

| Check | Result |
|---|---|
| `pnpm test` | **81/81 pass** (schema 10, engine 21, web 50), up from 68 |
| `pnpm typecheck` (also the repo's `lint`) | Clean |
| `pnpm build` | Succeeds. The >500 kB chunk warnings (`Pet3D`, `index`) were already there before this work |
| `pnpm simulate` | Pacing unchanged |
| Migrations 0001–0004 + `rls.sql` + `privacy.sql` on a local Postgres 16 | All expected results; 0004 re-runs cleanly |
| Secret scan of the diff | No keys or tokens |
| Not run | `e2e-live.cjs` (touches the live project), Android build, any device test, Deno type-check of the edge function (no Deno installed; changes reviewed by hand) |

## Manual steps for the owner (cannot be done from here)

1. **Rotate the OpenRouter key now.** The live function source contains a real key (audit addendum). Revoke it in OpenRouter, set the new one only as the `OPENROUTER_API_KEY` secret, then deploy `supabase/functions/ai` from this branch (`supabase functions deploy ai`, `verify_jwt` on).
2. Apply `supabase/migrations/0004_privacy_hardening.sql`. Until it's applied, the redeployed function can't write `user_id`, so it simply caches nothing; it doesn't fail. Consider recording 0002–0004 in the migration history, since the live project only lists 0001.
3. Turn on leaked-password protection (Auth settings).
4. Ship a new APK so phones get the B1 fix. The data-loss bug lives in the app, not the server.
5. Confirm or reverse the quiet-day decision above.

## Known limitations and follow-ups

- **B17 is not fixed.** A new phone that logs data before its first successful sync still ends up with two companions side by side. A correct fix needs a rule for merging the two histories; that's a product call.
- The widget only refreshes on the next data change after a PIN is turned on or off.
- `deductions.baseline_months` is still sent as null (B12). Storing it needs a new `Entry` field and sync mapping.
- Not every line exists in all three tones (B11), e.g. `dyingBanner` and the LogSheet absorbed/binge notes.
- Notification volume can still exceed two a day (B5b). It needs a device to measure before changing.
- Pet death remains permanent. Softening it is a product decision, not a bug.

## Monetisation readiness (no billing added)

**Current state:** there's no subscription, payment, entitlement or paywall code anywhere, and the app is distributed as a sideloaded APK.

**Hypothesis:** a ₹99/month paid-only plan would need:

1. A distribution decision. A store listing would mean store billing; sideloading would mean a third-party provider and webhooks.
2. A server-owned `entitlements` table (user_id, plan, status, current_period_end, source), writable only by the service role from verified provider webhooks or receipts, readable by its owner under RLS.
3. One client boundary, e.g. `useEntitlement()`, that reads it, caches it for offline grace, and gates features. **Never gate access to the person's existing data or export:** paid status should unlock features, not hold history hostage.
4. Server-side enforcement for anything that costs money (the `ai` function should check entitlement next to `bump_ai_usage`).
5. A preview path. The existing Simulator, a sandbox using the real engine that touches no logs, is a ready-made interactive demo.

I didn't add an entitlement stub, because there's no product spec for what would be gated, and a half-built gate would be dead or misleading code.
