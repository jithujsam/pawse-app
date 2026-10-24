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

## Round 3: remaining code issues (2026-10-24, same branch, PR #13)

### PR #13 CI
The only CI on the repo is the Vercel integration. Its "Vercel Preview Comments" check passes. The two Vercel *deployments* it reports, projects **commandcode** and **delecta**, fail. They failed identically on PR #12 when it contained only the audit document. They're Vercel projects attached to this repository from its earlier life (it previously held a different app) and don't build the Pawse app. The deployment logs need Vercel account access, which this session doesn't have. Not caused by this PR; nothing to fix in the code. Consider detaching those projects from the repo in Vercel.

### Changes

| Commit | Change | Verification |
|---|---|---|
| `041eeb2` | **New-phone duplicate pet (B17).** A deterministic merge rule, `syncmap.adoptAccount`, runs on a phone's first sync when the account already has a companion. The account's first habit (lowest position, then id) and its companion stay active. Everything logged on the phone first (slips, clean days, urges, reflections) moves onto them. The phone's never-synced habit and living companion are dropped; companions that already died stay in the Hall. The account's settings win. Plus, in every cycle, **a slip beats a clean mark on the same day** (`slipBeatsClean`): the clean mark is removed and tombstoned. | `firstsync.test.ts` fails on the old code (two companions); `data.test.ts` unit tests |
| `041eeb2` | **The erase-during-sync test now genuinely reproduces the race.** There's a shared realistic fake (`test/fake-supabase.ts`: conflict keys, the `touch_row` stale-write rule, changed-since filtering, pausable pulls). The account has two slips and another phone edits one, so the in-flight pull is incremental and returns only that one. | The test fails with the stale-cycle guard removed (the untouched slip never comes back) and passes with it. The sign-out race test also fails without the guard. |
| `c467c67` | The first sync pushes only rows the account doesn't have yet, so a phone that lost its sync position can't overwrite newer edits from another phone with its older copies | Test fails without the change |
| `73e6d7c` | **Notifications: at most two a day.** One pure planner, `planNotifications`, plans one-shot notifications for 14 days with ≤2 per local day, by priority: the check-in reminder (or the quiet-day note that replaces it), then today's care note, then the risky-hour heads-up, then good-morning. No reminder on a day already checked in. Each re-plan cancels the previous plan and the old repeating ids from earlier versions (1001, 2001–2004, 2010–2013); re-plans run strictly in sequence. | An exhaustive mix test (≤2/day, unique ids, future only); a mocked-native test with concurrent re-plans and a failed schedule |
| `73e6d7c`, `d638552` | **Tones (B11):** the quiet-day notes, dying banner, welcome-back line, slip-card absorbed and binge notes, and quiet-day banner now exist in gentle, honest and direct | Copy test: all tones, all different, no shaming words |
| `f067c8e` | **Permanent death, opt-in alternative.** A new setting, "can pass away" (`petsCanDie`, **default on = current behaviour**). Off: `simulate(…, { ceilingMonths: 1188 })` keeps the pet at age 99 (frail, never dead), and damage past the ceiling isn't counted toward scars, so clean days always bring it back. Existing dead companions stay dead, and no stored row is rewritten. Turning death back on is refused while the standard rules would mean the pet had already died, so it can't kill retroactively. | Engine tests (the option omitted gives an identical fold; pacing unchanged) and store tests |

**Product decision still open:** whether "can pass away" should default to off for new users. It's left on, matching the PRD. The setting syncs; older app versions ignore it and keep the standard rules, so on a mixed-version account an old phone could still record a death.

### Commands run in round 3 and results

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `pnpm lint`, `pnpm typecheck` | 0 errors |
| `pnpm test` | **138/138 pass**: engine 24, schema 10, web 104 (12 files) |
| `pnpm build` | Succeeds (only the existing large-chunk warnings) |
| `pnpm simulate` | Pacing table unchanged |
| Local Postgres 16: stub + 0001–0004 (0004 applied twice), `rls.sql`, `privacy.sql`, and the post-0004 checks in step 4 below | All as expected; privacy 11/11 PASS |
| Not run | Live e2e (production), Android build, device tests, Deno type-check of the function (no Deno; `cache.ts` is plain Web Crypto and exercised by the tests) |

