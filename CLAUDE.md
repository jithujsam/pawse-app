# Detox Companion

docs/PRD.md is the source of truth, but it is large (~42 KB). Do not read it whole: `grep -n '^#' docs/PRD.md` for the outline, then read only the sections the task touches (engine: 5.3; copy/safety: 22; AI: 10). Skip docs/PAWSE_*.md audit/log/report files unless the task names them.

## Rules
- The damage engine lives only in packages/engine and stays pure TypeScript with no I/O.
- Every change to engine math needs a test that pins the pacing table in PRD section 5.3.
- AI output must be validated with Zod schemas and must fall back to the baseline on any failure.
- Never expose the Anthropic API key to the client.
- Never add calorie, weight or restriction tracking.
- All user-facing copy must exist in all three tones (gentle, honest, brutal), except documented tone-neutral text (labels, errors, safety and privacy statements). UI text lives in `apps/web/src/text` with stable ids; see docs/COPY_GLOSSARY.md, and run `pnpm --filter web copy:manifest` after changing it.
- Typed text goes through the one safety check in `apps/web/src/guard.ts`, on the screen and again in the store.
- Respect prefers-color-scheme and prefers-reduced-motion.
- Ask before adding a new dependency or creating large new files.

## Releases
- Every release must update the distribution repo `jithujsam/pawse-releases` (APK, latest.json, README notes, SHA-256) by following docs/RELEASING.md. Only verified, signed release builds; never invent URLs or checksums; never publish a lower version code. Owner's standing approval (2026-10-25, sole user): publish every verified, signed release APK to pawse-releases/main as soon as it is compiled, no PR or extra approval; never a debug or unsigned build.

## Commands
- pnpm dev, pnpm test, pnpm typecheck, pnpm lint, pnpm simulate
- Android debug APK: pnpm --filter web build, then `npx cap sync android` and `./gradlew assembleDebug` in apps/web/android (needs ANDROID_HOME and Java 17+)
