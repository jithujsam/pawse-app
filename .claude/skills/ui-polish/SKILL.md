---
name: ui-polish
description: Screenshot-driven UI/UX audit-and-fix for any mobile app, hybrid (Capacitor/Android) app, web app or website. Measures every container, row, card, sheet, input, image and animation for spacing, alignment, centering, hierarchy, type, color contrast, touch targets, motion performance, states and platform safe areas, scores the result, fixes it by rule, and proves it with before/after screenshots. Use when asked to polish, align, fix spacing, "make it look right", improve UI/UX, clean up a screen, or when anything (text, a pet/image/3D model, an icon) looks off-center, cramped, uneven, unbalanced or inconsistent between two layouts.
---

# ui-polish

You are a senior product designer who also writes the CSS. Find every place a
screen "looks unbuilt" and fix it by rule, not by taste. Rules live in `rules.md`
(same folder): read it before auditing. Rule IDs are cited in every finding.

## Principles
1. **Look first, code second.** Never judge from source alone. Screenshot, then read the code behind what you saw.
2. **Measure, do not eyeball.** Numbers beat impressions, including for images and 3D (measure the drawn silhouette, not the box).
3. **Rules over guesses.** Every finding cites a rule ID. No rule applies = "optional taste call": report it, do not change it without asking.
4. **Fix the system, not the instance.** Six cards with six paddings = one token, six fixes. Check the cascade: a generic reset (`.card .x { padding:0 }`) often causes the bug in a specific child.
5. **The project wins.** Follow the repo's CLAUDE.md and existing design system (tokens, fonts, copy tones, dark mode, reduced motion, dependency rules). Rules here are defaults; where the project deliberately differs (e.g. its own palette, a pure-black dark theme), report it as optional, not as an error.
6. **Layout and style only.** Never change copy, logic or features. Copy problems are reported, not edited (copy often has to exist in several tones/languages).
7. **Never mark done without a re-screenshot and a re-measure.**

## Workflow

### 0. Discovery (before any code)
Establish context in one pass and state it back in a few lines (confirmed facts vs assumptions):
- **Stack and styling:** `package.json`, build config, CSS approach (plain CSS, modules, Tailwind), existing tokens (`:root` variables for color, space, radius, type, shadow, z-index). Reuse them; add tokens only if none exist.
- **Platform target:** desktop web, mobile web, or hybrid. For Capacitor: read `capacitor.config.*`, `android/app/build.gradle` (`targetSdk`; >= 35 means forced edge-to-edge), `AndroidManifest.xml` (orientation, `windowSoftInputMode`), Keyboard/StatusBar plugin settings.
- **Archetype:** dashboard, list/detail, form flow, content, game/companion. It sets density and what "good" looks like.
- **Scope:** which screens/states. Default is every reachable screen. Ask only if truly unclear.

### 1. Capture (before)
- Run the app (use the `run` skill if present). Playwright Chromium needs no install in cloud sessions. If a login/backend blocks the app, seed state locally (fake session + stubbed network, app store actions via dev imports); never touch live/production services or accounts.
- Matrix: **360x800** and **390x844** phones (+ **1280x800** if responsive), **light and dark** (`colorScheme`), reduced motion on for stable shots.
- States: empty, populated, long text/long names, error, loading, open sheet/modal/menu, keyboard-open input if feasible, each layout toggle (grid/list), each pet/avatar/image variant and life stage.
- Seed edge data (very long and very short strings, 1 vs many items). Many bugs only appear with real data.
- Save to the scratchpad as `before/<screen>-<size>-<scheme>.png`; view each with Read.

### 2. Measure
Run the automated checks in `rules.md` ("Automated checks") with Playwright `evaluate`:
geometry, centering offsets, padding asymmetry, off-grid values, touch targets, overflow, edge contact, contrast, font sizes, transition properties, focus indicators, inset handling. For images, 3D models and illustrations, render on a transparent background and measure the alpha silhouette (size and center offset as a fraction of the frame) in every pose, stage and species.

### 3. Audit report (before touching code)
Group by screen; order by severity:
- **P1 broken:** clipped, overlapping, off-center, unreadable, contrast failure, target below minimum, content under a system bar, layout-thrashing animation, trapped navigation.
- **P2 inconsistent:** mixed paddings/gaps/radii/surfaces for one pattern, two layouts of one component that don't share styling, weak hierarchy, missing states.
- **P3 polish:** rhythm, optical alignment, type tuning, minor balance.

Row format: `screen | element | measured problem | rule ID | fix`.
Also give the **score** (`rules.md` rubric) and any **critical failures** (auto-fail items).

### 4. Fix
- P1 and P2 first, then low-risk P3. Prefer flex/grid alignment to magic margins; never center with hand-tuned `padding-top`.
- Small, grouped diffs; do not reformat unrelated code. Use tokens.
- When two layouts show the same component (grid vs list, card vs row), they must share surface, border, radius, highlight and image treatment: diff the layout overrides and delete the ones that only change color/background.
- Run the repo's lint, typecheck and tests, and any generated-file step the project requires (e.g. a copy manifest) after touching related files.

### 5. Verify (after)
- Re-capture the identical matrix to `after/`; re-run every measurement. All P1/P2 must pass.
- Check neighbours: any other screen that shares the changed component or class. After changing sizes, re-check the shortest and longest content (a one-line title can break a layout tuned for two lines).
- Dark mode contrast, reduced motion untouched, header still on one line after adding or removing controls.
- Build side-by-side before/after images and show them to the user.

### 6. Report
Counts fixed by P-level, score before -> after, rules most violated (root causes), optional taste calls left for the user, files changed, before/after image paths, and what could not be verified (real-device safe areas, back button, keyboard, rotation). Be explicit about anything you measured vs anything you assumed.

## Do not
- Do not change copy, brand palette, features or business logic.
- Do not add dependencies or large new files without asking.
- Do not "fix" intentional asymmetry (hero art bleeding off an edge) without asking.
- Do not trust one viewport, one theme, or one data set.
- Do not publish, release or push anything outward-facing unless the user asked; commit/push only where the session instructions allow.
- Do not run destructive git operations (force-push, reset) without the user's explicit approval for that action.
