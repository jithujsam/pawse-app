# Pawse Overnight — Autonomous Execution Across Both Repositories

The owner will be unavailable. Work independently without routine questions. Complete all safe, authorised work; do not merely produce a plan.

## Repositories
- App: https://github.com/jithujsam/pawse-app
- Release: https://github.com/jithujsam/pawse-release

## Start
1. Inspect git status, project instructions, branches, open PRs, recent commits, and actual code in both repositories.
2. Read and execute `.claude/commands/pawse-recovery-redesign.md` as the PAWSE 3.0 product/research/implementation brief.
3. Validate earlier audit reports against current code.
4. Create dedicated branches; never commit directly to main or force-push.
5. Create/update `docs/PAWSE_OVERNIGHT_LOG.md` with a prioritised checklist, evidence, status, tests, and blockers.

## Execution order
1. Data-loss/privacy risks: authentication, sync, account deletion, backup/restore, RLS, AI cache isolation.
2. Deterministic recovery/check-in/pet/savings logic, missing-day semantics, timezone/DST/midnight behaviour, first-sync and onboarding races.
3. Implement high-impact recovery UX: onboarding, urge support, lapse recovery, trigger insights, weekly review, and humane pet mechanics.
4. Review notifications, widgets, accessibility, offline/error/empty states, AI safety, and cost controls.
5. Run tests, lint, typecheck, production build, disposable-database migration checks, and Android build/device tests where available.
6. Review diffs for secrets, generated files, destructive behaviour, and unsupported claims. Commit and push coherent changes; open/update a PR if permitted.
7. Coordinate the release repository after app changes are verified.

## Release repository
Inspect existing conventions first. Keep release documentation, version metadata, and release notes aligned with the app. Build an APK only if tooling permits; verify its package/version/install behaviour and calculate SHA-256 only for a real artifact. Keep `latest.json`, filenames, checksums, and links consistent. Never invent artifacts, checksums, versions, URLs, or test results. Preserve older releases. If no release-ready APK is verified, label work unreleased and update release preparation/checklist docs only. Use a separate branch/PR where possible and reference the app PR/branch.

## Safety and permissions
- Choose the safest reasonable option and document assumptions; do not ask routine questions.
- Never print, commit, or transfer secrets or private user data. Keep the current OpenRouter key unchanged.
- Use connected Supabase/GitHub integrations only within their actual permissions; connection does not imply unrestricted access.
- Never bypass approval controls, weaken RLS/authentication/encryption, or use real user data in tests.
- Do not modify production user data, run destructive production SQL, apply production migrations, change production auth settings, deploy app/functions, merge unreviewed work, publish a public release, or distribute an untested/unsigned APK unless an explicitly authorised and verified release procedure permits it.
- If a privileged action is blocked, continue independent work and document the exact owner action remaining.
- Do not claim production verification or device testing unless performed.

## Required reporting
Create/update `docs/PAWSE_OVERNIGHT_REPORT.md` in the app repo and a concise release status in `pawse-release`. Report user-visible changes, research conclusions and limitations, bugs/security changes, exact test results and unrun checks, both repos' branches/commits/PR links, Supabase work and whether production changed, APK build/signing/checksum/publication status, blockers, and ordered next steps.

Continue until safe, authorised work is complete or a genuine blocker prevents further progress.
