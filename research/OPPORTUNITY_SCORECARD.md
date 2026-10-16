# Opportunity Scorecard (pilot, 2026-10-16)

Rubric and weights: RESEARCH_PLAN.md (0–3 per criterion, maximum weighted total 43.5). Scores are stored in the
`scores` table and in `findings/pilot-scores.jsonl`, each with a basis and the evidence ids it rests on.
Superscripts: no mark = **fact** (directly shown by verified evidence), ⁱ = **inference**, ᵘ = unknown.
Only clusters that passed the gate (≥3 strict supporting voices) are scored; 8 clusters failed it
(see PROBLEM_CLUSTERS.md).

> A high score ranks what to test next. It is **not** proof of demand. Every cluster here rests on 3–9 voices from
> a bounded pilot, and no score uses stated willingness to pay (none was recorded).

| Rank | Cluster | Sev (×2) | Freq (×1.5) | Evid (×2) | Spend (×2) | Access (×1.5) | WTP (×2) | Diff (×1.5) | Build (×1) | Recur (×1) | **Weighted /43.5** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ec-multichannel-oversell ★ | 3 | 3 | 2 | 3 | 3 | 3 | 2ⁱ | 1ⁱ | 3ⁱ | **38** |
| 2 | ag-retainer-profitability ★ | 1 | 2 | 2 | 3 | 2 | 3 | 1 | 2ⁱ | 3ⁱ | **30.5** |
| 3 | dv-observability-cost | 2 | 2ⁱ | 1 | 3 | 2 | 3 | 1 | 1ⁱ | 3ⁱ | **29.5** |
| 4 | dv-bot-traffic-cost | 2 | 2ⁱ | 1 | 2 | 2 | 2 | 2ⁱ | 1ⁱ | 3ⁱ | **27** |
| 5 | bk-practice-mgmt-cost-bloat | 1 | 1ⁱ | 1 | 3 | 2 | 3 | 1ⁱ | 1ⁱ | 3ⁱ | **26** |
| 6 | bk-client-doc-chasing | 1 | 2 | 1 | 3 | 2 | 2 | 1 | 2ⁱ | 2 | **25.5** |
| 7 | tr-fsm-accounting-sync | 2 | 2ⁱ | 1 | 1 | 2ⁱ | 2 | 2ⁱ | 1ⁱ | 3ⁱ | **25** |
| 8 | bk-statement-fetching-gap | 1 | 2ⁱ | 1 | 3 | 2 | 2 | 1 | 0ⁱ | 3ⁱ | **24.5** |
| 9 | ll-pm-accounting-gaps | 2 | 2ⁱ | 1 | 2 | 2 | 2 | 1ⁱ | 0ⁱ | 3ⁱ | **24.5** |
| 10 | ll-small-portfolio-software-fit | 2 | 2ⁱ | 1 | 2 | 2 | 2 | 1 | 0ⁱ | 3ⁱ | **24.5** |
| 11 | ec-stocky-replacement | 1 | 2ⁱ | 1 | 2 | 3 | 2 | 0 | 2ⁱ | 3ⁱ | **24.5** |
| 12 | tr-fsm-too-heavy-small-shops | 1 | 1ⁱ | 1 | 3 | 2 | 3 | 0 | 0ⁱ | 3ⁱ | **23.5** |
| 13 | ll-compliance-notices-section8 | 3 | 1ⁱ | 1 | 1 | 2 | 0 | 2ⁱ | 1ⁱ | 2ⁱ | **20.5** |

## Sensitivity checks

| Variant | #1 | #2 | #3 |
|---|---|---|---|
| As scored | ec-multichannel-oversell 38 | ag-retainer-profitability 30.5 | dv-observability-cost 29.5 |
| Facts only (every inference scored 0) | ec-multichannel-oversell 31 | ag-retainer-profitability 25.5 | bk-client-doc-chasing 23.5 |
| Every inference −1 | ec-multichannel-oversell 34.5 | ag-retainer-profitability 28.5 | dv-observability-cost 26 |
| Every inference +1 | ec-multichannel-oversell 40.5 | dv-observability-cost 32 | ag-retainer-profitability 31.5 |
| Practitioner replies under vendor-flagged threads counted | unchanged (both leaders have no such items) | unchanged | observability, landlord and trades clusters gain 1 voice each, which does not move any Evidence score |

#1 is robust. #2 is ag-retainer-profitability in three of four variants; it loses second place to
dv-observability-cost only when the inferred scores are inflated. The gap between them is small (1 point), so the
validation experiment for #2 is designed to fail fast.

## Score detail: top four

### ec-multichannel-oversell: 38

