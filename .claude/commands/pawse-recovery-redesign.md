# Pawse Recovery Redesign — Evidence-Informed Product Overhaul

You are Pawse's product researcher, recovery-experience designer, and senior engineer. Research first, then implement the highest-value improvements in the actual application. Do not stop at recommendations.

## Mission
Make Pawse a useful, safe, supportive recovery companion that helps people understand a target behaviour, navigate urges, learn from lapses, and build independence. The product should not treat addiction or compulsive behaviour as a simple lack of discipline.

## Research requirements
Inspect the existing product and research credible current sources before making major decisions. Prioritise clinical guidelines, government health agencies, systematic reviews, and peer-reviewed research. Investigate CBT, motivational interviewing, coping plans, relapse prevention, urge-management strategies, habit cues/rewards, self-compassion, behavioural activation, social support, digital recovery apps, gamification, and AI safety. Separate strong evidence from emerging evidence and product hypotheses. Cite sources and note limitations.

Create or update:
- `docs/PAWSE_RECOVERY_RESEARCH.md`
- `docs/PAWSE_PRODUCT_DIAGNOSIS.md`
- `docs/PAWSE_PRODUCT_STRATEGY.md`
- `docs/PAWSE_RECOVERY_UX_FLOWS.md`
- `docs/PAWSE_VALIDATION_PLAN.md`

Resolve contradictions with existing specifications explicitly. Validate all audit findings against the current code rather than assuming previous reports are still accurate.

## Product principles
- Support the user's own goal; do not assume one goal fits every behaviour or person.
- Missing check-ins are unknown, not evidence of failure or success.
- A lapse is information, not a moral failure. Make resuming easy.
- Never fabricate savings, streaks, insights, or progress.
- Reward useful actions and learning without shame or coercive mechanics.
- Minimise unnecessary tracking, notifications, and AI usage.
- Build user independence; do not create needless dependence on the app or AI.
- Avoid unsupported medical claims and provide appropriate professional-support guidance when warranted.

## Redesign and implement
1. **Onboarding:** Create a short, skippable, editable setup for target behaviour, goal, reasons for change, triggers, difficult contexts, preferred support, and a realistic first step. Ask only questions that change the experience.
2. **Daily check-in:** Clearly distinguish progress/goal met, lapse, urge managed, unrecorded day, and intentionally untracked day. Do not infer behaviour from app inactivity.
3. **Urge flow:** Provide fast, low-friction options such as pause-and-observe, identify trigger/emotion, change environment, add friction to access, grounding/breathing, replacement activity, or contact a trusted person. Let the user switch strategies. Do not promise urges end within a fixed period.
4. **Lapse recovery:** Use calm language. Offer optional reflection about what happened before the lapse, contributing context, and one achievable adjustment. Preserve prior progress and allow immediate return to the plan.
5. **Triggers and insights:** Base observations on actual data, show uncertainty, and avoid causal claims from correlation. Show insufficient-data states rather than invented conclusions.
6. **Weekly review:** Summarise progress toward the user's goal, urges managed, patterns, useful strategies, difficult situations, and one realistic next-week adjustment. Abstinence streaks or money saved must not be the sole success measures.
7. **Virtual pet:** Audit pet health, aging, death, rebirth, and reward mechanics. Avoid shame, fear, irreversible punishment, or destroying unrelated progress. Prefer continuity and rewarding helpful recovery actions. Keep the mechanics explainable and based on recorded data.
8. **AI:** Use it selectively for useful personalised planning and summaries, not deterministic scoring or routine check-ins. Treat input/output as untrusted; validate schemas and bounds; protect user isolation and cache keys; apply server-side rate/cost controls; gracefully fall back when unavailable. Never expose or rotate credentials as part of this task.
9. **Safety and privacy:** Review crisis-language handling, sensitive-data exposure, analytics, notifications, PIN-protected widgets, sync, backups, deletion semantics, and Supabase RLS. Do not present AI as a clinician or substitute for urgent/professional care.
10. **UX quality:** Improve accessibility, plain-language copy, loading/error/empty/offline states, mobile ergonomics, and visual consistency. Avoid a cosmetic redesign that does not improve the recovery journey.

## Engineering rules
- Inspect repo instructions, current branch/status, architecture, existing tests, and product specifications first.
- Work in a dedicated feature branch. Preserve unrelated work and never force-push.
- Implement in small coherent slices; add regression tests for every meaningful fix.
- Run targeted tests, full available test suite, lint, typecheck, production build, and Android build/device tests if available.
- Do not remove tests to pass CI. Distinguish tests actually run from checks that could not run.
- Preserve existing user data and backward compatibility. Any migration must be necessary, reviewed, repeatable where possible, and tested against a disposable/local database.
- Do not deploy, publish an APK, merge a PR, or alter production data/settings. Do not apply production migrations.
- Keep the existing OpenRouter key unchanged. Never print or commit secrets.
- Do not introduce paid dependencies or live billing.
- If a task is blocked, complete all independent work and document the exact blocker rather than stopping.

## Completion criteria
Implementation is required; documents alone are not enough. Create a prioritised checklist and update it throughout. Commit coherent changes and push the branch/open a PR if credentials and permissions already work. At the end, report:
- User-visible changes and rationale.
- Research conclusions and caveats.
- Files and architecture changed.
- Tests and exact results.
- Remaining risks and unverified assumptions.
- Required deployment/migration/release steps, if any.

Begin by inspecting the actual repository and validating the current state. Then research, plan, implement, test, and document.
