# ui-polish rules

Rule IDs are cited in audit reports. Values are CSS px / dp. Rules are defaults: if the project's own design system or CLAUDE.md differs on purpose, report it as optional.

## 1. Scale (tokens)
- **S1 Base grid 4px, layout grid 8px.** Allowed spacing: 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Anything else is off-grid (flag, except borders and optical nudges <= 1px). Layout rhythm (container padding, grid gaps, section stacking) uses multiples of 8; micro spacing (icon-label gaps, chip padding) uses 4-steps.
- **S2 Proximity (Gestalt).** Gap inside a group < gap between groups < gap between sections. Suggested: label->field 4-8, item->item 8-12, card->card 12-16, section->section 24-32. Label-to-its-input distance should be at most 1/2.5 of the input-to-next-label distance (e.g. 6px vs 16px). If two gaps look equal but mean different things, hierarchy is broken.
- **S3 One value per pattern.** All cards of one kind share padding, radius, gap and min-height. Same for list rows, buttons, inputs, chips, stat tiles.
- **S4 Tokens, not literals.** Spacing, radius, type, color, shadow and z-index come from variables. Count literals per file; report the worst offenders.

## 2. Containers and padding
- **P1 Screen gutter.** 16 on phones (24 tablets, 24-32 desktop); same on every screen. Fixed bars and floating buttons include safe-area insets.
- **P2 Card padding.** 16 default, 12 compact, 20-24 spacious/hero. Equal on all sides (or vertical = horizontal - 4 for dense rows). Never top != bottom unless there is a deliberate header/footer.
- **P3 Concentric radius.** inner radius = outer radius - padding (min 4).
- **P4 Content never touches an edge.** >= 12 from any container edge; icons/text >= 8 from a border. Clipped text at a tile edge usually means a reset removed padding (see P6).
- **P5 Visual padding includes line-height.** Judge by glyph bounds, not box bounds; fix with `line-height`/flex centering, not uneven padding.
- **P6 Cascade resets.** A rule like `.card .stats .stat { padding: 0 }` silently strips padding from children that carry their own background (`.item`). When a tile has a background, it needs padding; scope resets to the unstyled variant.

## 3. Alignment and centering
- **A1 Layout centers, offsets don't.** `display:flex; align-items:center` or grid `place-items`. Banned: `padding-top`/`margin-top` hacks to center.
- **A2 Multi-line blocks center as a block.** Title + subtext are ONE element: wrap in a column (gap 2-4) and center that container in the row. Never leave both stuck to the top of a taller row.
- **A3 Row anatomy.** `[leading] [text block flex:1; min-width:0] [trailing]`, all vertically centered. Exception: multi-line body text beside an avatar aligns the avatar to the first line (say so).
- **A4 Edge alignment.** One column = one left edge. No stray 2-6px indents.
- **A5 Icon + text.** Icon box = label line-height (or 1.25x font-size); gap 8 (4 for small icons). Text-only buttons get equal horizontal padding.
- **A6 Baseline.** Mixed sizes on one line (price + unit, name + badge) share a baseline.
- **A7 Numbers.** Right-align numeric columns; `font-variant-numeric: tabular-nums lining-nums` on timers, money, stats and anything that changes.
- **A8 Optical correction.** Play glyphs, arrows, circles may be nudged 1-2px with a comment. Nothing else.
- **A9 Spacer rows for centered grids.** When an element spans several auto rows (art beside a 3-line text block), extra height is spread into the text rows and the text sticks to the top. Use `grid-template-rows: minmax(0,1fr) auto auto auto minmax(0,1fr)` (spacer rows), put the text in the middle rows, give the spanning element `align-self:center`. Use `minmax(0,1fr)`, not `1fr`, or the spacers inflate the card.
- **A10 Centered controls in a header.** Adding or removing a header control must not push the subtitle onto a second line: let the subtitle span the full width (grid with the subtitle on its own row) and keep actions >= 44.
- **A11 Visual centering of imagery.** Images, avatars, illustrations and 3D models are centered by their drawn silhouette, not their box. Measure alpha bounds on a transparent render for each variant/pose/age; correct with a per-variant offset and scale about the visual center (not the feet), so size changes (baby/adult) and animation never move it off-center. Shadows sit under the visual center. Keep silhouettes 0.6-0.9 of the frame and inside it (no clipping) in every pose, including lying/hurt poses.

