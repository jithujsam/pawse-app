# Multi-track architecture

Status: implemented (local data v2, server migration 0006). Written 2026-10-25 before the code, then updated to match it. It sits under PRD §5.1 ("one companion per tracked addiction, each with its own life") and §8 P0 ("create, edit and delete addictions"). It adds no recovery rules. The open decisions at the end are for the next prompt.

The Pets grid (the main screen redesign) is being built in a parallel session. This document covers only the data layer and the store API the grid can use. It does not change any layout.

## 1. What a track is

A **track** is one behaviour a person wants to change. It owns:

| Part | Where it lives | Notes |
|---|---|---|
| Identity: name, class, class weight, unit, check-in questions | `Habit` row (`habits` table) | Unchanged. A track *is* a habit row; nothing is renamed, so sync, RLS and old backups keep working. |
| Description, start date, status, pause history, archive date | `Habit.track` (`TrackState`) | New. |
| Per-track settings: starting pace (baseline), recovery plan (with the goal: stop / cut down / understand), rest days, weekly focus, celebrated milestones, accessory worn, treats given, last fed, savings goal | `Habit.track` | Moved here from global `Settings`. These were global only because there was one habit. |
| Its pet (current companion) | `Habit.companionId` → `Companion` | Unchanged. A companion now also records which track it belongs to (`Companion.trackId`). |
| Past pets (Hall of Companions) | `Companion` rows with `trackId` = this track and `diedOn` set | Rebirth (`adopt`) keeps the old companion and points the track at a new one, as before. |
| Event history: slips (+ deductions), goal-met days, urges | `entries`, `cleanDays`, `urges`, all keyed by `habitId` | Unchanged shape. |
| Weekly AI summaries | `summaries[trackId][weekStart]` | Was keyed by week only and pushed against `habits[0]`. |
| Progress: visible age, stage, streaks, care days, money kept | Never stored | Always recomputed from the event history of that track (PRD §9 rule). |

The **person** (global `Settings`) keeps only what is about them or this phone: tone, name, reminder time, currency, death-scene preference, pet rules (`petLife`), haptics, theme, accent, 3D, auto-lock, reminders, risk nudge, care notes, coach seen, onboarded, `neglectFrom`. The daily journal (mood + one line) also stays person-level: it describes the person's day, not one behaviour. See open decision D2.

`Settings.focusTrackId` (new, device-only, never synced) says which track the single-pet screens show. It is UI state, not recovery state.

## 2. Data ownership and the single source of truth

```
Person (Settings, journal)
 └── Track = Habit row + TrackState            ← owns everything below
      ├── current Companion  (habit.companionId, companion.trackId = track)
      ├── past Companions    (companion.trackId = track, diedOn set)
      ├── entries            (entry.habitId = track, entry.companionId ∈ track's companions)
      ├── cleanDays          (cleanDay.habitId = track)
      ├── urges              (urge.habitId = track)
      └── summaries[track]
```

- The only writable copy of recovery state is the event history (entries, clean days, urges) plus `TrackState`. Everything else is derived.
- Every read that computes progress is scoped by track id. `viewCompanion` now filters slips by **both** the companion and the companion's track, so a companion id that somehow ended up on another track's slip can never age the wrong pet.
- Writes go through `actions.*` in `apps/web/src/store.ts`. Pure track helpers (selectors, state defaults, pause checks, the integrity check) live in `apps/web/src/tracks.ts` and do no I/O.
- `checkTracks(d)` reports any cross-track reference (a slip whose companion belongs to another track, a companion claimed by two tracks, a track pointing at a missing companion). `normalize` repairs what it safely can on load and never drops a valid event.

## 3. Schema

### Local (IndexedDB / backup file), `AppData.v = 2`

```ts
type TrackStatus = "active" | "paused" | "archived";
interface Pause { from: string; to: string | null }   // to = null: still paused. Days are YYYY-MM-DD.

interface TrackState {
  description: string;            // ≤ 280, the person's own words
  startedOn: string;              // day the track began
  status: TrackStatus;
  pauses: Pause[];                // full history, oldest first; at most one open
  archivedOn: string | null;
  createdAt: number;              // ms, for stable ordering
  baseline: Baseline | null;
  plan: RecoveryPlan | null;      // plan.goal is the track's goal
  restDays: string[];
  weekFocus: WeekFocus[];
  celebrated: number[];
  wear: Accessory | null;
  treatsGiven: number;
  fedOn: string | null;
  savingsGoal: SavingsGoal | null;
}

interface Habit { ...unchanged; track?: TrackState }    // always filled on load; optional only for in-memory callers
interface Companion { ...unchanged; trackId?: string }   // filled on load
interface AppData { v: 2; ...; summaries: Record<trackId, Record<weekStart, string>> }
```

`Habit.track` is optional in the type so that code (and tests) that build a habit by hand keep working; `trackState(d, id)` always returns a complete state with defaults. The loader always writes a full `track`, so stored data is complete.

