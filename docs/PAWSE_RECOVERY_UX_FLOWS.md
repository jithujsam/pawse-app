# Pawse recovery UX flows (3.0)

Date: 2026-10-24 · All flows are implemented on branch `ccr-9d7d359f-c2d6k6`. File references are to `apps/web/src`.

## 1. Onboarding (`screens/Onboarding.tsx`, `screens/Plan.tsx`)

1. Companion: species → look → name (unchanged).
2. **What would you like to change?** (was "let go of"). Chips or own words; crisis and restriction checks unchanged.
3. How it shows up: measure and starting pace.
4. What tends to set it off (feelings). Skippable.
5. **Why it matters** (new, optional): goal (stop / cut down / understand first), reasons, hard situations. "Skip the plan for now".
6. **A first step, and what helps** (new, optional): first step (habit-specific suggestions or own words), preferred urge strategies, an optional support first name.
7. Tone with preview → reminder (copy no longer promises "never more than two a day") → 18+ and disclaimer → hatch.

Every new question changes the experience: goal changes the weekly review line; reasons appear during urges; situations become trigger options; strategies set the order in urge support; the first step shows on Home and after a slip.

Crisis language anywhere in the plan blocks Continue and shows the crisis message; skipping past it discards the plan.

## 2. Daily check-in (`screens/Home.tsx`, `screens/QuickSheet.tsx`, `recovery.ts dayStatus`)

| State | How it's recorded | Shown as |
|---|---|---|
| Goal met | "Goal met today" | Filled green dot |
| Slip | "I slipped" | Filled red dot |
| Urge managed | Urge support → "It's eased" (no slip, no goal-met mark) | Green ring |
| Not tracking | "Not tracking today" (Home, quick sheet, calendar) | Dashed outline |
| Not recorded | Nothing | Small grey dot |

Rules: a slip wins over everything that day; goal met or a slip replaces "not tracking"; "not tracking" can't be set over a recorded day. Unrecorded and not-tracking days never heal, hurt, count as progress or appear as success. Shapes differ, not just colours.

## 3. Urge support (`screens/UrgeSheet.tsx`)

1. "Having an urge?" (Home text button, + sheet). Rate strength 1–5. The person's own reasons are shown if they set any.
2. Strategies as switchable tabs, preferred ones first: pause and notice; name what's going on (feelings + their situations + own words, crisis-checked); change where you are; make it harder to act (habit-specific friction ideas); breathe slowly (counts up, stop any time); do something else (small swaps); reach out (their support name, never contacts anyone, emergency line note).
3. "How is it now?": **It's eased. I managed it** → managed (with strategy and trigger) → celebration; **Still strong. Try something else** → next strategy; **I acted on it** → recorded honestly, opens the slip sheet.
4. No timers that gate buttons, no "it passes in N minutes".

## 4. After a slip (`screens/LogSheet.tsx`)

1. Headline in the chosen tone, e.g. "Logged. A slip is something to learn from, not proof of anything about you."
2. The pet cost card (unchanged numbers; binge "permanent scar" note only under classic rules).
3. "Your N days with your goal met and M urges managed still stand."
4. "Back to your plan: {first step}" and **Back to my day**.
5. Optional **Reflect for a moment**: what was happening before; one small thing to try (if-then from the plan, habit friction ideas, or own words); "Add it to my plan" (default on). Skip is always available. Stored on the slip; never changes the pet.

## 5. Insights (`screens/Report.tsx`, `screens/WeeklyReview.tsx`)

- **Weekly review** (top): last week or this week so far; goal-relative line; day counts by state; urges managed; strategies used with outcomes; what came up most; pick one adjustment for the week ahead (ideas from the week's records or own words). The focus then shows on Home.
- **What your records show**: needs 5 slips + urges; each item shows "Early hint" (≥3) or "Pattern" (≥50% of ≥6 records) with "x of y"; a caveat that this is what was going on, not what caused it. Strategies tried at least twice with "managed x of y".
- Existing sections kept: week vs last week, urges managed, money kept (checked-in days only), when it happens, since you started, AI "In words" (optional), 8-week chart, projection.

## 6. Journey and pet (`screens/Journey.tsx`, `screens/Me.tsx`)

- Milestones and wardrobe count **days of care** (goal met or urge managed), cumulative, never reset by a slip. One celebration at the highest new milestone.
- Journey stats: days together, good days, urges managed, best streak.
- Me → Your companion → "How {name}'s health works": plain explanation and the classic-rules switch (disabled if the history would already mean death under classic rules).

## 7. Me → Your plan (`screens/Plan.tsx`)

Everything from onboarding, plus the if-then list (removable) and a "More support" card (self-help not treatment; AI is not a clinician; don't stop heavy daily drinking suddenly without medical advice; helplines).

## 8. Reminders (`notify.ts`)

Daily reminder unchanged. If check-ins stop: two neutral notes (day 2 and day 7), stating that unrecorded days don't count against the person. No post-slip "won't eat" notification.

## Empty, offline and error states

- Insights: insufficient-data message with how many more records are needed; "Nothing was recorded this week" review line.
- Plan: everything optional; empty if-then list explains how to add one.
- Offline: all recovery features are local-first and sync later; urges sync without strategy/trigger until migration 0005 is applied.
