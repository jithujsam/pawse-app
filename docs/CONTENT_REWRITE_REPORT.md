# Pawse content rewrite report

Scope: every user-facing string I could trace in `apps/web/src` (screens, shared UI, copy libraries). Changes are small, targeted corrections. Nothing was redesigned, and no route, data model, persisted value, or business rule was changed. Not committed or pushed.

## A. Executive summary

**Main problems found**

1. **Navigation names didn't match their screens.** The tabs are Home, Journey, Insights, and Me, but the Me heading said "You", the Journey heading said "Calendar", and onboarding referred to "your report" (there is no Report tab).
2. **Copy contradicted the product rules.** The PRD and recovery rules say "goal met" replaces "clean", that gaps in a streak are neutral (so "in a row" is wrong), and that scars and permanent damage belong to classic rules only. Several lines broke these rules.
3. **Copy promised things the app does not do.** "Notes from [pet]" promised a "won't eat" note that the scheduler never sends. The reset-data confirmation named one pet when the reset removes every pet.
4. **Terminology drift.** "Companion" and "pet" were both used for the same thing in visible text, and "counsellor" and "counselor" were both used.
5. **Grammar and plurals.** "1 slips", "1 this week.", "−1 months".
6. **Guilt or credit framing.** "That's your doing" (health sheet), "guilt-free", and the "I regret it" answer option.

**Most important changes**

- Tab headings now match the nav labels (Me, Journey).
- Health and history copy uses "goal met" and drops "in a row" wording.
- Scar and permanent-damage text appears only under classic rules, which is how the engine actually works. Under the default continuity rules, a binge day heals like any other.
- The Me "Notes from" hint now describes the two notes that really are scheduled.
- The reset-data warning now says it removes all pets.

Verification: typecheck, lint, the test suite (287/287, after one pinned assertion was updated for the new wording), and the web production build all pass. See section G.

## B. Screen-by-screen audit

Status key: **Changed** = at least one text change; **Reviewed** = read in full, no change needed.