## Security and privacy status

- **Fixed in the repo:**
  - local erase propagating to the cloud (B1);
  - the shared AI cache (B2) and an AI cache that outlived the account (B20);
  - no in-source key fallback (B19, repo only);
  - widget status while locked (B21), and the crisis check on reflections (B22);
  - stale sync cycles after sign-out or erase;
  - first-sync duplicates and stale overwrites (B17);
  - notification volume (B5b);
  - privileges anon and authenticated still held on the 0001 tables (in 0004).
- **Still true in production until you act (unverified since the read-only check):** the deployed `ai` function contains a hard-coded OpenRouter key and uses the shared cache; leaked-password protection is off; the anon grants are unchanged; the migration history lists only 0001.
- **Open by design:** 4–6 digit PINs can be brute-forced offline from a copied app storage; the Supabase session, on-phone AI cache and widget pet name aren't encrypted; cloud rows are plaintext under RLS (no end-to-end encryption); notification text can show on the lock screen.

## Release instructions (exact; none of these steps have been performed)

Nothing below has been done by this session. No merge, deploy, migration, setting change or APK. Do them in this order.

### 1. Merge the reviewed changes
1. Review PR #13 on GitHub (`claude/pawse-audit-6h0t1a` → `main`). The failing Vercel statuses (commandcode, delecta) aren't the Pawse app; see "PR #13 CI" above.
2. Merge with a merge commit (the branch's history builds on PR #12's merge). Locally: `git checkout main && git pull`.
3. Optional sanity check on `main`: `pnpm install --frozen-lockfile && pnpm test && pnpm typecheck && pnpm build`.

### 2. Configure the existing `OPENROUTER_API_KEY` secret (without exposing it)
The merged function has no key in its source; it reads only this secret. Keep the current key (rotation is a follow-up).
- **Dashboard (recommended):** Supabase → your project → Edge Functions → Secrets (Manage secrets) → add or edit `OPENROUTER_API_KEY` → paste the key → Save. Don't put it in chat, git, `.env` files that get committed, or tickets.
- **Or the CLI, without the key in shell history:** put `OPENROUTER_API_KEY=<key>` in a local file outside the repo (e.g. `~/pawse-secrets.env`, mode 600), then run `supabase secrets set --env-file ~/pawse-secrets.env --project-ref <project-ref>` and delete the file.
- **Check it's there without revealing it:** `supabase secrets list --project-ref <project-ref>` shows names and digests only. `OPENROUTER_API_KEY` must be listed.
- The function strips a "Bearer " prefix, quotes and invisible characters, but the value must otherwise be the key exactly. If it's missing or wrong, AI lines and weekly summaries stop (the function answers `not_configured`/`upstream`), and the app keeps working on the deterministic baseline.

### 3. Deploy the updated AI function
1. From the merged `main`, at the repo root: `supabase functions deploy ai --project-ref <project-ref>`. JWT verification stays on by default; **don't** pass `--no-verify-jwt`. This deploys `index.ts` together with `cache.ts`.
2. Check: Dashboard → Edge Functions → `ai` → its source must contain no `sk-or-` string, and "Verify JWT" must be on.
3. Smoke test: on a signed-in phone, log a slip. Within a few seconds the slip card's line should gain the ✦ AI mark. If it doesn't, check Edge Functions → `ai` → Logs for `upstream 401` (key problem) or `not_configured` (secret missing).

### 4. Apply migration 0004 (after step 3, never before)
Order: if 0004 runs while the old function is still deployed, that function keeps writing shared, ownerless cache rows until it's replaced.

**Do not run `supabase db push`.** The live migration history records only 0001 (under a different version name), and 0002 creates its tables without `if not exists`. So `db push` would try to re-run 0001–0004 and fail partway.
1. Dashboard → SQL Editor → New query → paste the entire contents of `supabase/migrations/0004_privacy_hardening.sql` → Run. It's additive and safe to run twice. Its only data change deletes ownerless (formerly shared) AI cache rows, which are just cached AI text. No user data is touched.
2. Verify in the SQL Editor:
   ```sql
   select column_name from information_schema.columns
   where table_schema = 'public' and table_name = 'ai_cache' and column_name = 'user_id';
   -- expect: one row, user_id

   select grantee, table_name, count(*) as privileges from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated') and table_name in ('ai_cache', 'ai_usage', 'app_state')
   group by 1, 2 order by 1, 2;
   -- expect: only authenticated / app_state (anon gone from all three; authenticated gone from ai_cache and ai_usage)

   select count(*) from public.ai_cache where user_id is null;
   -- expect: 0
   ```
   (Run against a local copy of the migrations, these return exactly that.)
