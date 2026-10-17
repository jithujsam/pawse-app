# Delecta: executive report

**Decision: VALIDATE FURTHER, on a much narrower concept. STOP the original concept as briefed.**

The original concept was an email-centric workspace covering the whole sales cycle, including outreach to new prospects.
**Stop that version.** Automated cold outreach through connected Gmail accounts is not an approved use under Google's policies
(F9, F40, F42). Every individual capability already exists in cheap products (02). And a large share of the target users say
spreadsheets, free CRMs or habits are enough (01).

**What survives** is a narrow, testable hypothesis: a *CRM upkeep co-pilot* for 3-10 seller B2B teams that already pay for
HubSpot or Pipedrive. It reads deal threads, proposes corrections to the CRM, a human approves them, and it shows what needs
attention today. It sends nothing. The concept clears the technical gate (3) and the no-ESP gate (7), and clears the policy
gate (4) for this narrowed scope. It has **not** cleared the gap gate (2) or willingness to pay (5). Both can be tested
without writing product code.

Citations: `E#` = verified customer quote, `F#` = verified official/vendor fact (see `generated/`). Unmarked
reasoning is analyst interpretation.

## Answers to the required questions

**1. Is this a real opportunity?**
- **The broad version: no.**
- **The narrow version: possibly, unproven.**
- The most common first-hand pain in the sample is keeping the CRM current from email, and attaching email to the right deal
  (15 and 7 voices: E63, E64, E14, E39, E10).
- Lost deals from forgotten follow-ups are real but anecdotal (E27, E28).
- Against it: 32 voices say simple tools or habits suffice (E33, E35, E56, E61).
- No one in the sample stated they would pay for this kind of product.

**2. Who should we serve first?**
- The head of sales or sales-led founder of a 15-60 person B2B company with 3-10 sellers on HubSpot or Pipedrive. She runs
  a weekly pipeline review and is (or sits next to) the mail admin (04 §1).
- Founders, SDRs, AEs, agencies and consultants were each rejected for a specific reason:
  - Founders and consultants: price sensitivity and "Excel works" (E57, E59).
  - SDRs and agencies: the outreach policy (F9).
  - AEs: IT refusal (E20) and not the buyer.

**3. What is the one problem to solve first?**
- "The CRM is wrong on Monday morning."
- Deals carry stale stages and next steps, and threads sit on the wrong deal, because reps don't log email activity
  consistently (E63, E64, E14).

**4. Why buy this instead of Gmail, Outlook, HubSpot, Instantly or others?**
- The honest answer today is: *only if native features fail on real data* (experiment 4).
- The verified gaps are narrow:
  - Auto-CRMs (Day.ai, Lightfield, Clarify) require replacing the CRM (F135, F164, F194).
  - HubSpot puts sequences behind its $100 Professional seat (F149, F100).
  - Inbox-native deal tools are Gmail-only (F84, F138).
- Instantly is not a substitute because we exclude cold outreach. Gmail nudges (F141) and Superhuman (F166) cover reminders
  but not deals.

**5. Can we deliver the workflow without becoming an ESP?**
- Yes, for the narrowed scope.
- Reading, threading, notifications and drafting all run through the Gmail API and Microsoft Graph (F31, F33, F58, F62).
- v1 sends nothing. Later sends stay inside existing threads with engaged contacts, under provider limits (F28, F64).

**6. Which permissions and policies could prevent launch?**
1. Google restricted-scope verification plus an **annual CASA assessment** for any background Gmail read, even headers
   only (F3, F13, F14, F15). It takes weeks to months (F19, F23), and the cost is unpublished.
2. **Microsoft admin consent** for Mail.Read/ReadBasic under the default "Microsoft managed" policy (F54).
3. Google can revoke API access if the app *enables users* to violate policy (F7). Any outreach feature would put the
   whole product at risk.
4. Workspace admins can block third-party apps (F44).

The risk register is in `generated/RISK_REGISTER.md`.

**7. What can we test without production code?**
- Problem interviews.
- A manual stale-pipeline audit, sold as a service.
- A permission test with real consent screens on an unverified test app.
- A benchmark against native CRM features.
- A clickable mockup.
- A written clarification request to Google (06).

**8. What is the smallest credible paid pilot?**
- A concierge stale-pipeline audit for 3-5 teams, delivered by hand from data they choose to share.
- The second month is charged at **≥ $100**.
- It passes if ≥ 3 teams pay (exp. 2). Software follows only after that.

