# Problem Clusters (pilot, 2026-10-16)

21 clusters across 6 segments, built from 90 evidence items. **Every quote was machine-checked against a saved
snapshot (90/90 verified, 0 duplicates).** Counts below are *strict*: verified, non-duplicate, and excluding any
reply posted inside a thread flagged as vendor/founder content (15 items). The "incl. replies" column shows the
count if practitioner replies under such threads were allowed; it changes no ranking.

`E<n>` = `evidence.id` in `research.db` (also traceable through `research/findings/pilot-<segment>.jsonl`).

## Segment summary

| Segment | Discovery queries | Snapshots | Evidence | Strongest cluster (strict supporting voices) | Researcher's read |
|---|---|---|---|---|---|
| E-commerce | 5/6 (2 timed out) | 13/15 | 15 | ec-multichannel-oversell (9) | medium-strong |
| Agencies | 5/6 (1 timed out) | 11/15 | 15 | ag-retainer-profitability (8) | medium |
| Landlords | 4/6 (1 timed out) | 15/15 | 15 | three clusters at 4 | medium |
| Bookkeeping | 6/6 (incl. 1 earlier WebSearch; 2 timed out) | 10/15 | 15 | bk-client-doc-chasing (4) | medium-weak |
| Developers | 5/6 | 8/15 | 15 | dv-observability-cost, dv-bot-traffic-cost (4 each) | weak-medium |
| Trades | 5/6 (2 timed out) | 13/15 | 15 | tr-fsm-too-heavy-small-shops (4) | weak-medium |

## All clusters

| Cluster | Supporting voices (strict / incl. replies) | Domains | Spend/churn voices | Behaviour/workaround voices | Against | Status |
|---|---|---|---|---|---|---|
| ec-multichannel-oversell | **9** / 9 | 2 | 4 | 5 | 0 | **shortlisted** |
| ag-retainer-profitability | **8** / 8 | 2 | 5 | 2 | 1 | **shortlisted** |
| tr-fsm-too-heavy-small-shops | 4 / 5 | 2 | 3 | 0 | 2 | open |
| ll-small-portfolio-software-fit | 4 / 5 | 2 | 2 | 2 | 1 | open |
| ll-pm-accounting-gaps | 4 / 5 | 2 | 4 | 0 | 1 | open |
| ll-compliance-notices-section8 | 4 / 5 | 3 | 1 | 2 | 0 | open |
| dv-observability-cost | 4 / 5 | 1 | 4 | 0 | 2 | open |
| dv-bot-traffic-cost | 4 / 4 | 2 | 1 | 2 | 1 | open |
| bk-client-doc-chasing | 4 / 4 | 1 | 2 | 2 | 2 | open |
| tr-fsm-accounting-sync | 3 / 3 | 1 | 1 | 2 | 1 | open |
| ec-stocky-replacement | 3 / 3 | 2 | 1 | 2 | 0 | open |
| bk-statement-fetching-gap | 3 / 3 | 2 | 2 | 1 | 0 | open |
| bk-practice-mgmt-cost-bloat | 3 / 3 | 2 | 3 | 0 | 0 | open |
| tr-fsm-reporting-gaps | 2 / 2 | 1 | 0 | 1 | 0 | rejected (gate) |
| bk-uncategorized-txn-followup | 2 / 2 | 1 | 1 | 1 | 2 | rejected (gate; served by Uncat, Keeper, Debits) |
| ag-time-capture | 2 / 2 | 2 | 0 | 1 | 0 | rejected (gate) |
| ec-returns-app-pricing | 1 / 1 | 1 | 0 | 0 | 0 | rejected (gate) |
| ec-marketplace-accounting-recon | 1 / 1 | 1 | 0 | 0 | 2 | rejected (gate; A2X 4.9★/361) |
| ag-client-reporting | 1 / 3 | 1 | 1 | 0 | 1 | rejected (gate) |
| tr-missed-calls-intake | 0 / 2 | 0 | 0 | 0 | 1 | rejected (gate; vendor-saturated) |
| dv-failed-payments | 0 / 1 | 0 | 0 | 0 | 2 | rejected (gate; Stripe defaults enough) |

Gate: fewer than 3 strict supporting voices → not ranked (RESEARCH_PLAN.md).

## The two shortlisted clusters in detail

### ec-multichannel-oversell: multichannel inventory sync fails silently and causes oversells
Sellers listing the same stock on Shopify plus Amazon, eBay, Walmart, Etsy or a POS see sync lag or silent
disconnects. The result is oversold orders, cancellations and marketplace-policy risk.