## 4. Sizing and touch
- **T1 Touch targets** >= 44x44 (iOS/mobile web), >= 48x48 (Android/Capacitor), including padding; the visible glyph may be smaller if the hit area is expanded (`::after` with `inset:50%` + `translate`, min 48). >= 8 between adjacent targets.
- **T2 Min row height** 48 single-line, 64-72 two-line. Height from padding + content, not fixed height (clips large text).
- **T3 Inputs/buttons** share height (44-52) and radius inside a form. Primary action is full-width on phones, or clearly the widest. On wide desktop screens cap button width (~380) instead of stretching.
- **T4 Text scaling.** Survives 130-200% font scale and 2-line wraps: `min-height`, not `height`.

## 5. Typography and hierarchy
- **H1 One focal point per screen.** The primary action or key number wins in size, weight or color.
- **H2 Type scale.** Modular: ratio ~1.2 on phones, ~1.25 on desktop. Typical: 12 caption, 14 secondary, 16 body (inputs never < 16: iOS zoom), 20 section, 24-28 screen title, 32+ hero numbers. <= 5 sizes and 2-3 weights per screen; same element, same size across layouts.
- **H3 Line-height and tracking by size.** >= 24px headings: line-height 1.1-1.2, tracking -0.02 to -0.01em. 14-16px body: 1.4-1.5, 0em. <= 12px captions/overlines: 1.3-1.4, +0.04 to +0.08em (uppercase only here).
- **H4 Contrast.** WCAG 2.2: body 4.5:1 (3:1 for >= 18px or 14px bold), UI controls/borders 3:1, placeholders 3:1, error text 4.5:1. Secondary text is lighter, not tiny: >= 12px. Check both themes. If measuring perceptual lightness, use Oklch L, not HSL L (HSL yellow and blue at the same L differ hugely).
- **H5 Line length** 45-75 chars for paragraphs; cap with `max-width`.
- **H6 Title/subtext pair.** Title 16-18/600, subtext 14/400 muted, gap 2-4; truncate (`min-width:0` + ellipsis) or allow 2 lines.
- **H7 Section headings** closer to their content (8-12) than to the previous section (24-32). No orphan heading at a screen bottom.
- **H8 Font roles.** Display/serif or decorative faces only for screen titles and large numbers (>= ~24-28px); UI sans for everything small. A decorative face next to a UI face at < 24px reads fragile and mismatched. Do not mix two fonts for headings of the same level.
- **H9 Fluid type (web).** Optional `clamp(min, base + slope*vw, max)` between 375 and 1440 viewports; never on fixed-size native-style mobile UI.

## 6. Lists, cards, grids
- **L1 Dividers or gaps, not both.** Inset to the text edge or full-bleed consistently; no divider after the last row.
- **L2 Grids.** Equal columns, equal gaps both axes, equal heights per row; odd last item left-aligned. Big dead space inside equal-height cards means the content tracks should be re-balanced, report it.
- **L3 Empty and loading states.** Empty: icon/illustration + why it's empty + one primary action to create the first item, centered both axes (24-32 gaps). Loading: skeletons match the final layout (no layout shift).
- **L4 Chips/badges** padding 4x8 to 6x12, radius full, same height in a row, equal wrap gaps.
- **L5 Two layouts, one component.** Grid and list (or card and row) views of the same thing share surface color, border, radius, active highlight, image backdrop and type sizes. Only layout (direction, columns, image size) may differ. Diff the override rules; delete any that only change look.
- **L6 Add/create tiles** are visually lighter than content (dashed or tinted, smaller glyph), never the same weight as a real item; check them at one-line and two-line titles.