Zod schemas in `packages/schema/src/data.ts`: `TrackStateSchema`, `AppDataSchema` (v2), and `AppDataV1Schema` (the old shape, used only to read and migrate old data).

### Server (Supabase), migration `0006_tracks.sql`, additive only

| Table | Change |
|---|---|
| `habits` | `description text` (≤ 280), `started_on date`, `status text` (`active` / `paused` / `archived`, default `active`), `track jsonb` (the per-track settings and pause history, object, < 16 KB). `archived_at` already exists and is now written. |
| `companions` | `habit_id uuid null` (the owning track). No foreign key: companions are pushed before habits, and a companion is created before its track points at it. RLS already restricts rows to the owner. |
| `profiles.settings` | No schema change. New phones stop writing per-track keys as the source of truth (see §4.3 for the compatibility copy). |
| `weekly_reports` | No change. It was already keyed by `(habit_id, week_start)`; the app now writes the right habit instead of `habits[0]`. |

Delete stays soft (`deleted_at`) so deletions reach other phones; the existing cascade on account deletion is untouched.

## 4. Migration strategy

### 4.1 Local v1 → v2 (runs on load, on unlock and on backup import)

1. Parse with the v1 schema (or salvage row by row, as today).
2. Pick the **primary track**: `habits[0]`, the one the app showed. It inherits every per-track setting that used to be global: `baseline`, `plan`, `restDays`, `weekFocus`, `celebrated`, `wear`, `treatsGiven`, `fedOn`, `savingsGoal`, and `settings.goal` as its description when that differs from its name.
3. Any other habits (possible only through sync from another phone) get default per-track settings. Nothing is copied to them, so nothing is counted twice.
4. `startedOn` = the earliest of: the bornOn of every companion the track has had, and the first day of any of its events. Nothing is backdated past the data.
5. `status = "active"`, no pauses, `archivedOn = null`.
6. Every companion gets `trackId`: the habit whose `companionId` is it, otherwise the habit of the slips that reference it. A companion with neither is kept as is (it was already shown in the Hall).
7. Flat `summaries` move to `summaries[primaryTrack.id]`.
8. The per-track keys are removed from `settings`. Before the first v2 write, the raw v1 copy is kept once in IndexedDB as `data.v1-backup` (not when a PIN protects the data, since that copy would be readable).

The migration is pure (`migrateV1(raw) → AppData`), idempotent (v2 input passes through), and tested for the "nothing lost" property: every entry, clean day, urge, journal entry, companion and summary survives with the same ids.

### 4.2 Server

`0006_tracks.sql` only adds nullable columns or columns with defaults. Old rows read as active tracks with empty per-track settings. When a phone with new code first syncs, its migrated tracks are pushed with their `track` column filled.

A server without 0006 keeps working: when an upsert fails on the new columns, sync retries without them (the same pattern as 0003 and 0005). Track state then stays only on that phone until the migration runs.

### 4.3 Mixed app versions

- **New phone, old phone, same account.** The new phone also writes the **primary track's** per-track settings into `profiles.settings` under the old keys, as a copy for old app versions to read. The copy is made only when pushing and is never read back as truth, so local data still has one source.
- When a new phone pulls a profile that still has the old keys, it ignores them. Plan edits made on an old version therefore don't reach new versions (risk R2).
- Old versions show only `habits[0]` and its pet. They don't know about pause or archive, so they can log to a paused track (risk R3).

### 4.4 Keeping the app working during the migration

- `activeCompanion` / `useActiveView` now follow the focused track (`focusTrackId`, else the first active track, else the first paused one, else the first archived one). With one track this is exactly `habits[0]`, so every current screen behaves as before.
- Existing actions that had no track argument (`savePlan`, `addIfThen`, `setWeekFocus`, `celebrate`, `resetCelebrations`, `setSummary`) take an optional track id and default to the focused track.
- The current screens change only where they read a per-track setting from `data.settings`; they now read `trackState(data, habit.id)` (or `useActiveTrack()`). No layout changes.
- Three reads that would have mixed tracks once there are several are now scoped: the Pet page's Hall shows that track's past companions; Insights' "enough data" check counts that track's goal-met days; and turning on classic pet rules is refused if it would end **any** track's companion, not only the one on screen (the rules are person-level).

## 5. Lifecycle and safeguards