3. Re-run the security advisor (Dashboard → Advisors → Security). The two "RLS enabled, no policy" notes on `ai_cache` and `ai_usage` remain by design (service role only).

### 5. Enable leaked-password protection
Dashboard → Authentication → the password security / attack protection settings → enable "Prevent use of leaked passwords" (checks HaveIBeenPwned) → Save. Supabase's docs list this feature as available on paid plans, so if the toggle is locked, it depends on the project's plan. Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 6. Bump the version and build a signed APK
1. Edit `apps/web/version.json`. The code must be higher than 7 (the current release), e.g. `{ "name": "2.2.0", "code": 8 }`. Gradle reads both for `versionName`/`versionCode`, and the in-app update check compares the code.
2. Put the signing key back (not in git; see `apps/web/android/keystore/README.md`): `apps/web/android/keystore/companion-release.jks` and `release.properties`. Updates only install if they're signed with this same key (certificate SHA-256 in that README).
3. Build (Java 21, Android SDK 35):
   ```
   pnpm install --frozen-lockfile
   pnpm --filter web build
   cd apps/web && npx cap sync android
   cd android && ANDROID_HOME=/path/to/sdk ./gradlew assembleRelease
   # -> apps/web/android/app/build/outputs/apk/release/app-release.apk
   ```
4. Check the signature: `apksigner verify --print-certs app-release.apk`. The SHA-256 must match the README.
5. Commit the version bump to `main`.
6. Publish (only when the device tests below pass): copy the APK to `pawse-releases/apk/Pawse-<name>.apk`, compute `sha256sum`, then update `pawse-releases/latest.json` (`name`, `code`, `url`, `notes`, `sha256`) and its README table. Installed apps show "Update available" when `latest.json`'s code is higher than theirs.

