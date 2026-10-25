# Detox Companion: Product Requirements Document

Working name: **Detox Companion** (earlier prototype: Detox Ledger)
Version: 0.1 draft
Date: 2026-10-23
Owner: Jithu
Build target: Claude Code, web first, native widgets later

---

## 1. One-line summary

A calendar-based behavior tracker where every addiction you log changes the health, age and mood of a companion (a dog by default) that lives on your home screen. Slip, and your companion ages and suffers. Stay clean, and it recovers. Let it get too bad, and it dies.

## 2. Why this exists

Most addiction and habit apps hand people a list of exercises and hope something works. Nobody can tell whether any of it helped.

This product takes a different position:

- **Realization is the intervention.** People rarely change until they see, in numbers and in a face, what they are doing. The app does not try to fix anyone. It makes the pattern impossible to ignore.
- **Track behavior, not just expense.** It works like an expense tracker, but the thing tracked is the behavior: what, where, why, how much, with an optional photo.
- **Make the cost visible and emotional.** A bar chart is easy to dismiss. A puppy turning grey is not.
- **No app can fix you until you want to.** The product is honest and a little blunt, and it never pretends to be therapy.

## 3. Product principles

1. **The companion is the product.** It owns the home screen. Everything else supports it.
2. **Friendly face, honest words.** The visuals are warm, soft and cute. The copy tells the truth.
3. **Every number is explainable.** Each slip shows exactly what it cost ("Biscuit lost 3 months"). No black boxes.
4. **Fast to log.** A slip takes under 15 seconds. A clean day takes one tap.
5. **Recoverable.** Damage is real but not hopeless. The app must never push someone into a shame spiral and an uninstall.
6. **Private by default.** Behavior data is sensitive. Nothing is shared or public unless the user chooses.
7. **Not medical.** Age and body effects are illustrative estimates. The app says so.

## 4. Target users

**Primary:** Adults (18+) who know they have a pattern they want to cut and can name it: impulse spending, food delivery, doomscrolling, smoking or vaping, drinking, gambling-adjacent spending, online shopping.

**Not for (v1):** People in acute crisis or medical withdrawal, minors, or people whose main issue is an eating disorder. See section 15.

**Core user story:** "I spend too much on random food and orders. I want to see how bad it really is week to week, and I want something that makes it feel real when I slip."

## 5. Core concept

### 5.1 The companion

- The user picks a companion during onboarding and names it.
- Default: **dog**. Alternatives in v1: cat, rabbit. Future: user's own pet from a photo, a plant, a human baby.
- Companion appearance depends on its **visible age**, which runs from **0 (baby) to 100 (death)**.
- One companion per tracked addiction in v1 (each addiction has its own life). Later option: one shared "household" companion fed by all addictions.

### 5.2 Visible age and life stages

Visible age is a number from 0 to 100. It is driven by accumulated damage, not by calendar time. A person who never slips never ages the companion.

| Visible age | Stage | Look and behavior |
|---|---|---|
| 0 to 9 | Baby (puppy) | Tiny, bouncy, big eyes, fast tail wag |
| 10 to 29 | Young | Playful, glossy coat, bright eyes |
| 30 to 49 | Adult | Calm, slightly slower, coat still healthy |
| 50 to 69 | Middle-aged | Grey on the muzzle, heavier, sighs, less play |
| 70 to 79 | Old (70) | Grey face, slow walk, cloudy eyes, cough |
| 80 to 99 | Frail (80 to 100) | Thin or swollen, trembling, lies down, rarely looks up |
| 100 | Dead | Memorial screen |

Recovery moves the companion back down the ladder, slowly. A clean week visibly helps. It does not erase a bad month.

### 5.3 The deduction engine

Each slip produces a **deduction**: an estimate of how many **months of companion life** were lost, plus a list of **body effects** that show on the companion.

- The companion has a **life budget** of 1,200 months (100 years of metaphorical life).
- Visible age = (months lost net of healing) / 1,200 × 100.
- Each slip logs a `months_lost` value, a `severity` score and `body_effects` tags.