| Screen / component | File | Purpose | Major issues found | Status |
|---|---|---|---|---|
| Welcome, account sign-in step | `screens/Welcome.tsx` | Story then account creation | "existing companion" wording | Changed (restoring line) |
| Story cards (onboarding intro) | `screens/Onboarding.tsx` (`STORY`) | Three intro cards | None | Reviewed |
| Onboarding, 10 steps | `screens/Onboarding.tsx` | Pet, goal, plan, tone, reminder, disclaimer | "Choose your companion"; "your report" | Changed |
| Hatch (birth) | `screens/Onboarding.tsx` | First-run reveal | None | Reviewed |
| Home (one recovery track) | `screens/Home.tsx` | Pet, today's check-in, week strip | Unlock note said "companion" | Changed |
| Pets grid and track menu | `screens/Pets.tsx` | One card per track; pause, delete | "Not checked in" differs from calendar's "Not recorded" | Changed |
| Add-track sheet | `screens/Pets.tsx` (`AddTrack`) | Create a track | None | Reviewed |
| Me (settings home) | `screens/Me.tsx` | Settings index | Heading "You" vs tab "Me" | Changed |
| Pet settings | `screens/Me.tsx` (`PetPage`) | Name, look, wardrobe, health rules, Hall | Sub-page "Your companion"; "1 slips"; classic-rules wording; rename toast | Changed |
| Voice | `screens/Me.tsx` (`VoicePage`) | Tone choice | None | Reviewed |
| Reminders | `screens/Me.tsx` (`RemindersPage`) | Reminder and care-note switches | "won't eat" note promised but never sent | Changed |
| Check-in questions | `screens/Me.tsx` (`QuestionsPage`) | Edit questions | Intro "sharper"; default label "New question" | Changed |
| Your data (backup, reset) | `screens/Me.tsx` (`DataPage`) | Export, restore, reset | Reset warning named one pet; reset removes all | Changed |
| Appearance | `screens/Me.tsx` (`AppearancePage`) | Theme, accent | None | Reviewed |
| Feel and region | `screens/Me.tsx` (`FeelPage`) | Haptics, currency | None | Reviewed |
| About and help | `screens/Me.tsx` (`AboutPage`) | Version, safety | None | Reviewed |
| App lock (PIN) | `screens/Security.tsx` | Enable and change PIN | Claims checked: encryption applies only when the PIN is on, and the hint says so; photos are stripped from sync | Reviewed |
| Lock screen | `screens/Lock.tsx` | Enter PIN, forgot PIN | None | Reviewed |
| Account | `screens/Account.tsx` | Sign in, sign out, delete | "your companion" in delete warning | Changed |
| Plan | `screens/Plan.tsx` | Goal, reasons, first step, support | "counsellor" spelling | Changed |
| Journey (calendar) | `screens/Journey.tsx`, `screens/Calendar.tsx` | Month grid, stats, milestones | Heading "Calendar" vs tab "Journey"; "−1 months" | Changed |
| Insights (report) | `screens/Report.tsx` | Week numbers, urges, money, risky hours | "guilt-free" | Changed |
| Check-in and weekly review | `screens/Reflect.tsx`, `screens/WeeklyReview.tsx` | Mood, reflection, weekly review, observations | None in user copy | Reviewed |
| Log a slip | `screens/LogSheet.tsx` | Log a slip and result | "1 this week." | Changed |
| Quick actions (+) | `screens/QuickSheet.tsx` | Four tiles and plan picker | Curly apostrophe; "in a row" | Changed |
| Urge support | `screens/UrgeSheet.tsx` | Pause, way through, outcome | None in user copy | Reviewed |
| Health sheet | `screens/HealthSheet.tsx` | Health, history, conditions | "That's your doing"; raw tone words | Changed |
| Health and history copy | `health.ts` | Health lines, conditions, history | "clean days"; "in a row"; scar copy shown under continuity; "permanent" in aging text | Changed |
| Memorial | `screens/Memorial.tsx` | Death scene, adopt | None | Reviewed |
| Coach tips | `ui/Coach.tsx` | First-run spotlight | Named "weekly report" tab | Changed |
| Error boundary | `ui/ErrorBoundary.tsx` | Crash fallback | "companion" | Changed |
| Update dialog | `ui/UpdateDialog.tsx`, `copy.ts` (`UPDATE_COPY`) | Update prompt | None | Reviewed |
| Toasts | Various (`grep`-checked) | Short confirmations | Reviewed; copy is neutral across tones (see section F) | Reviewed |
| Shared controls | `ui/Controls.tsx`, `ui/Sheet.tsx`, `ui/PinPad.tsx`, `ui/TimePicker.tsx`, `ui/Settings.tsx`, `ui/Toast.tsx` | Labels, placeholders, aria | Checked by grep, no changes needed | Reviewed (grep) |
| Pet voice lines | `voice.ts` | What the pet says by event, personality, tone | Every event has all tones and personalities. No changes | Reviewed |
| Copy library | `copy.ts` | Tone lines, milestones, pause and update copy | Two fixes; `mo` exported | Changed |
| Recovery copy library | `recovery.ts`, `questions.ts` | Strategies, reflections, observations, field labels | "I regret it" option | Changed (questions.ts) |
| Notifications | `notify.ts` | Reminder and care notes | Verified against the "won't eat" claim | Reviewed |
| Simulator | `screens/Simulator.tsx`, `screens/dev-gallery.tsx` | Developer tools (DEV only) | Not shipped to users | Excluded |

## C. Before-and-after comparison

Each row quotes the original text in the Before column. The source location is the file and the text it appears in. There are no stable copy IDs in this codebase yet (see section D and F).

