# PAWSE 3.0 — Evidence-Informed Recovery Product Redesign

Act as Pawse's product researcher, recovery-experience designer, and senior engineer. Research credible evidence, audit the actual app, then implement the highest-value improvements. Do not stop at recommendations or documents.

## Mission
Help users understand and change a target behaviour, navigate urges, learn from lapses, and build independence. Do not treat addiction or compulsive behaviour as a lack of discipline. Support the user's own goal. Missing check-ins are unknown, not failure or success. A lapse is information, not moral failure. Never fabricate savings, streaks, insights, or progress. Avoid shame, coercive gamification, unsupported medical claims, and needless dependence on Pawse or AI.

## Research first
Inspect the existing product and research credible current sources. Prioritise clinical guidelines, government health agencies, systematic reviews, and peer-reviewed research. Investigate CBT, motivational interviewing, coping plans, relapse prevention, urge management, habit cues/rewards, self-compassion, behavioural activation, social support, digital recovery apps, gamification, and AI safety. Distinguish strong evidence from emerging evidence and product hypotheses. Cite sources and dates, explain limitations, and translate findings into product decisions.

Create or update:
- `docs/PAWSE_RECOVERY_RESEARCH.md`
- `docs/PAWSE_PRODUCT_DIAGNOSIS.md`
- `docs/PAWSE_PRODUCT_STRATEGY.md`
- `docs/PAWSE_RECOVERY_UX_FLOWS.md`
- `docs/PAWSE_VALIDATION_PLAN.md`

Read existing specifications and audit reports. Verify their claims against current code and resolve contradictions explicitly.

## Redesign and implement
1. **Onboarding:** Short, skippable, editable setup for target behaviour, goal, reasons for change, triggers, difficult contexts, preferred support, and a realistic first step. Ask only questions that change the experience.
2. **Daily check-in:** Clearly distinguish progress/goal met, lapse, urge managed, unrecorded day, and intentionally untracked day. Never infer behaviour from app inactivity.
3. **Urge support:** Fast, low-friction options: pause and observe, identify trigger/emotion, change environment, add friction to access, grounding/breathing, replacement activity, or contact a trusted person. Let users switch strategies. Do not promise urges end within a fixed time.
4. **Lapse recovery:** Calm, nonjudgmental language. Offer optional reflection on what preceded the lapse, contributing context, and one achievable adjustment. Preserve prior progress and allow immediate return to the plan.
5. **Triggers and insights:** Use actual recorded data, make uncertainty clear, avoid causal claims from correlation, and show insufficient-data states rather than invented conclusions.
6. **Weekly review:** Summarise progress toward the user's chosen goal, urges managed, patterns, useful strategies, difficult situations, and one realistic next-week adjustment. Abstinence streaks or money saved must not be the only success measures.
7. **Virtual pet:** Audit pet health, aging, death, rebirth, and reward mechanics. Avoid shame, fear, irreversible punishment, or destroying unrelated progress. Prefer continuity and rewards for helpful recovery actions. Keep mechanics understandable and based on recorded data.
8. **AI:** Use selectively for personalised planning and summaries, not deterministic scoring or routine check-ins. Treat input/output as untrusted; validate schemas and bounds; protect user isolation and cache keys; enforce server-side rate/cost controls; fall back safely. Never expose or rotate credentials in this task.
9. **Safety and privacy:** Review crisis-language handling, sensitive data, analytics, notifications, PIN-protected widgets, sync, backups, deletion semantics, and Supabase RLS. AI is not a clinician or substitute for urgent/professional care.
10. **UX quality:** Improve accessibility, plain language, loading/error/empty/offline states, mobile ergonomics, and visual consistency. Avoid cosmetic changes without meaningful user benefit.

## Engineering rules
- Inspect project instructions, git status, architecture, tests, and specifications first.
- Use dedicated feature branches. Preserve unrelated work; never force-push.
- Implement in small coherent slices and add regression tests.
- Run targeted tests, full available suite, lint, typecheck, production build, and Android build/device tests when available.
- Do not remove tests to pass. Distinguish checks actually run from unavailable checks.
- Preserve user data and backward compatibility. Test necessary migrations locally or on a disposable database.
- Do not deploy, publish an APK, merge a PR, apply production migrations, or alter production data/settings.
- Keep the existing OpenRouter key unchanged. Never print or commit secrets.
- Do not introduce paid dependencies or live billing.
- If blocked, complete independent work and document the precise blocker.

## Completion criteria
Implementation is required; documents alone are insufficient. Keep a prioritised checklist and update it as work progresses. Commit coherent changes and push/open a PR if credentials and permissions allow it. Report user-visible changes, research conclusions and caveats, files changed, exact test results, unresolved risks, and deployment/migration/release steps. Begin by inspecting the real repository, then research, decide, implement, test, and document.
