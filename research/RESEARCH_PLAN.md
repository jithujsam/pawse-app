# Research Plan

Goal: find one credible, commercially testable problem that a solo founder can build for, reach directly and charge
for on a recurring basis. Nothing gets built until a validation experiment passes.

## Status

| Phase | State |
|---|---|
| 1. Infrastructure audit | Done. Evidence store and CLI built. **Research hosts are still blocked by the network policy** (see SOURCE_CATALOG.md). |
| 2. Pilot discovery (6 segments) | **Paused, 2026-10-16.** Re-probe: every research host still `proxy_denied` from the shell; WebFetch fails DNS for every host; WebSearch works but gives leads only. Budget used: 1/36 searches, 0/90 fetches, 0/90 evidence. Resumes when page retrieval works. |
| 3–7 | Not started. |

## Segments for the pilot

No segment is assumed to be the winner. Each gets the same budget and the same comparison.

| # | Segment (who) | Where they talk (primary → backup) | Incumbents to read reviews of | Why it's on the list |
|---|---|---|---|---|
| 1 | Small bookkeeping & accounting practices, 1–10 staff | r/Bookkeeping, r/Accounting → AccountingWEB, QuickBooks community | Karbon, TaxDome, Financial Cents, Canopy, Dext, Hubdoc | Recurring monthly workflows, existing software spend |
| 2 | Independent Shopify / multichannel sellers | r/shopify, r/ecommerce → Shopify Community, App Store reviews | Inventory-sync, returns, bookkeeping apps on the Shopify App Store | Public, dated, per-app reviews; merchants already buy apps |
| 3 | Trades & field-service businesses, 1–20 staff | r/HVAC, r/Plumbing, r/electricians, r/sweatystartup → Capterra reviews | Jobber, Housecall Pro, ServiceTitan, Workiz | Admin-heavy owners, phone/quote/invoice workflows |
| 4 | Small landlords & property managers, 1–200 units | r/Landlord, r/PropertyManagement → BiggerPockets forums | Buildium, AppFolio, TenantCloud, RentRedi, Baselane | Clear money flows, many spreadsheets |
| 5 | Small agencies & B2B ops teams, 2–30 people | r/agency, r/PPC, r/projectmanagement → G2 reviews, Canny boards | ClickUp, Teamwork, Harvest, Productive, AgencyAnalytics | Client reporting and billing chores |
| 6 | Developers on small teams / indie developers | HN (Algolia), r/devops, r/selfhosted → GitHub issues, Stack Exchange | Developer tools found during the pilot | Easy to reach, but crowded and price-sensitive |

## Pilot budget (bounded)

| Item | Per segment | Total cap |
|---|---|---|
| WebSearch queries (lead discovery) | 6 | 36 |
| Page/API fetches | 15 | 90 |
| Evidence items recorded | ≤ 15 | 90 |
| Researcher agents | — | 3 (two segments each, distinct source lists) |

Every query is logged in `queries` before it runs; a query already in the table is not repeated.

**Rule on searching before fetching works (decided 2026-10-16):** searches are not spent while no page can be
fetched. A search with no fetch produces leads that can never become verified evidence, and spending the
36-search cap this way would leave no search budget once fetching works.

### Pilot comparison (per segment, computed from verified, non-duplicate, non-vendor evidence)

1. Independent voices (distinct authors) for the top problem.
2. Share of evidence that describes **behaviour or workarounds**, not opinion.
3. Existing-spend signals (named paid tools, paid hires, money lost).
4. Severity signals (lost revenue, compliance risk, hours per week, churn from a tool).
5. Competitive density (number of credible tools addressing the problem; quality of their reviews).
6. Buyer accessibility (specific communities, directories or marketplaces where buyers can be contacted).
7. Evidence quality (how much of it could be verified at all).

Output: two segments recommended for deep research, with the evidence ids behind the choice and the
reasons the other four were set aside.

## Deep research budget and stop rule

- Up to 25 WebSearch queries and 120 fetches per shortlisted segment.
- Work in batches of 10 new verified evidence items. After each batch, rescore the clusters.
- **Stop** when two consecutive batches move no cluster by more than 1 rubric point and do not change the
  top-3 order, or when the budget is spent, whichever comes first.

