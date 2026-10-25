# PAWSE 3.0 final verification and release readiness (2026-10-25)

App branch `ccr-ea60e25f-6gxd74` (from `main` at `c85fe89`) · Release branch `ccr-ea60e25f-6gxd74` in `jithujsam/pawse-releases` (contains the earlier, PR-less docs branch `claude/pawse-audit-6h0t1a`).

**Verdict: PAWSE 3.0 is NOT released and is not ready to be.** Production is still 2.1.0 (code 7). The blockers are the deployed AI function (old code, still with the in-source key and the shared cache), key rotation, the signing key (not in this environment), and device tests. Nothing was merged, deployed, migrated, rotated or published by this session. No secret was read, printed or committed.

Labels: **Verified** = checked by a command or query in this session. **Blocked** = attempted and failed, reason given. **Not performed** = deliberately not done.

## 1. Repository and PR state (Verified 2026-10-25 via GitHub)

| Item | State |
|---|---|
| `pawse-app/main` | `c85fe89` (merge of #15) |
| pawse-app #12 (audit, round 1) | Merged 2026-10-24 18:44 UTC |
| pawse-app #14 (PAWSE 3.0) | Merged 2026-10-24 23:36 UTC |
| pawse-app #15 (#13 merged into 3.0, continuity default) | Merged 2026-10-24 23:57 UTC |
| pawse-app #13 (`claude/pawse-audit-6h0t1a`) | **Still open.** Its code is in `main`; the only remaining diff is `docs/REPORT_ONE.md` (commit `e432089`). Left open for the owner (not my work to close) |
| pawse-app #6 (gtm-skills) | Open, unrelated, untouched |
| `pawse-releases/main` | `92f6003` (merge of #1). `latest.json` = 2.1.0 / code 7 |
| `pawse-releases` branch `claude/pawse-audit-6h0t1a` | Docs only (`RELEASING.md`, `RELEASE_STATUS.md`), never had a PR. Merged into this session's release branch and carried into its PR, instead of being duplicated |
| CI | None for Pawse. Only the Vercel integration (unrelated projects, see the log, round 3) |

## 2. Changes and commits

| Repo | Commit | Change |
|---|---|---|
| pawse-app | `c91e466` | `apps/web/version.json` → `{ "name": "3.0.0", "code": 8 }` (above published code 7). Web bundle verified to embed `name:"3.0.0",code:8` |
| pawse-app | `f8720af` + this commit | This report section. Draft PR [jithujsam/pawse-app#16](https://github.com/jithujsam/pawse-app/pull/16) |
| pawse-releases | `fb1d567` (fast-forward from `claude/pawse-audit-6h0t1a`) + `e6d6c33` | `RELEASE_STATUS.md` refreshed with today's verified state. **`apk/`, `latest.json` and `README.md` unchanged** |

No code regressions were found, so no application code changed.

## 3. Tests run (Verified, on `main` at `c85fe89`, and again after the version bump)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK, lockfile unchanged |
| `pnpm lint`, `pnpm typecheck` | exit 0 |
| `pnpm test` | **166/166 pass**: schema 10, engine 29, web 127 (14 files) |
| `pnpm build` | OK (existing >500 kB chunk warning only) |
| `pnpm simulate` | light/medium/heavy identical to `docs/tuning.md` (PRD §5.3 pacing unchanged) |
| Local Postgres 16, fresh cluster per test: stub + 0001→0005, then 0004+0005 re-run | All apply; both re-run cleanly |
| `supabase/tests/rls.sql` | Every block as expected (own rows 1 1 1; stale write ignored; B sees 0 0 0 0; RLS errors; anon permission denied; check violation; cascade delete leaves 0; A untouched) |
| `supabase/tests/privacy.sql` / `recovery.sql` | **11/11 PASS** / **5/5 PASS** |
| Secret scan, full git history of both repos (132 app commits) for a full `sk-or-v1-…` key | 0 hits. The only `sk-or-` text in the repo is a prefix check in a log line |
| Client bundle/source for server secrets | None; only the publishable Supabase key (public by design) |
| Android debug build + `testDebugUnitTest` | **Blocked**: SDK 35 + build-tools installed, `cap sync` OK, but Gradle failed 5 times on different artifacts (`kotlin-stdlib-jdk8-1.9.25.jar`, `httpmime-4.5.6`) because this environment's egress to Maven Central is intermittent (the same URL returned 200, 404, 200) |
| **Not run** | `e2e-live.cjs` (creates accounts on production), Deno type-check of the function (no Deno), any device or emulator test |

Product rules re-checked in code: `petLife` defaults to continuity (`store.ts:153`); `QUIET_DAYS_AGE = false` (unrecorded days count for nothing); `MAX_PER_DAY = 2` in the notification planner; nothing is scheduled after a slip (`notify.ts:96`); plan and urges are not sent to AI (request schema unchanged).

## 4. Security findings

| Finding | Status |
|---|---|
| **OpenRouter key in the deployed `ai` function** | **Not rotated. Not verified as removed.** The deployed function is version 12, last deployed 2026-10-24 07:26 UTC. That is before the commit that removed the in-source key (`98fba1e`, 18:21 UTC), so it almost certainly still contains the key found by the audit. I deliberately did not fetch the deployed source, because that would copy the key into this transcript. This session has no OpenRouter access, so it could not create a replacement or revoke the old key |
| JWT verification on `ai` | **Verified on** (`verify_jwt: true`) |
| **Shared AI cache can come back (new, urgent)** | 0004 is applied, but the old function is still deployed and `ai_cache.user_id` is nullable, so the old function's next successful calls would write ownerless, cross-user cache rows again (audit B2). **Right now: 0 cache rows, 0 ownerless.** No AI calls since 2026-10-24 15:57 UTC |
| Repo function code | Reviewed: key only from the secret, auth before anything else, Zod in and out, per-user (80) and global (3000) daily limits that fail closed, cache only after validation |
| Leaked-password protection | **Verified off** (security advisor, 2026-10-25) |
| `public.rls_auto_enable()` executable by anon/authenticated (advisor WARN) | Supabase's own `ensure_rls` event-trigger function, not from this repo. An event-trigger function can't be invoked as a plain RPC, so the risk is low. Left unchanged |
| `delete_my_account()` executable by authenticated | Intended |
| `ai_cache`/`ai_usage` "RLS, no policy" (INFO) | By design (service role only) |

## 5. Production: migrations, AI function, auth (Verified read-only; nothing changed)

- **Migrations 0004 and 0005 are already in effect in production**, contrary to the 2026-10-24 reports. Metadata queries show `ai_cache.user_id` (FK, on delete cascade); urge `strategy`/`trigger` columns with both check constraints; no anon grants on any public table; `authenticated` keeps only `app_state` among `ai_cache`/`ai_usage`/`app_state`. Postgres logs show the 0004 script ran at 2026-10-24 18:44:36 UTC (26 s after #12 merged) and 0005 at 23:58:28 UTC (52 s after #15 merged). **Not by this session.** The actor is unknown (the owner, or an integration; to confirm).
- The migration history still lists only `20261024035919 init_app_state_and_ai_usage`. **`supabase db push` must still not be used.**
- Post-0004 checks, run live: `user_id` column 1 row ✓; grants as expected ✓; `ai_cache where user_id is null` = 0 ✓.
- **AI function:** old version 12, not the repo code. Deploying it needs approval and the secret, so it was **not performed**. Whether `OPENROUTER_API_KEY` is set as a secret couldn't be checked with the available tools.
- **Auth:** leaked-password protection off. Other auth settings weren't inspectable with the available tools.

## 6. Android build, signing and artifacts

- `apps/web/version.json` is now 3.0.0 / 8; Gradle reads it for `versionName`/`versionCode`. Package `app.detoxcompanion`, min SDK 23, target/compile SDK 35. Release signing is used only when `keystore/release.properties` exists.
- **Signing key:** not present in this environment (only `keystore/README.md`). **No release APK was built.** No replacement key was created, and none ever should be.
- **Debug APK:** blocked (section 3). It would have been test-only anyway.
- **Published 2.1.0, re-verified with the real build tools** (`apksigner`/`aapt2` 35.0.0, first time they were run on it): v1 + v2 signatures verified; signer SHA-256 `8081688b71ff39e76203abadb59c51c15783ec53680d948c9fc7341134d8257b` (matches `keystore/README.md`); `app.detoxcompanion` versionCode 7, versionName 2.1.0; not debuggable; SHA-256 `c8801d33…cba53` for both the repo file and the file served from `raw.githubusercontent.com`; the RELEASING.md consistency script prints `OK 2.1.0 7`.
- **Device tests:** none (no device or emulator). Checklist below.

### Device checklist for the signed 3.0.0 build (two phones, test account)
1. **Upgrade from 2.1.0:** install 3.0.0 over 2.1.0 without uninstalling. The pet, history, Hall, settings, PIN and account are kept. The pet may look younger (continuity drops the scar floor); expected, and in the notes. There's one milestone celebration at most.
2. **Old notifications:** after the upgrade, the 2.1.0 repeating reminders (ids 1001, 2001–2004, 2010–2013) never fire alongside the new ones; **never more than two notifications a day** over 2–3 days; no notification after logging a slip.
3. **Second device:** sign in on phone B: it shows "checking your account", then the same pet with no duplicate. A slip on A appears on B; a slip beats a good-day mark on the same day.
4. **Offline:** in airplane mode, log a slip, an urge (with strategy) and a good day; reconnect; they reach B, and B shows the urge strategy (0005 is live).
5. **Local erase vs delete account:** "Delete all data on this phone" restores from the account. Delete account (throwaway account only) removes it everywhere.
6. **PIN:** auto-lock, back-off after 5 wrong tries, "Forgot PIN → Erase" restores from the account.
7. **Widget privacy:** with a PIN set it shows "Tap to check in" immediately; status comes back when the PIN is removed.
8. **Midnight rollover:** with the app open across midnight, Today resets and an unrecorded yesterday shows as "not recorded" and doesn't age the pet.
9. **AI:** with the new function deployed, a slip line gains the ✦ mark. In airplane mode the plain line stands. Check `ai_cache` rows all have a `user_id`.
10. **Crisis language** in a plan, reflection or urge trigger shows the support card and isn't saved.

## 7. Release repository

- Branch `ccr-ea60e25f-6gxd74` in `pawse-releases`: the earlier docs branch merged in, plus a refreshed `RELEASE_STATUS.md` (3.0 **UNRELEASED**, today's verified facts, updated checklist). Commit `e6d6c33`; draft PR [jithujsam/pawse-releases#2](https://github.com/jithujsam/pawse-releases/pull/2). **No APK, `latest.json` or README change**: there's no verified, production-signed 3.0 artifact.
- Merging that docs PR doesn't change `latest.json`, so it doesn't push an update to phones. It still needs the owner's review.

## 8. Outstanding risks and owner actions (most urgent first)

1. **Rotate the OpenRouter key (urgent).** It has been in deployed source and an earlier transcript. Create a new key in OpenRouter → set it as the Supabase secret `OPENROUTER_API_KEY` (Dashboard → Edge Functions → Secrets; never in chat or git) → deploy (step 2) → confirm a slip gets the ✦ line → revoke the old key in OpenRouter. Until then, consider setting a low spend limit on the old key in OpenRouter.
2. **Deploy the repo's `ai` function (urgent; it closes the shared-cache gap that applying 0004 first re-opened).** From `main`: `supabase secrets list --project-ref syysftnaubbpolrmicvd` (must list `OPENROUTER_API_KEY`; names only), then `supabase functions deploy ai --project-ref syysftnaubbpolrmicvd` **without** `--no-verify-jwt`. Then check the dashboard source has no `sk-or-` text, "Verify JWT" is on, and `select count(*) from public.ai_cache where user_id is null;` returns 0. If it doesn't, re-run `0004_privacy_hardening.sql` in the SQL Editor (idempotent; it deletes only ownerless cached AI text).
3. **Turn on leaked-password protection** (Authentication → password security; may need a paid plan).
4. **Confirm who applied 0004/0005** on 2026-10-24, and whether an integration applies migrations on merge to `main`. If one does, merging any future migration is a production change. Optionally repair the migration history later (`supabase migration repair`, after reading its docs). Never `db push`.
5. **Close pawse-app #13** (only `REPORT_ONE.md` remains; merge that file first if you want to keep it) and review the two draft PRs from this session.
6. **Confirm the product defaults** (continuity, unrecorded days neutral) and the version name 3.0.0.
7. **Build and verify the release APK** on a machine with `companion-release.jks` + `release.properties` and working Maven access: `docs/RELEASING.md` steps 2–3 (`apksigner` signer `8081688b…257b`, `aapt2` code 8 / 3.0.0, debuggable 0, embedded `name:"3.0.0",code:8`, `sha256sum`).
8. **Run the device checklist** above on that signed build.
9. **Publish** per `docs/RELEASING.md` step 4 (APK, `latest.json`, README, measured SHA-256, consistency script). Merging that PR is the release; then step 6.
10. **Before a wider rollout:** the usability sessions in `docs/PAWSE_VALIDATION_PLAN.md`, and pick a pilot measurement option:

| Option | What you learn | Privacy trade-off |
|---|---|---|
| In-app opt-in weekly survey (3 questions) stored in the person's own rows | Self-reported usefulness, shame, confidence | No new collection beyond what the person types; covered by existing RLS and account deletion. Needs a small feature and three-tone copy |
| Participant-shared JSON backup, with consent | Full behaviour metrics, analysed offline | The person sees and chooses what to share. Manual, small samples; the shared file holds sensitive history and needs a retention rule |
| Server-side counts from existing tables | Retention, recording rate, return-after-slip | Most data and least effort for participants, but it means reading production rows. Needs written research consent, a retention period, aggregate-only queries and an owner decision. **Not authorised; not done** |

No analytics, billing, tracking or new data collection was added. No claim is made that Pawse reduces any behaviour.

---

# Pawse overnight report: PAWSE 3.0 recovery redesign

Date: 2026-10-24 · App branch: `ccr-9d7d359f-c2d6k6` (from `main` at `12a1d83`) · Release branch: `ccr-9d7d359f-c2d6k6` in `jithujsam/pawse-releases` · Detailed log: `docs/PAWSE_OVERNIGHT_LOG.md` (section "PAWSE 3.0 run")

**Nothing was deployed, merged, migrated in production or published.** No secrets were read, printed or committed; the OpenRouter key was not touched.

## 1. What users will notice

1. **Their own goal.** Onboarding asks "What would you like to change?" and adds two optional, skippable steps: goal (stop, cut down, or understand it first), reasons, hard situations, a first step, preferred urge strategies and a support first name. Everything is editable in Me → Your plan.
2. **Honest days.** Five states everywhere: goal met, slip, urge managed, not tracking (their choice) and not recorded. Unrecorded days never count for or against them. Shapes differ, not just colour.
3. **Urge support.** Seven strategies they can switch between (pause and notice, name it, change where you are, make it harder, breathe, do something else, reach out). No more "it passes in two minutes".
4. **After a slip.** A calm headline, a line saying what they've built still stands, and an optional reflection with one thing to try next time, which can become an if-then plan.
5. **Weekly review** at the top of Insights: progress toward their goal, urges managed, what helped, what came up most, and one adjustment for the week ahead (shown on Home).
6. **Honest insights.** Observations need at least five records, show "x of y", are labelled "Early hint" or "Pattern", and say they are not causes. Below the threshold: "not enough yet, Pawse won't guess".
7. **A kinder pet.** By default the companion can get very frail but never dies, and everything can heal back. Classic rules (death, permanent scars) are opt-in. Milestones and wardrobe unlocks count days of care, which never reset.
8. **Words.** "Goal met" and "good day" replace "clean". Reminders when check-ins stop are two neutral notes instead of four "lonely" ones; the "won't eat" push after a slip is gone.
9. **Safety.** Crisis checks on every new free-text field and more phrasings; a "More support" card with withdrawal guidance and helplines.

## 2. Research conclusions (details and sources: `docs/PAWSE_RECOVERY_RESEARCH.md`)

- **Moderate evidence:** self-monitoring works best combined with goals, feedback and review; if-then plans help goal attainment; mindfulness-based approaches reduce craving; MI-style autonomy is a sound default.
- **Strong model, moderate mechanism:** relapse prevention: how a person interprets a lapse (blame, guilt, lowered confidence) shapes what happens next.
- **Emerging:** self-compassion and recovery; virtual pets for health behaviour (small, short studies).
- **Low certainty:** app-based interventions for smoking and alcohol. **Pawse must not claim it reduces any behaviour.**
- **Guidance:** NIDA (avoid "clean/dirty"), NICE CG100 (no sudden stop for dependent drinkers), WHO 2024 (AI risks, automation bias).
- **Limits:** desk research, several abstracts only, mostly clinical populations. Validation plan: `docs/PAWSE_VALIDATION_PLAN.md`.

## 3. Bugs and security changes

| Change | Status |
|---|---|
| Earlier fixes B1 (erase deleted cloud data), B2 (shared AI cache), B3 (AI clamp), B4, B21, B22 | Re-checked in code and tests: still fixed |
| Crisis check now covers plan, urge trigger, slip reflection and weekly focus; more phrasings | Done, tested |
| Guilt notifications reduced (B5b partly) | Done; device count not measured |
| AI: global daily call ceiling `AI_GLOBAL_DAILY_LIMIT` (fails closed) and wording rule | In repo, **not deployed** |
| Migration 0005 (urge strategy + trigger, with check constraints); app syncs without it until applied | In repo, **not applied** |
| B17 (first-sync duplicate pet) | **Open on this branch**; fixed separately in PR #13 |

## 4. Tests and checks

| Check | Result |
|---|---|
| `pnpm test` | 109/109 pass (schema 10, engine 26, web 73); baseline was 81 |
| `pnpm typecheck` / `pnpm lint` | Clean |
| `pnpm build` | Succeeds (existing >500 kB chunk warning) |
| `pnpm simulate` | PRD pacing unchanged; recorded in `docs/tuning.md` |
| Local Postgres 16: 0001–0005 + `rls.sql` + `privacy.sql` (11/11) + `recovery.sql` (5/5) | Pass; 0005 re-runs cleanly |
| Playwright on a local dev server, fake session, backend unreachable (blocked by CSP) | Onboarding with plan, urge flow, slip + reflection, Insights, Journey, Plan, dark mode: no page errors. Fixed one layout bug found this way |
| **Not run** | Android build (**blocked**: Maven Central returned HTTP 429 to Gradle from this environment, 7 attempts; SDK install and `cap sync` worked), any device test, `e2e-live.cjs` (live project), Deno type-check of the edge function |

## 5. Repositories

| Repo | Branch | Commits | PR |
|---|---|---|---|
| `pawse-app` | `ccr-9d7d359f-c2d6k6` | `4c157d3` data layer · `9076fe5` UX · `c762439` notifications · `a1c3de2` docs | [#14](https://github.com/jithujsam/pawse-app/pull/14) (draft) |
| `pawse-releases` | `ccr-9d7d359f-c2d6k6` | `af27e09` release status + checklist only | [#1](https://github.com/jithujsam/pawse-releases/pull/1) (draft) |

**PR #13 is now merged into this work** (follow-up branch `ccr-9d7d359f-c2d6k6`, restarted from `main` after #14 was merged). Decision taken: **continuity (no death) is the default**; classic rules are opt-in. The two no-death settings became one (`petLife`; #13's unreleased `petsCanDie` is gone), using #13's damage ceiling, its guard against switching classic on when that would mean death, and its rule that companions that already died stay in the Hall. #13's notification planner (max two a day) is kept, with 3.0's two neutral quiet-day notes and no post-slip note. #13's copy lines were swept for "clean". After the merge, 166/166 tests pass and the browser flows were re-run with no page errors. See the merge PR for details.

## 6. Supabase

No connected Supabase tools were used. **Production was not read or changed.** Migration 0005 was tested only on a disposable local Postgres.

## 7. APK and release

No APK was built, signed, checksummed or published. `latest.json` and the 2.1.0 artifact are untouched. `pawse-releases` gets `RELEASE_STATUS.md`, marked **unreleased**, with a checklist for 3.0.

## 8. Blockers and owner actions, in order

1. ~~Decide the default pet rules~~ (decided: continuity). Review and merge the follow-up PR, which includes #13; then close #13 as superseded.
2. After merging, CI doesn't exist, so run `pnpm test`, `pnpm typecheck` and `pnpm build` locally after the merge.
3. Apply migration 0005 (after 0004) to production, then deploy the `ai` function. Earlier owner steps still stand: rotate the OpenRouter key that was found in the live function source, apply 0004, and turn on leaked-password protection.
4. Build the release APK on a machine with the signing key and working Maven access (bump `apps/web/version.json` first), then run device tests: notifications per day, widget with PIN, urge flow, onboarding on a small screen.
5. Follow `pawse-releases/RELEASE_STATUS.md` to publish, and only update `latest.json` with the real file's SHA-256.
6. Run the usability sessions in the validation plan before a wider release.

## 9. Known risks

- Existing users' pets may look younger after the update (scar floor off under continuity). This is intended, but it should be mentioned in the release notes.
- People with long histories see one milestone celebration the first time they mark a good day after updating.
- The weekly AI summary still sees only slips, spend and age, not urges or the plan.
- The strategy steps and labels are neutral rather than written in three tones; the emotional lines are in three tones.
