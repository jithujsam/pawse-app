# Tuning log

## 2026-10-23, engine v0 (pnpm simulate)

    light   2 slips/week, severity 1.0   d1:0.0  d7:0.3  d14:0.4  d28:0.7  d42:1.0  d56:1.2  d90:2.0
    medium  1 slip/day, severity 1.0     d1:0.3  d7:2.3  d14:4.7  d28:9.3  d42:14.0 d56:18.7 d90:30.0
    heavy   3 slips/day, severity 1.5    d1:1.9  d7:13.1 d14:26.3 d28:52.5 d42:78.8 d56:100.0 d90:100.0

- 1 slip/day at severity 1.0 reaches age 70 around day 210 and death around day 300 (PRD: about 7 and 10 months).
- 3 slips/day at severity 1.5 reaches age 70 around day 37 and death around day 53 (PRD: 5 to 6 weeks and 8 weeks).
- Open: the PRD says 2 slips/week reaches about age 20 after a year. The stated formulas give about 7 (scar floor 20% of lifetime damage). Tests pin the formulas, not the PRD figure.

## 2026-10-24, engine v2: hidden reserve and binge scar

Pacing table unchanged (the reserve only fills on clean days at the floor; the heavy and medium patterns never get there):

    light   2 slips/week, severity 1.0   d1:0.0  d7:0.3  d14:0.4  d28:0.7  d42:0.9  d56:1.2  d90:2.0
    medium  1 slip/day, severity 1.0     d1:0.3  d7:2.3  d14:4.7  d28:9.3  d42:14.0 d56:18.7 d90:30.0
    heavy   3 slips/day, severity 1.5    d1:1.9  d7:13.1 d14:26.3 d28:52.5 d42:78.8 d56:100.0 d90:100.0

- After 65 clean days a single 4-month slip is fully absorbed; after 200 clean days the reserve is capped at 12 and a 3-slip binge loses 6 of its 15 months to it.
- Ten heavy days then a year clean leaves net at 45% of lifetime damage (20% floor + 25% binge scar) instead of 20%.

## 2026-10-24, AI clamp fix (pnpm simulate)

Pacing table unchanged (the simulation uses the deterministic baseline only):

    light   2 slips/week, severity 1.0   d1:0.0  d7:0.3  d14:0.4  d28:0.7  d42:0.9  d56:1.2  d90:2.0
    medium  1 slip/day, severity 1.0     d1:0.3  d7:2.3  d14:4.7  d28:9.3  d42:14.0 d56:18.7 d90:30.0
    heavy   3 slips/day, severity 1.5    d1:1.9  d7:13.1 d14:26.3 d28:52.5 d42:78.8 d56:100.0 d90:100.0

- `applyAiAdjustment` no longer caps a baseline above 12 months to 12 whenever the AI answers. Before, an 18-month slip became 12 at a 0% adjustment (a 33% cut); a 24-month slip lost half. Now the AI moves any slip by at most ±30% and never above its own baseline once that is over 12.
- AI polish no longer decides life or death: if the nudge alone would kill the companion (or spare it), the baseline months stand.

## 2026-10-24, optional no-death ceiling (pnpm simulate)

Pacing table unchanged (the ceiling is off unless the person turns "can pass away" off):

    light   2 slips/week, severity 1.0   d1:0.0  d7:0.3  d14:0.4  d28:0.7  d42:0.9  d56:1.2  d90:2.0
    medium  1 slip/day, severity 1.0     d1:0.3  d7:2.3  d14:4.7  d28:9.3  d42:14.0 d56:18.7 d90:30.0
    heavy   3 slips/day, severity 1.5    d1:1.9  d7:13.1 d14:26.3 d28:52.5 d42:78.8 d56:100.0 d90:100.0

- `simulate(days, { ceilingMonths })`: net damage stops at the ceiling (1188 months = age 99, frail). Damage past it isn't counted toward lifetime damage, the scar floor or binge scars, otherwise the floor would climb to the ceiling and a heavy user's pet could never heal.
- Tests pin that omitting the option gives exactly the standard fold.
