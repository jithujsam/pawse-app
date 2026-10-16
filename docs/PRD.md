# PRD: WhatsApp-first candidate screening for Indian recruiters (QwikHire)

Status: DRAFT v0.2. Evidence labels: VERIFIED (public source), REPORTED (vendor or review claim), HYPOTHESIS (untested).
Clean-room note: this document describes our own product. No competitor code, copy, assets or branding is used.

## Changelog
- **v0.2 (Oct 2026):** Scope changed from a no-code, manually operated kit to a self-serve web app, per the founder's build brief. The validation goal (3 of 10 agency owners prepay) is unchanged; the app is sequenced so that a pitchable, end-to-end demo exists first. Added: mandatory human review before a shortlist is exported or shared, cost-to-serve tracking per job, response-rate funnel, CSV export (opens in Google Sheets) instead of a direct Sheets integration for now. User accounts, a dashboard and UPI checkout moved from non-goals to in-scope because the brief requires them.
- **v0.1:** Original draft (below, sections 1-4 unchanged except where noted).

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
3. Learn per-role cost to serve and candidate response rate. (v0.2: tracked in-app at `/ops`.)

Non-goals (MVP): ATS, video, multi-language beyond Hindi + English, enterprise sales, subscriptions.
(v0.2: user accounts, dashboards and a minimal billing flow are now in scope.)

## 4. MVP scope
1. Intake: recruiter creates a job, 3-5 questions (AI can draft), rubric of knockout must-haves and weighted nice-to-haves, and uploads a candidate CSV (name, phone, consent flag, language).
2. Screening flow: questions over WhatsApp one at a time, answered by text or voice note. STOP honoured at any time; one re-ask on off-script replies, then hand-off to a human.
3. Scoring: transcribe voice notes, score against the rubric (Claude, structured JSON), store reason and evidence. Total is computed in code from the model's per-criterion judgements. Human reviews before delivery (enforced: export and share unlock only after "Mark as reviewed").
4. Output: ranked shortlist in the app with transcripts, CSV export, and a no-login client share link of tagged candidates.
5. Payment: INR per job, UPI payment link, messages only after the payment webhook confirms. Free test mode for up to 5 candidates.
6. Manual fallback: recruiter can message any candidate directly from the transcript.

## 5. Success metrics (instrumented)
Funnel events: signup → org created → job created → CSV uploaded → paid → shortlist viewed. Per job: candidates, response rate, WhatsApp templates and session messages, voice seconds, LLM tokens.
