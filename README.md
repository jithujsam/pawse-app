# Detox Companion

A behaviour tracker where every slip ages a companion and every clean day heals it. See `docs/PRD.md`.

- `packages/engine`: the pure deduction, healing and stage logic, with the pacing tests.
- `apps/web`: the Vite + React app, wrapped for Android with Capacitor (`apps/web/android`).

Phase 0 and 1 of the PRD are built: local-first, no accounts, no AI yet.

## Run
    pnpm install
    pnpm dev          # web
    pnpm test
    pnpm simulate     # 90-day age curves

## Android debug APK
    pnpm --filter web build
    cd apps/web && npx cap sync android
    cd android && ANDROID_HOME=/path/to/sdk ./gradlew assembleDebug
    # apps/web/android/app/build/outputs/apk/debug/app-debug.apk
