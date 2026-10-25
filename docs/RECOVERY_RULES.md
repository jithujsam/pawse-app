# Pawse recovery rules

How Pawse counts recovery. This is the definitive spec for `apps/web/src/progress.ts`, the one calculation layer behind the Pets grid, a track's screen, Calendar, Insights, the weekly review, milestones, the pet and the widget. Screens show what it returns and never work these numbers out themselves.

- Tests: `apps/web/test/progress.test.ts` (calendar and unit tests) and `apps/web/test/recovery-rules.test.ts` (one regression block per rule below).
- The PRD points here from §19.9.
- Pet lifespan months (the engine in `packages/engine`) are a separate thing. This spec only decides which days the engine sees.

## Principles

1. **Missing data is unknown.** A day with nothing recorded is never progress, never a slip, never ends a streak, and never ages the pet.
2. **Derived, never stored.** Every number is recomputed from the records each time. Adding, editing, moving or deleting a record corrects every number at once.
3. **A slip is information, not a reset.** It ends the current streak and nothing else.
4. **Each track stands alone.** A track is one habit with its own companion (PRD §7.1). Its own entries, goal-met marks, urges, start day, rest days, pauses and celebrated milestones decide its numbers. Nothing recorded on one track changes another.

## 1. Records and the track

Records are **slips** (`entries`), **goal-met marks** (`cleanDays`) and **urges** (`urges`). Each carries the local calendar day it was logged on, as a `YYYY-MM-DD` key.

A track's **start** is its start date (`track.startedOn`) or its first record, whichever is earlier. A new track's start date is its pet's birth. For data from before tracks had their own state, the migration set it to the current companion's birth or the first record, whichever is earlier. A new companion after adoption therefore doesn't erase the track's history, and a track can start on any day of a month.

## 2. Check-ins and slips

- **Slip:** a slip entry, which only exists when the person saves the slip sheet. Nothing else creates one.
- **Urge:** any urge record. It's **managed** when the outcome is `rode_it_out`.
- **"I acted on it":** stores an urge with the outcome `slipped` and then offers the slip sheet. If the sheet is closed without saving, there is no slip.
- **Check-in:** any record for the track that day, including an urge that was acted on.
- **Missed check-in:** a day that is over, on or after the start, with no check-in, and not a rest or paused day. It is unknown, never a failure. Today is never missed.

## 3. Day state

Each day has exactly one state, the first that matches:

| State | Shown as | When |
|---|---|---|
| `future` | Upcoming | after today |
| `before` | Before you started | before the track's start |
| `lapse` | Slip | at least one slip that day |
| `met` | Goal met | a goal-met mark, no slip |
| `urge` | Urge managed | a managed urge, no slip, no goal-met mark |
| `paused` | Not tracking | inside one of the track's pauses |
| `rest` | Not tracking | a rest day for this track, or a shared rest day from before tracks were separate |
| `unrecorded` | Not recorded | anything else, including a day whose only record is an urge acted on |

Records rank above "Not tracking", so a record logged during a pause or on a rest day is never hidden. A goal-met mark under a slip is kept as history: the slip wins while it exists, and deleting the last slip that day brings the goal-met day back.

## 4. Numbers

