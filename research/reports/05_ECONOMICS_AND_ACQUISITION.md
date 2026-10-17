# Costs, pricing models and customer acquisition (deliverables 12 and 13)

Every number below is labelled:
- **fact (F#):** a verified price.
- **assumption:** a stated guess, given as a range.
- **unknown:** we don't know.

Nothing here is a revenue forecast.

## 1. Operating cost per seat (one seller's mailbox), per month

| Cost | Basis | Estimate |
|---|---|---|
| Classifying incoming/outgoing messages | **assumption:** 40 messages/day × 22 days, 1,500 input + 150 output tokens each, small model at $0.10 / $0.50 per MTok (F199) | ≈ $0.20 |
| Daily deal analysis | **assumption:** 15 open deals/seat analysed daily, 6k input + 400 output tokens, mid model at $2 / $10 per MTok (F198) with the 50% Batch discount (F200) | ≈ $2.60 |
| Follow-up drafts | **assumption:** 5/day, 8k input + 500 output tokens, mid model, not batched | ≈ $2.30 |
| AI subtotal | Newer tokenizer adds ~30% tokens (noted on the same pricing page); range covers heavy mailboxes | **$2-10** |
| Notifications | Pub/Sub: first 10 GiB/month free (F201) | ≈ $0 |
| Hosting, database, storage, monitoring | **assumption** | $1-3 |
| Gmail API usage | Billing only above 80M units/day per project (F25); price unpublished | $0 at small scale; **unknown** later |
| **Variable cost per seat** | | **≈ $3-13, central ~$7** |

**Fixed costs per year:**

| Fixed cost | Basis |
|---|---|
| Google CASA assessment | Required annually for restricted scopes (F15, F18). Cost **unknown** (`casa-cost`). Sensitivity scenarios below use $0 / $5k / $15k per year. These are scenario values, not quotes. |
| Microsoft publisher verification | Free (F56). |
| Microsoft 365 Certification | Optional (F57). |
| India DPDP / EU DPA compliance work | **assumption:** founder time + legal templates, $1-5k one-off. |

## 2. Three pricing structures

The assumed customer has 5 seats. Variable cost is $7/seat/month (central estimate).

| Model | Price | Revenue / customer / month | Variable cost | Gross margin before fixed costs | Sensitivity | Main risk |
|---|---|---|---|---|---|---|
| Per user | $25/seat | $125 | $35 | 72% | At $13/seat cost: 48% | Seat objections (E43); per-seat feels like "another HubSpot" (E51) |
| **Per team (selected)** | $149 flat, ≤ 10 seats | $149 | $35 | 77% | 10 heavy seats at $13: $130 → 13%. **Cap mailboxes or set fair-use AI limits.** | Margin erosion on large teams |
| Tiered | $79 (≤ 3 mailboxes) / $149 (≤ 10) / $299 (≤ 25) | $79-299 | $21-175 | 41-73% | | Complexity; feature-gating annoys buyers (E51) |

**How much fixed cost the business must carry:**
- At $149 per team, each team leaves about $114/month of gross profit.
- A $15k/year CASA scenario ($1,250/month) therefore needs about **11 paying teams** just to cover the assessment.
- At $5k/year it needs about **4 teams**.

**Is a sustainable small SaaS realistic?**
- 100 teams × $149 = $14.9k MRR, about $179k ARR. Gross margin would be ~75% before CASA and support (**arithmetic on assumptions**). That would sustain one founder.
- Reaching it depends entirely on two **unknowns**: willingness to pay (gate 5) and acquisition cost (gate 6).
- Churn risks:
  - Teams outgrowing into Salesforce/HubSpot Pro, which have native features.
  - Native features catching up.
  - Teams that see the problem as discipline cancelling after the backlog is cleaned (E33, E61).

## 3. Support and onboarding burden (inference)

- **Onboarding:** each team needs CRM mapping (pipelines and stages), admin consent on Microsoft, and possibly a Google
  "trusted app" setting where admins restrict third-party apps (F44, F45). Plan 30-60 minutes of assisted onboarding per team at first.
- **Support:** sync gaps are the classic failure ("Email sync is the part that kills these", E79). Budget founder time for
  reconciliation bugs in the first 6 months.

## 4. Customer acquisition hypothesis

| Hypothesis | Why it might work | Why it might fail | Test |
|---|---|---|---|
| **Founder-led outreach to heads of sales at 3-10 seller teams**, opening with a free stale-pipeline audit | The audit shows value in their own data before any permission is granted (E6 suggests appetite for human help) | Data-sharing reluctance; low reply rates | `exp-problem-interviews`, `exp-concierge-audit` |
| CRM app marketplaces (HubSpot, Pipedrive) | The buyer is already in the CRM looking for add-ons | Not verified in this pilot (listing rules, ranking, fees **unknown**); the platform is also the competitor | Read marketplace terms before building |
| Content around "pipeline hygiene" in communities where the evidence came from (r/sales, r/startups, HN) | That is where the complaints are | Many readers are builders, not buyers (WS3 sampling note) | Track inbound from posts during the interviews phase |

Our own outreach for interviews must follow the same rules this research found:
- Contact people individually.
- Follow the applicable law (F70-F74).
- Send nothing in bulk from a Gmail/Workspace account (F40).
