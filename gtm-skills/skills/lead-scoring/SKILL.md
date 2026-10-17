---
name: lead-scoring
description: Score and tier a lead CSV against an ICP with a transparent 0-100 rubric and a one-line reason per lead, so outreach goes to the best-fit accounts first. Use when the user has a lead list and asks to prioritise, qualify, score, rank, tier or clean it, or to decide who to email first.
---

# Lead Scoring

Goal: every row gets a score, a tier and a reason a human can check in five seconds.

## Rubric (100 points)

| Dimension | Points | Full points when |
|---|---|---|
| Company fit | 35 | Industry, size and geography all inside the ICP |
| Persona fit | 25 | Title owns the problem and the budget |
| Trigger | 25 | A fresh (< 90 days), verifiable trigger is present |
| Reachability | 15 | Pattern-confirmed or verified email, domain accepts mail |

Partial credit is fine; write down why. Tiers: **A** 75+, **B** 55-74, **C** 35-54, **Drop** < 35.

## Process
1. Restate the ICP in 3 lines. If none exists, ask for it or run `icp-builder`.
2. For each row, check the facts you need. If a fact is missing, score that dimension 0; do not guess.
3. Add columns: `score, tier, reason` (reason ≤ 15 words, cites the deciding facts).
4. Sort by score, write the CSV back.
5. Summarise: count per tier, the 3 most common reasons for low scores (these show what to fix in sourcing), and the top 10 accounts.

## Rules
- Same rubric for every row; no vibes.
- For more than ~200 rows, process in batches and keep the rubric identical across batches.
- Hand off: suggest `first-lines` for tier A and B only.