| Action | Rule |
|---|---|
| `createTrack` | Makes a habit, its state and a new companion together. Name 1–60 characters, description ≤ 280. Limited by the existing schema cap (50 habits). |
| `updateTrack` | Name, description, start date, baseline, plan. A start date can't be in the future or after the track's first recorded event, so no history falls outside the track. Class, unit and questions keep their existing actions (`updateHabitFields`, `refreshQuestions`). |
| `pauseTrack` / `resumeTrack` | Opens and closes a pause interval. While a day is inside a pause, slips, goal-met marks, urges and rest days for that day are refused (the actions return `null` / `false`). Days before the pause can still be filled in. Paused days show as "Not tracking", which already changes nothing (PRD §19.2). Progress is not frozen or changed. |
| `archiveTrack` / `unarchiveTrack` | Archive closes any open pause and makes the track read-only. Its history and pet stay and still count in lifetime totals. Unarchive makes it active again. |
| `deleteTrack(id, confirmName)` | Allowed only for an **archived** track, and only when `confirmName` matches its name (case and outer spaces ignored). Removes the habit, its companions, slips, clean days, urges and summaries in one commit; sync turns each into a tombstone. Returns a `TrackBackup` that `restoreTrack` can put back (undo). |
| Last track | Archiving or deleting the last non-archived track is refused, because the current screens assume one pet exists. The empty state belongs to the Pets grid prompt (D5). |
| `focusTrack` | Device-only; never changes recovery data. |

## 6. Risks

- **R1 Server not migrated.** Track state stays on one phone until `0006` is applied, so a second phone sees defaults. No data loss on the first phone.
- **R2 Mixed versions.** Plan or rest-day edits made on an old app version aren't read by new versions.
- **R3 Old versions ignore pause and archive.** They can log to a paused or archived track. The data stays valid and counts toward that track only.
- **R4 Backups.** A v2 backup can't be imported by an older app version (it rejects `v: 2`). That's deliberate: importing it would silently lose the per-track settings.
- **R5 Merge with the Pets grid branch.** The edits to `Home.tsx` here are mechanical: `data.settings.{restDays, plan, weekFocus, celebrated, wear, petLife}` become `track.*` from `useActiveTrack()`, and `petLife` is unchanged. Re-apply them on the redesigned screen if it conflicts.
- **R6 Hard delete.** On the phone, delete is final apart from the returned undo snapshot. The server keeps soft-deleted rows until the account is deleted.

## 7. Decisions (approved by the owner, 2026-10-25)

Each was approved as currently implemented. Changing any of them later is a product decision, not a refactor.

| | Decision | Approved behaviour |
|---|---|---|
| D1 | Pet rules | `petLife` (continuity / classic) and `deathScene` are person-level and apply to every track. Classic can't be switched on while it would end any track's companion. |
| D2 | Journal | The daily reflection is person-level, not tied to a track. |
| D3 | Reminders | One daily reminder and one risky-hour nudge, for the focused track only. No per-track reminders. |
| D4 | Pauses and streaks | A paused day is an unrecorded day: a "goal met in a row" streak ends at a pause, as at any gap. No streak bridging. |
| D5 | Empty state | Archiving or deleting the last non-archived track stays refused, so there is always one open track. |
| D6 | Track limit | No product cap below the schema's 50 tracks. |
| D7 | Household companion | Not built. One companion belongs to exactly one track. |
| D8 | Cross-track insights | None. Every insight is per track. |
| D9 | Adding a second track | `createTrack` is the data path. The flow and screens belong to the next UI prompt and must use it. |

## 8. Where the code is

| Piece | File |
|---|---|
| Types | `apps/web/src/types.ts` (`TrackState`, `TrackStatus`, `Pause`; `Habit.track`, `Companion.trackId`, `Settings.focusTrackId`) |
| Schemas | `packages/schema/src/data.ts` (`TrackStateSchema`, `AppDataSchema` v2, `AppDataV1Schema`, `LegacySettingsSchema`) |
| Selectors, defaults, pause check, integrity check, repair | `apps/web/src/tracks.ts` |
| v1 → v2 migration | `apps/web/src/persist.ts` (`upgradeV1`, `normalize`, `migrateIds`) and `boot()` in `store.ts` (one-time `data.v1-backup`) |
| Actions | `apps/web/src/store.ts` (`createTrack`, `updateTrack`, `pauseTrack`, `resumeTrack`, `archiveTrack`, `unarchiveTrack`, `deleteTrack`, `restoreTrack`, `focusTrack`, `setTrackSettings`, `useActiveTrack`) |
| Sync mapping | `apps/web/src/syncmap.ts` (track columns, legacy profile copy, `w:<track>:<week>` keys), `apps/web/src/sync.ts` (fallback without 0006) |
| Server | `supabase/migrations/0006_tracks.sql`, checks in `supabase/tests/tracks.sql` |
| Tests | `apps/web/test/tracks.test.ts` (migration, isolation, lifecycle, sync mapping), `trackboot.test.ts` (on-device upgrade and v1 backup), `tracksync.test.ts` (through the sync loop, with and without 0006), `packages/schema/test/schema.test.ts` |

For the Pets grid: `listTracks(data, ["active", "paused"])` gives each track with its companion and state; `viewCompanion(data, track.companion.id)` gives its age and stage; `actions.focusTrack(id)` makes the existing single-pet screens show that track.
