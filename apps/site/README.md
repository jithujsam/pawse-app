# Pawse landing page (`apps/site`)

The public marketing page: a funnel to Founding Member (Rs 249, first 50) and the Google Play waitlist. Separate from the
Android app in `apps/web`; it never touches that build or the release pipeline.

- **Plain HTML, tiny script.** `index.html` is a template; `vite.config.ts` fills it from `src/copy.ts` (all words) and
  `site.config.ts` (all hand-edited values), so it reads in full without JavaScript. `src/interactions.ts` (about 4 KB) adds
  reveals, the hero drift, the 21-day scrubber (it imports `wellness()` from `@detox/engine`), copy-UPI and the forms.
- **No live 3D.** The dog is a still render (`public/renders/*-hd.webp`, from the app's model; Quaternius, CC0). To re-render, run
  the old poster mode from git history (`git show 7410f71:apps/site/src/islands.tsx`).
- **Fonts:** Instrument Serif (`@fontsource/instrument-serif`) and Geist (`@fontsource-variable/geist`), self-hosted.
- **Design notes:** `DESIGN.md`. **Review screenshots:** `design/screens/` (every section, desktop 1440 and mobile 375).

## Skills used

`.claude/skills/` holds the taste skill plus five UI skills installed from `npx ui-skills`: `landing-page`, `baseline-ui`, `fixing-motion-performance`, `fixing-accessibility`, `fixing-metadata`. Set `siteUrl` in `site.config.ts` before sharing the page, so the canonical, `og:url` and absolute share-image tags are emitted.

## Commands

    pnpm --filter site dev        # http://localhost:5180
    pnpm --filter site build      # typecheck + production build into apps/site/dist
    pnpm --filter site preview    # serve the build on :4180

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

- `public/screens/*.webp`: captured from the app (5.0.19) with sample data (Miso, Juniper, Pepper); untouched.
- `public/renders/*-hd.webp`: the app's dog model rendered at 3x with a transparent background; `hero-face.webp` is the crop used inside the headline. The older small renders stay for reference.
- `public/og.png`: the first screen at 1200x630.

## Founding Member offer: what you edit

All hand-edited values are in **`site.config.ts`**: price, spots total and taken, refund window, UPI ID and payee name, QR image path, the international payment link, and form endpoints. They are filled into `index.html` at build time (`{{tokens}}` and `<!--if:key-->` blocks, see `siteHtml` in `vite.config.ts`), so the page still reads without JavaScript. Change `spotsTaken` by hand after each confirmed payment.

Forms post to **`VITE_FORM_ENDPOINT`** (payment confirmation) and **`VITE_WAITLIST_ENDPOINT`** (Google Play waitlist; falls back to the first). Set them in the host's environment (Vercel project settings) or in `apps/site/.env.local` for local runs. Any service that accepts a multipart POST and answers JSON works: Formspree or Web3Forms (create a form, paste its URL). Screenshot uploads need a plan that accepts files; the payment reference field works without one. With no endpoint set, the page says plainly that the form isn't connected; nothing is faked.

The page handles no card data: payment is by UPI (QR and ID) or an external link, and the form only carries a name, an email and a payment reference.
