# Report one: what was done, and what you need to do

Date: 2026-10-25. Covers all the work done in this session across `jithujsam/pawse-app` and `jithujsam/pawse-releases`.

**Where things stand:** all the code work is merged into `pawse-app/main` (through PRs #12 and #15), and on that code 166/166 tests pass, the typecheck is clean and the build works. **Nothing has been released.** Users still have version 2.1.0. Production (Supabase) hasn't been changed. Releasing needs a few steps only you can do (part 2).

---

## Part 1: what was done

### 1. Audit (read only)
- Wrote `docs/PAWSE_PRODUCT_AND_SYSTEM_AUDIT.md`: a full, source-backed review of the product, code, pet rules, AI, data, security, money and tests.
- Ran a read-only check of the live Supabase project. It found:
  - a **real OpenRouter key typed into the deployed AI function's code**;
  - leaked-password protection switched off;
  - database migrations applied outside the migration history;
  - only about 5 test accounts.

  No production data or settings were changed.

### 2. Fixes (round 1, merged in PR #12)
| Problem | Fix |
|---|---|
| "Delete all data on this phone" (and "Forgot PIN → Erase") **deleted the account's cloud data too** | Erasing now clears only the phone; the account restores itself |
| The AI cache was **shared between users**, so one person could see another's sentence | The cache is now per person and per exact request; cached text is deleted with the account |
| The AI could **cut a slip's cost by up to 50%** (the rule says ±30%) | The AI stays within ±30% and can never decide whether the pet dies |
| Days with nothing logged **aged the pet** and counted as **money saved** | Unrecorded days now change nothing; "money kept" counts only days you checked in |
| Web reminders said "on" but never fired | They stay off on the web and say why |
| The crisis check didn't cover reflections | Reflections now get the same check |
| The home-screen widget showed slip status even with a PIN | It shows only "Tap to check in" while a PIN is set |
| You could mark old days clean but not log old slips | The calendar can log a slip for any past day |
| An open app didn't roll over at midnight | It now updates at midnight |
| Migration 0004 | Removes permissions that logged-out visitors still had, and makes the AI cache per person |

### 3. Fixes (rounds 2–3, merged through PR #15)
- **Sign-out or erase during a sync** can no longer put an account's data back on a wiped phone.
- **No duplicate pet on a new phone.** If the account already has a pet, the phone's data moves onto it. When two phones disagree about a day, a slip beats a clean mark. Old copies on a phone can't overwrite newer edits.
- **At most two notifications a day**, with no notification after a slip. Reminders when you stop recording are neutral, at 2 and 7 days only.
- **Tones:** the remaining messages now exist in gentle, honest and direct versions.
- **Pet death:** PR #14 (another session) made "continuity" the default: the pet can get very frail but never dies, and everything can heal. The original rules stay available as an opt-in "classic" mode. My overlapping version was dropped in favour of it.
- **Tests:** 68 at the start, 166 now. They include realistic sync tests with a fake server, AI failure tests, time-zone and midnight tests, and backup and PIN tests.
- **Database checks:** migrations 0001–0005 tested on a throwaway local database. The security-rule, privacy (11/11) and recovery (5/5) checks pass.

### 4. Release process
- Wrote `docs/RELEASING.md`: exactly how to publish to `pawse-releases` safely. It covers how to check a build is ready, verifying the APK's signature, version and checksum, updating `latest.json` and the README, and a consistency check.
- Added a rule to `CLAUDE.md`: **every release must update `pawse-releases`**.
- Checked the published 2.1.0: its checksum matches, it's signed with your release key, and its version is 2.1.0 / 7.
- `pawse-releases`: added `RELEASING.md` and updated `RELEASE_STATUS.md` on branch `claude/pawse-audit-6h0t1a`. The APK, `latest.json` and README are unchanged.

### 5. Pull requests
| PR | State |
|---|---|
| pawse-app #12 (audit and round 1) | Merged |
| pawse-app #13 (rounds 2–3) | Its work is merged through #15; the PR now has no changes, **so you can close it** |
| pawse-app #14 (PAWSE 3.0, another session) | Merged |
| pawse-app #15 (combines #13 and #14) | Merged |
| pawse-releases branch `claude/pawse-audit-6h0t1a` | Pushed, **not merged and no PR** (status docs only) |

### 6. What was *not* done (and why)
- **No release was published.** There's no Android SDK here, your signing key isn't available (by design), and no device tests have run.
- **No production changes.** The secret, deploy, migrations and auth settings all need your accounts.
- **The OpenRouter key wasn't rotated**, as you asked.
- **Not run:** the live end-to-end test (it touches production), an Android build, any phone testing.

---

## Part 2: what you need to do (in order)

### Step 1: Decide
- [ ] Keep **"continuity" (pets never die)** as the default? Classic rules stay optional either way.
- [ ] Keep **unrecorded days counting for nothing**?

### Step 2: Tidy GitHub
- [ ] Close pawse-app PR #13 (its work is already in `main`).
- [ ] Optional: merge the `pawse-releases` branch `claude/pawse-audit-6h0t1a` (it only changes docs).
- [ ] Optional: detach the Vercel projects **commandcode** and **delecta** from `pawse-app`. They aren't Pawse and always show as failed.

### Step 3: Supabase (production), in this order
1. [ ] **Secret:** Dashboard → Edge Functions → Secrets → set `OPENROUTER_API_KEY` to your current key. Never paste it into chat or git. Check with `supabase secrets list --project-ref <ref>`, which shows names and digests only, not values.
2. [ ] **Deploy the AI function:** `supabase functions deploy ai --project-ref <ref>`. Keep JWT verification on. Then check the function's source in the dashboard contains no `sk-or-` text.
3. [ ] **Migrations:** Dashboard → SQL Editor → paste and run `supabase/migrations/0004_privacy_hardening.sql`, then `supabase/migrations/0005_recovery.sql`. Both are safe to run twice. The checks to run afterwards are in `docs/PAWSE_OVERNIGHT_LOG.md`.
   **Don't use `supabase db push`**: it would try to re-run old migrations and fail.
4. [ ] **Auth:** turn on **leaked-password protection** (Supabase's docs list it as a paid-plan feature).

### Step 4: Build the app (on your computer with the signing key)
- [ ] Edit `apps/web/version.json`, e.g. `{ "name": "3.0.0", "code": 8 }`. The code must be above 7.
- [ ] Put `companion-release.jks` and `release.properties` back in `apps/web/android/keystore/`.
- [ ] Build (Java 21, Android SDK 35):
  ```
  pnpm install --frozen-lockfile
  pnpm --filter web build
  cd apps/web && npx cap sync android
  cd android && ./gradlew assembleRelease
  ```
- [ ] Check the signature: `apksigner verify --print-certs app-release.apk`. Its SHA-256 must match `apps/web/android/keystore/README.md`.

### Step 5: Test on two phones (checklist in `docs/PAWSE_OVERNIGHT_LOG.md`)
- [ ] Install over 2.1.0: the pet and history are kept.
- [ ] Sign-up, email link, sign-in, sign-out, password reset.
- [ ] A second phone signs in: it gets the same pet, with no duplicate.
- [ ] Offline check-ins sync later.
- [ ] "Delete all data on this phone" brings the history back; deleting the account removes it everywhere (use a test account).
- [ ] PIN: auto-lock, wrong tries, "Forgot PIN".
- [ ] Widget: it hides today's status while a PIN is set.
- [ ] Notifications: never more than two a day.
- [ ] Midnight rollover with the app open.

### Step 6: Publish
- [ ] Follow `docs/RELEASING.md`:
  - add `apk/Pawse-<version>.apk` to `pawse-releases`;
  - update `latest.json` and the README with the **measured** SHA-256;
  - open a PR.
- [ ] **Merging that PR releases the update** to every installed phone.
- [ ] Or send the signed APK to Claude to verify and prepare the PR for you.

### Step 7: After release
- [ ] **Rotate the OpenRouter key:** make a new one, update the secret, check the AI still works, then revoke the old one. The old key has appeared in plaintext in the deployed function's code and in a session transcript.

---

## Where to find the details
| File | What's in it |
|---|---|
| `docs/PAWSE_PRODUCT_AND_SYSTEM_AUDIT.md` | The full audit |
| `docs/PAWSE_OVERNIGHT_LOG.md` | Every change with commits, every command run, exact release steps, device test plan |
| `docs/RELEASING.md` | How to publish to `pawse-releases` |
| `docs/PAWSE_OVERNIGHT_REPORT.md` | The PAWSE 3.0 session's report (PR #14) |
| `pawse-releases/RELEASE_STATUS.md` | What's published, and the checklist for the next release |
