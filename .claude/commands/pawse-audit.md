---
description: Audit Pawse's existing product, code, behavioural mechanics, AI, data, security, and monetisation without changing application code.
---

# Pawse Full Product and System Audit

You are acting as a senior product architect, staff software engineer, behavioural product researcher, AI systems architect, and QA engineer.

## Mission

Understand the Pawse application exactly as it exists in this repository. Produce a verified, source-backed audit that we can use to make product decisions together before implementation.

**This is a read-only discovery task, not an implementation task. Do not redesign, refactor, fix, delete, rename, or otherwise modify application code, configuration, schemas, dependencies, or existing documentation.** The only permitted repository change is creating or updating the audit report at `docs/PAWSE_PRODUCT_AND_SYSTEM_AUDIT.md`. Preserve unrelated work.

Do not assume a feature works because it appears in a README, PRD, screenshot, or UI. Trace it through the actual implementation. Distinguish verified facts, inferences, hypotheses, and unknowns. Never invent behaviour or claim a test passed unless it was run.

## Working method

1. Start by checking the repository state and identifying the actual framework, runtime, package manager, launch/deployment environment, and default branch from repository evidence. Do not assume which launchpad or hosting platform is being used.
2. Read the project documentation and map the source tree.
3. Trace real execution paths from UI entry points through state, business logic, persistence, APIs, and visible outcomes.
4. Inspect relevant source files in enough detail to verify the logic. Search for additional feature implementations beyond the files mentioned in documentation.
5. Run only safe, non-destructive checks that are appropriate for the available environment. Do not install or upgrade packages, run destructive migrations, access real user accounts, or expose secret values.
6. Write the audit report. If the task cannot be completed in one pass, clearly track what was inspected and what remains unverified.
7. Finish with a concise terminal summary and wait for product-owner review. Do not start fixing discovered issues.

## Areas to inspect

### 1. Product definition and current state
Establish what Pawse is intended to be, its target users, primary user outcome, current promise, existing monetisation, and what a user can actually accomplish. Explain the role of the virtual pet and whether the product currently behaves like a pet simulation, habit tracker, commitment device, behaviour-change system, or a combination.

Separate implemented functionality from plans, prototypes, placeholders, assumptions, and stale documentation.

### 2. Technology and architecture
Document the actual frameworks, languages, packages, routing, state management, UI structure, backend, database, authentication, storage, APIs, AI providers, animation/rendering engines, analytics, and deployment services.

Identify the app's true development/runtime environment from configuration and evidence. Explain what works locally, what requires external setup, and what is unknown. Map the main modules and dependencies.

### 3. Screens and complete user journey
Inventory every route, page, modal, onboarding step, settings view, dashboard, component with meaningful state, and interactive flow.

Trace first launch, onboarding, pet creation/selection, goal setup, reminders, daily check-ins, partial completion, missed check-ins, recovery, pet progression, history, reviews, settings, backup/restore, account deletion, and subscription purchase/cancellation wherever implemented.

For each screen or flow, document its purpose, available actions, code entry points, data read/written, logic triggered, resulting state, transitions, failure states, and implementation status. Identify dead ends and confusing or inconsistent transitions.

### 4. Feature inventory
Discover all features actually present, including pet customisation and animations, pet stats, habits, scheduling, completion criteria, streaks, rewards, milestones, reminders, notifications, progress charts, history, weekly reviews, AI, offline use, accounts, sync, privacy, export/deletion, subscriptions, loading states, errors, and accessibility.

For every feature include:
- Purpose and user entry point.
- Source file paths and important function/component names.
- Inputs and dependencies.
- Actual rules and calculations.
- State changes and side effects.
- Persistence and external calls.
- Failure behaviour.
- Status: working, partial, placeholder, broken, or unverified.
- Product, behavioural, privacy, or technical risks.