## 7. Overlays, bars, depth
- **O1 Bottom sheets/modals** 16-24 padding, 16-24 top radius, drag handle 36x4 centered 8 from the top, title 16-20 under it, safe-area bottom padding, close target >= 44 aligned to the title center. Dismiss by backdrop, close button, Esc, and hardware back (Android).
- **O2 Top bars** 48-56 (+ status inset); actions >= 44, icon visually aligned to the gutter.
- **O3 Bottom nav** 56-64 (+ inset); icon 24 over label 12; equal-width items; active state doesn't shift layout.
- **O4 Fixed/sticky elements** never cover content: scroll containers get bottom padding = bar height + 16 (+ inset).
- **O5 Elevation.** Small set of layered shadows (ambient + key, low opacity), not a single heavy blur; no border + heavy shadow on one card. Z-index from a scale (base 0, elevated 10, dropdown 100, backdrop 500, modal 600, toast 1000).
- **O6 Radius set** <= 4 values (e.g. 4 / 8 / 12 / 16 + full).

## 8. Motion and performance
- **M1 Compositor only.** Animate `transform` and `opacity`. Never transition/animate `height`, `width`, `top`, `left`, `right`, `bottom`, `margin`, `padding` (layout thrash, dropped frames). Modals scale 0.95->1, drawers/sheets `translateY(100%)->0`, accordions via transform/grid-rows tricks.
- **M2 Budgets.** Micro (toggles, taps) 100-150ms; structural (sheets, menus, modals) 200-300ms with a decelerating curve; page/view crossfades 250-350ms. Nothing blocking > 400ms.
- **M3 Reduced motion.** Every animation respects `prefers-reduced-motion: reduce` (global override collapsing durations). Do not alter existing handling.
- **M4 Press feedback.** Pressable elements give instant feedback (scale .97-.99 or tint) in <= 100ms.
- **M5 Continuous animation** (pets, loaders) pauses when off-screen/hidden and respects reduced motion.

## 9. Color
- **K1 Balance ~60/30/10.** Neutral ground ~60%, structural surfaces ~30% (offset from the ground by a small lightness step), accent <= 10%. One accent hue; semantic colors: error red, warning amber, success green, never arbitrary.
- **K2 Neutral ground.** Neutrals have very low chroma. Pure `#000`/`#fff` canvases are a taste call: pure-black dark themes cause OLED smear/halation with saturated text and make elevation invisible, but are used deliberately by some systems for battery. If found, report as **optional**; never change a deliberate brand choice without asking. Elevated dark surfaces should be lighter than the ground.
- **K3 Dark mode is its own palette** (not inverted): re-check accent lightness, borders, shadows (shadows barely show in dark; use border/lightness for elevation).
- **K4 Tokenized.** Colors live in variables per theme; flag raw hex/rgb literals in components. Prefer Oklch for deriving lightness steps.
- **K5 Never color alone** for state (add icon/text/shape).

## 10. Components and states
Each interactive component needs: default, hover (pointer devices only, `@media (hover:hover)`), active/pressed, **focus-visible** (visible ring, 2px with offset; never `outline:none` without a replacement), disabled, loading (disabled + indicator), error (inline icon + text, `aria-invalid`, `aria-describedby`).
- **C1 Buttons** 40 desktop / 48 mobile height; label 14, 600; min width 80; destructive actions are red but not the default focus; secondary = ghost/outline, not low-contrast solid.
- **C2 Inputs** labels visible and linked (`for`/`id`), not placeholder-only; 16px text; padding-x 12; inline error below the field.
- **C3 Dialogs** `role="dialog"`, `aria-modal`, labelled, focus trapped and restored, Esc closes.
- **C4 Toasts** `role="status"`/`alert`, auto-dismiss pauses on hover/focus, never covers primary actions or the nav bar.
- **C5 Tables/lists** header row, row hover/selected states, empty and loading rows; numeric columns right-aligned with tabular numbers.
- **C6 Consistency.** Same thing, same look across screens; report variants as drift, fix to the dominant one.
- **C7 Icons** one family, one stroke weight, 16/20/24; decorative icons next to headings are removed unless they speed scanning.

