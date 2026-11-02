# Pawse landing page: design notes (v3, 2026-11-02)

The page is a sales funnel with one job: Founding Members (Rs 249, first 50) and the Google Play waitlist. It has
its own design language and does not borrow the app's cream, clay and rounded cards.

## Design brief

- **Palette:** ground `#f7f7f7`; ink (bottle green) `#0d2a1c`; one yellow `#f6e016` used as whole fields (hero stage, the offer), the pet's frame and tags; mist `#dfe9e2` and surface `#ebebeb` as tone steps; white `#ffffff` for pay panels. Light only.
- **Type:** Instrument Serif (display, 400, tracking -0.02em, leading 0.92 to 1.05) for headlines; Geist (400/500/600, leading 1.55) for text. Five steps: display, h2, h3, lead, body, plus small (15px). Nothing below 13px.
- **Spacing:** 8px base; one pair of side margins `clamp(20px, 4vw, 56px)`; max width 1360px; sections 96 to 176px apart; square corners everywhere except the phone frame.
- **Motion:** content rises 28px and fades once on entry (80ms stagger); the hero pet drifts at 8% of scroll speed; the journey runs the first eight days once when it scrolls into view, then the visitor drives it. Transform and opacity only; all off under `prefers-reduced-motion`.
- **Imagery:** the app's real screenshots, one large device frame per section; the dog re-rendered at 3x from the app's own model (`public/renders/*-hd.webp`, CC0 model by Quaternius) so it is crisp at hero size. No live 3D on the page.

## The idea (taste skill, direction "The sentence is the layout")

On this page, the pet becomes a word in the headline: "A [pet] that heals when you do", with the dog's face where the noun is. The palette was redrawn once ("Bottle ink, yellow") because the dealt "Sand and moss" read as cream, which the brief rules out; the type was chosen with the owner (Instrument Serif approved as a new dependency).

The live thing is the 21-day scrubber: the app's own `wellness()` rule from `@detox/engine` drives the number, the bar and which conditions have healed.

## Funnel (attention, interest, desire, trust, action)

1 nav (one button, always visible) / 2 hero / 3 problem and promise / 4 how it works / 5 goal progress / 6 21-day journey / 7 free vs Plus / 8 Founding Member offer and checkout / 9 data and honesty / 10 FAQ (five questions) / 11 final call to action with waitlist / 12 footer.

## Editing

- Every word: `src/copy.ts`. Prices, spots, UPI, endpoints, links, analytics flag: `site.config.ts`. See README.
- `index.html` is a template filled at build time by `vite.config.ts`.

## Claims and where they come from

Checked against `apps/web` and `supabase` in this repo; see the hand-over summary for what could not be verified.
