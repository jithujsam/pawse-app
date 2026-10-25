# Multi-track architecture

Status: implemented on `claude/pawse-multi-track-architecture-exg1hh`, merged with `main` (Pets grid and the `progress.ts` rules layer). Local data v2, server migration 0006 (not yet applied to production). Updated 2026-10-25.

This is the data layer for several independent recovery tracks per person. It sits under PRD §5.1 ("one companion per tracked addiction, each with its own life") and PRD §20. The counting rules (day states, streaks, pauses, milestones) are in `docs/RECOVERY_RULES.md`; this document says where the data lives, how it moves, and how old data and old app versions are handled. It adds no recovery rules.

## 1. What a track is

A **track** is one behaviour a person wants to change. A track *is* a `habits` row: nothing was renamed, so sync, row level security and old backups keep working. It owns:

| Part | Where it lives | Notes |
|---|---|---|
| Name, class, class weight, unit, check-in questions | `Habit` | Unchanged. |
| Description, start date, status, pause history, archive date | `Habit.track` (`TrackState`) | |
| Plan (with the goal: stop / cut down / understand), starting pace, rest days, weekly focus, milestones celebrated, accessory, treats given, last fed, savings goal | `Habit.track` | Per track. These were global settings while there was one habit. |
| Its pet | `Habit.companionId` → `Companion` | |
| Past pets (Hall of Companions) | `Companion` with `trackId` = this track and `diedOn` set | `adopt` keeps the old companion and points the track at a new one. |
| Events: slips (+ deductions), goal-met days, urges | `entries`, `cleanDays`, `urges`, keyed by `habitId` | |
| Weekly AI summaries | `summaries[trackId][weekStart]` | |
| Progress: age, stage, streaks, days of care, milestones reached, check-in rate, money kept | Never stored | Recomputed from that track's own events (`progress.ts`, `viewCompanion`). |

### Per person, per track, per phone

| Scope | What | Why |
|---|---|---|
| **Per track** (`Habit.track`, synced in `habits.track`) | Everything in the table above | Each behaviour has its own plan, pace, history and pet. |
| **Per person** (`Settings`, synced in `profiles.settings`) | Tone, name, reminder time, currency, pet rules (`petLife`), death-scene choice, care notes, risky-hour nudge, `neglectFrom` | Deliberately shared (approved D1, D3): one voice and one set of pet rules. Classic pet rules can't be turned on while they would end **any** track's pet. |
| **Per person, not settings** | The daily journal (mood + one line) | Deliberately shared (D2): it describes the person's day. |
| **Per phone** (`Settings`, never synced) | `activeHabit` (the open track), haptics, theme, 3D, auto-lock, reminders on, coach seen | `activeHabit` is UI state, not recovery data: it is in `DEVICE_ONLY`, never pushed, and a pulled profile can't change it. |

Reminders and the risky-hour nudge follow the open track (D3).

## 2. Ownership and the single source of truth

```
Person (Settings, journal)
 └── Track = Habit row + TrackState            ← owns everything below
      ├── current Companion  (habit.companionId, companion.trackId = track)
      ├── past Companions    (companion.trackId = track, diedOn set)
      ├── entries            (entry.habitId = track)
      ├── cleanDays          (cleanDay.habitId = track)
      ├── urges              (urge.habitId = track)
      └── summaries[track]
```

