# Copy glossary and text architecture

How words work in pawse. The rules below are enforced by tests (`apps/web/test/copy-catalogue.test.ts`, `copy-coverage.test.ts`, `safety-paths.test.ts`), so they can't quietly drift.

## Where the words live

| What | Where | How to change it |
|---|---|---|
| Fixed text on a screen (headings, buttons, labels, hints, toasts, accessibility labels, safety and privacy statements) | `apps/web/src/text/sections/*.ts`, one **section** per block of a screen | Edit the entry between that section's `@copy-section <id>` and `@copy-section-end <id>` markers, then run `pnpm --filter web copy:manifest` |
| A line that depends on the Voice (Gentle, Honest, Direct) | A `tones(gentle, honest, brutal)` entry in the same files, shown with `tt(id, tone, vars)` | All three versions are required |
| A line code builds from numbers or the person's records | The function named in the inspector (`src/copy.ts`, `src/recovery.ts`, `src/health.ts`) | Edit the function; the inspector's *generated* group shows what it renders |
| What the pet says | `src/voice.ts` `PET_LINES` (4 personalities × 3 Voices) | Edit the table |
| Lists of choices | The array named in the inspector | Edit the array |

Every entry has a stable id, `screen.section.key` (for example `onboarding.pet.title`). Ids are never reused for different copy. Screens show text with `t("id", { name })`; the types make a wrong id or a missing placeholder a compile error, and `{app}` is always the product name from `src/brand.ts`.

**Inspector.** In a dev build open `/#copy`. It lists every section, entry, Voice version, generated line and list, with the file and line range to edit. It is read-only and does nothing to the source.

**Manifest.** `apps/web/src/text/manifest.generated.json` is generated from the catalogue and the markers. A test fails when it is out of date; regenerate it with `pnpm --filter web copy:manifest`.

**Tone-neutral on purpose.** Labels, validation and error messages, safety instructions, privacy statements and factual status text are plain entries: a Voice would make them less clear or less accurate. Everything the pet or the app *says to the person about how they are doing* has all three Voices.

## Vocabulary

| Say | Not | Notes |
|---|---|---|
| **pet** | companion | The creature. "Your pet", "Hall of Pets", "Choose your pet". "Companion" stays in code. |
| **track** / **recovery track** | habit, addiction | The behaviour a pet looks after. |
| **slip** | lapse, relapse, fail | |
| **goal met** / **goal-met day** | clean day | Labels, stats, statuses. "Good day" is fine in a pet's own words, never as a stat label. |
| **days of care** | | Goal-met days plus managed urges. They never reset. |
| **urge managed** | rode out, ridden out | |
| **heavy day** | binge day | Three or more slips in a day. |
| **lasting mark** | scar | Permanent damage under Classic rules. |
| **Voice** (Gentle, Honest, **Direct**) | Tone, Brutal | `brutal` is the stored id for Direct and never shows on screen. |
| **Home**, **Journey**, **Insights**, **Me** | Pets, Calendar, You | The four tabs, as the PRD names them (section 7); each screen heading matches its tab. "Me → Your plan" style references use these names. The month grid on Journey is still a calendar. |
| **Skip for now** | Skip the plan for now | For optional steps. **Not now** declines an offer or permission. **Skip** is for short tours. |

## Style

- **UK spelling** throughout: counsellor, behaviour, favourite, colour, grey, judgement.
- **Straight** quotes and apostrophes only; the ellipsis is the single character `…`.
- Sentence case for buttons and headings; no full stop on a label or button, a full stop on a sentence.
- Say numbers with `plural()`, `monthsText()` and `money()` from `src/format.ts`: "1 month", "2.5 months", "₹500", "AED 500".
- The product name is written `{app}` in the catalogue; it is lowercase by design ("pawse").
- A message may be warm, funny or blunt. It may not shame, scold, withhold care, or make the pet's welfare depend on the person's behaviour.

## The pet

The pet is hurt by a slip's cost and helped by goal-met days. That is the game. It is never **disgusted by, disappointed in, or withholding from** the person: it doesn't refuse food, doesn't say care must be earned, and a hard day doesn't make the person less welcome. The pet has no feeding, "strike" or treat dialogue. Pet conditions describe how the pet feels (run down, quiet), not that it won't eat.

## Safety

One check (`src/guard.ts`) decides, and the screens and the store both apply it.

- **Crisis language** in *any* field: the crisis message and nothing is saved (PRD §15).
- **Food, calories, weight and restricting** in anything that names or defines what is tracked: a track's name, what it counts, a custom question or its answers, a typed answer ("Type your own"), a plan item, a pet's name. Notes, reflections and the journal are checked for crisis language only.
- The store refuses unsafe text even if a screen forgets to check. Backups and rows from another phone are scrubbed of questions that would track food or weight.

## Privacy statements

Each claim has to match what the code does. Verified 2026-10-26:

| Statement | Verified against |
|---|---|
| Photos stay on this phone | `syncmap.ts stripPhotos` removes them before upload; `ai.ts`/`store.ts slipRequest` never include them. A backup file you export does include them. |
| Everything else is saved to your account, private to it | Supabase tables with row-level security on every table (`supabase/migrations`), `allowBackup="false"` on Android. |
| No ads or analytics | No analytics or ad package in `apps/web/package.json` or the source. |
| What goes to the AI | `store.ts slipRequest` (pet name, kind of habit, amount, picked answers, short notes) and `weekRequestFor` (counts, hardest weekday, age, currency). Sent through `supabase/functions/ai`, which asks OpenRouter not to collect data and caches only the reply, keyed by a hash. |
| **Not verifiable from this repo** | What the AI provider does with the text on its side. The copy says so. |
| There is no switch to turn AI wording off | True today; signing out stops it. |
