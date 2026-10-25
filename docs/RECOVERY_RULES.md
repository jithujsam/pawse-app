# Pawse recovery rules

How Pawse counts recovery. This is the spec for `apps/web/src/progress.ts`, the one calculation layer that Home, Calendar, Insights, the weekly review, milestones and the widget all read. Screens don't recompute these numbers themselves. The tests are in `apps/web/test/progress.test.ts`.

Pet lifespan months (`Entry.months`, the engine in `packages/engine`) are a separate thing and aren't covered here.

## Principles

1. **Missing data is unknown.** A day with nothing recorded never counts as progress, never as a slip, and never ends a streak.
2. **Derived, never stored.** Every number is recomputed from the records. Editing, backdating or deleting a record corrects every number at once.
3. **A slip is information, not a reset.** It ends the current streak and nothing else.
4. **Each track stands alone.** A track is one habit. Every rule below applies per track, and nothing on one track changes another.

## Records and day states

Records are slips (`entries`), goal-met marks (`cleanDays`) and urges (`urges`). Each is stored under the local calendar day (`YYYY-MM-DD`) it was logged on.

A track's **start** is its start date (`track.startedOn`) or its first record, whichever is earlier. A new track's start date is its pet's birth. For data from before tracks had their own state, it was set on migration to the current companion's birth or the first record, whichever is earlier. That way a new companion after adoption doesn't erase the track's history, and a track can start on any day of a month.

Every day has exactly one state. The first rule that matches wins:

| State | When |
|---|---|
| `future` | after today |
| `before` | before the track's start |
| `lapse` (slip) | at least one slip logged that day |
| `met` (goal met) | marked goal met, no slip |
| `urge` (urge managed) | at least one urge ridden out (`rode_it_out`), no slip, not marked goal met |
| `paused` | inside one of the track's pauses |
| `rest` (not tracking) | a rest day for this track |
| `unrecorded` | none of the above |

Recorded states sit above `paused` and `rest`, so a record is never hidden.

- **Urge:** any urge record. It's **managed** when its outcome is `rode_it_out`. An urge that was acted on doesn't create a slip; only a logged slip is a slip.
- **Missed check-in:** a past `unrecorded` day. Today is never missed because it isn't over yet. Rest and paused days are never missed.

## Numbers

| Number | Rule |
|---|---|
| Current streak | Walk from the start to today. `met` and `urge` days add 1, a `lapse` sets it back to 0, and every other state is skipped (neither adds nor breaks). Today with nothing recorded yet doesn't break it. |
| Best streak | The highest the current streak has ever reached. It isn't stored, so a slip can't lower it, but deleting a record can correct it. |
| Days of care | Distinct days, up to today, that were goal met without a slip, plus days with a managed urge. A managed urge counts even on a day with a slip. It only grows. |
| Goal-met days | `met` days without a slip. |
| Slips | The number of slip entries. Slip days counts the distinct days with a slip. |
| Days since last slip | Calendar days from the last slip to today. Null if there has never been a slip. |
| Check-in rate | Recorded days ÷ (recorded + unrecorded days) since the start, counting today. Rest and paused days are left out. |
| Quiet days | Consecutive `unrecorded` days ending yesterday. A rest day, a paused day or any record ends the count. |
| Milestones | Days of care against `MILESTONES` (3, 7, 14, 30, 60, 100). When a milestone is crossed, only the highest new one is celebrated, once. Celebrated milestones are kept per track. A correction that lowers days of care doesn't take a celebration back, and the same milestone never fires twice. |
| Progress after a setback | Days of care, best streak and milestones reached are unchanged by a slip. Only the current streak and days since the last slip move. |

## Time

- **Day arithmetic** runs on UTC day numbers built from the `YYYY-MM-DD` keys, so a DST change can't add or lose a day. `dates.ts` (`addDays`, `daysBetween`, `weekStart`) uses the same helpers.
- **Time zones:** a record keeps the local day it was logged on, and it is never re-bucketed when the phone's zone changes. `localDay(instant, zone)` gives the local day of an instant.
- **Weeks** run Monday to Sunday.
- **Calendar month:** a `YYYY-MM` bucket with its real length, 28–31 days. Leap years follow the Gregorian rules (1900 no, 2000 yes).
- **Recovery month:** the n-th monthly anniversary of the track's start. It falls on the same day of the month, moved back to the month's last day when that month is shorter: Jan 31 → Feb 28 (Feb 29 in a leap year) → Mar 31. A Feb 29 start has its yearly anniversary on Feb 28 in other years.
- **Elapsed duration:** whole recovery months (shown as years and months) plus the remaining days, with the plain day count alongside. Days tracked counts the start day as day 1.
- **No 30-day month is ever assumed.** One recovery month from Feb 15 is 28 days; one from Mar 15 is 31.

## Pauses and rest days

- **Pause:** `{ from, to }`. Days from `from` up to, but not including, `to` are paused, and `to: null` means still paused.
  - Only one pause can be open at a time.
  - Pausing again on the day a pause ended rejoins that pause.
  - A pause can't start inside or before an earlier one, so past pauses are never rewritten.
  - Resuming on the day a pause began drops the pause.
- **Rest day:** one day not tracked, per track (`track.restDays`). Logging a slip or marking goal met on a rest day clears it for that track. A rest day can't be set over a recorded slip or goal-met day.
- **Rest days from before tracks were separate** (the shared `settings.restDays`) applied to every track. The migration copies them into every track's own list, so clearing one on a track leaves the other tracks unchanged.
- **A record during a pause** is kept, shown and counted. A pause never refuses one. An archived track is read-only and does refuse new records.
- **Where it's stored:** rest days, pauses and celebrated milestones live on each track (`Habit.track`), never in the person's settings. See `docs/MULTI_TRACK_ARCHITECTURE.md`.

## Corrections

- **Logging a slip on a goal-met day** keeps the goal-met mark as history. The slip wins while it exists. The pet engine sees the day as a slip with no healing.
- **Deleting a slip** brings back whatever else was recorded that day.
- **Backdating** a slip or a goal-met mark recomputes streaks, best streak, days of care and milestone progress immediately.
- **Filling in a forgotten day** can join two streak runs, because an unrecorded gap never broke them.
- **Records dated after today** are ignored by every number until their day arrives.
