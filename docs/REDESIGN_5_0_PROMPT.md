You are implementing the Pawse 5.0 UI redesign in the repo at /home/user/pawse-app (web app in apps/web, React 19 + Vite + Capacitor Android). This file is the complete spec. Do exactly what it says, in the order given. Do not redesign beyond it, do not add features, do not "improve" things it does not mention. When this spec and the code disagree about data or logic, the code wins (do not change behaviour). When they disagree about visuals, this spec wins.

THIS FILE IS TEMPORARY: when Phase 8 is complete and before Phase 9 (release), delete docs/REDESIGN_5_0_PROMPT.md, commit "5.0: remove redesign prompt", and push. It must not exist in the released build's commit.

======================================================================
0. HARD RULES (never break)
======================================================================
- Branch: ccr-e7e44e27-hpwv8d. Commit and push (`git push -u origin ccr-e7e44e27-hpwv8d`) at the end of every phase. Never push elsewhere. No PRs.
- RESUMING: before starting, run `git log --oneline -15` and skip every phase whose commit message (below) already exists. Continue from the first missing phase.
- Follow /home/user/pawse-app/CLAUDE.md. Never touch packages/engine. Never change recovery rules, sync schema, Supabase, AI code, guard.ts or crisis.ts.
- Only new dependencies allowed: `@fontsource/instrument-serif@5.3.0` and `@fontsource-variable/instrument-sans@5.3.0` (add to apps/web). Remove `@fontsource-variable/geist` and `@fontsource-variable/newsreader` when nothing imports them.
- New files allowed (only these): apps/web/src/scene.ts, apps/web/src/ui/PetScene.tsx, apps/web/src/ui/TopBar.tsx, apps/web/src/portrait.ts, apps/web/scripts/portraits.cjs, apps/web/public/portraits/*.png, apps/web/test/scene.test.ts.
- Do NOT: use the design-taste-frontend skill or its scripts, spawn subagents, read docs/archive or overnight/audit reports, read whole large files repeatedly (use grep + line ranges), run `playwright install`, edit apps/web/android (the version comes from apps/web/version.json), commit the `.taste-skill/` folder.
- Copy: all UI text lives in apps/web/src/text/sections/*.ts. Labels, titles, errors, safety and privacy text may be plain strings. Any new user-facing SENTENCE must use `tones(gentle, honest, brutal)`. Read docs/COPY_GLOSSARY.md once before your first copy edit. After any text change run `pnpm --filter web copy:manifest`.
- Respect prefers-color-scheme and prefers-reduced-motion everywhere.
- Checks per phase: `pnpm --filter web typecheck` then `pnpm --filter web test`. Fix failures you caused. Update tests that assert removed UI. NEVER weaken, skip or delete tests in packages/engine or safety-paths/crisis/guard/recovery tests; if one of those fails because of your change, STOP and report.
- STOP and report (do not improvise) if: a required file/function named here does not exist, a safety test fails, a phase needs a dependency not listed, or the same error survives 3 fix attempts.

======================================================================
1. DESIGN SYSTEM (exact values — use nothing else)
======================================================================
Feel: calm, premium, native Android (Apple Music / Spotify restraint). The pet and its scene are the only expressive things. No emoji, no gradients (except the scene sky), no glow, no blur/glass, no shadows on resting items, no cards inside cards, no entrance animations on screen content, no coloured icons in circles.

Decisions (fixed): one accent for every pet ("Evergreen"); the per-pet `data-pet` hues and the `data-accent` options are removed. Cat stays for existing pets but is not pickable. Rabbit/owl/panda are migrated to dog (Shiba). Logo/paw mark uses ink, not orange.

TOKENS — keep these CSS variable names in apps/web/src/styles.css, replace the values:
                light      dark
--ground        #FAFAF9    #000000
--surface       #FFFFFF    #121212
--raised        #F2F2F0    #1E1E1E
--active        #E8E8E6    #2A2A2A   (nav pill, selected row)
--line          #E7E7E4    #2A2A2A
--control       #D6D6D2    #3A3A3A   (input/switch-off borders)
--text          #111110    #F5F5F4
--muted         #5E5E5A    #A3A3A0
--accent        #1B6E66    #5FB3A6   (progress data + selected marks only)
--soft          color-mix(in srgb, var(--accent) 10%, var(--surface))
--primary       #111110    #F5F5F4   (main button fill)
--on-primary    #FFFFFF    #111110
--positive      = var(--accent)
--negative/--slip #B42318  #F0675A
--negative-soft rgba(180,35,24,.08)   rgba(240,103,90,.14)
--warning       #92400E    #E5AE44
Remove: --hero-a, --hero-b, --pet, --shadow usages on resting items, --accent-dark mechanics, all [data-pet] and [data-accent] blocks. Write the dark block ONCE as a shared rule used by both `@media (prefers-color-scheme: dark){:root:not([data-theme="light"])}` and `:root[data-theme="dark"]` (no duplicated value lists).

TYPE — fonts: `--serif: "Instrument Serif", Georgia, serif; --font: "Instrument Sans Variable", system-ui, sans-serif;` Import in main.tsx: `@fontsource/instrument-serif/400.css` and `@fontsource-variable/instrument-sans` (latin only if the package offers a latin subset import).
Roles (class names to create in styles.css and use; delete other ad-hoc font declarations):
.t-display  serif 400 40px/44px, letter-spacing -0.01em   → pet name, onboarding titles
.t-headline serif 400 30px/36px, letter-spacing -0.01em   → large screen titles (h1)
.t-title    sans 600 18px/24px                           → section headings (h2) — NEVER serif
.t-body     sans 400 16px/24px                           → body (default on body)
.t-label    sans 500 14px/20px                           → buttons, row values
.t-caption  sans 500 12px/16px                           → meta, axis, nav labels
.t-figure   sans 400 28px/32px, tabular-nums             → key numbers
Set `h1 → .t-headline`, `h2 → .t-title`, `h3 → sans 600 16px/24px` as element defaults. No other font sizes anywhere except inside the 3D/scene code.

SPACING (4px grid): screen side margin 20px (--pad: 20px); gap between sections 32px; gap inside a section 12px (--gap: 12px); card padding 20px; list row min-height 56px (one line) / 72px (two lines); touch target ≥ 48px.
SHAPE: --radius: 20px (panels/cards; sheets top corners 24px), --radius-sm: 12px (inner items, inputs), controls (buttons, chips, segmented, nav pill) fully round (999px). Surfaces separate by tone step or a 1px var(--line) border, never both, never a shadow. Shadows allowed ONLY on: open dropdown menu, toast, bottom sheet.

COMPONENTS
- .btn (primary): height 52px, radius 999, bg --primary, color --on-primary, t-label weight 600. .btn.secondary: bg --raised, color --text. .btn.text: no bg, color --text. .btn.danger: color --negative, bg --negative-soft. No filter/brightness hover. Press: `transform: scale(.98)` 120ms + a state layer `color-mix(in srgb, currentColor 8%, transparent)` via ::after.
- Chips/segmented/scale/choice selected state: 1.5px solid --text outline + --soft fill. Unselected: --raised. Segmented control is only as wide as its options (inline-grid), active segment = --surface, NO shadow.
- Switch: 52×32, off --control, on --accent, thumb white, no shadow.
- Inputs: 52px, bg --surface, 1px --control border, radius 12; focus border 1.5px --text.
- Settings rows (.srow): 56px (72 with subtitle), icon 20px in --muted, label t-body, value t-label --muted, chevron --muted. Divider 1px --line inset from text start.
- Bottom nav (.tabbar): 80px + safe area, opaque --surface, top 1px --line, NO backdrop-filter. Each tab: icon 24px over label t-caption. Active: icon sits in a 56×32 pill of --active, label --text weight 600; inactive --muted. Center "+": 48px circle, bg --primary, icon --on-primary, inline in the bar — no lift, no ring, no shadow.
- Toast: --text bg, --ground text, radius 12, shadow allowed. Sheet: --surface, top radius 24, drag handle 32×4 --control, scrim rgba(0,0,0,.5).
- Loading placeholders: flat --raised blocks at final size, no shimmer, no pulse. Delete .shimmer-line and ghost-pulse.
- Remove the app entrance animation (.app-wake/.app-in/.bar-in) and every `variants={rise}`/stagger entrance on screen sections (keep press feedback, sheet open/close, pet motion, number tick-up if it respects reduced motion).
- Icons: outline, 1.75 stroke, --muted by default; never coloured by accent except the selected nav icon (--text).

TopBar (new src/ui/TopBar.tsx): Android large top app bar. Props: title, back?: () => void, actions?: ReactNode. Renders a large title (t-headline, 20px side margin, 8px below the status-bar safe area) and a sentinel; when the large title scrolls out (IntersectionObserver), show a sticky 56px bar with the title in sans 18/600 on --ground with a 1px --line bottom border. Use it on: Pets grid, Journey, Insights, Me, and every Me subpage (replacing .subpage-top).

DAY MARKS (one system everywhere: Home strip, Journey calendar, history timeline, legends):
goal met = filled dot --accent; urge managed = 2px ring --accent; slip = filled dot --slip; not tracking/paused = 1.5px dashed ring --muted; not recorded = small 6px dot --line; today = 1.5px --text ring around the cell. Calendar cells: day number t-label in --text, mark centred under it; NO filled coloured day circles.

======================================================================
2. PHASES (do in order; one commit + push each, using the exact commit message)
======================================================================

PHASE 1 — Foundations. Commit: "5.0: design tokens, type, controls"
1. Add/remove font packages as in §0. Apply §1 tokens/type/spacing/shape/components in styles.css. Delete dead CSS in the same pass: .hero::before/::after and float/drift keyframes, .badge-3d, "warm clay finish" overrides, shimmer/ghost-pulse, the .ts-system gradient (render it as two flat divs side by side), all [data-pet]/[data-accent] rules, the duplicated dark block, the .agebar gradient, the .healthbar hatched gradient.
2. Remove emoji from every string in src/text (grep for emoji code points). Run copy:manifest.
3. Remove the code that sets `data-pet`/`data-accent` on <html> (grep `data-pet`, `dataset.pet`, `data-accent`). Keep the stored `accent` setting field untouched (ignored).
Done when: typecheck + tests pass; grep finds no `backdrop-filter`, no `linear-gradient` outside scene code, no `box-shadow` on resting classes.

PHASE 2 — 3D-only pets, remove dead features. Commit: "5.0: 3D-only pets, portraits, remove wardrobe and 2D art"
1. Species: in src/pets.ts set SPECIES to dog, cat (off: true), fox only; delete rabbit/owl/panda from SPECIES, COATS, NAMES. Change the `Species` type in src/types.ts to "dog" | "cat" | "fox". In the load normaliser (grep `normalize` in src/persist.ts) map any companion with species rabbit|owl|panda to { species: "dog", breed: "shiba", coat: "golden" }, keeping name and history. Add a test for it in apps/web/test/data.test.ts.
2. Wardrobe/accessories: delete ACCESSORIES from pets.ts, the wardrobe section in screens/Me.tsx, the accessory unlock in screens/Home.tsx (the function using `ACCESSORIES.find`), accessory drawing, and the "lists.accessories" entry in src/text/dynamic.ts. KEEP the `wear` field and `Accessory` type in types.ts/tracks.ts/syncmap.ts/store.ts (sync compatibility) — just stop using it in UI.
3. Accent picker: remove the colour section from the Appearance page in Me.tsx (keep theme). Remove ACCENT_OPTS usage in the row value.
4. Simulator row in Me.tsx: render only when `import.meta.env.DEV`.
5. Portraits: extend the dev gallery route in src/dev-gallery.tsx: `#gallery/solo3d/<species>/<mood>/<breed>/<coat>` passes breed and coat to Pet3D (breed "_" = none), and sets document.body.style.background = "transparent". Create apps/web/scripts/portraits.cjs EXACTLY:
```
const { chromium } = require('playwright');
const combos = [['dog','shiba',['golden','cocoa','cream']],['dog','husky',['grey','black','red']],['fox','_',['red','arctic','silver']],['cat','_',['tabby','ginger','tuxedo']]];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 320, height: 320 } });
  for (const [sp, breed, coats] of combos) for (const coat of coats) for (const mood of ['happy','idle','sad']) {
    await p.goto(`http://localhost:5173/#gallery/solo3d/${sp}/${mood}/${breed}/${coat}`); await p.reload(); await p.waitForTimeout(3000);
    await (await p.$('#solo')).screenshot({ path: `public/portraits/${sp}-${breed}-${coat}-${mood}.png`, omitBackground: true });
  }
  await b.close();
})();
```
Run once: start `pnpm --filter web dev --port 5173` in the background, `mkdir -p apps/web/public/portraits`, `cd apps/web && node scripts/portraits.cjs`. Open 2 of the PNGs to confirm a pet on transparency. If they are blank, STOP and report.
6. Create src/portrait.ts: `portraitSrc(species, breed?, coat?, mood)` → `portraits/${species}-${species==="dog" ? (breed ?? "shiba") : "_"}-${coat ?? first coat id}-${m}.png` where m = happy if mood is happy; sad if mood is sad|hurt|sick|dying; else idle. Create `<PetImage>` (in src/Companion.tsx) = an `<img>` of that src, circular-clipped when a `round` prop is set, sized by `size`.
7. In src/Companion.tsx replace every use of the 2D `CompanionArt` (PetPortrait `still`, all `fallback=` props, the non-3D branch of LiveCompanion) with `<PetImage>`. In screens/Me.tsx the Hall of Companions uses `<PetImage round mood="dying">`. Then DELETE CompanionArt and all 2D drawing code (accessory art, coat painting, gestures used only by 2D) from Companion.tsx, and the 2D sections of dev-gallery.tsx. Keep LiveCompanion's 3D logic, idle gestures for 3D, Waiting3D.
Done when: grep `CompanionArt` returns nothing; app builds; tests pass.

PHASE 3 — Pet screen: scene + command centre + zero-effort logging. Commit: "5.0: pet screen scene and command centre"
1. src/scene.ts (pure, no DOM): `export type SceneMood = "storm"|"overcast"|"clearing"|"clear"|"golden"; export type SceneTime = "day"|"dusk"|"night";`
   `sceneFor({ wellness, rescue, slipToday, milestoneToday, hour })`: mood = golden if milestoneToday or wellness ≥ 95; clear if ≥ 80; clearing if ≥ 60; overcast if ≥ 40; else storm. If rescue and mood is clear/golden and wellness < 95, cap at clearing. time = day for 6 ≤ hour < 17, dusk for 17 ≤ hour < 20, else night. Returns { mood, time, rain: mood==="storm" ? 24 : mood==="overcast" ? 10 : slipToday ? 12 : 0, ink: (mood is storm|overcast or time is night) ? "light" : "dark", light } where light comes from the table below (night: intensity × 0.55; dusk: intensity × 0.8).
   Table (sky top → sky bottom, ground, light colour, light intensity):
   storm    #3E4650 → #5B636B, #4A4640, #C9D3DD, 0.9
   overcast #8D969E → #B4BAC0, #6E6A5E, #E6E9EC, 1.2
   clearing #A9C3D6 → #D9E4EA, #7C8B5E, #F4F1EA, 1.4
   clear    #7FB2DA → #CFE3EF, #6F9450, #FFF8EE, 1.6
   golden   #E8B57A → #F6DDBA, #8A9A4E, #FFE2B8, 1.7
   Dusk: mix sky 35% toward #4A3A33. Night: mix sky 70% toward #0B0F14 and ground 50% toward #0B0F14. Export the resolved colours.
   Write apps/web/test/scene.test.ts covering every threshold, the rescue cap, the three times, and rain counts.
2. src/ui/PetScene.tsx: full-bleed block (no radius, extends under the status bar using env(safe-area-inset-top)), height 52svh, min 420px. Layers: sky (the ONE allowed linear-gradient, top→bottom), a ground platform (ellipse 78% width × 22% height at the bottom, ground colour, a 1-step darker 2px lower edge, no shadow), particles (rain = thin 1×14px streaks of rgba(255,255,255,.35) falling via CSS transform; clearing = 2 flat cloud shapes drifting over 60s; clear + day = 5 small grass tufts on the platform; golden = 8 slow motes; clear/golden + night = 6 fireflies instead). Max 24 particle elements. Animations transform/opacity only, paused when off-screen (IntersectionObserver) and when `document.hidden`; with reduced motion no particles move and rain is hidden. The 3D pet (existing LiveCompanion) sits centred on the platform.
3. Pet3D: add optional prop `light?: { color: string; intensity: number }`. When set, the hemisphereLight sky colour and the key directionalLight colour use `light.color`, and both intensities are multiplied by `light.intensity / 1.6`. Default behaviour unchanged when absent.
4. screens/Home.tsx (the open-track screen) new layout, top to bottom:
   a) PetScene. Overlays inside it (20px margins, below the safe area): top-left: back "All pets" (only if more than one active track), then the pet name `.t-display` and one status line t-body (reuse the existing speech/status text). Top-right, right-aligned, three readouts stacked 4px apart, each t-label with the figure in sans 600: "{wellness}% well", "Day {run} run", "Next: day {milestone}" (omit a line whose value does not exist). Text colour from the scene `ink` (dark = #111110, light = #FFFFFF). wellness = the existing `healthPct`. run and next milestone = reuse the values already computed for Journey (screens/Journey.tsx / src/progress.ts) — do not write new math.
   b) "Today" section (t-title): if nothing is logged today → primary .btn "Goal met" and secondary .btn "I slipped" side by side, then a .btn.text "Had an urge" under them. Goal met = call the same action the current Goal met button calls, then a toast with Undo (reuse the existing undo). I slipped = if the habit has any required question, open LogSheet exactly as now; otherwise log immediately with the same store call LogSheet uses on save with empty answers, then a toast "Slip logged" with actions Undo and "Add details" (opens LogSheet). Had an urge = open UrgeSheet. If already logged today → one row showing the existing logged-state copy with an "Edit" text button (reuse the existing edit/remove behaviour).
   c) 28-day strip: 28 day marks (§1 DAY MARKS) in one row, oldest left, today right, plus one 6px wellness bar under it (track --raised, fill --accent at the true ratio, round ends), caption left "{wellness}% well", right = the existing journey line text (recover/consistency/thriving).
   d) One list group (.group-body) with four .srow rows: Health (value "{wellness}%"), History, Conditions (value = count if > 0), Missions (value = the existing badge count if > 0). They open the same sheets the old vitals opened.
   e) Remove from this screen: the old .hero panel, .speech bubble, .vitals icon circles, .healthbar segments, .care-row, and the weekly summary card (it moves to Insights in phase 5). Keep the update banner (restyled as a plain .srow at the top of the list) and the paused card.
Done when: tests pass; run the screenshot check (§3) once and fix anything that overlaps or clips.

PHASE 4 — Pets grid + Log sheet. Commit: "5.0: pets grid and log sheet"
- screens/Pets.tsx: TopBar title "Pets". 2-column grid, 12px gap. Card: --surface, radius 20, padding 16, no shadow, no outline unless active (1.5px --text). Content: PetImage round 96px (still portrait — no live 3D in the grid), name t-title, habit t-caption --muted, one line: today's day mark + "{wellness}% well" t-caption. "Add a pet": same size slot, 1.5px dashed --control border, centred "+" icon and the label "Add a pet", no filled disc. Keep the grid/list toggle and all behaviour. If exactly one active track exists, the app opens straight to that pet's screen on launch (reuse the existing open-track state; don't change what's stored).
- screens/QuickSheet.tsx: title "Log today". Replace the separate "whose pet" step with a row of pet chips at the top (active pet preselected) when there is more than one track. Then three 64px rows: Goal met, I slipped, Had an urge (same behaviours as now), then "Open plan" as a .srow. Icons --muted, no colour by tone.

PHASE 5 — Journey, Insights, Plan (structure + wording). Commit: "5.0: journey, insights and plan structure"
Use these exact headings (labels, plain strings). Reorder existing sections into them; move, don't rewrite logic. Remove `motion.section` entrance variants.
- Journey (screens/Journey.tsx + Calendar.tsx): TopBar "Journey". 1) "This month" — calendar using DAY MARKS, header line "{met} of {days} days met" (days = days elapsed this month with tracking). 2) "Your runs" — one panel split into three equal columns by 1px --line: "Current run", "Best run", "Goal-met days" (t-figure over t-caption). 3) "Milestones" — next milestone first with "{n} days to go", then reached ones as a list. 4) "Notes" — the existing Reflect entries. The age-this-month chart renders only when it has ≥ 7 points; otherwise omit it.
- Insights (screens/Report.tsx + WeeklyReview.tsx): TopBar "Insights". Order: 1) "This week" (existing week verdict + the weekly summary moved from Home + AI summary) 2) "Hardest times" (existing when/risk section) 3) "Money" (only if money is tracked, as now) 4) "Patterns" 5) "Check in with yourself" (existing weekly review/check-in) 6) "Looking ahead" (existing forecast). The urges section goes inside "This week" as a figure. Charts: one colour (--accent), 3–4 faint gridlines (--line), no legend for one series, no area gradient.
- Plan (screens/Plan.tsx): sections in order: "Goal", "Why it matters", "First step", "If-then plans", "What helps", "Support", "What we've noticed". At the top, a "Finish your plan" panel listing only the missing items among Why it matters / First step / If-then plans (each a .srow that scrolls to its section); hide the panel when none are missing.

PHASE 6 — Me / Settings. Commit: "5.0: settings structure"
- TopBar "Me". Profile header: PetImage round 64px, name t-title, "{habit} · {wellness}% well" t-caption, chevron → pet profile page. Keep the safety statement where it is, restyled as plain t-label text on --raised, radius 12, padding 16, with a 20px info icon; do not change its words.
- Groups (.group-title t-caption --muted sentence case, 32px above): "Your pet": Pet profile. "Recovery": Your plan, Reminders, Check-in questions. "Experience": Voice, Appearance, Sound and haptics (the existing "feel" page). "Privacy & security": Account, App lock, Your data. "Help": How Pawse works, Updates, About. (Simulator row only in dev, last.) Same destinations as today.
- Every subpage: TopBar with back; sections as `h2.t-title` + content directly on --ground or one --surface panel; no nested cards.

PHASE 7 — Onboarding + remaining screens. Commit: "5.0: three-step onboarding and screen polish"
- screens/Onboarding.tsx: reduce to 3 steps + hatch. Step 1 "Choose your pet": species (dog, fox only), breed for dog, name prefilled with the first NAMES entry (editable). Coat = first coat, personality = "playful" (changeable later in Pet profile). Step 2 "What would you like to change?": exactly the current step 2. Step 3 "A daily nudge": the current reminders step, plus EVERYTHING the current step 9 ("One last thing") shows or requires (disclaimer, consent, safety) copied verbatim. Then the existing hatch step, rendered on a PetScene with mood "clear" (raise) or "storm" (rescue). Remove the count/triggers/why/help/voice steps; their draft fields keep their empty defaults and tone defaults to "honest". The progress chrome shows "Step n of 3". Keep draft persistence and the crisis/guard checks on typed text.
- Restyle with §1 only (no structure changes): Welcome, Lock (PinPad), Memorial (use PetScene mood "storm", time "night"), UpdateDialog, MissionsSheet, HealthSheet, LogSheet, UrgeSheet, Toasts, Tutorial. Remove emoji/coloured icon discs; titles t-headline/t-title per §1.
- Logo/paw mark: fill var(--text) instead of the accent (src/brand.ts / .logo / boot splash / public/logo-mark.svg if it hardcodes orange). Do not change the Android launcher icon files.

PHASE 8 — Copy, dead code, docs, version. Commit: "5.0.0: copy, cleanup, PRD §24"
1. Remove text ids no longer referenced (grep each id in src); run copy:manifest.
2. Dead code sweep: delete CSS classes in styles.css not referenced anywhere in src (check each with grep), unused exports (`pnpm --filter web exec tsc --noEmit --noUnusedLocals --noUnusedParameters`, and fix only real dead code), unused imports, empty files.
3. docs/PRD.md: append "## 24. Pawse 5.0 design amendment (2026-10-31)" — 8–12 bullet lines: design system (tokens, Instrument Serif/Sans, spacing), one accent, 3D-only pets + portraits + species migration, wardrobe/accent picker removed, pet scene moods, zero-effort logging, 3-step onboarding replacing §7.7, Journey/Insights/Plan/Me structures. No other PRD edits.
4. apps/web/version.json → {"name": "5.0.0", "code": 54}.
5. Run from the repo root: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm --filter web build`. All must pass.
6. Run the screenshot check (§3) and fix visible defects (overlap, clipped text, inconsistent spacing, leftover old colours). Max 2 rounds.
7. Delete docs/REDESIGN_5_0_PROMPT.md, commit "5.0: remove redesign prompt", push. (Keep this file's content in your context for Phase 9.)

PHASE 9 — Release. Follow docs/RELEASING.md exactly (read it now, not before). The signing bundle is in the env var ANDROID_RELEASE_BUNDLE. If the Android SDK cannot be set up within 2 attempts, STOP and report the blocker; never publish a debug, unsigned or differently signed APK and never invent URLs or checksums. On success publish to jithujsam/pawse-releases main per the doc (standing owner approval in CLAUDE.md), with release notes summarising this redesign in 4–6 plain lines.

======================================================================
3. SCREENSHOT CHECK (the only visual verification — use exactly this)
======================================================================
Start the dev server with a placeholder backend so a fake local session works:
`cd apps/web && VITE_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co VITE_SUPABASE_ANON_KEY=x setsid nohup pnpm dev --port 5174 > /tmp/dev5174.log 2>&1 &`
Save as /tmp/shoot.cjs and run `mkdir -p /tmp/shots && node /tmp/shoot.cjs /tmp/shots`:
```
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2]; const b = await chromium.launch();
  for (const scheme of ['light','dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: scheme, reducedMotion: 'reduce' });
    await ctx.route(/supabase\.co/, r => r.abort());
    const sess = { access_token:'x', token_type:'bearer', expires_in:2592000, expires_at: Math.floor(Date.now()/1000)+2592000, refresh_token:'r', user:{ id:'00000000-0000-0000-0000-000000000001', email:'demo@example.com', aud:'authenticated', role:'authenticated', app_metadata:{}, user_metadata:{}, created_at:'2026-01-01T00:00:00Z' } };
    await ctx.addInitScript(v => { localStorage.setItem('sb-abcdefghijklmnopqrst-auth-token', v); localStorage.setItem('pawse/tutorial-v1','1'); }, JSON.stringify(sess));
    const p = await ctx.newPage(); await p.goto('http://localhost:5174/'); await p.waitForTimeout(12000);
    await p.evaluate(async () => {
      const { actions } = await import('/src/store.ts'); const { blank } = await import('/src/persist.ts'); const { defaultTrackState } = await import('/src/tracks.ts'); const { shiftDays } = await import('/src/progress.ts'); const { today } = await import('/src/dates.ts');
      const T = today(), d = blank();
      actions.applyRemote({ ...d, settings: { ...d.settings, onboarded: true, activeHabit: 'h1', coachSeen: true },
        companions: [{ id:'c1', species:'dog', breed:'husky', name:'Scout', bornOn: shiftDays(T,-60), diedOn:null, finalAge:null, trackId:'h1', adoption:'raise' }, { id:'c2', species:'fox', name:'Ember', bornOn: shiftDays(T,-20), diedOn:null, finalAge:null, trackId:'h2', adoption:'rescue' }],
        habits: [{ id:'h1', name:'Smoking', cls:'smoking', classWeight:1.4, companionId:'c1', unit:'count', fields:[], track: defaultTrackState(shiftDays(T,-60)) }, { id:'h2', name:'Late-night scrolling', cls:'doomscrolling', classWeight:1, companionId:'c2', unit:'count', fields:[], track: defaultTrackState(shiftDays(T,-20)) }],
        cleanDays: Array.from({ length: 12 }, (_, i) => ({ habitId:'h1', day: shiftDays(T, -(12 - i)) })) });
      actions.logSlip('h2', {});
    });
    await p.waitForTimeout(3000);
    const shot = async (n) => { await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${scheme}-${n}.png` }); };
    await shot('0-pets');
    const tabs = async () => p.$$('.tab');
    const card = await p.$('.pet-card:not(.pet-card-add)'); if (card) { await card.click({ timeout: 4000 }).catch(()=>{}); await shot('1-pet'); }
    for (const [i, n] of [[1,'2-journey'],[3,'3-insights'],[4,'4-me']]) { const t = (await tabs())[i]; if (t) { await t.click({ timeout: 4000 }).catch(()=>{}); await shot(n); } }
    await ctx.close();
  }
  await b.close();
})();
```
Then combine into two contact sheets (one per theme) with Python PIL (5 images side by side, each resized to 390×844) and view ONLY the two contact sheets. Judge: consistent 20px margins, one title size per screen, section headings sans 18/600, no orange/cream left, no emoji, no shadows on cards, readable scene readouts, nothing clipped under the nav bar. If the fake session lands on onboarding or the splash, wait longer once; if it still fails, skip screenshots and say so in the report. If class names (.tab, .pet-card) changed in your redesign, update the selectors in this script accordingly.

======================================================================
4. FINAL REPORT (keep it under 25 lines)
======================================================================
Per phase: done / skipped / blocked + commit hash. Test, typecheck, lint, build results. Release result (version, APK SHA-256, pawse-releases commit) or the exact blocker. Anything in this spec you could not do and why. Do not claim checks you did not run.
