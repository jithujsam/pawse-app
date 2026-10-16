# Competitor Analysis (pilot, 2026-10-16)

Pricing marked **verified** was copied from a snapshot saved on 2026-10-16 and machine-checked
(`competitors.pricing_text` in `research.db`, source `findings/pilot-competitor-pricing.jsonl`). All other prices
are what users said in evidence and are labelled as such. Vendor pages are tagged `is_vendor_content` and are never
counted as demand.

## Shortlist 1: multichannel inventory sync (Shopify + marketplaces)

| Product | Price | Rating seen | What users complain about (evidence) | What they like |
|---|---|---|---|---|
| Sellbrite | **Verified:** free plan with 2-hour inventory sync; Pro 100 $19/mo (15-min sync, 100 orders/mo); Pro 2K $99/mo | 3.9 (121) on Shopify App Store | eBay oversells forcing cancellations (E61); Amazon oversells over a month, uninstall (E62); variants managed by hand for months (E63); 100-variant import cap (researcher note) | Cheap entry point; unlimited channels/SKUs |
| Cin7 Core (DEAR) | **Verified:** from $349/mo; Pro $599/mo; Advanced $1,199/mo, plus paid add-ons | 4.3 (62) | Stock "disconnects when it says it is connected" (E68), even for a merchant paying ~$5,000/mo; slow support | Full inventory/ERP |
| QuickSync | Not verified | – | "seems to break more often than it works"; Clover POS disconnects (E67) | – |
| Custom builds | Upwork developer (E64) | – | Error checking on the Walmart feed | – |
| Stocky (Shopify, free) | Free with POS Pro; being retired (2026-08-31, reportedly extended to 2027-03-01) | – | Neglected; merchants fall back to Google Sheets (E69) and a paid label app (E70) | – |
| Replacement wave | Sumtracker, Stockroom, Organizely, GoStock, StockTrim, Replenly, C2W, ChannelBay (named in one 52-comment thread) | – | – | Shows how crowded the space is |

**Pattern.** The complaints are not about missing features. They are about *trust*: the sync reports itself as
connected while it is not (E68), syncs run on 15-minute to 2-hour intervals (Sellbrite plans), and failures only
surface as an oversold order (E61, E62, E66). Merchants respond with buffers (E65), manual variant management (E63)
or custom code (E64).

**Gap (inference, to test).** An independent, read-only *sync watchdog* that compares Shopify stock with each
channel's live listing quantity and alerts on drift or a dead connection before an oversell. It would sit alongside
whatever sync app the merchant already pays for, not replace it. No product positioned this way was seen in the
evidence; this was not searched exhaustively.

**Threats.** Sync vendors could add health monitoring themselves. Marketplace API access (Amazon SP-API, eBay,
Walmart) needs developer approval and has rate limits. Shopify could absorb the feature into its own channels.

## Shortlist 2: agency retainer hour budgets and profitability

| Product | Price | What users say |
|---|---|---|
| ClickUp (native time tracking) | Not verified | No budget-threshold alerts, no recurring monthly retainer budgets (E5, E6, E7) |
| Everhour | **Verified:** "Absolutely free for up to 5 seats"; Team $8.50 per user/month (annual) | Bought on top of ClickUp *specifically* for hour-budget alerts (E5); one agency left it for ClickUp's native tracking and is "not pleased with the change" (E6). Its pricing page claims "Budget alerts saved us $47K last quarter" (vendor claim, not counted). |
| Harvest | **Verified:** Teams from $9/seat/month (annual) or $11 monthly; Enterprise from $14 / $17.50 | Paired with ClickUp but has "No budgets, no recurring monthly time budgets for retainers" in that setup (E7); timer reminders weak (E15) |
| Productive | **Verified:** Essential "$10 /month", Professional "$29 /month" (page shows totals of $90 and $240 a month for 10 users) | Replaced Harvest + Sheets + Excel for one CEO (E8, *against*); budget maths "don't always tally" (E9); complex and expensive (researcher note) |
| Bonsai | Not verified | Chosen by a Google Ads agency owner (E1); some thread comments look like shills |
| Accountant | "a fair whack" weekly (E4) | Solves it for that agency |

**Pattern.** The need is real and paid for, but *it is already sold*. Everhour advertises exactly this outcome and
is cheap. The repeated gap is narrower: **recurring monthly retainer budgets** that reset each month, plus alerts
inside the tool the team already uses (E5, E6, E7).

**Gap (inference, to test).** A narrow add-on for ClickUp or Harvest users: monthly-resetting retainer budgets per
client, with burn alerts at 75% and 90%, and month-end over/under reporting. It is at risk of being a feature, not a
product.

## Other segments: incumbents in brief

| Segment | Incumbents | Repeated complaints | Competitive read |
|---|---|---|---|
| Bookkeeping | TaxDome, Financial Cents, Karbon, Canopy, Dext, Hubdoc, Uncat, Keeper, Debits, SafeSend | TaxDome price about doubled per user and forced payment switch (E41, E42); Hubdoc lost statement fetching (E44, E45); Financial Cents puts integrations behind its top tier (E43) | Crowded; client-chasing is flooded by founders |
| Landlords | TenantCloud, AppFolio, Buildium, Yardi, Baselane, Stessa, Innago, RentRedi | TenantCloud weak accounting, lock-in pricing, not state-compliance aware (E46–E48, E55, E56); Innago QBO sync broke books (E59) | Free tools at low end; enterprise tools too costly mid-size |
| Trades | ServiceTitan, Housecall Pro, Jobber, Workiz, FieldPulse, ServiceFusion | ServiceTitan too heavy and add-on priced (E81–E84); QuickBooks sync glitches across HCP, Jobber, Workiz (E76–E78) | Saturated; buyers fatigued by pitches (E89) |
| Developers | Datadog, Better Stack, Grafana stack, Cloudflare, AWS WAF Bot Control | Surprise Datadog bills (E16, E18); Turnstile bypassed (E24, E25) | Many cheaper alternatives already |
| E-commerce (other) | A2X, Link My Books, Taxomate, AfterShip Returns, Loop | A2X price for small sellers (E72); returns features paywalled at $119 (E75) | A2X strong (4.9★/361) |

Not verified: Karbon, Canopy, Financial Cents, Buildium, AppFolio and RentRedi Capterra pages (IDs not found);
G2 and Trustpilot (blocked by the sites).
