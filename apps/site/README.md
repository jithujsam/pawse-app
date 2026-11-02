# PAWSE landing page (`apps/site`)

The public marketing page. It is a separate workspace package from the Android app (`apps/web`) and never
touches its build, its Capacitor config or the release pipeline.

- **Content** is static HTML in `index.html`, so the page is readable and indexable without JavaScript.
- **`src/main.ts`** (about 5 KB) wires the small behaviours in `src/interactions.ts`: the phone menu, the tool
  list, the questions, the pinned Missions screen and the entrances.
- **`src/islands.tsx`** loads after first paint and mounts the live pieces: the app's own 3D dog
  (`apps/web/src/Pet3D.tsx`, imported directly) and the "Try the 21 days" panel (`src/Demo.tsx`), which runs the
  real mission engine from `@detox/engine` (`journey()`, `wellness()`, `petTraits()`). `src/demo.ts` only turns
  taps into day records; `test/demo.test.ts` pins it to `docs/MISSION_FORMULA.md`.
- **Dog model:** `apps/web/public/models/dog.glb` is served in dev and copied into the build by
  `vite.config.ts`, so there is one copy in git. Credit: Quaternius, CC0 (`apps/web/public/models/LICENSE.md`).
- **Font:** Schibsted Grotesk, self-hosted (`public/fonts`, SIL OFL). The page makes no third-party requests.
- **Design notes:** `DESIGN.md` (inventory, argument, chosen Taste Skill direction, copy deck);
  `design/direction.json` (the dealt sheet); `design/inspect/` (the last Taste Skill inspection, 1440/768/390).

## Commands

    pnpm --filter site dev        # http://localhost:5180
    pnpm --filter site build      # typecheck + production build into apps/site/dist
    pnpm --filter site preview    # serve the build on :4180
    pnpm --filter site test       # the demo pinned to the mission rules

Taste Skill gate (from the repo root, against the production preview):

    node .claude/skills/design-taste-frontend/scripts/lint.mjs apps/site/index.html apps/site/src
    node .claude/skills/design-taste-frontend/scripts/inspect.mjs http://localhost:4180/ --out apps/site/design/inspect

## Deploy on Vercel

Create a project from this repository and set **Root Directory** to `apps/site` (leave "Include files outside
the root directory" on: the page imports `apps/web/src/Pet3D.tsx`, the model and `packages/engine`).
`vercel.json` sets pnpm install, `pnpm build`, `dist`, long caching for hashed assets and fonts, and a few
security headers. No environment variables are needed.

Before launch, set an absolute URL for `og:image` and add `<link rel="canonical">` once the domain is known.

## Pictures

- `public/screens/*.webp`: captured from the current app (5.0.19) running locally with sample data (three
  tracks: Miso, a rescued Shiba for late-night food orders; Juniper, a raised fox for doomscrolling; Pepper, a
  rescued husky for vaping). Network calls were blocked; no account or real data was used.
- `public/renders/*.webp`: the real dog model, rendered by the page's dev-only poster mode
  (`/?poster=hero|rescue|raise` on the dev server, screenshot with a transparent background). They show while
  the 3D dog loads, and stay when WebGL is unavailable.
- `public/og.png`: the first screen at 1200×630.

## Not wired yet

- **Checkout.** The pass buttons point at `#checkout-status`, a visible line saying checkout isn't open. When
  payments exist, set each `a[data-checkout]` `href` to its checkout URL and remove that sentence.
