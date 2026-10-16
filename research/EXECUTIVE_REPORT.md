# Executive Report: SaaS Opportunity Research Pilot

Date: 2026-10-16 · Branch: `ccr-2fa9a2a0-1qszpe` · Status: **pilot complete; validation not started; nothing built.**

## Bottom line
Six segments got the same bounded budget. Two opportunities came out ahead, but **both are hypotheses to test,
not proven demand**:

1. **Sync Watchdog for multichannel Shopify sellers.** Score 38/43.5, first in every sensitivity check.
   - Merchants already pay for inventory-sync apps, and those apps fail *silently*.
   - The failures cause oversold and cancelled marketplace orders (9 independent voices, 0 against).
   - The opening to test is an independent, read-only monitor that alerts *before* an oversell. It would sit
     alongside the merchant's existing sync app, not replace it.
2. **Retainer burn alerts for small agencies on ClickUp or Harvest.** Score 30.5/43.5, a narrow second.
   - Agencies pay for add-ons (Everhour) or an accountant just to know when a retainer runs over its hours (8
     voices, 1 against).
   - Counterevidence is strong: Everhour sells this at $0–8.50 per user per month, and Productive covers it. It may
     be a feature, not a product.

Each has a 3-week validation experiment costing under $100 that requires **actual payment** to pass
(VALIDATION_EXPERIMENTS.md).

## What was done
| Step | Result |
|---|---|
| Access | Re-tested at content level. Shell retrieval works. Reddit is read via the Arctic Shift archive (reddit.com requires login). Capterra, GetApp, Shopify App Store, BiggerPockets, HN and Stack Exchange work. G2, Trustpilot, Product Hunt and AccountingWEB block bots themselves. |
| Pilot | 3 researchers, 2 segments each, with the same rules and budget |
| Budget used | Discovery queries **30/36** (8 returned nothing because of archive timeouts) · fetches **76/90** (70 by researchers + 6 pricing pages) · evidence **90/90** |
| Verification | **90/90 quotes machine-verified** against saved snapshots; 0 duplicate quotes, 0 duplicate sources |
| Exclusions | 15 items sit in threads flagged as vendor or founder posts. They are excluded from all counts; including them changes no ranking. |
| Clustering | 21 clusters; 13 passed the ≥3-voice gate and were scored; 8 rejected |
| Competitors | Pricing verified from saved pages for Sellbrite, Cin7 Core, Everhour, Harvest and Productive |

## Segment comparison (pilot output)
| Segment | Best cluster score | Read | Why |
|---|---|---|---|
| **E-commerce** | **38** | strongest | Paid tools fail with real consequences; buyers are identifiable through app-store reviews |
| **Agencies** | **30.5** | medium | Stacked paid tools for one gap, but strong cheap incumbents |
| Developers | 29.5 | weak-medium | Real churn from Datadog, but cheaper alternatives already solve it; bot-cost problem is emerging |
| Bookkeeping | 26 | medium-weak | Real recurring pain, flooded with founders and tools; client behaviour, not tooling, is often the blocker |
| Landlords | 24.5 | medium | Severe compliance items, but few voices and no spend; heavy builds; free tools at the low end |
| Trades | 25 | weak-medium | Saturated FSM market; communities openly hostile to founder pitches |

**Recommended for deep research or validation:** e-commerce and agencies. Set aside for now: the other four
(reasons above; details in PROBLEM_CLUSTERS.md).

## Opportunity 1: multichannel inventory sync watchdog
- **Evidence for.**
  - Cancelled eBay orders and policy risk (E61).
  - Merchants uninstalling and looking for a replacement (E62).
  - Variants managed by hand for months (E63).
  - A paid Upwork developer for a custom Walmart sync (E64).
  - QuickSync "seems to break more often than it works" (E67).
  - Cin7 at about $5,000/month still "disconnects when it says it is connected" (E68).
- **Willingness to pay.** Strongest of all clusters: merchants pay for this problem today. Verified prices are
  Sellbrite $19–99/month and Cin7 Core $349–1,199/month. No *stated* WTP for a monitor yet; that is what Experiment
  1 tests.
- **Counterevidence and risks.**
  - The search targeted complaints; Sellbrite still rates 3.9 (121), with 69% five-star ratings.
  - The space is crowded with sync apps, with 8+ new Stocky replacements.
  - Some failures stem from marketplace API rate limits.
  - Amazon, eBay and Walmart API approval is a real build risk (complexity scored 1/3).
  - One key voice (E68) is a large merchant, outside the small-seller target.

## Opportunity 2: agency retainer burn alerts
- **Evidence for.**
  - Pays for Everhour on top of ClickUp purely for hour-budget alerts (E5).
  - Moved off Everhour and is unhappy (E6).
  - ClickUp plus Harvest has "no recurring monthly time budgets for retainers" (E7).
  - Pays an accountant weekly for project profitability (E4).
  - Spreadsheet workarounds (E2, E3).
- **Willingness to pay.** Paying for this problem today (Everhour, accountant), but the existing price anchor is low:
  Everhour is $8.50 per user per month (verified).
- **Counterevidence and risks.**
  - Productive replaced Harvest plus spreadsheets for one CEO with no complaints (E8).
  - Everhour covers the core need.
  - No money lost was quantified.
  - 6 of the 8 voices come from two Reddit threads.
  - r/agency removes promotional posts.
  - The margin over #3 (observability cost) is 1 point.

## Limits of this pilot (read before acting)
- 3–9 voices per cluster is enough to choose what to test, not to size a market.
- Reddit was reached only through a third-party archive, which may lag or miss deleted content. About half of all
  archive searches timed out.
- Review sites skew toward incentivised or vendor-referred reviews (noted per item). G2 and Trustpilot could not be
  read.
- Founder "validation" posts and vendor seeding are pervasive in r/SaaS, r/Bookkeeping, r/Plumbing and r/HVAC. They
  were flagged and excluded, but some astroturf may remain.
- Evidence ids (E<n>) refer to the current `research.db`. The JSONL files in `research/findings/` are the source of
  truth and can rebuild it.

## Next actions
1. Run Experiment 1 (Sync Watchdog). Start with the 3-day API feasibility check.
2. Run Experiment 2 (retainer alerts) in parallel. It is interview-led and can fail within 10 days.
3. If both fail, the next candidates are `dv-observability-cost` and `dv-bot-traffic-cost`.
4. Deep research (up to 25 queries and 120 fetches per segment, per the plan) is optional. It is only worth doing
   if an experiment is ambiguous.

## Files
| File | Contents |
|---|---|
| RESEARCH_PLAN.md | Method, budget, rubric, status |
| SOURCE_CATALOG.md | What each source is, access results |
| PROBLEM_CLUSTERS.md | All 21 clusters, counts, key quotes, counterevidence |
| COMPETITOR_ANALYSIS.md | Incumbents, verified pricing, gaps |
| OPPORTUNITY_SCORECARD.md | Rubric scores with basis and evidence ids; sensitivity checks |
| VALIDATION_EXPERIMENTS.md | Two experiments with pass/fail thresholds |
| research.db + findings/*.jsonl + snapshots/ | Evidence store (76 snapshots, 75 sources, 90 evidence, 117 scores) |