**Deterministic baseline (always runs, works offline):**

```
months_lost = BASE × severity_multiplier × repeat_multiplier

BASE                = 4 months per slip
severity_multiplier = 0.5 to 3.0 (see below)
repeat_multiplier   = 1.0 for the 1st slip of the day,
                      1.25 for the 2nd, 1.5 for the 3rd, capped at 2.0
```

**Severity multiplier inputs (per habit type):**

- Money habits: amount spent relative to the user's own 30-day median for that habit. Above median pushes severity up.
- Count habits (cigarettes, drinks): count relative to the user's own median.
- Time habits (minutes scrolled): minutes relative to median.
- Trigger flags: late night, stress, alone, "extra beyond planned" answered Yes add +0.25 each (max +0.5).
- Habit class weight: a fixed table (for example smoking 1.4, alcohol 1.3, scrolling 0.8, food spending 0.7, impulse buying 0.9). These are product choices, not medical claims, and are editable.

**AI layer (adds explanation and fine-tuning, never replaces the baseline):**

- The AI receives the slip, the habit, and the user's recent history.
- It returns an adjustment of at most ±30% on `months_lost`, a one-line explanation, and body effect tags.
- Output is clamped to 0.5 to 12 months per slip. If the AI call fails, the baseline stands and the explanation comes from a template.

**Healing:**

```
clean_day_heal = 1.5 months
healing cannot take damage below the scar floor
scar_floor     = 20% of lifetime damage
```

So some damage stays. That is intentional: it makes history matter. It is also an open question (section 17), because it could feel punishing.

**Hidden reserve (v2, "extra lives"):**

```
reserve grows  0.2 months per clean day, only once healing has nothing left to heal
reserve cap    12 months (about three ordinary slips)
absorb         a slip's damage comes out of the reserve first, at most 6 months per day
```

A companion that has been well for about two months shrugs off a one-off slip: visible age does not move, and the app says so ("It's been 63 days. One slip doesn't undo that."). The reserve is never shown as a number. A brand-new companion has none, and a binge still lands because of the daily cap.

**Binge scar (v2):** a day with 3 or more slips adds 25% of that day's damage to the scar floor, permanently. The companion does not die from it; its **life expectancy** (100 minus the floor age) drops, and that is shown.

**Recovery plan (v2):** after a slip the app shows how many clean days in a row undo it (damage / 1.5, rounded up) and how many bring the companion back to its previous stage. If the scar floor sits above a target, the app says that part can't come back rather than promising it.

**Appetite (v2, presentation only):** on a day with a slip the companion refuses food ("Not hungry. Not until you stop."); it eats again after a clean day. This is behaviour and copy, not engine math.

**Missed check-ins (v3):** a day with nothing logged (no slip, no clean day) is "quiet". The first two quiet days in a row cost nothing; each further one costs 1.5 months (loneliness), absorbed first by the hidden reserve. The rule only applies from the day it shipped on a given account (no retroactive ageing), never to today, and never after death. Healing still needs a clean day, so a pet only recovers when the person keeps checking in. Reminders go out after 2, 4, 7 and 10 quiet days.

**Rough pacing targets (to be tuned in playtests):**

| Pattern | Roughly reaches stage | Time |
|---|---|---|
| 1 slip per day, severity 1.0 | Old (70), then death | about 7 months, death at about 10 months |
| 3 slips per day, severity 1.5 | Old (70), then Frail | about 5 to 6 weeks, death at about 8 weeks |
| 2 slips per week, otherwise clean | Stays baby to young | age about 3 after 6 months, about 20 after a year |

These figures come from a quick simulation of the formulas above (heal on every clean day, scar floor applied). Phase 0 turns this into a committed test.

### 5.4 Body effects

Each habit class maps to visible conditions on the companion. Effects stack as damage grows and fade as it heals.

