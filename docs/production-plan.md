# Production plan

Starting point: the calm redesign (tinted themes, guided onboarding, Supabase accounts with whole-blob sync, OpenRouter edge function with Zod-validated output). It works, but it reads as an MVP: motion is CSS-only and mostly decorative fades, onboarding is a form, data lives in one localStorage blob and one `app_state` JSON row, and there is no app lock, no real sync, no notifications.

The PRD stays the source of truth. Nothing here changes engine math.

## Status

- Phase 1: done.
- Phase 2: done in the app. Migration `0002_normalized.sql` is written but not yet applied, so sync has not run against a real database yet. The sync mapping is covered by unit tests only.
- Phase 3: done in the app. The hardened `ai` function is written; it still has to be deployed, and `OPENROUTER_API_KEY` set as a function secret.
- Round 2: serif headings (Newsreader), research-based one-tap check-in questions (`docs/check-in-questions.md`), equal-size card groups, login required before use, and a sandboxed simulator in You that plays one day every 2 seconds.
- Not done: biometric unlock, home-screen widgets (PRD phase 4).

## Phase 1: Feel (motion, onboarding, micro-interactions)

- Motion system: duration and spring tokens, one library (`motion`) for gestures and exit animations, CSS for ambient loops. Everything honours `prefers-reduced-motion`.
- Direction-aware tab transitions, a sliding tab indicator, staggered content.
- Bottom sheets that drag to dismiss, with a handle, scrim fade and focus trap.
- Animated numbers (age, months, streak, spend) and a spring age bar.
- Haptics on native (Capacitor Haptics), `navigator.vibrate` fallback, off switch.
- Toasts for confirmations and undo (delete slip).
- Companion: tap to pet (hearts), eyes follow the pointer, idle behaviours (look around, yawn), smooth coat and stage transitions, reacts while you type its name.
- Onboarding rebuilt as a story: intro cards, hatch ceremony, live speech previews per tone, a baseline question ("how often right now"), reminder with permission request, safety and 18+ gate, optional account, first-run coach marks on Home.
- Milestones: 3, 7, 14, 30 clean days get a celebration, in all three tones.
- Error boundary with a calm recovery screen.

## Phase 2: Data and security

- Normalised Supabase schema following PRD section 9: `profiles`, `companions`, `habits`, `entries`, `clean_days`, `deductions`, `weekly_reports`, plus `ai_usage`. RLS on every table scoped to `auth.uid()`, check constraints, indexes, `updated_at` triggers, soft delete. Client-generated UUIDs so offline writes are idempotent.
- Local store moves from one localStorage blob to IndexedDB, with a versioned schema, migrations from v1, and Zod validation on every load and import.
- Sync engine: an outbox of changed rows, batched upserts, pull by `updated_at` cursor, last-write-wins, retry with backoff, online and offline state shown in the UI.
- App lock: optional 4 to 6 digit PIN, hashed with PBKDF2 (WebCrypto), auto-lock after time in the background, rate-limited attempts.
- Auth: email OTP code as well as password, password strength hint, delete account (RPC that removes the auth user and cascades).
- Content Security Policy, edge function CORS allow-list, strict request validation, no free text in logs.
- Photos stay on the device. They are never uploaded or sent to AI.

## Phase 3: AI, notifications, performance, release

- OpenRouter: model fallback list, server-side cache keyed by a hash of normalised features, results stored in `deductions` and `weekly_reports`.
- Weekly summary written automatically once a week when signed in; a short daily line from the companion, validated and with template fallback.
- Local notifications for the daily check-in (in the chosen tone), at most two a day.
- PWA manifest, icons and a service worker for offline use.
- Performance: per-screen code splitting, memoised companion views (the age fold currently reruns on every render).
- Tests for migrations, sync merge, PIN hashing and schemas; Playwright screenshots at 390 px in light and dark.
- README, Supabase setup and tuning log updated.
