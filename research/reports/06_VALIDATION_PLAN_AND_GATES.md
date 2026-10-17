# Validation plan, go/no-go scorecard and open questions (deliverables 14, 15 and 17)

The full experiment specifications are in `generated/EXPERIMENTS.md`. Each one lists its hypothesis, participants,
recruitment, procedure, cost, duration, confounders and the decision for each result. Thresholds are fixed **before**
running. The gate rationales are in `generated/GATES.md`, and the open questions in `generated/UNKNOWNS.md`.

Signals are counted in this order, weakest to strongest: interest → free use → repeated use → signed commitment → **payment**.
Only payment passes gate 5. Survey enthusiasm never counts.

## Ranked experiments (no product code required)

| # | Experiment | Pass | Fail → decision |
|---|---|---|---|
| 1 | **Problem interviews**: 15 heads of sales, 3-10 sellers, HubSpot/Pipedrive | ≥ 8/15 give a specific recent lost or delayed deal **and** report ≥ 2 h/week/rep on CRM upkeep | ≤ 4/15 → STOP the upkeep wedge; test the follow-up wedge with consultants only, or stop |
| 2 | **Concierge stale-pipeline audit** (manual, with consent; no API access) | ≥ 5 accept **and** ≥ 3 pay ≥ $100 for a second month | < 3 accept or 0 pay → STOP |
| 3 | **Permission test**: real consent screens for the documented scopes, unverified test app (≤ 100 users, F23) | ≥ 60% complete the connection; the buyer is the M365 admin in ≥ 70% of cases | < 40% → CRM-API-only variant, or STOP |
| 4 | **Native benchmark**: audit vs. what HubSpot/Pipedrive recorded natively | ≥ 30% of updates missing or wrong natively | < 10% → STOP (the incumbent already solves it) |
| 5 | **Clickable mockup** of the approval queue, filled with their own audit data | ≥ 4/6 use it in a real pipeline review | They prefer the PDF → stay a service |
| 6 | **Provider clarification**: written question to Google; one CASA lab quote. **Needs your approval before contacting any third party.** | Written fit with approved use cases (F8); quote < $5k/yr | Rejection or > $15k/yr before revenue → Microsoft-first or CRM-API-only |
| 7 | **Paid pilot** with provider-approved integrations, 60 days | ≥ 3 teams pay for month 3 **and** approve ≥ 50% of proposed updates weekly | < 2 retain → STOP |

## Go/no-go scorecard (status today)

| Gate | Status | What would change it |
|---|---|---|
| 1. Frequent, costly problem | **Conditional**: frequent CRM-upkeep pain (E63, E14, E39); revenue loss only anecdotal (E27, E28); 32 voices say simple tools suffice | Experiment 1 |
| 2. Meaningful gap vs. existing products | **Unresolved**: only packaging/price gaps (no-migration companion, below HubSpot Pro, Outlook) | Experiment 4 |
| 3. Technical feasibility via supported integrations | **Pass**: F31, F33, F58, F62 | — |
| 4. Policy and compliance | **Conditional**: pass for CRM/correspondence/drafts (F8); **fail for cold outreach** (F9, F40, F42) → removed from scope | Experiment 6 |
| 5. Willingness to pay | **Unresolved**: spend on adjacent tools only | Experiments 2, 7 |
| 6. Reachable segment | **Unresolved**: persona defined; channel untested | Experiment 1 recruitment speed |
| 7. Narrow MVP without an ESP | **Pass**: v1 sends nothing | — |
| 8. Sustainable unit economics | **Conditional**: ~75% gross margin on assumptions (05); CASA cost and CAC unknown | Experiment 6, recruitment cost |

**Critical gates that failed: policy, for the cold-outreach part of the original concept.**

The smallest alternative hypothesis worth testing is the CRM upkeep co-pilot for teams already paying for a CRM. It sends nothing and keeps cold outreach out of scope.

## Evidence that would convince us to stop

Stop if any one of these happens:
- Fewer than 5 of 15 qualified heads of sales can name a recent, concrete, costly example (exp. 1).
- Nobody pays for a second concierge audit (exp. 2).
- Native HubSpot/Pipedrive features get ≥ 90% of deal updates right on real data (exp. 4).
- Fewer than 40% of buyers complete the mailbox connection (exp. 3).
- Google declines the use case in writing, or CASA costs more than the first year's expected revenue (exp. 6).

## Open questions that materially affect the decision

| Question | Gate |
|---|---|
| Will 3-10 seller teams pay $99-199/month for CRM upkeep (`wtp-small-team`)? | 5 |
| Will they grant mailbox read access (`permission-grant-rate`)? | 3 |
| Can the CRM API supply logged email content, so no Gmail/Graph scopes are needed (`crm-logged-email-sufficient`)? | 3 |
| How good is native HubSpot/Pipedrive AI at deal updates (`native-crm-ai-overlap`)? | 2 |
| What does CASA cost (`casa-cost`)? | 4/8 |
| Does Google treat low-volume personalised first-touch B2B emails as "unsolicited commercial mail" (`google-cold-outreach-classification`), and follow-ups after a cold first email (`google-followup-classification`)? | 4 |
| What share of the segment needs Microsoft admin consent (`ms-managed-consent-share`), and Outlook vs. Gmail share (`outlook-share`)? | 3/6 |
| EU ePrivacy position on B2B prospecting (`eu-b2b-email-law`); LLM sub-processor transfer under Limited Use (`llm-subprocessor-transfer`) | 4 |
| Acquisition channel and cost (`acquisition-channel`) | 6 |