| Screen | Section ID or source location | Before | After | Reason |
|---|---|---|---|---|
| Me | `Me.tsx`, page heading | `You` | `Me` | Matches the "Me" tab. |
| Journey | `Journey.tsx`, page heading | `Calendar` | `Journey` | Matches the "Journey" tab. |
| Onboarding | Step 1 heading | `Choose your companion` | `Choose your pet` | Visible term is "pet". |
| Onboarding | Step 3 hint | `No judgement. It helps your report show how far you've come.` | `No judgement. It helps your Insights show how far you've come.` | There is no "report" tab. |
| Welcome | Restoring screen | `Checking your account for an existing companion…` | `Checking your account for an existing pet…` | Terminology. |
| Home | Unlock note after a new accessory | `Put it on in Me → your companion.` | `Put it on in Me → your pet.` | Terminology. |
| Me | Pet sub-page title | `Your companion` | `Your pet` | Terminology. |
| Me | Classic-rules description | `at 100 a companion dies and you adopt a new one.` | `at 100 a pet dies and you adopt a new one.` | Terminology. |
| Me | Hall of Companions count | `{n} slips` (shows "1 slips") | "1 slip" / "N slips" | Plural. |
| Me | Reminders, "Notes from …" hint | `A thank-you after good days, and a note when it won't eat` | `A thank-you on the evening of a good day, and a morning note after it` | The "won't eat" note is never scheduled (`notify.ts` plans only thank-you and morning notes after a good day, and nothing after a slip). The hint now matches what is sent. |
| Me | Check-in questions intro | `Asked after each slip. Short answers make your insights sharper.` | `Asked each time you log a slip. Short answers keep your Insights easy to read.` | Accurate trigger; drops the vague "sharper". |
| Me | New question default label | `New question` | `Your question` | Reads as an editable prompt. |
| Me | Rename toast | `Say hi to {n}` | `Renamed to {n}` | Says what happened. |
| Me | Reset warning, with account | `This removes {name}, every log and your settings from this phone only. …` | `This removes all your pets, every log and your settings from this phone only. …` | The reset clears every track (`resetAll`), so naming one pet was wrong. |
| Me | Reset warning, no account | `This removes {name}, every log and your settings from this phone. It can't be undone.` | `This removes all your pets, every log and your settings from this phone. It can't be undone.` | Same reason. |
| Pets | Pet card status for unrecorded days | `Not checked in` | `Not recorded` | Matches the calendar's label for the same state. |
| Quick actions | Sheet title | `What’s going on?` | `What's going on?` | Straight apostrophe, as used elsewhere. |
| Quick actions | "Goal met today" hint | `{n} days in a row` | `{n} days so far` | Gaps are neutral (`docs/RECOVERY_RULES.md`); "in a row" implied otherwise. |
| Log a slip | Result line | `{n} this week.` | `1 slip this week.` / `N slips this week.` | Plural. |
| Journey | Calendar day, slip amount | `−{n} months` (shows "−1 months") | Uses `mo()`, so "−1 month" / "−3.5 months" | Plural. |
| Plan | More support | `a doctor, counsellor or support service` | `a doctor, counselor or support service` | Matches the spelling in the disclaimer and PRD. |
| Check-in (after a slip) | Option "I regret it" (`questions.ts`) | `I regret it` | `Not happy about it` | Lower-shame wording for an answer the person picks. |
| Insights | Savings goal reached | `You've kept enough. Treat yourself, guilt-free.` | `You've kept enough. Treat yourself.` | Drops the "guilt" framing. |
| Health sheet | Health tab, no conditions | `Nothing is troubling {name} right now. That's your doing.` | `Nothing is weighing on {name} right now.` | Removes the credit framing, which implies blame when things go wrong. |
| Health sheet | Conditions list tag | Raw `mild` / `moderate` / `serious` | `Mild` / `Moderate` / `Serious` | Raw internal words shown to the user. |
| Health sheet, history | Clean-day run, `health.ts` `history()` | `{n} clean days, … months of life back` | `{n} goal-met days, … months of life back` | PRD §19.4: "goal met" replaces "clean". |
| Health | Thriving line, `health.ts` `healthReport()` | `{n} good days in a row and it shows.` | `{n} good days so far and it shows.` | Gaps are neutral. |
| Health | Condition fix, `health.ts` `conditions()` | `{n} good days in a row clears it up.` | `{n} good days clear it up.` | Gaps are neutral. |
| Health | Aging condition fix, `health.ts` `conditions()` | `{n} good days in a row to feel younger again.` | `{n} good days to feel younger again.` | Gaps are neutral. |
| Health | Aging fix when no day count, `health.ts` | `Some of this is permanent now, but good days still help.` | `Good days still help bring them back.` | Permanent damage exists only under classic rules; continuity is the default. |
| Health | "Old scar" condition, `health.ts` | Shown whenever a binge day exists | Shown only when `petLife === "classic"` | Under continuity `scars` is off and the copy claimed a permanent scar and a lower life expectancy. |
| Health | History entry for a binge day, `health.ts` `history()` | `… lost N months of lifespan. A lasting scar` on every binge day | `A lasting scar` only under classic rules; otherwise a plain slip entry | Same as above. |
| Home / shared lines | `copy.ts` `cleanLine()` | `{n} good days in a row. {name} is healing.` | `{n} good days so far. {name} is healing.` | Gaps are neutral. |
| Insights | `copy.ts` `verdict()` | `No slips this week. That is a slip-free week.` | `No slips this week. That's a slip-free week.` | Contraction, matching the rest of the copy. |
| Coach (first run) | `ui/Coach.tsx` step 3 | `Your calendar and weekly report fill in as you log.` | `Your Journey and Insights fill in as you log.` | There is no "weekly report" tab; names match the nav. |
| Account | Delete-account warning | `…your account, your companion and every log…` | `…your account, your pets and every log…` | Delete removes all pets. |
| Error screen | `ui/ErrorBoundary.tsx` | `Your companion and your logs are safe on this phone.` | `Your pets and your logs are safe on this phone.` | Terminology. |
| Test | `test/health.test.ts` line 55 (not user copy) | `/3 clean days/` | `/3 goal-met days/` | Pinned assertion updated to the new wording. The `kind` value is unchanged. |