| Habit class | Early effects | Late effects |
|---|---|---|
| Food spending | Slightly rounder, dull coat | Heavy, labored breathing, can barely stand |
| Smoking or vaping | Occasional cough | Constant cough, grey muzzle, thin |
| Alcohol | Sluggish, glassy eyes | Trembling, sleeps constantly |
| Doomscrolling | Tired eyes, slumped posture | Hollow stare, stops responding to play |
| Impulse buying | Cluttered bed, anxious look | Surrounded by unopened boxes, hides |
| Custom | Generic "worn down" set | Generic "failing" set |

The AI may suggest additional effect tags from a fixed vocabulary. It cannot invent new art; it picks from tags the art supports.

## 6. Experience and design direction

### 6.1 Feel

The earlier prototype was a blunt clinical ledger. This version keeps the honesty but changes the feel to **warm, soft and friendly**, so the emotional hit comes from caring about the companion, not from a harsh interface.

- Rounded shapes, generous spacing, large touch targets.
- Warm neutral background, one soft accent color per companion, red used sparingly for harm.
- Rounded display type for headings, a clean sans for body, a mono face only for numbers.
- Motion with meaning: breathing, tail wag, head tilt, slow droop. Nothing decorative.
- Dark mode designed with the same care, not inverted.

### 6.2 Voice and tone setting

The user chooses a tone at onboarding and can change it any time:

| Tone | Example after a slip |
|---|---|
| Gentle | "Biscuit is a little tired today. Tomorrow is a fresh start." |
| Honest (default) | "That was the third order today. Biscuit lost 4 months." |
| Brutal | "Look at him. You did that. Again." |

All tones stay respectful. None may insult the person, only describe the behavior and its cost.

## 7. Screens and flows

### 7.1 Home (companion is the hero)

The companion fills roughly the top 55 percent of the screen. Everything else is secondary.

```
+--------------------------------+
|  Biscuit               Fri 23  |
|                                |
|        [  COMPANION  ]         |
|        [  animated   ]         |
|                                |
|   Age 54  .  Middle-aged       |
|   [=========-----]  Life 46    |
|   "He is getting heavy."       |
|                                |
|  Today's check-in              |
|  [ I slipped ]  [ Clean today ]|
|                                |
|  This week: 9 slips, Rs 2,340  |
|  Clean streak: 0 days          |
+--------------------------------+
| Home |Calendar| + |Insights|You|
+--------------------------------+
```

Tabs: **Home**, **Calendar** (the month grid first, then milestones), **Insights** (named "Report" in earlier drafts; it holds patterns and the weekly review rather than a report card), and **You** (settings). The centre **+** opens the quick check-in.

States the companion must express:

- **Waiting** (no check-in yet today): looks at the door or the user, ears up.
- **Happy** (clean day logged): tail wag, small bounce.
- **Hurt** (slip just logged): brief flinch, then a stage-appropriate idle.
- **Sick** (stage 70 and above): cough loop, slow breathing.
- **Dying** (age 90 and above): lying down, barely moving. A banner states clearly how close it is.
- **Dead:** memorial screen.

### 7.2 Log a slip

Bottom sheet with the habit's custom questions. Fields types: short text, number, money, yes or no, photo.

After saving, the companion reacts on screen and a **deduction card** appears:

> That order cost Biscuit **3 months**. His coat looks duller.
> Rs 420 spent. Third slip this week.

### 7.3 Calendar

Month grid. Each day shows slip, clean or not-logged. Tap a day to see entries, photos and per-day deduction. A small companion-age sparkline sits above the grid so users can see the age curve over the month.

### 7.4 Weekly report

- This week versus last week for slips and spend, with a plain verdict.
- Months of companion life lost this week versus last week.
- 8-week trend chart.
- Pattern facts: worst weekday, repeated places or triggers, biggest single slip.
- AI-written summary of 3 to 5 sentences in the chosen tone, with one concrete observation and no advice unless the user asks for it.
- Projection: "At this pace, Biscuit reaches the frail stage in about N weeks."

### 7.5 Memorial and rebirth

When visible age reaches 100:

1. A quiet, respectful death scene. No gore. The companion lies down and fades.
2. A summary: how long it lived, total slips, total money spent, what the final month looked like.
3. A **Hall of Companions** entry that stays forever.
4. Option to **adopt a new puppy**. The new life starts at age 0, and the user's history carries over in reports.

