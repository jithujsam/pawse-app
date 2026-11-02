# PAWSE landing page (`apps/site`)

The public marketing page. It is a separate workspace package from the Android app (`apps/web`) and never
touches its build, its Capacitor config or the release pipeline.

- **Content** is static HTML in `index.html`, so the page is readable and indexable without JavaScript.
- **`src/main.ts`** (a few KB) wires the small behaviours in `src/interactions.ts`: the phone menu and the
  entrances. The questions are native `<details>`.
- **`src/islands.tsx`** loads after first paint and mounts the live pieces: the app's own 3D dog
  (`apps/web/src/Pet3D.tsx`, imported directly) and the "Try the 21 days" panel (`src/Demo.tsx`), which runs the
  real mission engine from `@detox/engine` (`journey()`, `wellness()`, `petTraits()`). `src/demo.ts` only turns
  taps into day records; `test/demo.test.ts` pins it to `docs/MISSION_FORMULA.md`.
- **Dog model:** `apps/web/public/models/dog.glb` is served in dev and copied into the build by
  `vite.config.ts`, so there is one copy in git. Credit: Quaternius, CC0 (`apps/web/public/models/LICENSE.md`).
- **Look:** the app's own tokens, cards, pills, room scene and fonts (Geist and Newsreader via `@fontsource-variable`, as in `apps/web`). The page makes no third-party requests.
- **Design notes:** `DESIGN.md` (inventory, argument, the v2 direction, the brand rules allowed and why);
  `design/direction.json` (the dealt sheet); `design/inspect/` (the last Taste Skill inspection, 1440/768/390).

## Commands

    pnpm --filter site dev        # http://localhost:5180
    pnpm --filter site build      # typecheck + production build into apps/site/dist
    pnpm --filter site preview    # serve the build on :4180
    pnpm --filter site test       # the demo pinned to the mission rules

Taste Skill gate (from the repo root, against the production preview):

    node .claude/skills/design-taste-frontend/scripts/lint.mjs apps/site/index.html apps/site/src
    node .claude/skills/design-taste-frontend/scripts/inspect.mjs http://localhost:4180/ --out apps/site/design/inspect \
      --allow gradient,palette-claude,palette-terracotta,palette-cream,all-centred,micro-label,shadow,hairline,outlined-box,icon-cards

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

## Founding Member offer: what you edit

All hand-edited values are in **`site.config.ts`**: price, spots total and taken, refund window, UPI ID and payee name, QR image path, the international payment link, and form endpoints. They are filled into `index.html` at build time (`{{tokens}}` and `<!--if:key-->` blocks, see `siteHtml` in `vite.config.ts`), so the page still reads without JavaScript. Change `spotsTaken` by hand after each confirmed payment.

Forms post to **`VITE_FORM_ENDPOINT`** (payment confirmation) and **`VITE_WAITLIST_ENDPOINT`** (Google Play waitlist; falls back to the first). Set them in the host's environment (Vercel project settings) or in `apps/site/.env.local` for local runs. Any service that accepts a multipart POST and answers JSON works: Formspree or Web3Forms (create a form, paste its URL). Screenshot uploads need a plan that accepts files; the payment reference field works without one. With no endpoint set, the page says plainly that the form isn't connected; nothing is faked.

The page handles no card data: payment is by UPI (QR and ID) or an external link, and the form only carries a name, an email and a payment reference.
