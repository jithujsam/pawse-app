# Detox Companion

Read docs/PRD.md before any work. It is the source of truth.

## Rules
- The damage engine lives only in packages/engine and stays pure TypeScript with no I/O.
- Every change to engine math needs a test that pins the pacing table in PRD section 5.3.
- AI output must be validated with Zod schemas and must fall back to the baseline on any failure.
- Never expose the Anthropic API key to the client.
- Never add calorie, weight or restriction tracking.
- All user-facing copy must exist in all three tones (gentle, honest, brutal).
- Respect prefers-color-scheme and prefers-reduced-motion.
- Ask before adding a new dependency or creating large new files.

## Releases
- Every release must update the distribution repo `jithujsam/pawse-releases` (APK, latest.json, README notes, SHA-256) by following docs/RELEASING.md. Only verified, signed release builds; never invent URLs or checksums; never publish a lower version code; merging into pawse-releases/main publishes and needs the owner's approval.

## Commands
- pnpm dev, pnpm test, pnpm typecheck, pnpm lint, pnpm simulate
- Android debug APK: pnpm --filter web build, then `npx cap sync android` and `./gradlew assembleDebug` in apps/web/android (needs ANDROID_HOME and Java 17+)