Design intent: the death should land emotionally but must not end the user's journey. See risks in section 15.

### 7.6 Widget (smallest form)

- Small square widget: companion face, visible age, one line of status.
- Optional lock screen widget: face only.
- Tapping opens the check-in sheet directly.
- Widgets require native code. They ship in phase 4.

### 7.7 Onboarding

1. Pick a companion and name it.
2. Name the first addiction. Choose a template (food spending, impulse buying, doomscrolling, smoking or vaping, alcohol, blank) and edit the daily questions.
3. Pick a tone.
4. Set a daily check-in reminder time.
5. A short, honest disclaimer: this is not medical advice or treatment.

### 7.8 Settings and "You" tab

Addictions and their questions, tone, reminder time, companion list and Hall of Companions, data export, delete all data, safety resources.

### 7.9 v2 additions

- **Urge SOS** (centre button): rate the urge 1 to 5, then two minutes of paced breathing (4 in, 4 hold, 6 out) with the companion, then an honest outcome. Ridden-out urges are counted and celebrated; they never change visible age.
- **Reflect** (Journey): one mood (1 to 5) and an optional sentence per day, with rotating prompts including an if-then plan.
- **Insights**: urges ridden out and success rate, a weekday by time-of-day map of slips, money kept against the starting pace, and an optional savings goal.
- **Risky-hour heads-up**: once at least 5 timed slips show a clear peak, a daily note 30 minutes before it, in the companion's voice.
- **Widget** (Android): companion, name and one line about today; looks sad on a slip day; tapping opens the quick check-in.

## 8. Functional requirements

**P0 (must have for first playable):**

- Create, edit and delete addictions with custom questions (5 field types).
- Log a slip with date, optional time and field values; mark a day clean.
- Companion on the home screen with at least 5 stage looks and 3 mood states.
- Deterministic deduction engine, healing, scar floor, death and rebirth.
- Calendar view with per-day detail.
- Weekly comparison with plain-language verdict and trend chart.
- Local-first storage so the app works with no account.

**P1:**

- Accounts and cloud sync.
- AI deduction explanations and body effect tags.
- AI weekly summary.
- Daily reminder notifications.
- Tone setting.
- Companion choice (dog, cat, rabbit).
- Hall of Companions.

**P2:**