### 5. Habit, goal, and pet-state logic
Reverse-engineer the real rules for habit creation, schedules, success/partial/failure states, streaks, rewards, score changes, pet mood/age/health/energy/hunger/happiness, decay, deterioration, and any death or reset mechanics.

For each mechanic, trace:
**Trigger → conditions → calculation → in-memory state changes → persisted changes → visible result → subsequent effects.**

Use actual formulas, thresholds, date handling, and example scenarios from the code. Do not invent missing rules.

Check how the system distinguishes a real missed behaviour from a missed report; whether users can correct check-ins; how schedule changes affect history; and how midnight, time zones, daylight-saving changes, duplicate events, repeated submissions, and stale state are handled.

Document the goal data model, validation, frequency, difficulty, multiple-goal support, pause/archive/delete behaviour, history preservation, and model limitations for different everyday behaviours.

### 6. Behavioural and psychological model
Map where the product uses goal-setting, action planning, reminders/cues, self-monitoring, feedback, rewards, pet attachment, accountability, recovery, personalisation, competition, loss aversion, guilt, or punishment.

For each mechanism explain where it appears, its intended effect, potential benefit, possible unintended effect, and what evidence would be required to validate it.

Distinguish accountability from punishment, app engagement from real-world progress, pet engagement from habit improvement, and a missed action from missing data. Do not assume punishment improves adherence or that removing all consequences is automatically better. Document first; do not redesign.

### 7. AI inventory and end-to-end data flow
Find every model call, prompt, provider, model configuration, route, server function, tool, background job, cache, quota, and fallback.

For each AI feature, document its trigger, inputs and user context, prompt location, provider/model, execution location, expected output, validation, output transformation, persistence, side effects, user approval, error handling, fallback, rate/cost limits, and data shared with the provider.

Check for client-exposed secrets, untrusted user content, prompt injection risks, invalid output, cross-user cache leakage, race conditions in quotas, and AI-triggered changes without approval.

Classify each capability as:
- AI adds meaningful value.
- Better handled by deterministic logic.
- Hybrid rules plus AI.
- Unnecessary or duplicative.
- Unverified.

Evaluate AI against the question: **Does it deliver useful personalised reasoning that ordinary application logic cannot provide as reliably or economically?** Do not propose a generic chatbot merely to label the app AI-powered.

### 8. Data model, persistence, and sync
Map entities, fields, types, relationships, validation, migrations, and source of truth. Inspect local storage/IndexedDB, database schemas, Supabase or other backend usage, API payloads, encryption, backup, restoration, and sync code.

Trace app startup, save/load, offline edits, reconnect, conflict resolution, concurrent changes, deletion propagation, schema upgrades, data corruption, logout, and account deletion.

Check authentication boundaries, row-level security where relevant, encryption/key management, PIN/password handling, recovery, and cross-device consistency. Do not claim security based only on the presence of encryption or RLS; identify what is actually verified versus what needs deployed-environment testing.

### 9. Security, privacy, and reliability
Inspect for exposed secrets, missing server-side authorisation, cross-user access, weak session handling, unvalidated input, unsafe AI output, weak encryption/recovery assumptions, PIN brute-force and lockout risks, sync races, duplicate writes, quota races, sensitive logging, third-party data exposure, and missing consent/deletion flows.

Classify findings as confirmed from code, probable, or requiring live/configuration testing. Do not access real user accounts, reveal secret values, or perform destructive tests.

### 10. Pet rendering and animations
Identify whether the pet is actual 3D, 2D, SVG, CSS, canvas, WebGL, or a combination. Document the rendering engine, assets, animation selection, triggers, pet-state-to-animation mapping, timing, responsiveness, fallback behaviour, performance, and memory risks.

Trace the connection between visual pet behaviour and the underlying habit state. Do not generate or replace assets.

### 11. Monetisation
Audit existing payment and subscription code, if any: purchase flow, server-side verification, entitlement enforcement, renewals, cancellation, expiry, restoration, failed payments, and access restrictions.

