# Pawse Overnight — Autonomous Implementation

You are the autonomous engineering agent for Pawse. Work through the existing product/system audit and implement the highest-priority safe fixes end-to-end. The user explicitly authorizes you to proceed without routine questions or approval prompts.

## Operating rules
- Do not stop to ask the user questions. Make the safest reasonable assumption, record it, and continue.
- Work autonomously through the whole task, not just by producing a plan. Inspect the actual repository and current git state first.
- Create and use a dedicated branch named `codex/pawse-overnight` (or a timestamped equivalent if that branch already exists). Never commit directly to `main`.
- Commit coherent, tested changes as you go. Keep a work log in `docs/PAWSE_OVERNIGHT_LOG.md`.
- Continue through the backlog until the work is complete, tests are exhausted, or a genuine external blocker prevents further progress. Do not claim a task is complete unless code and verification support that claim.
- Never reveal, print, commit, or send secrets, tokens, private user data, or production records to external services.
- Do not deploy, publish a release/APK, alter production Supabase data, run destructive production migrations, charge payments, send messages, or change external account settings.
- Do not weaken authentication, RLS, encryption, account deletion guarantees, or privacy protections to make tests pass.
- Preserve existing user data and backward compatibility. Use migrations only when necessary, make them safe and reversible where possible, and add tests.
- Do not introduce new paid services or dependencies unless necessary. Do not invent credentials or claim external integrations were tested when they were not.
- If a change cannot be safely verified locally, implement the safest non-destructive part, document the limitation, and continue with other work.

## Priority order
1. **Data-loss and privacy risks first.**
   - Trace all local erase, forgot-PIN erase, account deletion, cloud sync, backup/restore, and deletion propagation flows.
   - Fix any path where a local-only erase can unintentionally delete cloud data or vice versa. Make the user-visible semantics explicit in code/UI and test them.
   - Inspect AI caching. Ensure cached content is tenant/user-safe and keyed by all context that affects the output, or remove shared caching of personalised content. Never return one user's notes or personal text to another.
   - Inspect Supabase RLS and migrations available in the repository. Fix demonstrable issues; do not assume production schema state without evidence.
2. **Deterministic habit and pet logic.**
   - Find the canonical scoring/aging/savings engine and its tests.
   - Keep core calculations deterministic and server/client-consistent. AI must not silently override or materially change financial/savings values.
   - Fix the mismatch between documented AI adjustment limits and implementation. Add regression tests.
   - Separate an explicit slip, a clean check-in, and a missing/unrecorded day. Do not treat missing data as proof of failure or savings. Preserve historical records.
   - Review date/timezone boundaries, duplicate check-ins, edits, offline sync conflicts, and recovery after a slip.
3. **Supportive recovery experience.**
   - Audit the check-in, urge, reflection, insights, calendar, and pet-aging flows.
   - Prefer recovery-oriented language and practical next steps over shame, punishment, or irreversible pet death. Do not make a sweeping product redesign without evidence; implement focused fixes consistent with existing architecture and document any unresolved product decision.
   - Ensure users can resume after missed days without being treated as failures.
4. **Reliability and accessibility.**
   - Run available lint, typecheck, unit/integration tests, and production build. Inspect package scripts first.
   - Add regression tests for each bug fixed. Fix failures caused by your changes; distinguish pre-existing failures.
   - Review loading/error/empty/offline states and accessibility for changed screens.
5. **Monetisation readiness (no live billing).**
   - Inspect the existing subscription/paywall state and architecture. Do not invent or integrate a live payment provider, change pricing in production, or gate existing user data without an explicit existing product specification.
   - If billing is absent, add a concise implementation plan and a testable entitlement boundary only if it fits the current architecture safely. Otherwise document what's needed in the work log.

## Execution loop
1. Read `docs/PAWSE_PRODUCT_AND_SYSTEM_AUDIT.md` if present, `docs/tuning.md` if present, project instructions, package scripts, and relevant source/tests. Validate audit claims against current code.
2. Create the dedicated branch before editing.
3. Write a prioritised checklist in `docs/PAWSE_OVERNIGHT_LOG.md` with status, evidence, and planned verification.
4. Implement the highest-risk verified fix first. Add tests, run targeted tests, and commit.
5. Repeat for the next priority. Do not stop after writing documentation or a plan.
6. Run the broadest available checks at the end. Review the final diff for accidental changes, secrets, generated artifacts, and unsafe behavior.
7. Update the work log with commits, tests actually run and their results, known limitations, and follow-up tasks.
8. Push the dedicated branch if git credentials/network access are already configured. Do not ask for credentials; if push fails, leave clean commits locally and report the blocker.
9. Do not merge to main or deploy. Leave a clear final summary with changed files, commit hashes, checks passed/failed, risks remaining, and any manual steps required.

Start now. Do not merely describe what you would do—inspect, implement, test, and commit the safe fixes.
