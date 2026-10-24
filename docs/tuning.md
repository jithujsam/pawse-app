# Tuning log

## 2026-10-23, engine v0 (pnpm simulate)

    light   2 slips/week, severity 1.0   d1:0.0  d7:0.3  d14:0.4  d28:0.7  d42:1.0  d56:1.2  d90:2.0
    medium  1 slip/day, severity 1.0     d1:0.3  d7:2.3  d14:4.7  d28:9.3  d42:14.0 d56:18.7 d90:30.0
    heavy   3 slips/day, severity 1.5    d1:1.9  d7:13.1 d14:26.3 d28:52.5 d42:78.8 d56:100.0 d90:100.0

- 1 slip/day at severity 1.0 reaches age 70 around day 210 and death around day 300 (PRD: about 7 and 10 months).
- 3 slips/day at severity 1.5 reaches age 70 around day 37 and death around day 53 (PRD: 5 to 6 weeks and 8 weeks).
- Open: the PRD says 2 slips/week reaches about age 20 after a year. The stated formulas give about 7 (scar floor 20% of lifetime damage). Tests pin the formulas, not the PRD figure.