- The only writable recovery state is the events plus `TrackState`. Writes go through `actions.*` in `store.ts`, and every per-track write goes through one helper (`withTrack`).
- **Reads are scoped by track.** `progress.ts` (`trackIndex`) reads one track's events, rest days, pauses and start date. `viewCompanion` counts a slip only if it belongs to the companion **and** to the companion's track, so a mis-filed slip can never age another track's pet.
- `tracks.ts` holds the pure helpers: `trackState` (complete state with defaults), `getTrack` / `listTracks`, `focusedTrackId`, `canRecord`, `checkTracks` (cross-track references), `repairTracks` (fills what older data lacks without inventing history) and `trackFromLegacy` (old settings → one track's state).
- **Start date.** `startedOn` is stored. For existing data it is set by the rule in `RECOVERY_RULES.md`: the current pet's birth or the first record, whichever is earlier. `progress.ts` starts a track at `startedOn` or its first record if that is earlier.

## 3. Schema

### Local (IndexedDB / backup file), `AppData.v = 2`

```ts
type TrackStatus = "active" | "paused" | "archived";
interface Pause { from: string; to: string | null }   // from..to (to excluded); to = null: still paused

interface TrackState {
  description: string;            // ≤ 280
  startedOn: string;
  status: TrackStatus;            // "paused" exactly when a pause is open; repaired on load
  pauses: Pause[];
  archivedOn: string | null;
  createdAt: number;
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
interface Habit { ...; track?: TrackState }        // always filled on load
interface Companion { ...; trackId?: string }      // always filled on load when an owner can be found
interface Settings { ...person and phone keys...; activeHabit: string | null }
interface AppData { v: 2; ...; summaries: Record<trackId, Record<weekStart, string>> }
```

Zod schemas (`packages/schema/src/data.ts`): `TrackStateSchema`, `AppDataSchema` (v2), `AppDataV1Schema` and `LegacySettingsSchema` (old shapes, read only to migrate). `SettingsSchema` and `TrackStateSchema` keep unknown keys (`passthrough`), so a field written by a newer app version survives this one loading and saving it (§6).

### Server (Supabase), migration `0006_tracks.sql`, additive only

| Table | Change |
|---|---|
| `habits` | `description text` (≤ 280, default `''`), `started_on date`, `status text` (`active` / `paused` / `archived`, default `active`), `track jsonb` (object, < 16 KB). `archived_at` already existed and is now written. |
| `companions` | `habit_id uuid` (the owning track), indexed. No foreign key: companions are pushed before habits, and a pet exists before its track points at it. |
| `profiles.settings` | No change. It carries a copy of the first track's settings under the old keys for older apps (§5). |
| `weekly_reports` | No change (already keyed by `habit_id, week_start`); the app now writes each track's own. |

Row level security is unchanged and covers the new columns: every policy is per row and per `user_id`, and `supabase/tests/tracks.sql` checks that another person can neither read nor change a track or a pet's owner. `companions.habit_id` isn't checked against the habit's owner (there is no foreign key); a wrong value only affects the writer's own rows.

## 4. Migration

### 4.1 On the phone, v1 → v2 (load, unlock, backup import, and a server profile with no track rows yet)

Two v1 shapes exist and both are handled: single-track data (released apps: 2.1.0 and the 3.0.0 test build), and the interim multi-track shape on `main` (per-habit `trackRest`, `pauses` and `celebratedBy` maps next to shared keys; never shipped in a build). `trackFromLegacy` gives each track what it showed before:

| Old key | Becomes |
|---|---|
| `plan`, `baseline`, `weekFocus`, `wear`, `treatsGiven`, `fedOn`, `savingsGoal` | Copied to every track (they were shown on every track). |
| `restDays` (shared) + `trackRest[id]` | That track's `restDays` (shared ones applied to every track). |
| `pauses[id]` | That track's `pauses`; `status = paused` if one is open. |
| `celebratedBy[id]`, else `celebrated` for the first habit only | That track's `celebrated`. |
| `goal` (the first habit's own words) | The first track's `description`, if it differs from the name. |
| Flat `summaries` | `summaries[firstHabit]`. |
| `activeHabit` | Kept as is (already device-only). |

Then `startedOn` is set (§2), every companion gets its owner (`trackId`: the habit pointing at it, else the habit of its slips), and the old keys leave `settings`. Every row keeps its id. On first load the original v1 data is kept once as `data.v1-backup` (not when PIN-locked, where that copy would be readable). The migration is pure, idempotent, and tested for "nothing lost": every row, id, pet, setting and streak survives. `main`'s rule tests (`progress.test.ts`) now run on migrated data.

### 4.2 Server

`0006_tracks.sql` only adds columns. Existing rows read as active tracks; a phone with this version fills `track` on its next push. Until 0006 is applied, sync retries habits and companions without the new columns (as it did for 0003 and 0005), and track state stays on the phone that set it.

### 4.3 Never losing data silently

- `normalizeWithReport` counts rows it had to leave out (invalid, or orphaned because their parent is missing). If it left out anything, or can't read the data at all (damaged, or `v` from a newer version), `boot` keeps the original under `data.unreadable.<time>` before anything is saved over it. On a PIN-locked phone the sealed blob is kept instead (`data.enc.unreadable.<time>`), so nothing readable is written.
- A backup from a newer version is refused, not half-read. A backup with damaged rows imports the good rows; the file itself is untouched.
- From the server, a malformed track state is rejected by the schema and the phone's state stands. Unknown keys are kept.

## 5. Older app versions on the same account

Released apps (2.1.0, and the 3.0.0 test build, which uses the same Supabase project) show only `habits[0]` and know nothing of tracks.

- **Their profile saves can't wipe or override track state.** They save `profiles.settings` whole and drop keys they don't know. Track state doesn't live there; it lives in `habits.track`. Their habit saves never send the track columns, and an upsert only sets the columns it sends, so those survive. New phones ignore per-track keys in a pulled profile. Tested through the sync loop in `tracksync.test.ts`.
- **They still find their settings.** New phones write the first track's settings into the profile under the old single-track keys. This copy is written only and never read back as truth. The one exception: a track that arrives with no state at all (a server without 0006, or a habit an older app created) is seeded from it with the same mapping as §4.1. The interim per-habit maps are not written: no released app reads them, and writing them would feed one track's rest days into another's seed.
- **Limits:** a plan or rest-day edit made in an older app isn't picked up by new versions (R2). An older app can log to a paused or archived track, and that record counts for that track only (R3). A v2 backup can't be imported by an older app (R4).

## 6. Forward compatibility

`SettingsSchema` and `TrackStateSchema` keep unknown keys, and `habits.track` is built from the whole state, so a field a newer app adds survives this version loading and editing it. That's the same failure older apps have with the profile, fixed for the future. Data with a newer `v` is never loaded or overwritten (§4.3).

## 7. Lifecycle and safeguards

| Action | Rule |
|---|---|
| `addTrack` (Pets grid) / `createTrack` | A habit, its state and a new pet, together. Name 1–60 characters, description ≤ 280, at most 50 tracks (the grid hides "Add" at 50). |
| `updateTrack` | Name, description, start date, starting pace, plan. A start date can't be in the future or after the first record. |
| `selectTrack` | Device-only; never changes recovery data. |
| `pauseTrack(id, from)` / `resumeTrack(id, on)` | The rules in `RECOVERY_RULES.md` (`withPause` / `withResume`). Paused days count neither way. **Records are never refused or hidden during a pause.** Past pauses are never rewritten. |
| `archiveTrack` / `unarchiveTrack` | Archive closes any open pause and makes the track read-only: `logSlip`, `markClean`, `recordUrge`, `setRest` and `pauseTrack` refuse. It leaves the Pets grid, and an archived track is never the one the screens open, even if selected. Refused for the last track that isn't archived. |
| `deleteTrack(id, confirmName)` | Only an archived track, and only when its name is typed back (case and outer spaces ignored). Removes the habit, its pets, events and summaries in one commit; sync sends a soft delete for each. Returns a snapshot for `restoreTrack` (undo). A pet another track points at is never removed. |
| Missing pieces | A track whose pet is missing is reported by `checkTracks` and skipped by the grid. An open track that disappears (deleted elsewhere) falls back to the next one. `normalize` leaves out events whose track is gone, counts them, and keeps the original (§4.3). |

## 8. Risks

- **R1 Server not migrated.** Until `0006` is applied, track state stays on the phone that set it, and a second phone sees the profile seed or defaults. No data is lost on the first phone.
- **R2 Mixed versions.** Plan or rest-day edits made in an older app aren't read by new versions.
- **R3 Older apps ignore pause and archive.** Their records stay valid and count for their track only.
- **R4 Backups.** A v2 backup can't be imported by an older app (it rejects `v: 2`), deliberately.
- **R5 Interim builds from `main`.** Never shipped. If one was used against the account, it reads the first track's rest days from the profile as shared, so it shows them on every track. Display only, in that build.
- **R6 Hard delete.** On the phone, delete is final apart from the undo snapshot. The server keeps soft-deleted rows until the account is deleted.
- **R7 Kept copies.** `data.unreadable.*` copies are kept until the person resets the app. There is no UI to see or restore them yet.

## 9. Decisions

Approved by the owner on 2026-10-25 as then implemented:

| | Decision | Behaviour |
|---|---|---|
| D1 | Pet rules | Person-level, apply to every track; classic can't be turned on if it would end any track's pet. |
| D2 | Journal | Person-level. |
| D3 | Reminders | One daily reminder and one risky-hour nudge, for the open track. |
| D5 | Last track | Archiving or deleting the last non-archived track is refused. |
| D6 | Limit | 50 tracks. |
| D7 | Shared pet | Not built; one pet belongs to one track. |
| D8 | Insights | Per track only. |
| D9 | Adding a track | Through `addTrack` / `createTrack`. The Pets grid's add sheet does this. |

**Superseded by the merged rules in `RECOVERY_RULES.md` (need the owner's confirmation):**

- **D4 Pauses and streaks.** The earlier approval said a pause ends a streak. `main`'s rules, merged before this branch, say paused, rest and unrecorded days are skipped and never break a streak. This branch follows `main`.
- **Records during a pause.** This branch first refused records on paused days. `main`'s rules say records always win over a pause. This branch now follows `main`, so a record is never lost.

## 10. Where the code is

| Piece | File |
|---|---|
| Types | `apps/web/src/types.ts` |
| Schemas | `packages/schema/src/data.ts` |
| Track helpers, legacy mapping | `apps/web/src/tracks.ts` |
| Counting rules | `apps/web/src/progress.ts` (reads track state) |
| Migration, load report | `apps/web/src/persist.ts` (`upgradeV1`, `normalizeWithReport`, `migrateIds`); `boot` / `unlockWith` in `store.ts` |
| Actions | `apps/web/src/store.ts` |
| Sync | `apps/web/src/syncmap.ts` (`remoteTrack`, `legacyProfileCopy`, track columns), `apps/web/src/sync.ts` (fallback without 0006) |
| Server | `supabase/migrations/0006_tracks.sql`, `supabase/tests/tracks.sql` |
| Tests | `apps/web/test/tracks.test.ts`, `trackboot.test.ts`, `tracksync.test.ts`, `progress.test.ts`, `packages/schema/test/schema.test.ts` |
