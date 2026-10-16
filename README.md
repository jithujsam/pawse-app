# Delecta

WhatsApp-first candidate screening for Indian recruiters and small staffing agencies. A recruiter creates a job, uploads candidates, and candidates answer screening questions on WhatsApp by text or voice note. Answers are scored against the recruiter's rubric and delivered as a ranked shortlist. Priced per job in INR, paid by UPI.

Spec: [docs/PRD.md](docs/PRD.md) · Why things are built this way: [docs/DECISIONS.md](docs/DECISIONS.md) · Open items and lawyer questions: [TODO.md](TODO.md) · Sales demo: [docs/DEMO.md](docs/DEMO.md) · Deploy, backups, rollback: [docs/DEPLOY.md](docs/DEPLOY.md)

## Run it locally (no keys needed)
```bash
npm install
npm run dev
```
Open http://localhost:3000. Everything runs locally: an embedded Postgres (PGlite, stored in `.data/`) and mock WhatsApp, payments, scoring and email. Sign-in links appear on screen. Use **Phone simulator** on an active job to play the candidate, and **See a demo workspace** for seeded data.

To use a real Postgres, set `DATABASE_URL` and run `npm run db:migrate`. All settings are in [.env.example](.env.example).

## Checks
```bash
npm run lint
npm run typecheck
npm test          # unit + full-flow tests on mocks (vitest, in-memory Postgres)
npm run e2e       # browser tests (Playwright) against a dev server on mocks
```

## Layout
```
app/              Next.js routes: public site, /app (recruiter), webhooks, cron, legal pages
components/       UI pieces (app shell, site header/footer)
lib/domain/       Pure logic: CSV validation, conversation engine, scoring, billing gate, copy
lib/services/     Use cases, all tenant-scoped (jobs, candidates, payments, outreach, scoring, compliance)
lib/adapters/     WhatsApp, speech-to-text, scorer (Claude), payments (Razorpay), mailer, each with a mock
lib/db/           Drizzle schema, connection, withOrg() row-level security wrapper
lib/jobs/         Postgres-backed job queue and handlers
db/migrations/    SQL migrations (including row-level security)
tests/ e2e/       Vitest and Playwright tests
docs/ scripts/    Docs; migrate, seed and worker scripts
```