**9. What evidence would convince us to stop?**
- Fewer than 5 of 15 qualified buyers can name a recent costly example.
- Nobody pays for a second audit.
- Native HubSpot/Pipedrive AI gets ≥ 90% of updates right.
- Fewer than 40% of buyers complete the mailbox connection.
- Google rejects the use case, or CASA costs more than first-year revenue (06).

**10. What should we do in the next 14 days?**

| Days | Action | Output |
|---|---|---|
| 1-2 | Write the interview script and screener (CRM, mail provider, admin, sellers, last lost deal); build a list of 40 target heads of sales from your network and LinkedIn | Screener + list |
| 1-3 | Read the HubSpot and Pipedrive API docs on email engagements and deal writes (closes `crm-logged-email-sufficient`); add them to the evidence base | New facts |
| 3-12 | Run 15 problem interviews (exp. 1). Offer the free audit at the end | Interview log against the pre-set thresholds |
| 5-14 | Deliver 3-5 manual audits; quote the paid second month (exp. 2); compare with what the CRM recorded natively (exp. 4) | Audit results; payment yes/no |
| 7 | **With your approval:** email Google OAuth verification support about the use case, and ask one CASA lab for a quote (exp. 6) | Written answers |
| 14 | Re-score gates 1, 2, 5 and 6 in `synthesis.py`; decide PROCEED / STOP | Updated scorecard |

## Coverage and limits (this was a bounded pilot, not an exhaustive study)

- **Customer evidence:** 80 verified quotes from 79 authors. Sources: Reddit via an archive, Capterra page 1 for 7
  products, 2 HN threads.
  - Reddit comment search failed, which biased the sample towards question posts.
  - G2 and TrustRadius were blocked.
  - Workflow areas D, E, G and I, and the SDR and agency segments, are thin.
  - This sample cannot estimate how common the problems are.
- **Competitors:** 24 products, 119 of 121 facts verified.
  - Pipedrive, Copper and Microsoft Copilot prices could not be read.
  - Many matrix cells are "not verified" (`?`), especially for Salesloft, Outreach, Front and Salesforce.
- **Provider and legal:** 76 facts, all verified.
  - EU law, the FTC guide and SMTP AUTH dates were not retrieved.
  - CRM (HubSpot/Pipedrive) APIs were not researched.
- **Economics:** token prices and Pub/Sub cost are verified facts. Volumes, hosting and CASA are assumptions (05).
- **Not done:** no contact with any third party, no paid services, no product code.

## Deliverable index

| # | Deliverable | Where |
|---|---|---|
| 1 | Executive report | this file |
| 2 | Customer problem map | `01_CUSTOMER_PROBLEM_MAP.md`, `generated/CUSTOMER_EVIDENCE.md`, `generated/CLUSTERS.md` |
| 3 | Competitor and capability matrix | `02_COMPETITORS_AND_PRICING.md`, `generated/CAPABILITY_MATRIX.md` |
| 4 | Pricing comparison | `02_COMPETITORS_AND_PRICING.md`, `generated/PRICING.md` |
| 5 | Gmail and Microsoft feasibility | `03_PROVIDER_FEASIBILITY.md`, `generated/FACTS.md` |
| 6 | Policy and compliance risk register | `generated/RISK_REGISTER.md` |
| 7 | Customer-segment ranking | `04_SEGMENT_WEDGE_ARCHITECTURE_MVP.md` §1, `generated/HYPOTHESES.md` |
| 8 | Ranked product hypotheses and rejections | `04_...` §2, `generated/HYPOTHESES.md` |
| 9 | Recommended wedge | `04_...` §2 |
| 10 | MVP scope and exclusions | `04_...` §4 |
| 11 | Architecture diagram and dependencies | `04_...` §3, §5 |
| 12 | Implementation and operating-cost estimates | `05_ECONOMICS_AND_ACQUISITION.md` |
| 13 | Customer acquisition hypothesis | `05_...` §4 |
| 14 | Validation experiment plan | `06_VALIDATION_PLAN_AND_GATES.md`, `generated/EXPERIMENTS.md` |
| 15 | Go/no-go scorecard | `06_...`, `generated/GATES.md` |
| 16 | Evidence database and source catalog | `../findings/*.jsonl`, `../snapshots/`, `generated/SOURCE_CATALOG.md`, `../METHOD.md` |
| 17 | Unresolved questions | `06_...`, `generated/UNKNOWNS.md` |