Supporting, non-copy changes (needed for the copy above to compile):
- `copy.ts`: `mo` is now exported and used by the calendar.
- `screens/Calendar.tsx`: imports `mo` from `copy.ts`.
- `screens/HealthSheet.tsx`: `COND_TONE_LABEL` map and `Condition` type import.
- `health.ts`: gates the scar condition and the scar history text on `d.settings.petLife === "classic"`. `settings` was already on `AppData`, so no new data is read.
- `screens/Me.tsx`: small `slipCount()` helper for the plural.

## D. Content principles

These are the rules the existing copy follows and that the changes above restore. They are written down here so future edits can be checked against them.

**Core voice.** Warm, plain, and honest. The pet is glad to see the person and is hurt by the habit, never by the person. Short sentences. Numbers come from the engine, and every number has a visible reason.

**Terminology (user-facing)**
- Nav tabs: **Home**, **Journey**, **Insights**, **Me**. Screen headings use these exact names.
- **Pet** is the term for the companion in visible text. "Companion" appears only in code identifiers and in the product name "Hall of Companions" (kept as a named feature).
- **Recovery track** = one habit with its own pet. "Track" is used in menus and headings.
- **Goal met** replaces "clean" everywhere in user copy (PRD §19.4).
- **Slip** = a logged slip. A slip is never inferred.
- **Not recorded** = a day with nothing logged. **Not tracking** = a rest or paused day. **Paused** = a track that is paused.
- **Days of care** = goal-met days plus managed urges. It only grows.
- "Urge managed" / "urge acted on" are the two urge outcomes. Acting on an urge is a check-in, never a slip.

**Writing rules**
- Use "good days so far" or "in total" when counting. Never "in a row", because gaps are neutral.
- Plurals: write "1 slip" / "N slips", "1 month" / "N months" (use `mo()` for month amounts), "1 day" / "N days".
- Spelling: British for general vocabulary ("colour", "behaviour", "judgement"), except "counselor", which matches the disclaimer and PRD.
- Apostrophes are straight (`'`) in user copy.
- Do not explain a rule that the screen does not need.

**Emotional boundaries**
- No line may shame, punish, or threaten the person. Describe what happened and what it cost, not who the person is.
- The pet never withholds affection because of a slip. Slips may make the pet tired or off its food, but the next good day always brings it back.
- Avoid credit or blame framing ("that's your doing"), guilt ("guilt-free" was removed), and words like "regret".
- No streak pressure. A quiet day costs nothing.
- Health lines describe illustrative pet conditions. They must never claim a real medical outcome.