The proposed direction is a paid-only subscription at **₹99/month**, potentially with an interactive preview before payment. This is a product hypothesis, not evidence that the current app implements it. Document what is present, missing, mocked, or merely planned. Identify ongoing infrastructure/AI costs and what current features might support recurring value. Do not implement payment changes.

### 12. Tests and quality
Inspect test suites, build scripts, type checks, linting, CI, and error reporting. Identify coverage for habit logic, dates, pet progression, persistence/migrations, sync, encryption, AI validation/quotas, and subscription access.

Run only safe checks. Report the exact checks run and results. Never claim an unrun test passed.

### 13. End-user evaluation
Evaluate the existing product from a new user's perspective:
- Is its purpose clear within one minute?
- Can the user reach a first meaningful action easily?
- Is the pet's role understandable?
- Is the daily interaction brief and clear?
- Is the next action obvious?
- Does feedback help the user?
- Is recovery after a setback understandable?
- Can users understand progress beyond streaks?
- Is there reason to return after novelty fades?
- Is the ₹99/month value proposition clear?
- Does AI add value beyond the pet and standard habit tracking?

Separate observed defects from hypotheses that require user testing. Do not equate time in app, streaks, or notifications opened with real-world improvement.

## Required report

Create `docs/PAWSE_PRODUCT_AND_SYSTEM_AUDIT.md`. Creating the `docs` directory is permitted if needed. Include:

1. Executive summary.
2. Verified stack, runtime, launch/deployment environment, and dependencies.
3. Product purpose, audience, and current product promise.
4. Repository and architecture map.
5. Screen inventory and end-to-end user journey.
6. Complete feature inventory and implementation status.
7. Habit, check-in, pet-state, and date/time logic.
8. Behavioural/psychological model and trade-offs.
9. AI inventory, prompts, providers, request flows, and value assessment.
10. Data model, persistence, encryption, backup, and sync.
11. Security, privacy, and reliability findings.
12. Pet rendering and animation architecture.
13. Subscription and monetisation audit.
14. Testing and quality findings.
15. End-user experience assessment.
16. Confirmed bugs, probable risks, and items requiring verification.
17. Explicit unknowns, evidence needed, and how to verify.
18. Prioritised decisions requiring product-owner input.

Use concise prose, tables, and Mermaid diagrams where useful. Cite actual source paths and function/component names for important claims. Include relevant formulas and thresholds exactly as implemented. Never include secret values.

## Evidence labels

Mark significant claims using these labels:
- **Verified** — directly supported by source code, configuration, or a check that was run.
- **Inferred** — best interpretation of the available evidence, not explicitly guaranteed.
- **Hypothesis** — product/behavioural idea requiring validation.
- **Unknown** — cannot be established from the available repository or environment.
- **Needs runtime verification** — code inspection alone is insufficient.

## Final terminal summary

After writing the report, provide:
- What Pawse currently is.
- What is actually implemented versus planned.
- How the core habit and pet mechanics work.
- How AI currently works (or confirmation that no live AI path was found).
- How data is stored and synchronised.
- The five most important findings.
- The five most important unanswered questions.
- Safe checks run and their results.
- The next recommended discussion step.

## Strict constraints

- Do not implement fixes or recommendations.
- Do not refactor or rewrite application code.
- Do not change dependencies, application configuration, database schemas, or existing product documentation.
- Do not make product decisions on the owner's behalf.
- Do not invent features, business rules, model behaviour, or test results.
- Do not expose secrets or modify unrelated work.
- The only permitted file change is `docs/PAWSE_PRODUCT_AND_SYSTEM_AUDIT.md`.
- If you cannot verify something, say what is missing and how it could be verified.
- If you run out of context or time, document progress and remaining work rather than pretending the audit is complete.

**Success means a comprehensive, source-backed understanding of Pawse as it exists today. Understanding is the deliverable. Implementation comes later.**
