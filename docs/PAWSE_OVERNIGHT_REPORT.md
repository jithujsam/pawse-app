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
