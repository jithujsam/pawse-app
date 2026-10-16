# Decisions

A living log of why things are the way they are. Newest at the bottom of each section.

## Product and scope
- **Self-serve app, sequenced for an early pitch (Oct 2026).** The PRD v0.1 described a manual kit; the build brief asks for a product. We built the full flow on mock providers first so it can be demoed today, with real WhatsApp and payments behind env switches. See PRD changelog.
- **Name: ReplyHire** (Oct 2026). Simple English, says what happens: candidates reply, you hire. Quick web search found no recruiting product using it; a proper trademark search is in TODO.md. Set in `lib/brand.ts`. The old Klaroh landing page was a different product and was removed (it remains in git history).
- **3-5 questions, not exactly 5.** The brief says 5. We allow 3-5 so a recruiter can run a shorter screen; the form, AI drafts and sample role all default to 5. Easy to lock to exactly 5 if you prefer.
- **Human review gate.** Export and client sharing unlock only after "Mark as reviewed". AI scores are suggestions; no candidate is rejected automatically.
- **Price is a placeholder** (`PRICE_PER_JOB_INR`, default ₹1,499, up to 200 candidates). To be set from customer interviews.

## Architecture
- **Next.js 15 App Router + TypeScript**, extending the existing app. Server actions for UI mutations, route handlers for webhooks/cron/export.
- **Postgres via Drizzle ORM.** SQL migrations in `db/migrations`. Locally and in tests we use **PGlite** (Postgres compiled to WASM) so the app runs with zero setup; production uses `DATABASE_URL`.
- **Tenant isolation in two layers.** Every service function takes `orgId` and filters by it, *and* Postgres row-level security enforces it: tenant code runs inside `withOrg()`, which sets `app.org_id` and switches to the `app_user` role for the transaction. A query that forgets its filter returns nothing (tested in `tests/tenancy.test.ts`). System code (webhooks, workers, auth) uses `asSystem()` and is kept small.
- **Job queue in Postgres, not Redis.** `job_queue` table with `FOR UPDATE SKIP LOCKED`, retries with exponential backoff (10s → 1h), max attempts, stale-lock recovery and dedupe keys. Jobs are enqueued in the same transaction as the data change. No extra paid service.
- **Running jobs on Vercel.** Serverless functions can't host a resident worker, so the queue is drained (a) right after a request that enqueued work, via `after()`, and (b) every 10 minutes by Vercel Cron (`/api/cron`), which also runs the sweep. `npm run worker` exists for hosts with long-running processes.
- **No double messages.** Every outbound message has a unique `dedupe_key` (`invite:<candidate>`, `reply:<inbound>:<n>`, `reminder:<conversation>`) and is inserted as `queued` before sending; a retry skips anything already `sent`. The remaining gap is a crash between the provider accepting a message and our update. WhatsApp has no idempotency key, so this is at-least-once with a very small window.
- **Inbound idempotency.** Inbound messages are deduped by provider message id, both on the queue and on the `messages` table. Payment webhooks are deduped in `webhook_events` and a payment only moves `created → paid` once.
- **Conversation engine is a pure function** (`lib/domain/conversation.ts`): state + message → new state + effects. All edge cases (STOP, DELETE, repeat, "I don't understand", off-script, late replies, closed job, resume after silence) are unit-tested without a database.
- **Scores are computed in code.** The model returns per-criterion judgements (knockout met/not met/unclear, nice-to-have 0-3 with evidence) validated by zod; the total is a weighted average we compute. "Unclear" fails a knockout, so it is surfaced to the recruiter rather than silently passed.
- **Claude for scoring and question drafts.** `claude-opus-5-5` by default (env `ANTHROPIC_MODEL`), structured outputs via the SDK's zod helper, `effort: medium` for scoring and `low` for question drafts, and the server-side refusal fallback (`fallbacks: "default"`) enabled. A refusal marks the job failed for manual review rather than inventing a score. The system prompt forbids using protected attributes and penalising Hindi/Hinglish.
- **Adapters with mocks** for WhatsApp, speech-to-text, scoring, payments and email (`lib/adapters`). The mock WhatsApp is driven by an in-app phone simulator.
- **Demo workspaces are always simulated.** `whatsappFor(isDemo)` / `paymentsFor(isDemo)` force mocks for demo orgs regardless of env, and inbound routing never crosses demo/live. CSV upload is disabled in the shared demo so visitors can't put real people's data where other visitors see it.
- **Auth: email magic link only for now.** Phone OTP needs an SMS provider (paid); deferred. Tokens and sessions are stored as SHA-256 hashes; sessions are httpOnly cookies, re-validated against the DB and membership on every request.

## Security and privacy
- Candidate phone numbers are **encrypted at rest** (AES-256-GCM) with a keyed blind index (HMAC) for lookup and per-job uniqueness.
- **No PII in logs:** the logger redacts known PII keys and phone/email patterns. Queue payloads can contain message text, so finished jobs are deleted after 7 days.
- **CSV export** neutralises spreadsheet formula injection.
- Security headers set in `next.config.ts`. Public webhook endpoints accept only the configured live provider and verify HMAC signatures (`X-Hub-Signature-256`, `X-Razorpay-Signature`).
- In-memory rate limits on login, demo and AI suggestions (per instance; see TODO).
- Deletion keeps a row skeleton (status `deleted`, PII blanked) so counts, costs and the audit log remain consistent.

## Compliance (built in, not claimed)
- Per-candidate consent record from the CSV, with the privacy-notice version; withdrawn on STOP.
- Privacy notice link in the first WhatsApp message; plain-language candidate notice at `/legal/candidate-privacy` (English + Hindi).
- DELETE over WhatsApp, recruiter-initiated deletion, and a retention purge N days after a job closes.
- Audit log for job, candidate, score, payment, consent and deletion events.
- The UI never claims legal compliance; legal pages are marked as drafts for lawyer review.
