# Pawse product strategy (3.0)

Date: 2026-10-24

## Positioning

**From** "slips age a pet that can die" **to** "a companion that helps you understand a habit, get through urges, learn from slips and build your own way of handling it."

Pawse is a self-help and self-awareness tool, not treatment. It supports the person's own goal: stop, cut down, or understand it first.

## Principles (binding on every feature)

1. **The person's goal, not ours.** Goal is chosen and editable; "understand it first" is valid.
2. **Missing data is unknown.** Unrecorded days never count as success or failure. Not tracking is a legitimate choice.
3. **A slip is information.** Calm language, progress kept, one small adjustment, back to the plan.
4. **Nothing invented.** Every number and observation comes from records, with counts. Below the threshold, say "not enough yet".
5. **Warmth, not fear.** The pet reflects how things are going and recovers; it doesn't die by default, and nothing earned is taken away by one slip.
6. **Independence.** Strategies, if-then plans and reasons belong to the person and work without the app. AI is optional and never needed for core use.
7. **Safety first.** Crisis language stops the flow and shows help; alcohol withdrawal guidance; no medical claims; no calorie, weight or restriction tracking.
8. **Private by default.** Support names only, no contacts; photos stay on the phone; RLS everywhere.

## Success measures (replacing streak-first metrics)

Primary, per person, from their own records:
- Progress toward their goal (stop: share of recorded days without a slip; cut down: slips vs earlier weeks and their stated starting pace; understand: days recorded and urges noticed).
- Urges managed, and which strategies helped.
- Return after a slip: share of people who record again within 3 days of a slip (the AVE proxy).

Secondary: weekly review completion, plan completeness, retention (D7/D30), share of days recorded (data coverage, never framed as success).

## What we built in 3.0 (in priority order)

1. Day-state model and rest days (data truthfulness).
2. Plan (onboarding + editable) and if-then plans.
3. Urge support with switchable strategies.
4. Lapse recovery screen.
5. Weekly review and honest observations.
6. Continuity pet rules and cumulative days of care.
7. Language and notification clean-up; crisis coverage.
8. Server-side AI ceiling (repo only).

## Next (not built)

- Device test pass; then a release candidate (see release repo checklist).
- B17 merge rule for first-sync duplicates.
- Multi-habit support (PRD §8 P2) only if validation shows demand.
- AI: include the plan and urges in the weekly summary request (coordinated function + client change).
- Optional local-only mode (PRD P0) if account friction proves to be the main drop-off.

## Monetisation stance

Unchanged from the overnight log: no billing. If a paid tier comes, it must never gate the person's existing data, export, crisis help, or the core coping tools.