| Number | Rule |
|---|---|
| Current streak | Walk from the start to today. `met` and `urge` (successful days) add 1. A `lapse` sets it to 0. Every other day is neutral: skipped, so it neither adds nor breaks. Today with nothing yet doesn't break it. The streak counts successful days only, and `runStart` is the first successful day of the current run. |
| Best streak | The highest the current streak has reached. Derived, so a slip can't lower it, but deleting a record can correct it. |
| Days of care | Distinct days, up to today, that were goal met without a slip, plus days with a managed urge. A managed urge counts even on a day with a slip. A slip never lowers it. |
| Goal-met days | `met` days without a slip. |
| Slips / slip days | The number of slip entries / the number of distinct days with a slip. |
| Days since last slip | Calendar days from the last slip to today. Null if there has never been one. |
| Days checked in | Days with a check-in (any record), from the start to today. Records dated after today are ignored. |
| Check-in rate | Checked-in days ÷ (checked-in days + days that weren't rest or paused), since the start, counting today. |
| Quiet days | Missed check-ins in a row ending yesterday. A check-in, a rest day or a paused day ends the count. |
| Outcome days | Days with a slip or a goal-met mark. Money kept and slip pace use only these, because a day with just an urge, or nothing, could have had an unlogged slip. |
| Milestones | Days of care against 3, 7, 14, 30, 60 and 100. Only the highest new milestone is celebrated, once, and per track. A correction never takes a celebration back. A new companion on the track celebrates afresh. |
| After a setback | Days of care, best streak and milestones reached are unchanged by a slip. Only the current streak and days since the last slip move. |

### Existing users

The pre-3.1 streak counted only goal-met marks and stopped at the first past day without one. Every day it counted is also a successful day under the new rule, and the new rule only adds days and never stops at a gap. So for every possible history:

- current streak (new) ≥ current streak (old)
- best streak (new) ≥ best streak (old)
- days of care is unchanged

The regression test compares both versions over 500 random histories. Streaks go **up** for people with unrecorded gaps, rest days or urge-managed days. Someone who checked in every day sees no change.

## 5. Not tracking: rest days and pauses

- **Rest day:** one chosen day per track (`track.restDays`). It can only be set on a day with nothing recorded and no pause, and the store refuses it on a day with a slip, a goal-met mark or a managed urge. Logging a slip or marking goal met on a rest day clears it.
  - **Rest days from before tracks were separate** (the shared `settings.restDays`) applied to every track. The migration copies them into every track's own list, so clearing one on a track leaves the other tracks unchanged.
- **Pause:** `{ from, to }` per track (`track.pauses`). Days from `from` up to, but not including, `to` are paused, and `to: null` means still paused.
  - One pause can be open at a time.
  - Pausing again on the day a pause ended rejoins it.
  - A pause can't start inside or before an earlier one, so history is never rewritten.
  - Resuming on the day a pause began drops it.
- **A record during a pause** is kept, shown and counted. A pause never refuses one. An archived track is read-only and refuses new records.
- **Where it's stored:** rest days, pauses and celebrated milestones live on each track (`Habit.track`), never in the person's settings. See `docs/MULTI_TRACK_ARCHITECTURE.md`.
- Rest and paused days are neither success nor failure:
  - they never create, change or remove a record
  - they're never missed check-ins
  - they're neutral in streaks
  - they're left out of the check-in rate
  - they never age, heal or count as missed for the pet

## 6. Dates and time zones

- **Today** is the phone's local calendar day (`dates.today()`). A record takes today's key when it is made, or the day the person picked.
- **Midnight:** 23:59:59 belongs to that day and 00:00:00 to the next. The app re-renders at local midnight and whenever it returns to the foreground.
- **Time-zone changes:** a record keeps the day key it was made with and is never re-bucketed. Seen from a zone that is behind, a record can be dated "tomorrow", and it isn't counted until that day arrives.
- **Day arithmetic** (shifting days, counting between days, weeks, weekdays, month grids) runs on UTC day numbers built from the keys, so daylight saving can't add or lose a day. It doesn't depend on the phone's zone.
  - `dates.ts` uses the same helpers.
  - Calendar cells come from `monthGrid`.
  - Weekday charts come from `weekdayOf`.
- **Weeks** run Monday to Sunday.
- **Calendar months** have their real length (28–31 days), with Gregorian leap years.
- **Recovery month:** the n-th monthly anniversary of the start, on the same day of the month, moved back to the month end when that month is shorter: Jan 31 → Feb 28/29 → Mar 31. A Feb 29 start has its yearly anniversary on Feb 28 in other years.
- **Elapsed time** is whole recovery months (as years and months) plus remaining days, with the day count alongside. No 30-day month is ever assumed.
- **A slip's hour** is its own time if one was given, or the local hour it was logged at if that was on the same local day. Otherwise it has no hour.

## 7. The pet

`petDayInputs` builds the engine's day-by-day input for one companion, from its birth to today (or to its death):

- Only this companion's own slips age it.
- Only its own track's goal-met days without a slip heal it. That includes a companion that has passed away, whose track now belongs to its successor.
- Rest and paused days with nothing recorded are empty days: no ageing, no healing.
- The pet's history timeline lists this companion's own slips. After a same-day adoption, the earlier companion's slips stay in its own story.

**Missed-day damage** (PRD §5.3 v3) stays **off** (`QUIET_DAYS_AGE = false`), as PRD §19.2 requires. The code is kept. If it is switched back on, only a missed check-in counts, from `neglectFrom` on. Rest days, paused days, days with any record, today and days after a death never do.

## 8. What a day allows (`dayControls`)

| Control | Allowed when |
|---|---|
| Mark goal met | the day is within the current companion's life, not in the future, has no slip and isn't already marked |
| Remove goal met | the day's state is `met` |
| Choose not to track, or undo it | the day is within the current companion's life, has nothing recorded and isn't paused |
| Log a slip | the day is within the current companion's life and the companion is alive |
| Shown as "Not tracking" | rest or paused, with nothing recorded |

## 9. Corrections

- **Adding** a slip to a goal-met day: the day becomes a slip and the goal-met mark is kept.
- **Deleting** a slip: the day goes back to whatever else was recorded. Deleting one of several slips keeps the day a slip.
- **Editing** a slip in place (an AI adjustment, a reflection) keeps the day a slip.
- **Moving** a slip to another day (an edit synced from another device): the old day is freed and the new one becomes a slip.
- **Backdating**, or filling in a forgotten day, recomputes everything. Filling a gap can join two streak runs.
- **Records dated after today** are ignored until their day arrives.

## 10. Edge cases

- **Same day, repeated:** several slips are one slip day, but each counts as a slip. Duplicate goal-met marks are one day. Several managed urges are one day of care, but each counts as a managed urge.
- **Empty history:** a track with no records starts on its companion's birth, and its numbers are zero. An unknown track id gives zeros and allows nothing.
- **A track whose pet has passed away** keeps every number but takes no new slips.
- **A removed track:** its rows are dropped when the data is loaded, and other tracks don't change.

## Open conflicts and dependencies

These are recorded here rather than decided:

1. **Plan, goal and reasons are shared across tracks** (PRD §7.1, "still shared across tracks for now"). The weekly review's goal line therefore uses the one shared goal for every track. Per-track goals need a product decision and a data change.
2. **Rest days.** PRD §7.1 (Pets tab commit) listed "not tracking today" days as shared across tracks. The owner approved per-track rest days on 2026-10-25, and that is what's implemented, with the old shared days still applying to every track. The PRD now says per-track. The owner should confirm.
3. **Archiving a track.** The data layer has `archiveTrack` and `unarchiveTrack` (`docs/MULTI_TRACK_ARCHITECTURE.md`); an archived track is read-only and keeps its history.
4. **No pause control in the UI yet.** `pauseTrack` and `resumeTrack` exist and are tested, but nothing in the app calls them.
5. **Reminders during a pause.** Notifications still follow the track opened last, paused or not.
6. **An urge acted on with no slip logged** shows as "Not recorded" on the calendar while counting as a check-in. Whether it deserves its own label is a copy decision.
7. **Tones.** The day-state labels are one neutral wording, not three tones. That matches the existing labels, but differs from the `CLAUDE.md` rule.
8. **Mixed app versions on one account.** Per-track state is synced in `habits.track` (migration 0006), which older versions leave alone. See `docs/MULTI_TRACK_ARCHITECTURE.md` §4.3 for what older versions can and can't see.
