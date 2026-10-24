# Pawse Full Overnight Run

Execute the full Pawse overnight workflow autonomously. Read these two files completely before acting:

1. `.claude/commands/pawse-3.0-evidence-informed-recovery-product-redesign.md` — **PAWSE 3.0 — Evidence-Informed Recovery Product Redesign**
2. `.claude/commands/pawse-overnight-both-repos.md` — execution, app/release repository coordination, safety, release boundaries, and reporting.

Follow both prompts together. Inspect the current state of `pawse-app` and `pawse-release`; research, implement, test, document, commit, push, and open PRs where permitted. Do not wait for routine user input or stop after writing a plan. If a permission or external dependency blocks an action, continue all independent work and document the exact blocker. Do not deploy, apply production migrations, merge unreviewed work, or publish an unverified release. Finish with the report required by the overnight prompt.