**Three tones**
- **Gentle**: soft, reassuring, invites the person back.
- **Honest** (default): plain facts, a clear next step.
- **Direct** (the code's `brutal` key, labelled "Direct" in the UI, as set by PRD §21.9): blunt and short, never insulting.
- Each tone keeps the same meaning, function, and safety content. Crisis messages, the disclaimer, and the professional-help note are the same text in every tone, by design.

**Safety**
- Crisis language in any free-text field shows the crisis message and saves nothing.
- Helplines appear in the plan's More support section and in the About page.
- Privacy claims were checked against the code (see section E).

## E. Unchanged content

Reviewed and deliberately left as they are:

- **Pet voice lines (`voice.ts`).** Each event has gentle, honest, and brutal lines for every personality. The structure is consistent, and I found no shaming or missing variants. Changing them would have altered the product's personality, which the task says to preserve.
- **Privacy and security claims.** "Photos never leave this phone" is true: photos are stripped from sync (`syncmap.ts` `stripPhotos`). "PIN on. Everything on this phone is encrypted" is true: when a PIN is set, the stored data is sealed (`store.ts` `data.enc`). "Nothing is shared, and there are no ads or trackers" was left as written. The reviewed code has no ad SDK and no sharing feature, but this was checked by reading the code, not by a full dependency audit.
- **Onboarding disclaimer and the adult check.** Matches PRD §7.7 and §15 exactly.
- **Crisis messages and helplines.** Same wording wherever they appear. Only the placement was reviewed.
- **Milestone and accessory copy.** Matches the PRD milestones (3, 7, 14, 30, 60, 100 days of care).
- **Quiet-day and "not being tracked" copy.** Matches the `docs/RECOVERY_RULES.md` rules. Quiet days cost nothing (`QUIET_DAYS_AGE = false` in `store.ts`).
- **Brutal tone label "Direct".** Kept as the UI label because PRD §21.9 names it "direct (brutal)". The internal key stays `brutal`.
- **Hall of Companions.** Kept as the feature name in PRD §7.5.
- **Condition names (`health.ts`).** Pet ailments that mirror each habit, such as "Chest cold", "Tired liver", and "Kidney strain". They are labelled illustrative on screen. Some are blunt metaphors that may be worth a product review, but changing them is a content-strategy decision, not a correction.
- **Toasts with no tone variant (e.g. "Plan saved", "Slip deleted").** Neutral, factual confirmations. See section F.
- **Developer screens (`Simulator.tsx`, `dev-gallery.tsx`).** Shown only in DEV builds.

## F. Unresolved issues

These could not be fixed safely with copy alone, or need a product decision.

1. **Delete track does not match the PRD.** PRD §20.2 says delete needs an archived track and the name typed back. `Pets.tsx` calls `actions.deleteTrack(habit.id, habit.name)`, which passes the track's own name, so no typed confirmation happens. The confirmation copy describes what happens, which is accurate. The missing typed-name step is a functional gap that needs a decision.
2. **Typed triggers can break the grammar of weekly adjustment ideas.** `recovery.ts` `adjustmentIdeas` builds "Plan one thing to do when I'm {trigger}". A typed trigger such as "after work" yields "when I'm after work". A fix needs either a trigger-phrasing step or neutral wording, so it was left alone.
3. **Dead copy.** `copy.ts` `careNote` has a "strike" branch, and `notify.ts` declares a `strike` kind, but nothing schedules it. Removing it is a code cleanup, not a copy change, so it was left for a follow-up.
4. **Dormant "quiet day lost months" text.** `health.ts` `history()` has a "Quiet day … lost N months" line. It is unreachable while `QUIET_DAYS_AGE` is `false`. It is correct for that flag value and was left in place.
5. **Code comment with an unsupported research claim.** `screens/Reflect.tsx` says short writing "roughly doubles follow-through". This is a developer comment, not user copy, but it is an unsupported claim and should be softened or sourced.
6. **Tone-less toasts.** CLAUDE.md says all user-facing copy must exist in all three tones. Many short confirmations ("Plan saved", "Slip deleted", "Renamed to …") are tone-less across the whole app. I left them as neutral, factual confirmations rather than inventing three variants per toast. Whether these count as "user-facing copy" under CLAUDE.md is a decision for the owner.
7. **Stable copy IDs were not added.** The task asked for stable IDs and for copy to be centralised. I did not create a new copy module. The repository's preference is to ask before creating new files, and the existing copy is already grouped in `copy.ts`, `voice.ts`, `recovery.ts`, and `questions.ts`. Adding IDs means touching most components, so it should be a separate, agreed change.
8. **Unverified multi-case grammar.** Only the strings I read or matched by grep were checked. Strings built by long templates in `progress.ts`, `store.ts`, and `tracks.ts` were not each traced to a screen.

## G. Verification

Run from `/home/user/pawse-app` after all changes:

| Command | Result |
|---|---|
| `pnpm install` (frozen lockfile, falling back to install) | Succeeded (exit 0) |
| `pnpm typecheck` (`tsc --noEmit` in `packages/engine`, `packages/schema`, `apps/web`) | Passed (exit 0) |
| `pnpm lint` (the workspace lint script is `tsc --noEmit` in each package; there is no ESLint step) | Passed (exit 0) |
| `pnpm test` (Vitest, `apps/web`) | First run: 286 passed, 1 failed (`test/health.test.ts`, which pinned the old "clean days" wording). After updating that one assertion to "goal-met days": 21/21 files, 287/287 tests passed. |
| `pnpm --filter web build` (Vite production build) | Passed (exit 0). Vite printed a chunk-size warning for `index` and `Pet3D` bundles. I did not measure whether this warning existed before these changes. |

Not run: `pnpm simulate` (no copy change touches the engine), and the Android build (`npx cap sync`, `./gradlew assembleDebug`), which needs an Android SDK this environment does not have. Browser-level visual checks were not run.

Change set: 18 files under `apps/web/src`, plus one test file (`apps/web/test/health.test.ts`), plus this report. Nothing was committed or pushed.
