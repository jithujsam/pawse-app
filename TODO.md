# TODO

## Before messaging real candidates (blocking)
- [ ] **WhatsApp Business API:** Meta business verification, a dedicated number, and approval of two templates (`screening_invite` with 4 body params: org, role, retention days, privacy URL; `screening_reminder` with 2: org, role) in English and Hindi. Template wording must match `lib/domain/copy.ts`. Research and report: current per-message fees for India (utility vs marketing category), verification and approval times. *Not researched yet; do not guess.*
- [ ] **Test `CloudWhatsApp` against a live test number** (send template, send text, inbound text, inbound voice note, webhook signature, media download). Written to Meta's documented API but not run against it.
- [ ] **Test `RazorpayPayments` in Razorpay test mode** (payment link creation, `payment_link.paid` webhook, signature, event id header). Confirm UPI-only link options.
- [ ] **Choose and integrate a real speech-to-text provider** (paid: ask first). Run an accuracy test on real Hindi, Hinglish and regional-accent voice notes before choosing. The mock just echoes text.
- [ ] Set the real **price per job** from customer interviews (`PRICE_PER_JOB_INR`).
- [ ] Native-speaker review of all **Hindi copy** (`lib/domain/copy.ts`, candidate privacy notice).

## For a lawyer
- [ ] Trademark search and registration for the name "Delecta" (India, class 35/42); check domain availability (e.g. delecta.in, getdelecta.com).
- [ ] DPDP Act 2023 (and Rules): are we a Data Processor for the recruiter (Data Fiduciary)? What must the processing contract contain? Do we need a grievance officer or consent manager arrangements?
- [ ] Is a recruiter-ticked "consent" column in a CSV sufficient basis for first contact on WhatsApp? What evidence of consent should we require recruiters to keep or upload?
- [ ] Is the privacy notice in the first WhatsApp message plus the linked page adequate notice? Required language versions?
- [ ] Retention: is 90 days after job close appropriate? Different for candidates who were hired?
- [ ] Cross-border transfer: Anthropic (scoring), STT provider, hosting region. Any restriction or notice needed?
- [ ] Use of automated scoring in hiring: disclosures to candidates, right to human review, anti-discrimination exposure.
- [ ] Review Terms, Privacy, DPA and Refund drafts (`app/legal/*`); fill company name, address, liability, governing law.
- [ ] GST on per-job fees; is our receipt sufficient or do we need tax invoices? Refund timelines with Razorpay.
- [ ] Client share link: OK to show candidate names and scores to the agency's client without the candidate's separate consent?

## Product (next sprints)
- [ ] S6: translate recruiter questions for Hindi candidates (today the framing is Hindi but question text is as written by the recruiter).
- [ ] S6: a second regional language; scheduling (send window, e.g. 9am-8pm IST); configurable reminder timing.
- [ ] Phone OTP login (needs SMS provider: paid, ask first).
- [ ] Team members: invite colleagues to a workspace (memberships table already supports it).
- [ ] Re-score button after a failed scoring job; retry button for failed sends on "Needs attention".
- [ ] Demo workspace reset (nightly re-seed) since it's shared.
- [ ] Candidates in two active jobs with the same number: inbound replies route to the most recently messaged active conversation. Consider sending only one job at a time per number.
- [ ] Direct Google Sheets export (needs Google OAuth).

## Engineering
- [ ] Error tracking service (Sentry or similar: paid, ask first). Hook point: `captureError` in `lib/log.ts`.
- [ ] Move rate limits from in-memory to Postgres so they hold across serverless instances.
- [ ] Failed queue jobs keep their payload (may include message text): purge or redact after N days.
- [ ] Encryption key rotation procedure for `DATA_ENCRYPTION_KEY`.
- [ ] Landing and pricing pages are statically rendered: price changes need a redeploy (or make them dynamic).
- [ ] Mock scorer is keyword-based and misses Hindi/Hinglish; it exists only so the app runs without a key.