## 11. Platform (hybrid/Capacitor/Android, mobile web)
- **X1 Safe areas.** Header, bottom nav, FABs and sticky footers use `env(safe-area-inset-*)` (via variables with a `0px` fallback). Targets Android 15+ (SDK 35+) are forced edge-to-edge: content draws under status and gesture bars unless padded. Verify with simulated insets (top 24, bottom 48): nothing important is covered or clipped.
- **X2 Inset fallback.** Some WebView versions report `0` for `env(safe-area-inset-*)` even when bars overlap. If the project targets Capacitor, check that a native fallback (StatusBar plugin info or Android window insets) exists; report it as "unverified without a device" if it can't be tested.
- **X3 Keyboard.** Focused inputs stay visible: resize mode `body`/`none` plus `scrollIntoView({block:'center'})` after the keyboard animation (~300ms); fixed headers/footers don't collapse the page; sheets with inputs move with the keyboard. Check `windowSoftInputMode` and the Keyboard plugin config.
- **X4 Hardware back / predictive back.** Back closes the topmost overlay first (alert > sheet > drawer > sub-route > tab), then navigates, and only then minimizes/exits. Flag any overlay not registered with the app's back handler.
- **X5 Orientation.** Phone-first apps lock orientation deliberately (`android:screenOrientation="portrait"` plus manifest `orientation`); layouts that are not designed for landscape must not rotate.
- **X6 Platform behaviors.** No hover-only affordances on touch; momentum scrolling and `overscroll-behavior: contain` inside sheets/modals; `100dvh` not `100vh`; no tap-highlight flash; haptics only through the project's existing bridge.
- **X7 Navigation conventions (Jakob).** Bottom nav on mobile, standard placement for search, profile and cart; don't reinvent form fields, toggles or pagination.

## 12. UX judgment (apply with the stated limits)
- **U1 Hick.** > 5 choices at once -> group, search or progressively disclose. Limit: don't split an independent linear form into a long wizard.
- **U2 Fitts.** Primary actions large and reachable (bottom third on phones). Limit: don't stretch buttons across ultra-wide desktops.
- **U3 Miller/chunking.** Group long lists/settings into labeled chunks. Limit: a scannable table may show 20 rows.
- **U4 Progressive disclosure.** Advanced options behind a labeled disclosure; defaults pre-filled so the common path is 1-2 taps (e.g. pre-pick species, make coat/breed/personality optional).
- **U5 Peak-end.** Completion moments (first check-in, milestone, export) get a clear, polished confirmation.
- **U6 Cognitive load.** Cut competing banners, decorative icons, nested borders and jargon.
- **U7 One meaning per symbol.** Two similar "+" (add item vs quick log) on one screen is a conflict: differentiate by form, position or label.

## 13. Content audit (REPORT ONLY, never edit)
Scan labels and messages and report: ambiguous buttons ("Submit", "OK", "Are you sure?") -> verb + object; errors that say what happened, why, and give a recovery action; empty states with no call to action; exclamation-mark filler; jargon. Respect the project's copy system (tones, glossary, stable ids): propose wording, don't change it.

## 14. Anti-slop (report as P2/P3)
Full-bleed decorative gradients/glows, card-inside-card, rounded gray boxes around every text block, icons beside every heading, symmetrical centered layouts for dense data, oversized shadows, 3D/illustrations taking most of the viewport. Prefer 1px dividers, tonal steps, typographic hierarchy and a restrained accent.

