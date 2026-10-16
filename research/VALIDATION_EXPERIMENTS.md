# Validation Experiments (designed 2026-10-16, not yet run)

Nothing gets built until one of these passes (RESEARCH_PLAN.md). Each experiment:

- costs under $100 in cash plus founder time;
- can be finished in 3 weeks;
- tests **payment**, not interest;
- has thresholds fixed *before* it starts.

Results go into `research.db` as new evidence (signal types `stated_wtp` or `existing_spend`) so they are scored
the same way as the pilot evidence.

**Contact rules for both experiments**

- One-to-one messages only, through public business contact routes such as a store's contact page or an agency's
  website.
- No bulk email, and no scraping of personal data beyond what a review publicly shows.
- No promotional posts in subreddits that ban them (r/agency, r/Bookkeeping, r/PropertyManagement).
- Say plainly that you are researching a possible product.

---

## Experiment 1: "Sync Watchdog" for multichannel Shopify sellers (cluster `ec-multichannel-oversell`)

**Hypothesis.** Shopify merchants who sell the same stock on at least one marketplace (eBay, Amazon, Walmart, Etsy
or a POS) and already pay for a sync app will pay **$29–79/month** for an independent monitor. It would detect stock
drift and dead connections between Shopify and each channel and alert them before an oversell. It would not replace
their sync app.

**Why this framing.** The evidence is about sync that *looks* connected but is not (E68), and failures found only
through oversold orders (E61, E62, E66). Merchants already pay for sync (E64, E67, E68; Sellbrite $19–99 and Cin7
from $349, verified), so a read-only monitor avoids competing head-on with 10+ sync apps. That last point is an
inference and is what this experiment tests.

### Step 0: feasibility spike (days 1–3, $0)
Confirm that read-only inventory quantities can be pulled for Shopify (Admin API), eBay (Inventory or Trading API)
and one of Amazon SP-API or Walmart. Record approval time and rate limits.
- **Kill if:** no marketplace besides Shopify grants read access within about 2 weeks. The product would then
  depend on merchant CSV exports, which removes the value of real-time alerts.

### Step 1: concierge "sync audit" outreach (days 1–14, about $20 for a domain and landing page)
1. **Build a list of 40 merchants.**
   - Sources: 1–2★ reviews from the last 12 months on the Shopify App Store pages of Sellbrite, Cin7 Core and
     other multichannel sync apps, where the review mentions oversells, disconnects or sync delays.
   - Shopify reviews show the store name, so find each store's public contact.
   - Add r/shopify and r/FulfillmentByAmazon posters who described the problem, contacted by Reddit DM.
2. **Send the offer.** Offer a *free one-off sync audit*: the merchant sends a Shopify inventory export and each
   channel's active-listing quantity report, and gets back a mismatch list within 48 hours.
3. **Run the audits.** Diff each pair of exports by hand or with a spreadsheet.
4. **Make the paid offer.** At delivery, offer "continuous monitoring with alerts" at a founding price of
   **$39/month**, paid up front through a Stripe payment link for month 1, with a full refund if it is never
   delivered.

### Success / failure criteria
| Metric | Pass | Fail |
|---|---|---|
| Replies to 40 contacts | ≥ 8 (20%) | < 4 |
| Audits completed | ≥ 5 | < 3 |
| Audits finding ≥1 mismatch the merchant confirms is real | ≥ 3 of 5 | ≤ 1 |
| Merchants who **pay** month 1 ($39) | **≥ 3** | **0** |
| Merchants who say "I'd rather just switch sync apps" | recorded as counterevidence | if ≥ half of those interviewed, fail regardless of payment |

**Between pass and fail** (for example 1–2 payers): run one more batch of 40 with the price at $29. If it still has
fewer than 3 payers, fail.

**What a pass buys.** Permission to build a single-channel (Shopify ↔ eBay) monitor for the paying merchants only.
A pass is not proof of a market.

---

## Experiment 2: retainer burn alerts for agencies on ClickUp or Harvest (cluster `ag-retainer-profitability`)

**Hypothesis.** Agencies of 3–30 people that run monthly retainers on ClickUp or Harvest will pay **$49/month per
agency** (flat, not per seat) for monthly-resetting retainer hour budgets. The product would alert at 75% and 90%
of budget and send a month-end over/under report per client.

**Main risk to test first.** Everhour already sells budget alerts at $0 for up to 5 seats and $8.50 per user per
month after that (verified), and Productive covers budgets (E8). So the experiment must find out *why those are not
enough*, and fail fast if they are.

### Step 1: problem interviews (days 1–10, $0)
1. **Contact 50 agency owners or ops leads.**
   - The authors in the two r/agency threads (E1–E7 and others there), through Reddit DM.
   - Capterra reviewers of Harvest, Productive and ClickUp who mention budgets, through the public site of the
     agency named in the review.
   - Agency owners on r/PPC.
2. **Hold 20-minute calls.** Ask about the last month: which retainers went over, by how many hours, when they found
   out, and what it cost. Then ask whether they tried Everhour or Productive, and why they kept or dropped it.

### Step 2: concierge burn report (weeks 2–3, $0)
For agencies that report at least one overrun a month, they share a weekly time export (ClickUp or Harvest CSV)
plus retainer hours per client. They get a weekly burn email per client, with 75% and 90% flags. After two reports,
offer month 2 at **$49**, paid up front.

### Success / failure criteria
| Metric | Pass | Fail |
|---|---|---|
| Calls held out of 50 contacts | ≥ 10 | < 5 |
| Interviewees reporting ≥1 retainer overrun per month, with an hour or $ figure | ≥ 6 of 10 | ≤ 2 |
| Interviewees who say Everhour or Productive already solves it for them | ≤ 3 of 10 | ≥ 6 of 10, which fails the experiment immediately |
| Agencies that run the 2-week concierge | ≥ 3 | < 2 |
| Agencies that **pay** $49 for month 2 | **≥ 2** | **0** |

**What a pass buys.** Permission to build a ClickUp-only integration for the paying agencies. If the experiment
fails, test #3 next: unpredictable observability bills (`dv-observability-cost`, 29.5). Its first question would be
whether anything beats a switch to Better Stack or self-hosted Grafana (E17, E20).

---

## Recording results
- Log every outreach, reply, audit and payment as JSONL in `research/findings/validation-<experiment>.jsonl`.
  Record kinds: `source` for interview notes or emails, which are stored as snapshots so quotes can be verified;
  `evidence` with signal type `stated_wtp` or `existing_spend`.
- Re-score the two clusters with the new evidence and update OPPORTUNITY_SCORECARD.md.