| Criterion | Score | Basis | Rationale | Evidence |
|---|---|---|---|---|
| Sev | 3 | fact | Cancelled marketplace orders and eBay/Amazon policy risk from oversells | 61,62,66 |
| Freq | 3 | fact | Sync runs continuously; one team managed variants by hand daily for months | 63 |
| Evid | 2 | fact | 9 independent supporting voices on 2 sites (Shopify App Store, Reddit); 0 against | 61-68,71 |
| Spend | 3 | fact | Paying for tools that fail: Cin7 ~$5,000/mo, QuickSync; hired an Upwork developer for a custom sync | 64,67,68 |
| Access | 3 | fact | Shopify App Store reviews name the merchant store; r/shopify, r/FulfillmentByAmazon | 61,62,63,68 |
| WTP | 3 | fact | Paying for this problem today (sync apps $19-$1,199/mo verified on listings; paid developer) | 64,67,68 |
| Diff | 2 | inference | Repeated, specific complaints (silent disconnects, slow intervals, variant caps) about Sellbrite, Cin7, QuickSync; but many sync apps exist | 61,62,63,67,68 |
| Build | 1 | inference | Several fragile marketplace integrations (Shopify, Amazon, eBay, Walmart, POS) with rate limits; a read-only monitor wedge would lower this | 64,67 |
| Recur | 3 | inference | Continuous: stock changes every sale | 63 |

### ag-retainer-profitability: 30.5

| Criterion | Score | Basis | Rationale | Evidence |
|---|---|---|---|---|
| Sev | 1 | fact | Usable evidence states time/accountant cost; no quantified money lost (the 'barely making money' post was removed with no comments) | 4 |
| Freq | 2 | fact | Monthly retainer cycles; one agency reviews project profitability weekly | 4,7 |
| Evid | 2 | fact | 8 independent supporting voices, 2 domains (Reddit 2 threads, Capterra); 1 against | 1-7,9 |
| Spend | 3 | fact | Pays for Everhour on top of ClickUp only for hour-budget alerts; pays an accountant weekly; ClickUp+Harvest still lacks retainer budgets | 4,5,6,7 |
| Access | 2 | fact | Named communities (r/agency, r/PPC) and Capterra reviewer pools; r/agency removes promotional posts | 1,5,9 |
| WTP | 3 | fact | Paying for this problem today (Everhour bought for budget alerts; accountant) | 4,5 |
| Diff | 1 | fact | Strong incumbents cover it: Productive replaced Harvest+Sheets for one CEO; Everhour free to 5 seats then $8.50/user; Bonsai, Harvest | 8,5 |
| Build | 2 | inference | One main integration (ClickUp or Harvest time-entry API) | 5,7 |
| Recur | 3 | inference | Continuous; data accumulates per client | 7 |

### dv-observability-cost: 29.5

| Criterion | Score | Basis | Rationale | Evidence |
|---|---|---|---|---|
| Sev | 2 | fact | Bills grow to a non-trivial % of SaaS budget; five-figure bills | 16,19 |
| Freq | 2 | inference | Monthly billing cycle | 16 |
| Evid | 1 | fact | 4 strict supporting voices, 1 domain (HN); 2 against | 16-19 |
| Spend | 3 | fact | Paying for an inadequate/overpriced tool and churning | 17,18,19 |
| Access | 2 | fact | HN, r/devops named; price-sensitive, hostile to pitches | 16,17 |
| WTP | 3 | fact | Paying for this problem today | 17,19 |
| Diff | 1 | fact | Cheaper incumbents already solve it (Better Stack cut cost 90%; self-hosted Grafana) | 17,20 |
| Build | 1 | inference | High-volume ingest pipelines | 16 |
| Recur | 3 | inference | Continuous | 16 |

### dv-bot-traffic-cost: 27

| Criterion | Score | Basis | Rationale | Evidence |
|---|---|---|---|---|
| Sev | 2 | fact | Real money on on-demand infra; sign-ups shut down; drained credits | 23,24,26 |
| Freq | 2 | inference | Ongoing traffic; monthly bills | 23 |
| Evid | 1 | fact | 4 strict supporting voices, 2 domains; 1 against | 23-26 |
| Spend | 2 | fact | Paying hosting bills inflated by bots; AWS WAF Bot Control | 23,26 |
| Access | 2 | fact | HN, r/selfhosted named | 23,26 |
| WTP | 2 | fact | Paying adjacent tools/bills, not a dedicated fix | 23,26 |
| Diff | 2 | inference | Cloudflare Turnstile repeatedly reported bypassed; cheap VPS+Cloudflare counter-argument | 24,25,27 |
| Build | 1 | inference | Adversarial arms race at the edge | 25 |
| Recur | 3 | inference | Continuous | 23 |