## Automated checks (Playwright `page.evaluate`)
For every element with background/border/radius/shadow, or any flex/grid parent with children:
1. **Centering offset:** union of child rects (text via Range rects) vs container: top gap vs bottom gap (and left/right for buttons/chips). Flag > 2px.
2. **Padding asymmetry:** top vs bottom, left vs right > 4px with no header/footer reason.
3. **Off-grid:** padding, margin, gap not in S1 (ignore 0, 1, 2); count literals vs tokens (S4).
4. **Sibling drift:** same-class siblings with different rect height/padding/gap/surface.
5. **Targets:** interactive elements (`a, button, input, select, textarea, [role=button], [tabindex]`) < 44 (48 on Android hybrid) on either axis, accounting for expanded `::after` hit areas; < 8 between neighbors.
6. **Overflow/clipping:** `scrollWidth > clientWidth`, `scrollHeight > clientHeight` with `overflow:hidden`, text cut at the container edge.
7. **Edge contact:** text/icon rects < 8 from their container edge.
8. **Fixed-bar overlap:** content intersecting fixed/sticky bars at max scroll, and with simulated insets (top 24 / bottom 48).
9. **Type:** distinct font sizes per screen (> 5 flag), inputs < 16, text < 12, same-role size drift across layouts, decorative face at < 24px.
10. **Contrast:** text and borders vs their real background (resolve transparent ancestors; normalize colors through a 1x1 canvas); WCAG ratios per H4, both themes.
11. **Motion:** scan stylesheets and inline styles for `transition`/`animation` on layout properties; confirm a `prefers-reduced-motion` override exists.
12. **Focus:** flag `outline:none`/`outline:0` without a `:focus-visible` replacement; tab through the page and compare focus order to visual order.
13. **States:** render each component in loading, empty, error and long-content states and screenshot.
14. **Imagery/3D:** per variant, transparent render -> alpha bbox; report size (w/h of frame) and center offset (dx, dy); flag > 3% off-center or any edge clipping; sample animated poses several times.
15. **Layout parity:** compare computed background, border, radius, shadow, font sizes of the same component across its layouts (L5).
16. **Header integrity:** subtitle/title wrap count before vs after adding controls (A10).

Output a table of selectors and numbers. Screenshots confirm every flagged item before it enters the report (discard false positives).

## Scoring (use before and after; the point is to rank work, not to impress)
Score only what you measured; mark the rest N/A and rescale. Pass = >= 85/100 with no critical failure.

| Area | Dimension | Pts |
|---|---|---|
| Color | WCAG contrast (H4) | 7 |
| | 60/30/10 balance, neutral ground (K1-K2) | 5 |
| | Semantic color intent (K1, K5) | 4 |
| Type | Modular scale and role adherence (H2, H8) | 6 |
| | Line length, leading, tracking (H3, H5) | 5 |
| | Tabular numbers (A7) | 4 |
| Space | 4/8 grid and tokens (S1, S4) | 7 |
| | Touch targets (T1) | 6 |
| | Alignment, centering, imagery (A*, P*) | 5 |
| Components | Interactive states (section 10) | 6 |
| | Forms and validation (C2) | 5 |
| | Empty and loading states (L3) | 5 |
| Motion | Compositor-only (M1) | 6 |
| | Duration budgets and reduced motion (M2, M3) | 4 |
| Hybrid | Safe areas (X1, X2) | 7 |
| | Keyboard (X3) | 5 |
| | Back handling (X4) | 5 |
| Cognition | Hierarchy, chunking, content (H1, U*, section 13) | 8 |

**Critical failures (score capped at 50 until fixed):** content or primary action hidden under a system bar; layout-property animation on a primary flow; Android back exits the app while an overlay is open; global `outline:none` with no replacement; text contrast < 3:1 on primary content; clipped text in a core control.

## Decision order when rules conflict
Accessibility (T1, H4, T4, focus) > Platform safe areas and back handling (X*) > Alignment (A*) > Grid scale (S1) > Aesthetics and taste calls. The project's own design system outranks every default here. Document each exception in the report.

## Known pitfalls (learned the hard way)
- A parent reset (`padding:0`) on a nested tile stripped its padding and clipped text (P6).
- A spanning image in an auto grid pushed text to the top; spacer rows with `minmax(0,1fr)` fix it (A9).
- A decorative serif at 18-22px beside a UI sans looked mismatched; reserve it for titles/big numbers (H8).
- Two layouts of one card had different backgrounds, borders and image backdrops (L5).
- Adding an icon button beside a toggle wrapped the subtitle onto two lines (A10).
- Models placed by their feet and scaled from the floor sink as they shrink; center by silhouette and scale about the center (A11).
- After shrinking type, the shortest content (one-line add tile) rearranged and exposed new gaps: always re-check short and long content (L6).
- A phone-first app without an orientation lock rotates (X5).
- Force-pushes and releases are separate approvals; never bundle them into a styling pass.