### 7. Test on real Android devices before publishing
Use two phones (A and B) and a test account, not a real user's.
- **Login and recovery:** create an account on A, confirm by email link (it opens the app), sign out, sign in, "Forgot password" link → new password works.
- **First sync on a new device:** on B, sign in to the same account → "checking your account" → A's companion and history appear, with no onboarding and no second pet.
- **New device that logged before its first sync (B17):** on a fresh install of B, sign in to the account and switch on airplane mode before "checking your account" finishes. Onboarding appears (the first sync couldn't run). Create a pet and log a slip, switch airplane mode off, then Me → Account → "Sync now". Expected: B shows only the account's companion (no second pet on Home or in Me → Hall), and B's slip now appears in the account's history on both A and B.
- **Second-device sync:** log a slip on A → within about 5 minutes (or Me → Account → "Sync now") it appears on B; rename the pet on B → it shows on A; mark the same day clean on B after A logged a slip → the slip wins on both.
- **Offline:** on A in airplane mode, log a slip and a clean day → Me → Account says changes will sync later → turn the network on → they reach B.
- **Local wipe vs account deletion:** on A, Me → Your data → "Delete all data on this phone" → "checking your account" → the full history returns and B is unaffected. Then, on a throwaway account only, Me → Account → Delete account → everything is gone on all phones, and signing in fails.
- **PIN:** set a PIN, background the app past the auto-lock time → the lock screen appears; 5 wrong tries → back-off; "Forgot PIN → Erase" while signed in → the history returns from the account.
- **Widget privacy:** add the home-screen widget. Without a PIN it shows today's status; set a PIN → it changes immediately to "Tap to check in"; remove the PIN → the status returns; tap → the quick check-in opens.
- **Notifications:** on Android 13+, accept the permission prompt; set the reminder for a few minutes ahead → it fires; mark the day clean → no reminder that day; over 2–3 days, count the notifications: **never more than two in a day**, including after reinstalling over the old version (the old repeating reminders must not fire alongside the new ones).
- **Midnight rollover:** leave the app open on Home across midnight (or change the phone's clock) → "Today" resets to "Not checked in yet", and the week strip and streak update.
- **Also:** AI unavailable (airplane mode during a slip) → the plain line stands; the 3D pet runs smoothly on a low-end phone; "can pass away" off in Me → Feel and region → a pet at the top age stays frail and recovers on clean days.

### 8. After release
- **Rotate the OpenRouter key** (deliberately not done yet): create a new key in OpenRouter, update the secret as in step 2, confirm AI still works, then revoke the old key. It has appeared in plaintext in the old deployed source and in an earlier session transcript.
- Optionally reconcile the migration history (it lists only 0001) using the Supabase CLI's migration repair, after reading its docs; not verified here.

**Release-ready verdict:** the code and every available automated check are ready. Release is **not** ready until steps 2–7 are done and the device tests pass.

## Follow-ups

- **Rotate the OpenRouter key** (step 8).
- **Decide** whether "can pass away" should default off, and confirm or reverse the quiet-day decision (`QUIET_DAYS_AGE`).
- **B12:** `deductions.baseline_months` is still sent as null.
- **Tones:** pet condition texts and a few health-sheet lines still have one wording for all tones.
- **Bundle size:** large chunks (`Pet3D` ~1 MB); consider further splitting.
- **Vercel:** detach the commandcode and delecta projects from this repository.
- **Subscription and pricing validation:** test willingness to pay ₹99/month with target users, decide on distribution (store billing vs sideloaded plus a payment provider), and specify what would be gated before any billing or entitlement code is written. No payment code was added.

## Monetisation readiness (no billing added)

**Current state:** there's no subscription, payment, entitlement or paywall code anywhere, and the app is distributed as a sideloaded APK.

**Hypothesis:** a ₹99/month paid-only plan would need:

1. A distribution decision. A store listing would mean store billing; sideloading would mean a third-party provider and webhooks.
2. A server-owned `entitlements` table (user_id, plan, status, current_period_end, source), writable only by the service role from verified provider webhooks or receipts, readable by its owner under RLS.
3. One client boundary, e.g. `useEntitlement()`, that reads it, caches it for offline grace, and gates features. **Never gate access to the person's existing data or export:** paid status should unlock features, not hold history hostage.
4. Server-side enforcement for anything that costs money (the `ai` function should check entitlement next to `bump_ai_usage`).
5. A preview path. The existing Simulator, a sandbox using the real engine that touches no logs, is a ready-made interactive demo.

I didn't add an entitlement stub, because there's no product spec for what would be gated, and a half-built gate would be dead or misleading code.

---

# PAWSE 3.0 run (2026-10-24, second overnight)

Brief: `.claude/commands/pawse-full-run-v3.md` → `pawse-3.0-evidence-informed-recovery-product-redesign.md` + `pawse-overnight-both-repos.md`. Branch: `ccr-9d7d359f-c2d6k6` in both repos (the only branch this session may push to). Baseline before any change: `pnpm test` 81/81, typecheck clean.

## Prioritised checklist

| # | Item | Status | Commit | Verification |
|---|---|---|---|---|
| 1 | Re-check earlier data-loss/privacy fixes (B1, B2, B3, B4, B21, B22) still hold | **Done** | — | Tests pass; see `PAWSE_PRODUCT_DIAGNOSIS.md` §2 |
| 2 | Research and five product documents | **Done** | docs commit | `docs/PAWSE_RECOVERY_RESEARCH.md` and four others |
| 3 | Day-state model: slip, goal met, urge managed, not tracking, not recorded | **Done** | `4c157d3` | `test/recovery.test.ts` |
| 4 | Plan (goal, reasons, situations, first step, strategies, support name, if-then) synced in settings | **Done** | `4c157d3`, `9076fe5` | tests + browser run of onboarding (plan saved) |
| 5 | Urge strategy and trigger: migration 0005 + sync fallback | **Done in repo, not applied** | `4c157d3` | 0001–0005 + `rls.sql`, `privacy.sql` (11/11 PASS), `recovery.sql` (5/5 PASS) on local Postgres 16; 0005 re-runs cleanly |
| 6 | Continuity pet rules (no death, no permanent scars), classic opt-in | **Done** | `4c157d3`, `9076fe5` | engine tests (26/26, PRD pacing still pinned), store tests |
| 7 | Onboarding plan steps, urge support, lapse recovery, weekly review, honest observations | **Done** | `9076fe5` | tests + Playwright run at 390 px, light and dark |
| 8 | Days of care for milestones/unlocks; no reset on a slip | **Done** | `9076fe5` | `test/recovery.test.ts` |
| 9 | "Clean" → "goal met"/"good day" in user copy; crisis check on all new text; more phrasings | **Done** | `9076fe5` | `test/crisis.test.ts`, `test/care.test.ts` |
| 10 | Notifications: two neutral lapse notes, no post-slip guilt push | **Done** | `c762439` | typecheck; device check not possible here |
| 11 | AI: global daily ceiling (fails closed), wording rule | **Done in repo, not deployed** | `9076fe5` | code review (no Deno here) |
| 12 | Android debug build | **Blocked** | — | SDK installed in `/tmp`, `cap sync` OK; Gradle dependency resolution fails with HTTP 429 from Maven Central through this environment's egress after 7 attempts |
| 13 | Release repo status | **Done (unreleased)** | release branch | see `pawse-releases` `RELEASE_STATUS.md` |

## Decisions taken on the owner's behalf (please confirm)

- **Continuity is the default for everyone, including existing accounts.** Existing pets that carried scar-floor damage now show a lower age; nothing stored changes, and turning on classic rules restores the PRD maths. Companions already dead stay in the Hall. Classic can't be switched on if the history would already mean death under it.
- **Milestones count cumulative days of care**, so people with history see one celebration for the highest milestone reached, once.
- **"Clean" is gone from user copy.** Table and field names (`clean_days`, `cleanDays`) are unchanged for compatibility.
- **The AI request schema is unchanged** (the deployed function is strict). Plan and urges are not sent to AI.

## Final checks (actually run)

| Check | Result |
|---|---|
| `pnpm test` | **109/109 pass** (schema 10, engine 26, web 73), up from 81 |
| `pnpm typecheck`, `pnpm lint` (both `tsc --noEmit`) | Clean |
| `pnpm build` | Succeeds; the >500 kB chunk warning predates this work |
| `pnpm simulate` | PRD pacing unchanged; logged in `docs/tuning.md` |
| Local Postgres 16: migrations 0001–0005, `rls.sql`, `privacy.sql`, `recovery.sql` | All expected results; 0005 idempotent |
| Playwright, local dev server with a fake session and an unreachable backend (CSP blocked it; nothing reached the live project) | Onboarding with plan, Home, urge flow, slip + reflection, Insights, Journey, Plan, dark mode: no page errors |
| Not run | Android build (blocked), device tests, `e2e-live.cjs` (touches the live project), Deno check of the edge function |

## Follow-up: PR #13 merged into 3.0 (2026-10-24)

#14 was merged to `main`, so the branch restarted from `main` and #13 (`claude/pawse-audit-6h0t1a`) was merged into it. Owner instruction: "do what makes the most sense".

- **Pet rules:** one setting, `petLife`, default `continuity`. #13's `petsCanDie` (unreleased) was folded into it. Engine: one options type (`SimOptions`; `SimulateOptions` kept as an alias) with #13's rule that damage past the ceiling counts toward nothing, plus 3.0's `scars: false`. Companions that already died stay dead (#13). Classic can only be switched on while it wouldn't mean death (`canAllowPassingAway`). One switch in Me → Your companion; the farewell-scene option shows under classic.
- **Notifications:** #13's two-a-day planner kept; its four quiet-day notes replaced by 3.0's two neutral ones; the post-slip "strike" note removed (a slip still clears that day's thank-you). Test updated to pin this.
- **Copy:** #13's new tone lines kept and swept for "clean". 3.0's dying banner kept. The binge line shows only under classic.
- **Sync:** both the 0005 urge-column fallback and #13's stale-cycle guard.
- **Checks:** `pnpm test` 166/166 (schema 10, engine 29, web 127); typecheck, build and simulate clean; Playwright onboarding and recovery flows, no page errors. Migrations unchanged since the earlier local run.
