---
description: Audit and polish Pawse's UI (spacing, alignment, centering, type, contrast, motion, Android) with before/after screenshots. Optional argument: a screen or area, e.g. "Home list view" or "all".
---

# Pawse UI polish

Use the `ui-polish` skill (`.claude/skills/ui-polish/SKILL.md`, rules in `rules.md`). Scope: **$ARGUMENTS** (if empty, audit every reachable screen: Home grid and list, pet detail, Journey, Insights, Me, Your pet, the add-pet sheet, the pet menu sheet).

## Pawse specifics
- **Stack:** Vite + React web app wrapped by Capacitor for Android. Styles are plain CSS in `apps/web/src/styles.css` with `:root` variables (`--surface`, `--raised`, `--soft`, `--accent`, `--muted`, `--radius`, `--font`, `--display`, `--serif`). Reuse the tokens.
- **Type rule (decided):** the serif (Newsreader) is for screen titles and big numbers only. Everything small uses Geist (`--display`/`--font`).
- **Project rules still apply** (`CLAUDE.md`): no copy changes (UI text lives in `apps/web/src/text`, every line in three tones; report copy problems, don't edit them), respect `prefers-color-scheme` and `prefers-reduced-motion`, no new dependencies, never expose secrets. The black dark-mode canvas is deliberate: report it as optional only.
- **Pets:** 3D pets (`Pet3D.tsx`) are centered by measured silhouette (`FRAME`/`FRAME_LYING` tables). If you add a species, pose or stage, re-measure it on a transparent render (`#gallery/3d/<species>`) before and after.
- **Android:** orientation is locked to portrait in `AndroidManifest.xml`; target SDK >= 35 means edge-to-edge, so check safe-area insets, the keyboard and the hardware back button (`apps/web/src/back.ts`). Report what can't be verified without a device.

## How to run it locally (no live services)
1. `pnpm install --frozen-lockfile`, then `cd apps/web && pnpm dev --port 5173`.
2. The app needs a Supabase session. Do **not** create accounts or call the live project. In Playwright, inject a fake session into `localStorage` key `sb-syysftnaubbpolrmicvd-auth-token` (JWT with a far-future `exp`), and stub `**/*.supabase.co/**` with `200` and `[]` (return the user JSON for `/auth/v1/user`).
3. Seed pets in the page with the store: `const { actions } = await import('/src/store.ts')`, then `actions.finishOnboarding({...})` and `actions.createTrack({...})`. Use long names and several species (fox, cat, dog, husky) so edge cases show.
4. Capture 360x800 and 390x844, light and dark, reduced motion on; save under the scratchpad as `before/` and `after/`, and build side-by-side images.

## Deliverable
Follow the skill's workflow: discovery, capture, measure, an audit table (P1/P2/P3 with rule IDs and a score), fix, re-verify, and a short report with before/after images. Run `pnpm lint && pnpm typecheck && pnpm test` (and `pnpm --filter web copy:manifest` if copy files changed). Commit to the designated branch; do not release, publish or force-push without being asked.