- Native widgets (iOS and Android).
- Photo-based pet (user's own pet, stylized).
- Shareable "report card" image (opt-in).
- Accountability buddy (one trusted person sees a weekly summary, opt-in).
- Multiple addictions feeding one household companion.

## 9. Data model

Postgres (Supabase). Row level security on every table, scoped to `user_id`.

```
users            (id, created_at, tone, reminder_time, timezone, onboarding_done)

companions       (id, user_id, species, name, born_on, died_on null,
                  cause_summary null, final_age null)

habits           (id, user_id, name, class, companion_id, created_at,
                  archived_at null, class_weight)

habit_fields     (id, habit_id, label, type, position, required)
                  -- type: text | number | money | yesno | photo

entries          (id, habit_id, user_id, occurred_on, occurred_at null,
                  values jsonb, spend numeric null, count numeric null,
                  created_at)

entry_photos     (id, entry_id, storage_path)

clean_days       (habit_id, day, created_at)   -- primary key (habit_id, day)

deductions       (id, entry_id, months_lost numeric, severity numeric,
                  baseline_months numeric, ai_adjust_pct numeric null,
                  body_effects text[], explanation text, source text)
                  -- source: baseline | ai

companion_daily  (companion_id, day, damage_months, healed_months,
                  net_months, visible_age numeric, stage text)
                  -- derived and cached nightly and on write

weekly_reports   (id, user_id, habit_id, week_start, stats jsonb,
                  summary text, created_at)
```

**Rule:** visible age is always recomputable from `entries`, `clean_days` and `deductions`. `companion_daily` is a cache, never the source of truth.

## 10. AI design

Models: `claude-haiku-5-5` for per-slip work (fast, cheap), `claude-sonnet-5-5` for the weekly summary. Calls go through a server route or edge function. The API key never reaches the client.

### 10.1 Per-slip deduction

Input (JSON): habit class, this entry's values, spend or count, the user's 30-day medians, last 7 days of slips, tone.

Output (strict JSON, validated with a schema):

```json
{
  "ai_adjust_pct": 12,
  "body_effects": ["dull_coat", "heavier"],
  "explanation": "Third order today and well above your usual spend."
}
```

Guardrails:

- Reject and fall back to baseline if the JSON is invalid or any value is out of range.
- `ai_adjust_pct` clamped to -30 to +30.
- `body_effects` must come from the fixed vocabulary.
- Explanation max 140 characters, in the user's tone, no medical claims, no insults.
- Cache by a hash of (class, normalized features) so identical slips cost nothing twice.

### 10.2 Weekly summary

Input: this week and last week stats, deductions, pattern facts, tone.
Output: 3 to 5 sentences. Must cite at least one real number. Must not give medical advice. For smoking, alcohol and similar classes, it may suggest talking to a professional once, never repeatedly.

### 10.3 What the AI never does

- Diagnose anything or state health outcomes as fact.
- Shame the user as a person.
- Change the baseline math by more than the allowed range.
- Run on data the user has not logged.

## 11. Technical approach

### 11.1 Recommended stack

**Phase 1 to 3 (validate fast): web app as a PWA**

- Next.js (App Router) with TypeScript
- Tailwind CSS
- Supabase (Postgres, Auth, Storage, RLS)
- Anthropic API called from server routes or Supabase edge functions
- Companion art as layered SVG or Rive animations
- Vitest for the damage engine, Playwright for core flows

**Phase 4 (widgets): native shell**

Home screen widgets cannot be done from a PWA. Options:

- **Expo (React Native)** app reusing the same Supabase backend and the shared engine package, plus native widget extensions (WidgetKit on iOS, Glance on Android).
- Or a thin native wrapper around the PWA with only the widgets written natively.

Decision point after phase 3, based on whether people use it.

### 11.2 Code structure

```
/apps/web            Next.js app
/packages/engine     Pure TypeScript: deduction math, healing, stages, projections
/packages/schema     Zod schemas shared by client, server and AI validation
/packages/companions Companion asset manifests and stage/mood mapping
/supabase            Migrations, RLS policies, edge functions
/docs                PRD.md, design notes, tuning log
```

The **engine package is pure and heavily unit-tested**. It is the heart of the product, and it must behave identically on web and native.

### 11.3 Companion art pipeline

- Style guide first: proportions, line weight, palette, eye style, per-species silhouette.
- For each species: 7 stage looks × 5 moods (idle, happy, hurt, sick, dying) is 35 states. Reduce by sharing parts: body and head are layered, with overlays for grey muzzle, coat dullness, weight, cough puffs and so on.
- Prefer **Rive** or layered SVG with CSS or Lottie animation so one skeleton serves all stages.
- Generated illustration is acceptable for concept and exploration. The shipped set must be consistent, original, and cleared for commercial use. No copyrighted characters.

## 12. Notifications

- One daily check-in reminder at the chosen time, worded in the chosen tone.
- One optional end-of-day nudge if nothing was logged.
- A high-risk alert when the companion enters the frail stage ("Biscuit needs a good week").
- No guilt-loop spam. Max 2 notifications per day, user can silence any of them.

## 13. Success metrics

**Validation phase (first 4 weeks of real users):**

- D1, D7 and D30 retention.
- Daily check-in completion rate (slip or clean logged).
- Median time to log a slip (target under 15 seconds).
- Share of users with 14 or more days of data.
- Share of users whose week 4 slips or spend is lower than week 1 (the honest outcome metric).

**Qualitative:**

- "Did seeing your companion change a decision?" asked in-app after week 2.
- Number of users who say they would be sad if the companion died.

## 14. Roadmap and build plan for Claude Code

Each phase ends with something runnable and testable.

### Phase 0: Foundations (2 to 3 days)

- Repo, monorepo tooling, CI, lint, type checks.
- `packages/engine` with deduction, healing, scar floor, stage mapping and death logic.
- Unit tests that pin the pacing table from section 5.3.
- Seed script that simulates 90 days for several user patterns and prints the age curve.

**Acceptance:** the simulated heavy user reaches the frail stage in 6 to 8 weeks, the light user stays under age 50, and tests pass.

### Phase 1: Playable local MVP (about 1 week)

- Next.js app, local-first storage (IndexedDB).
- Onboarding, addiction setup with custom questions, log slip, mark clean.
- Home screen with the companion hero, 5 stage looks, 3 moods, deduction card after each slip.
- Calendar with day detail.
- Memorial and rebirth.

**Acceptance:** a new user can finish onboarding, log slips for a simulated week, watch the companion age, and see it die and be reborn, with no backend.

### Phase 2: Report and design polish (about 1 week)

- Weekly comparison, 8-week chart, pattern facts, projection.
- Full art pass: all 7 stages, tone-aware copy, dark mode, motion polish.
- PWA install, offline support.

**Acceptance:** two real people use it for a week and complete check-ins on 5 of 7 days.

### Phase 3: Accounts and AI (about 1 week)

- Supabase auth, schema, RLS, sync from local.
- Per-slip AI deduction layer with validation and baseline fallback.
- AI weekly summary.
- Reminders (web push).

**Acceptance:** AI output always passes validation or falls back cleanly; no API key reaches the client; RLS verified by tests.

### Phase 4: Native and widgets (2 to 3 weeks)

- Expo app or native wrapper, shared engine.
- Small home screen widget and lock screen widget.
- Push notifications on device.

**Acceptance:** the widget shows the correct companion and age within a minute of a change, and tapping it opens the log sheet.

### Phase 5: Validate and decide

- Put it in front of 20 to 50 real users in the target group.
- Measure the metrics in section 13.
- Decide: kill, iterate, or invest in more species, buddy mode and a paid tier.

## 15. Safety, ethics and risks

This product deals with sensitive behavior and uses a blunt emotional mechanic. These are requirements, not nice-to-haves.

| Risk | Mitigation |
|---|---|
| Shame spiral and uninstall after the companion dies | Rebirth is one tap; copy after death focuses on the next day; Gentle tone available from day one |
| Users with eating disorders using food tracking to restrict | Food template tracks spending and extra eating, never calories, weight or restriction. No streaks or targets that reward eating less. Show help resources and let users remove the food template |
| Alcohol and drug users in danger from sudden stopping | Disclaimer plus a one-time, non-repeating suggestion to speak to a professional for alcohol, smoking and substances. App never advises quitting abruptly |
| Self-harm risk when someone is distressed | If a user types crisis language into any field, show a calm message with local crisis resources and do not continue the slip flow as normal |
| Pet-loss trauma | Species choice includes non-pet options; user can turn off the death scene and keep only the memorial text |
| False health claims | Every age and body effect is labeled illustrative; AI is forbidden from claiming real medical outcomes |
| Sensitive data exposure | RLS everywhere, no public profiles, no ad SDKs, export and delete from settings |
| Minors | 18+ gate at onboarding |
| AI inconsistency | Deterministic baseline, strict schema, clamped adjustments, caching |
| Death mechanic feels punishing for slow recovery | Playtest scar floor and healing rate; consider a "grace week" for new users |

Disclaimer text (draft): "Detox Companion is a self-awareness tool. It is not medical advice, diagnosis or treatment. If your habit is affecting your health or safety, please talk to a doctor or a counselor."

## 16. Positioning and validation notes

- Category: behavior awareness, not treatment. Closest comparisons are habit trackers and expense trackers, but the emotional companion is the differentiator.
- Early validation does not need the full build. Phase 1 plus a short demo video is enough to test whether people care about the companion.
- Test message to try with real people: "Your slips age a puppy. Would you want to see how old he gets?"

## 17. Open questions

1. Should damage be partly permanent (scar floor), or should full recovery always be possible?
2. One companion per addiction, or one shared companion across all addictions?
3. Should the death scene be opt-out for users who find it too heavy?
4. How should "extra beyond planned" be defined for people without a meal plan?
5. Is a buddy or accountability feature worth adding before the widget?
6. Pricing: free core plus paid species, history length and AI reports, or fully free until validated?
7. Region: start India-only (Rs, local food apps as examples) or neutral currency from day one?

## 18. Claude Code kickoff

### 18.1 Suggested `CLAUDE.md` for the repo

```
# Detox Companion

Read docs/PRD.md before any work. It is the source of truth.

## Rules
- The damage engine lives only in packages/engine and stays pure TypeScript with no I/O.
- Every change to engine math needs a test that pins the pacing table in PRD section 5.3.
- AI output must be validated with the Zod schemas in packages/schema and must fall back to the baseline on any failure.
- Never expose the Anthropic API key to the client.
- Never add calorie, weight or restriction tracking.
- All user-facing copy must exist in all three tones (gentle, honest, brutal).
- Respect prefers-color-scheme and prefers-reduced-motion.
- Ask before adding a new dependency or creating large new files.

## Commands
- pnpm dev, pnpm test, pnpm typecheck, pnpm lint
```

### 18.2 First prompts, in order

1. "Read docs/PRD.md. Set up a pnpm monorepo with apps/web (Next.js, TypeScript, Tailwind), packages/engine, packages/schema. Add Vitest and CI. Do not build UI yet."
2. "Implement packages/engine per PRD sections 5.2 and 5.3: deduction baseline, healing with scar floor, stage mapping, death. Write tests that simulate the three pacing scenarios and assert the targets."
3. "Add a simulation script that prints the visible-age curve over 90 days for a light, medium and heavy user."
4. "Build the Home screen in apps/web with a placeholder companion component that renders the correct stage and mood from engine output. Local-first storage with IndexedDB."
5. "Add onboarding, addiction setup with custom questions, the log-slip sheet and the deduction card."

### 18.3 Definition of done for every phase

- Tests pass, types check, lint clean.
- Reviewed on a 390 px wide viewport in light and dark.
- Pacing simulation re-run and numbers recorded in docs/tuning.md.
- Acceptance criteria from section 14 demonstrated.

## 19. PAWSE 3.0 amendments (2026-10-24)

These override the sections they name. Reasons and sources: `docs/PAWSE_RECOVERY_RESEARCH.md`, `docs/PAWSE_PRODUCT_DIAGNOSIS.md`.

1. **Death and scars (§5.3, §7.5, §17 Q1 and Q3).** Default rules are *continuity*: net damage stops at 99% of the life budget (no death) and there is no scar floor or binge scar, so full recovery is always possible. The PRD rules stay available as *classic*, opt-in per person. The engine default is unchanged and still pinned by the §5.3 pacing tests; continuity is an option on `simulate`.
2. **Day states (§5.3 missed check-ins, §7.3).** A day is a slip, goal met, urge managed, not tracking (chosen by the person) or not recorded. Only slips age the companion and only goal-met days heal it. Not tracking and not recorded change nothing.
3. **Goals (§4, §7.7).** The person chooses stop, cut down, or understand it first. Onboarding adds two optional steps for goal, reasons, hard situations, a first step, preferred urge strategies and a support first name.
4. **Language (§6.2).** "Goal met" or "good day" replace "clean" in user-facing copy (NIDA, Words Matter). No tone may shame; the §6.2 "Brutal" example is not used.
5. **Urge SOS (§7.9).** Several switchable strategies; no promise that an urge ends within a set time.
6. **Rewards (§7.9, milestones).** Milestones and unlocks count cumulative days of care (goal met or urge managed) and never reset on a slip.
7. **Weekly report (§7.4).** Adds a deterministic weekly review with one adjustment for the week ahead. Observations need at least five records, show counts, and never claim causes.
8. **Notifications (§12).** At most two neutral reminders when check-ins stop; no post-slip guilt notification.