| Id | Who | Quote (exact) | Signal |
|---|---|---|---|
| E61 | SPADEFISH Store, Sellbrite 1–2★ review, 2026-08 | "We had 2 orders on eBay for products no longer available. We had to cancel the orders. Not good for customers, not good for complying with eBay policies." | behaviour, severity |
| E62 | HB Sports Inc., Sellbrite review, 2026-08 | "We're removing the app from our store and actively seeking a more reliable solution." | churn |
| E63 | WomanShopsWorld, Sellbrite review, 2026-08 | "Several variants have been managed manually for months now. An absolute nightmare for our small team…" | workaround, daily |
| E64 | u/nsxn, r/shopify, 2025-09 | "I had to hire a developer off Upwork to build a custom solution - one that does error checking and handling on the walmart feed…" | existing spend |
| E65 | r/shopify commenter | "Put units on hold so you can't sell the last 50 pcs… Basically hold a buffer for out of stocks" | workaround |
| E66 | u/ricyricy, r/shopify, 2026-08 | "we found this out the hard way and massively oversold once because it was reading from both locations" | behaviour |
| E67 | u/BigDyl98, r/shopify, 2026-09 | "We're currently using QuickSync, but it seems to break more often than it works…" | existing spend |
| E68 | Leather Gallery, Cin7 Core review, 2026-02 | "Stock Just disconnects when it says it is connected. -This leads to incorrect stock values." (same review: paying Cin7 close to $5,000/month) | existing spend |
| E71 | u/FistBumpMaster, r/shopify, 2026-08 | "Doing about 8000 in yearly sales order … Looking for inventory sync and replenishment" | behaviour |

**Counterevidence and limits.** No "against" item was found, but the search went looking for complaints: 3 of the
9 voices come from one page of Sellbrite 1–2★ reviews, and Sellbrite still rates 3.9 (121 reviews). One merchant
(E68) pays about $5,000 a month and is not a small seller. One Reddit thread's opening post may be vendor seeding;
only separate repliers were used. The researcher noted that some failures stem from marketplace API rate limits,
which a new tool would also face.

### ag-retainer-profitability: hours against retainer budget, and profit per client
Agencies cannot see during the month whether a retainer is over its hour budget or unprofitable. They glue
together a PM tool, a time tracker and spreadsheets, or they pay an accountant.

| Id | Who | Quote (exact) | Signal |
|---|---|---|---|
| E5 | u/Ordinary-Bear8914, r/agency, 2025-07 | "we use everhour … we really needed the features of being alerted when we reached budget thresholds on hours which click up couldn't do" | existing spend |
| E6 | u/North-Research-3981, r/agency, 2025-07 | "had been using Everhour and switched back to the native ClickUp time tracking. And I'm not pleased with the change. Same pain point…" | churn |
| E7 | u/Kronseyes, r/agency, 2025-07 | "We use Clickup for all project management and Harvest for time tracking. … No budgets, no recurring monthly time budgets for retainers…" | existing spend |
| E4 | u/tdaawg, r/agency, 2025-01 | "Our accountant does this for us each week for project profitability… spend a fair whack" | existing spend (paid person) |
| E1 | u/IQsDigital, r/agency, 2025-01 | "I'm looking for something more automated than just a good old spreadsheet. ... I decided to go with [Bonsai]" | existing spend |
| E2, E3 | two r/agency owners | Accounting software + spreadsheet; Google Sheets for profitability | workaround |
| E9 | Capterra, Productive reviewer | "Sometimes it's difficult to work out how much budget is remaining as the calculations don't always tally with my own figures." | opinion |

**Counterevidence.** E8 (Productive CEO reviewer) says they switched from "Jira Harvest Google Sheets Microsoft Excel"
to Productive and found nothing missing. E5 shows Everhour already solves budget alerts, and its pricing page shows
it is free for up to 5 seats and $8.50 per user per month after that. The author of E7 says they are overall pleased with
ClickUp and Harvest. Six of the 8 voices come from two Reddit threads, and no money lost was quantified
(the post titled "highest revenue accounts are barely making money" had been removed and had no comments).

## Other notable clusters (ranked but not shortlisted)

- **dv-observability-cost:** real churn from Datadog (E16–E19). Listen Notes cut costs 90% by moving to Better Stack
  (E17), which shows cheaper incumbents already solve it.
- **dv-bot-traffic-cost:** an emerging problem: AI scrapers inflate serverless bills (E23, $40–50 a month per blog),
  and bots defeat Turnstile (E24, E25). Against: a $4 VPS behind Cloudflare handles it (E27).
- **ll-compliance-notices-section8:** the most severe single items (a failed Oregon audit standard, E56; two months
  of a rent increase lost, E58), but there is no spend signal and the domain is legal-advice-adjacent.
- **bk-client-doc-chasing:** real, but more than 15 of 25 search hits were founder posts. A large firm found that
  SafeSend Gather did not change client behaviour (E35); others write it into engagement letters (E33).
