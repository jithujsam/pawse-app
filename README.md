# Companion

A behaviour tracker where every slip ages a companion and every clean day heals it. See `docs/PRD.md`; the production work is tracked in `docs/production-plan.md`.

- `packages/engine`: the pure deduction, healing and stage logic, with the pacing tests.
- `packages/schema`: Zod schemas for stored data, sync rows and AI input and output.
- `apps/web`: the Vite + React app, wrapped for Android with Capacitor (`apps/web/android`).
- `supabase`: migrations (RLS on every table) and the `ai` edge function that calls OpenRouter. See `supabase/README.md`.

An account is required. After sign-in the app works offline and syncs when it can. An optional PIN encrypts everything on the phone. You -> Test the simulation plays a life forward, one day every 2 seconds, without touching real data.

## Run
    pnpm install
    pnpm dev          # web
    pnpm test
    pnpm typecheck
    pnpm simulate     # 90-day age curves

## Android debug APK
    pnpm --filter web build
    cd apps/web && npx cap sync android
    cd android && ANDROID_HOME=/path/to/sdk ./gradlew assembleDebug
    # apps/web/android/app/build/outputs/apk/debug/app-debug.apk

## Where things live in the app
- `src/motion.ts`: the shared springs and transitions. `src/ui/`: Sheet, Toast, Controls, Coach, PinPad, AnimatedNumber.
- `src/store.ts`: in-memory state, IndexedDB persistence, encryption when a PIN is set. `src/persist.ts`: validation, salvage, migrations.
- `src/sync.ts` and `src/syncmap.ts`: offline-first sync against the normalised tables.
- `src/vault.ts`: PBKDF2 + AES-GCM app lock. `src/notify.ts`: daily reminder. `src/haptics.ts`.
