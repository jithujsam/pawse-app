# PRD: WhatsApp-first candidate screening for Indian recruiters (working title)

Status: DRAFT v0.1. Evidence labels: VERIFIED (public source), REPORTED (vendor or review claim), HYPOTHESIS (untested).
Clean-room note: this document describes our own product. No competitor code, copy, assets or branding is used.

## 1. Problem
Small Indian staffing agencies and recruiters screen applicants by phone, one by one. [HYPOTHESIS]
Vendor blogs say screening takes 60-70% of recruiter time. [REPORTED, vendor-sourced, indicative only]
Existing screening tools are priced in USD, billed by card, and use SMS or video links, not WhatsApp.
[VERIFIED for Hirevire: hirevire.com/pricing, USD plans from $49/mo via Stripe. VERIFIED for Textwork: textwork.co, SMS-based, WhatsApp not mentioned.]
Gap: no WhatsApp-first, INR/UPI, per-job option seen on their public sites. [HYPOTHESIS, not exhaustively searched]

## 2. Target user
- Primary: owner or head of a small Indian staffing agency (1-20 recruiters) hiring in bursts. [HYPOTHESIS]
- Secondary: in-house recruiter at an SME with high-volume roles.
- Buyer = user for MVP.

## 3. Goals and non-goals
Goals (MVP):
1. Prove at least 3 of 10 agency owners will prepay by UPI for one live role.
2. Deliver a scored shortlist within 24h of receiving candidate list.
3. Learn per-role cost to serve and candidate response rate.

Non-goals (MVP): ATS, billing system, user accounts, video, dashboards, multi-language beyond Hindi + English, enterprise sales.

## 4. MVP scope (no-code kit, manual operations)
1. Intake: recruiter shares job description + candidate CSV (name, phone, consent flag).
2. Screening flow: 5 questions per role over WhatsApp, answered by text or voice note. Questions co-written with the recruiter.
3. Scoring: rubric per role (must-haves = knockout, nice-to-haves = points). Transcribe voice notes, summarise, score. Human reviews before delivery.
4. Output: Google Sheet shortlist with score, transcript, reason, candidate contact.
5. Payment: INR per role, UPI, collected before delivery.
6. Manual fallback: operator can message candidates directly.

## 5. Later (only if MVP passes)
Agency workspaces (per-client branded shortlist), self-serve upload, Hindi + regional languages, scheduling, WhatsApp Business API automation, per-100-candidates pricing.

## 6. Pricing hypothesis
Flat INR price per role (X, to be set from interview feedback). No subscription. [HYPOTHESIS]
Reference points (USD, not directly comparable): Hirevire $49-$249/mo [VERIFIED]; TextUs $99-$199/mo + $0.02/msg [REPORTED: hiretruffle.com/blog/text-recruiting-platforms].

## 7. Success metrics
- Payment: >=3 of 10 interviewees prepay (pass bar).
- Candidate response rate >=40% within 24h. [HYPOTHESIS target]
- Recruiter says shortlist saved >=50% of their screening time.
- Cost to serve per role well under price (to be measured).

## 8. Risks and open questions
| Risk | Status |
|---|---|
| WhatsApp Business API fees, business verification, template approval delays | UNCHECKED, research next |
| DPDP Act consent for processing candidate data | UNCHECKED; get legal advice |
| Unsolicited messaging / spam complaints, number bans | UNCHECKED |
| Candidates distrust unsolicited job messages | REPORTED scam concern (consumer.ftc.gov, createcultivate.com) |
| Voice-note transcription accuracy in Indian languages | HYPOTHESIS, test |
| Agencies keep using phone calls | HYPOTHESIS, test via interviews |
| Competitor terms: Hirevire AUP bars use "as part of any effort to compete"; do not use its product for analysis | VERIFIED: hirevire.com/acceptable-use-policy |

## 9. Validation plan
10 interviews with agency owners; ask for UPI prepayment for one live role. Script is in the project chat. Do not count praise or "send details" as a yes.

## 10. Milestones
- Week 0: finish WhatsApp cost and DPDP research; finalize price X.
- Week 1: kit ready (question flow, rubric, sheet template); book interviews.
- Week 2: run interviews; deliver first paid roles manually.
- Week 3: decide: build self-serve app, pivot, or stop.