## Evidence rules

- A **lead** (search result) is not evidence. Evidence needs a fetched page snapshot and a quote that
  `rdb.py verify` finds in it. Unverified items are stored but never scored.
- Quotes are short (≤ 300 characters) and exact; `...` marks omitted text.
- One author counts once per cluster, however many times they post. Identical quotes on different URLs
  are marked as duplicates and count once.
- Vendor blogs, listicles and AI-written summaries are tagged `is_vendor_content` and never count as demand.
- `signal_type` separates: `opinion`, `behaviour`, `workaround`, `existing_spend`, `stated_wtp`, `churn`,
  `vendor_claim`. A complaint is **not** willingness to pay; only `existing_spend` and `churn` with a named
  paid tool count as spend evidence, and `stated_wtp` is recorded but weighted low.
- Every score cites evidence ids and is labelled `fact`, `inference` or `unknown`.

## Scoring rubric (0–3 per criterion)

| Criterion | 0 | 1 | 2 | 3 | Weight |
|---|---|---|---|---|---|
| Severity | Mild annoyance | Time cost stated | Money/time loss quantified by users | Revenue, compliance or client loss | 2 |
| Frequency | One-off | Yearly | Monthly | Weekly or daily | 1.5 |
| Independent evidence | < 3 voices | 3–5 voices, one site | 6–10 voices, ≥ 2 sites | > 10 voices, ≥ 3 sites | 2 |
| Existing spend / workarounds | None seen | Manual workaround | Spreadsheet + paid tool glued together | Paying for an inadequate tool or a person | 2 |
| Buyer accessibility | Unknown where they are | Generic channels only | Named communities | Named directories/marketplaces with contactable buyers | 1.5 |
| Willingness-to-pay evidence | None | Stated only | Paying for adjacent tools | Paying for this problem today | 2 |
| Competitive differentiation | Solved well, cheaply | Strong incumbents, minor gaps | Incumbents with repeated, specific complaints | No adequate solution for this sub-segment | 1.5 |
| Build & maintain complexity (inverse) | Heavy integrations / regulated | Several fragile integrations | One main integration | Standalone or simple API | 1 |
| Recurring-revenue potential | One-time need | Seasonal | Monthly workflow | Continuous, data accumulates | 1 |

Gates, applied before ranking: fewer than 3 verified independent voices → not ranked; a score that depends
on an assumption with no evidence → that criterion scores 0; regulated domains (health data, payments
custody, legal advice) flagged and scored down on complexity. **A high score ranks what to test next; it
is not proof of demand.**

## Workflow

```bash
python3 research/rdb.py init                          # safe to rerun
python3 research/rdb.py probe && python3 research/rdb.py catalog
python3 research/rdb.py ingest research/findings/*.jsonl   # researcher output; safe to rerun
python3 research/rdb.py fetch --segment bookkeeping --limit 15
python3 research/rdb.py verify                        # quote check + duplicate marking
python3 research/rdb.py stats
```

`research/findings/*.jsonl` is the source of truth for what researchers recorded; `research.db` can be
rebuilt from it plus `research/snapshots/`. Both are committed so work resumes across sessions.

Record format (one JSON object per line, `kind` selects the table): `run`, `query`, `lead`, `source`,
`cluster`, `competitor`, `evidence`. Evidence example:

```json
{"kind":"evidence","run_id":"pilot-bookkeeping","segment":"bookkeeping","url":"https://...",
 "author_key":"reddit:u_example","quote":"exact short quote","problem":"...","workaround":"...",
 "frequency_signal":"monthly close","severity_signal":null,"spend_signal":"pays for Dext",
 "signal_type":"workaround","competitor":"Dext","confidence":"medium","limitations":"single poster",
 "clusters":["bk-client-doc-chasing"],"stance":"supports"}
```

## Deliverables (produced as phases complete)

RESEARCH_PLAN.md · SOURCE_CATALOG.md · PROBLEM_CLUSTERS.md · COMPETITOR_ANALYSIS.md ·
OPPORTUNITY_SCORECARD.md · VALIDATION_EXPERIMENTS.md · research.db · EXECUTIVE_REPORT.md
