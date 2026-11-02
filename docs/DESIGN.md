# Pawse Design

Design system and UX principles. Companion to `docs/PRD.md` section 6 (Experience and design direction), which stays the source of truth for product intent. Tokens below mirror `apps/web/src/styles.css`; if they disagree, the CSS wins and this file needs updating.

## 1. Design intent

The companion is the product. Pawse looks warm, soft and friendly so the emotional weight comes from caring about the pet, not from a harsh interface. The visuals are kind; the words are honest.

Principles (from PRD section 3, applied to design):

1. **Companion first.** It owns Home (about the top 55 percent). Everything else supports it.
2. **Friendly face, honest words.** Rounded, warm visuals. Copy states the cost of a slip plainly.
3. **Explainable numbers.** Every number shows where it came from ("Biscuit lost 3 months").
4. **Fast to log.** A slip in under 15 seconds, a clean day in one tap.
5. **Recoverable.** Never design for shame. Damage is visible but never hopeless.
6. **Private by default.** No public or shared surface unless the user opts in.
7. **Not medical.** Estimates are labelled as illustrative.

## 2. Color

One palette. The only hue that changes is the accent, and it comes from the chosen pet (or the user's accent override). Light by day, warm charcoal by night.

### 2.1 Neutrals and text (light)

| Token | Value | Use |
|---|---|---|
| `--ground` | `#faf7f2` | App background |
| `--surface` | `#ffffff` | Cards, sheets |
| `--raised` | `#f5f0e8` | Rows, inputs, tiles on a surface |
| `--control` | `#ddd3c5` | Control tracks, borders on interaction |
| `--text` | `#24211e` | Primary text |
| `--muted` | `#675f57` | Secondary text |
| `--line` | `rgba(36,33,30,.09)` | Hairline dividers |

### 2.2 Status colors

| Token | Light | Meaning |
|---|---|---|
| `--slip` | `#d42a2a` | Harm. Used sparingly: slips and damage only |
| `--negative` / `--negative-ink` | `#b85c47` / `#a84f3b` | Soft negative (a setback, not an alarm) |
| `--positive` | `#4e8752` | Clean days, recovery |
| `--warning` | `#d99b26` | Caution; pair with `--on-warning` text |
| `--streak` | `#e8742c` | Streak flame |

Each status has a `-soft` tint for backgrounds. Red is for harm only; never decorative.

### 2.3 Accent per companion

Each pet brings a light-mode accent and a brighter `--accent-dark` that reads on charcoal.

| Pet | `--accent` | `--accent-dark` |
|---|---|---|
| Dog | `#a8632a` | `#e8a86a` |
| Cat | `#5a5fb0` | `#a9adf2` |
| Rabbit | `#ad4f78` | `#f0a3c4` |
| Fox | `#c0532a` | `#f49b70` |
| Owl | `#2c7a68` | `#7fd3bd` |
| Panda | `#4b7a37` | `#a3d68c` |
| Default (coral) | `#c45a2a` | `#e88b60` |

User accent options: coral, ocean, forest, berry, plum, slate. Surfaces derive from the accent with `color-mix` (e.g. `--hero-a`, `--soft`), so tinting stays subtle.

### 2.4 Dark mode

Designed, not inverted.

- Follows `prefers-color-scheme`; `data-theme="light|dark"` overrides.
- Ground is true black (AMOLED). Surfaces sit a few steps up (`#0c0c0e`, `#161618`, `#2a2a2e`), lightly tinted by `--accent-dark`.
- Text is near-white tinted toward the accent; `--on-accent` flips to `#101012`.
- Status colors are re-tuned lighter (`--slip` `#ff6b64`, `--positive` `#68a76d`, `--warning` `#e5ae44`).
- Chart color switches from `--accent` to `--accent-dark`.

### 2.5 Contrast

Body text and controls meet WCAG AA in both themes. Never rely on color alone for slip versus clean; pair with icon or label.

## 3. Typography

| Role | Face | Notes |
|---|---|---|
| Body and UI | Geist Variable (system sans fallback) | `--font` |
| Display headings | Geist Variable | `--display`, rounded feel through weight and spacing |
| Editorial headings | Newsreader Variable (serif) | Subpage titles, update and health headers, tutorial pages. Slight negative tracking (`-0.008em`) |
| Numbers | Tabular or mono figures | Counts, money, ages; avoid layout jitter while animating |

Rules: one display moment per screen, short line lengths, generous leading. Honor user font scaling; layouts must not clip at large text sizes.

## 4. Shape, spacing, elevation

| Token | Value |
|---|---|
| `--radius` | 24px (cards, sheets, pet cards) |
| `--radius-sm` | 16px (rows, inputs, tiles) |
| Pills and chips | 999px |
| `--gap` | 20px |
| `--pad` | 22px |
| `--section` | 24px between sections |

- **No resting shadows.** Separation comes from a 1px `--line` or a tone step between `--ground`, `--surface` and `--raised`. Shadow is reserved for things that float: sheets (`--shadow-sheet`) and menus.
- Generous spacing and rounded corners everywhere; avoid dense tables.

## 5. Components

- **Cards** (`.card`): `--surface`, 24px radius, 24px padding.
- **Items/rows** (`.item`, `.srow`): `--raised`, 16px radius, 16 by 18px padding.
- **Buttons** (`.btn`): primary uses `--accent` with `--on-accent`; text/ghost variants for low emphasis; minimum height 44px.
- **Inputs** (`.input`): 52px tall, 16px radius, `--raised` fill, 2px accent border on focus.
- **Chips and segmented controls**: pill shape, 44px minimum, 48px for the large segmented variant.
- **Quick tiles**: 60px minimum height, icon plus label.
- **Sheets**: bottom sheets for logging, urge, missions and health; `--shadow-sheet`, drag handle, focus trapped while open.
- **Health bar** (`.healthbar`): fills with the pet's state; a `danger` state pulses unless reduced motion is on.
- **Toasts, dropdowns, dialogs**: dropdown menus use the one floating shadow plus a 1px control ring.

States for every interactive element: default, pressed, focus-visible (2px `--accent` outline), disabled, loading, error.

## 6. Motion and haptics

Motion with meaning: breathing, tail wag, head tilt, slow droop. Nothing decorative.

- Easing: `--ease` = `cubic-bezier(.22,.8,.3,1)`; durations roughly 200 to 300ms for UI, longer for companion idle loops.
- Animate `transform` and `opacity` only; avoid animating layout or heavy blur.
- **`prefers-reduced-motion: reduce` must be honored** for every animation: loaders, health bar, pet scene effects (rain, snow, wind, petals), tutorial dots, accordions. Replace motion with a static state, never remove information.
- Haptics are light confirmations (log saved, mission done). Never used to punish.

## 7. The companion

- Rendered as a 3D model (`Pet3D`) with a 2D portrait fallback where WebGL is unsupported or slow.
- State is shown through posture, energy and a scene (weather, time of day), not through red warnings.
- Age and "life" read at a glance on Home: age label, life bar and one line of honest copy.
- A memorial screen exists for loss; treat it with the gentlest tone regardless of the chosen setting.

## 8. Voice and tone

Three tones, user-selected at onboarding and changeable any time:

| Tone | Character | After a slip |
|---|---|---|
| Gentle | Soft, forward-looking | "Biscuit is a little tired today. Tomorrow is a fresh start." |
| Honest (default) | Plain, factual, states the cost | "That was the third order today. Biscuit lost 4 months." |
| Brutal | Blunt, still respectful | "Look at him. You did that. Again." |

Rules:

- All three tones stay respectful. Describe the behavior and its cost; never insult the person.
- Every user-facing string exists in all three tones, except documented tone-neutral text (labels, errors, safety and privacy statements).
- UI text lives in `apps/web/src/text` with stable ids. See `docs/COPY_GLOSSARY.md`; run `pnpm --filter web copy:manifest` after changes.
- Never add calorie, weight or restriction tracking, in copy or in UI.
- AI-written text is validated and falls back to baseline copy on any failure.

## 9. Key screens

Layouts follow PRD section 7; design notes only here.

| Screen | Design emphasis |
|---|---|
| Welcome / Onboarding | One decision per step; pet choice sets the accent; tone chosen with live example lines |
| Home | Companion hero (about 55 percent), age and life bar, one honest line, then check-in buttons "I slipped" and "Clean today", then weekly summary |
| Log sheet | Under 15 seconds; large targets; typed text passes the safety guard |
| Urge sheet | Calm, low-stimulus, one next step at a time |
| Missions sheet | Small, achievable pet missions; completion is celebrated quietly |
| Journey / Calendar / Report | Charts use `--chart`; every number explainable on tap |
| Weekly review / Reflect | Reflective, never judgmental; recovery framed as real progress |
| Pets / Memorial | Pet cards on `--surface`; memorial uses the gentlest tone |
| Me / Security / Account | Settings groups on `--surface`; PIN pad with large keys; privacy statements tone-neutral |
| Lock | Minimal, shows nothing sensitive |

## 10. Safety-aware design

- A shame spiral is a design failure. Slips show cost and a recovery path together.
- Typed text goes through the single safety check in `apps/web/src/guard.ts`, on the screen and again in the store.
- Crisis surfaces (`crisis.ts`) use calm, tone-neutral wording and clear help actions.
- Estimates of age or body effect are labelled illustrative, never medical.

## 11. Accessibility

- Touch targets at least 44px (60px for primary tiles).
- Visible `:focus-visible` outlines in the accent color; logical focus order; focus trapped in sheets and returned on close.
- Respect `prefers-color-scheme` and `prefers-reduced-motion`.
- Meaningful labels for the 3D companion (`aria-label` describing state) and for icon-only buttons.
- Support OS font scaling and screen readers; status is never color-only.

## 12. Android and platform

- Capacitor shell: respect status bar and gesture-navigation safe areas; sheets clear the bottom inset.
- Theme follows the system by default; splash and boot brand animation also honor reduced motion.
- Home-screen widget art (`widget-art.tsx`) uses the same palette and radius language.
- Back gestures close sheets before navigating (`back.ts`).

## 13. Design checklist for any change

- [ ] Uses tokens, not raw hex values
- [ ] Looks right in light and dark, and with each pet accent
- [ ] Reduced-motion path exists
- [ ] Touch targets and contrast verified
- [ ] Copy exists in gentle, honest and brutal (or is documented as tone-neutral)
- [ ] No resting shadows; red used only for harm
- [ ] Checked on a narrow phone width and with large text
- [ ] Run `/pawse-ui-polish [screen]` for measured before/after screenshots
