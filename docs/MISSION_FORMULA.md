# Mission formula (permanent reference)

The single source of the pet-mission rules. Code: `packages/engine/src/missions.ts` (rules, pure), `apps/web/src/missions.ts` (reads the app's records into it), `supabase/migrations/0010_mission_21.sql` (`mission_journey()`, the server's copy). Tests that pin it: `packages/engine/test/missions.test.ts`, `supabase/tests/missions.sql`. Keep all three in step when anything here changes.

## The idea
A pet that suffers from the same habit you're fighting. 21 clean (goal-met) days in a row heal it. After that, staying consistent keeps it well. A slip once is a small problem; slipping often makes it serious. One number shows how the pet is: wellness W.

## Inputs
Per day since the pet arrived: goal met, slip (with severity), or nothing. A slip beats a goal-met mark on the same day. Days with nothing recorded, rest days and paused days count neither way.

## Stage 1: recovery (strict)
- `run` = goal-met days in a row. A slip sets `run = 0`; `bestRun` keeps the longest run.
- Rescue conditions heal on run days 1, 3, 6, 10, 15, 21: itchy coat, low energy, noise fear, can't play, fear of being alone, fear of people. Raise learns six skills on the same days.
- W = 10 + 90 × run/21 (rescue), 70 + 30 × run/21 (raise), rounded to 5.
- Run 21: recovered.

## Stage 2: consistency, then 3: thriving
- 21 more goal-met days while well; rewards at 7, 14, 21. Then thriving: a reward every 30 well days.
- No restarts from here on.

## After recovery: slips make issues
points = 1 + [2nd slip in 7 days] + [3rd slip in 7 days] + [3+ slips in 30 days] + [heavy: severity ≥ 2 or 3+ slips that day]
tier = min(3, points); a slip during an active issue raises it at least one tier and restarts its count.

| Tier | Issue | Clear with (in a row) | W while active |
|---|---|---|---|
| 1 Minor | upset stomach, restless nights, itchy patch (in turn) | 3 | 100 − 15 × (1 − done/needed) |
| 2 Moderate | old fear returns | 7 | 100 − 30 × (1 − done/needed) |
| 3 Serious | withdrawn | 14 | 100 − 50 × (1 − done/needed) |

While an issue is active, goal-met days clear it before counting toward consistency.

## Worked example (rescue, junk food)
Days 1-8 no junk → run 8, W 45, coat/energy/noise healed. Day 9 junk → run 0, W 10, best run 8. Days 10-30 clean → recovered, W 100. Day 33 junk → minor issue (upset stomach), W 85; days 34-36 clean → cleared. Days 40 and 42 junk → second slip in a week → moderate (7 days), W 70.

## What the app shows
Home: one bar (W), the heart (W), one line ("13 goal-met days to recover" or "Upset stomach: 2 days to clear"). Missions: the 21-day count with boxes, best run, the six conditions; after recovery the issue, rewards and one line of slip rules. Pop-ups for healed, recovered, rewards, issues, cleared, restart. The slip-damage engine (PRD §5.3) still runs underneath for history but isn't shown on Home.

## Talking-pet packs (rescue only)
Lines about the pet's past owner, by habit type (food, smoking, alcohol, scrolling, shopping; anything else gets the generic pack), in all three Voices: `apps/web/src/text/sections/packs.ts`. No typed text is ever inserted; no body or weight words.
