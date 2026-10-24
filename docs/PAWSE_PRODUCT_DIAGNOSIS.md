# Pawse product diagnosis

Date: 2026-10-24 · Code checked: branch `ccr-9d7d359f-c2d6k6`, starting from `main` at `12a1d83` · Inputs: `docs/PRD.md`, `docs/PAWSE_PRODUCT_AND_SYSTEM_AUDIT.md` (audit), `docs/PAWSE_OVERNIGHT_LOG.md` (log)

## 1. What Pawse was before 3.0

A one-habit reduction tracker whose display is a pet. Slips cost "months of life", days marked clean heal, the pet can die at 100 and is replaced. The emotional engine was **loss framing** (PRD §2: "Realization is the intervention"; "a puppy turning grey is not [easy to dismiss]").

That design does some things well: logging is fast, every number is explained, there's a visible "way back", and the engine is pure and well tested. But read against the recovery evidence (`PAWSE_RECOVERY_RESEARCH.md`), it had structural problems:

| # | Problem | Where (before 3.0) | Why it matters |
|---|---|---|---|
| D1 | Only two recorded states; no "urge managed" day, no "not tracking" day | `Home.tsx` week strip, `Calendar.tsx` `status()` | The app can't tell coping from silence, or a chosen break from a gap |
| D2 | Death, permanent scar floor and binge scars | `life.ts`, `logSlip` sets `diedOn` | Irreversible punishment; fear as motivator; feeds the abstinence violation effect |
| D3 | Rewards reset on one slip (milestones, `celebrated: []` on every slip) | `store.ts logSlip`, `Journey.tsx` | Streak loss after a slip is the moment people most need to see progress kept |
| D4 | Urge flow promised the urge passes ("usually within minutes", "It passes") and offered one technique | `UrgeSheet.tsx`, `QuickSheet.tsx` | Unsupported promise; no way to switch when breathing doesn't help |
| D5 | No goal, reasons or plan; the goal was assumed to be "never again" | `Onboarding.tsx` ("What would you like to let go of?") | People cutting down or just observing had no fitting path |
| D6 | Slip screen centred the cost; reflection only as optional slip questions | `LogSheet.tsx` | No "what next", no link to a plan |
| D7 | Patterns shown after 3 slips, stated as facts ("Worst weekday", "What sets it off most") | `Report.tsx` | Small numbers presented as certainty; implied causation |
| D8 | "Clean" language everywhere | copy | Stigmatising (NIDA) |
| D9 | Guilt notifications: "misses you", "getting lonely", "still waiting", and a "won't eat" push hours after a slip | `notify.ts`, `Home.tsx` | Guilt as engagement driver; contradicts "silence is not failure" |
| D10 | No weekly review beyond slip counts | `Report.tsx` | No space to plan the next week |

## 2. Earlier audit findings, re-checked against the code

| Audit id | Claim | Status on this branch | Evidence |
|---|---|---|---|
| B1 | "Erase this phone" deleted cloud data | **Fixed earlier, still fixed** | `store.resetAll` commits `"reset"`; `sync.ts onCommit` treats it as a first sync; `test/reset.test.ts` passes |
| B2 | Shared AI cache | **Fixed in repo** (needs deploy + 0004) | `cacheKey(userId, request)` in `functions/ai/index.ts`; `privacy.sql` PASS locally |
| B3 | AI could cut a big slip 50% | **Fixed** | `applyAiAdjustment` ±30%; engine test |
| B4 | Web reminders on but never fired | **Fixed** | `test/notify.test.ts` |
| B5b | More than two notifications a day possible | **Reduced**: lapse notes 4 → 2, post-slip care note removed. Still unmeasured on a device | `notify.ts`, `Home.tsx` |
| B6 | Slips only for today/yesterday | **Fixed earlier** | `Calendar.tsx` logs slips for any past day |
| B11 | Not all copy in three tones | **Partly**: new recovery lines are in three tones (`recovery.ts`, `copy.ts dyingBanner`). Instructional labels and strategy steps are neutral by design. Some older lines remain single-tone (`conditions` texts) | grep |
| B14 | No global AI cost ceiling | **Fixed in repo** (not deployed): `AI_GLOBAL_DAILY_LIMIT`, fails closed | `functions/ai/index.ts` |
| B17 | First-sync duplicate companion | **Open.** Needs a product rule for merging two histories | `sync.ts cycle` |
| B19/B20 | Key fallback, cache outliving account | **Fixed in repo**; rotation of the live key is an owner action | log |
| B21 | Widget showed status outside PIN | **Fixed earlier** | `App.tsx` widget effect |
| B22 | Crisis check missed reflections | **Fixed earlier, extended now** to plan, urge trigger, slip reflection and weekly focus; more phrasings | `crisis.ts`, `test/crisis.test.ts` |
| Quiet-day ageing (§7.7) | Silence aged the pet | **Off** since the overnight run (`QUIET_DAYS_AGE = false`); 3.0 adds explicit "not tracking" days on top | `store.ts` |

## 3. Contradictions resolved

| Topic | PRD says | Code before | Decision in 3.0 |
|---|---|---|---|
| Death | §7.5 death, memorial, rebirth; §17 Q3 asks if it should be opt-out | Always on | **Continuity by default** (no death, no permanent scars); classic rules opt-in in Me → Your companion. Already-dead companions stay in the Hall. Engine default unchanged, so PRD pacing tests still pin §5.3 |
| Scar floor | §5.3, §17 Q1 asks if damage should be partly permanent | Always on | Off under continuity, on under classic |
| Missed check-ins | §5.3 v3: quiet days cost life | Already disabled by the overnight run | Kept off; added "not tracking" as a deliberate state |
| Language | "clean day" | "clean day" | "Goal met" / "good day" (NIDA). Data model names (`cleanDays`, `clean_days`) unchanged for compatibility |
| Success | §13: fewer slips week 4 vs week 1 | Streaks, slips, money | Goal-relative weekly review; urges managed and days of care count too |
| Brutal tone | "Look at him. You did that. Again." | Already softened in code ("Direct") | Kept soft. The PRD example is shaming and is not used |
| AI models | Claude Haiku/Sonnet | OpenRouter `gpt-4.1-mini` | Unchanged (owner decision; key must stay as is) |
| Account | P0: works with no account | Account required | Unchanged; documented in `supabase/README.md` |

## 4. What 3.0 still doesn't do

- One habit only (`habits[0]`).
- No outcome measurement beyond self-report.
- No device testing of notifications, widget or 3D in this run.
- AI weekly summary input doesn't include urges or the plan (the deployed function's strict schema would reject new fields; changing it needs a coordinated deploy).
