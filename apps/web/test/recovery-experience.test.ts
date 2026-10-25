import { describe, expect, it } from "vitest";
import { actions, getData, reminderInputs, viewCompanion } from "../src/store";
import { blank } from "../src/persist";
import { addDays, today } from "../src/dates";
import { planNotifications } from "../src/notify";
import { trackSummary } from "../src/progress";
import { defaultTrackState, focusedTrackId, trackState } from "../src/tracks";
import type { AppData } from "../src/types";

/**
 * Regression tests for the recovery experience (PRD §21): pausing from the Pets grid, reminders that follow the
 * open track, per-track plans, the urge flow and what a slip leaves intact. The store tests use the real clock.
 */

const t0 = today();
const born = addDays(t0, -40);

/** Two independent tracks, each with its own pet, reminders on. */
function twoTracks(): AppData {
  const d = blank();
  return {
    ...d,
    settings: { ...d.settings, onboarded: true, remindersOn: true, reminder: "20:00", activeHabit: "ha" },
    companions: [
      { id: "ca", species: "dog", name: "Biscuit", bornOn: born, diedOn: null, finalAge: null, trackId: "ha" },
      { id: "cb", species: "cat", name: "Miso", bornOn: born, diedOn: null, finalAge: null, trackId: "hb" },
    ],
    habits: [
      { id: "ha", name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: "ca", unit: "money", fields: [], track: defaultTrackState(born) },
      { id: "hb", name: "Smoking", cls: "smoking", classWeight: 1.4, companionId: "cb", unit: "count", fields: [], track: defaultTrackState(born) },
    ],
  };
}
const load = (d: AppData = twoTracks()) => actions.applyRemote(d);

describe("pausing a track silences its reminders, and resuming restores them", () => {
  it("plans reminders for the open track, in its pet's name", () => {
    load();
    expect(reminderInputs(getData())).toMatchObject({ enabled: true, name: "Biscuit", reminder: "20:00" });
    actions.selectTrack("hb");
    expect(reminderInputs(getData()).name).toBe("Miso");
  });

  it("a paused open track plans nothing, without touching the person's reminder settings", () => {
    load();
    const before = getData().settings;
    expect(actions.pauseTrack("ha")).toBe(true);
    const r = reminderInputs(getData());
    expect(r.enabled).toBe(false);
    expect(planNotifications({ ...r, now: new Date(), care: null })).toEqual([]);
    expect([getData().settings.remindersOn, getData().settings.reminder, getData().settings.riskNudge]).toEqual([before.remindersOn, before.reminder, before.riskNudge]);
  });

  it("resuming brings back exactly the saved reminder preferences", () => {
    load({ ...twoTracks(), settings: { ...twoTracks().settings, reminder: "07:45" } });
    actions.pauseTrack("ha");
    expect(actions.resumeTrack("ha")).toBe(true);
    expect(reminderInputs(getData())).toMatchObject({ enabled: true, reminder: "07:45" });
  });

  it("reminders that were off stay off after a resume", () => {
    load({ ...twoTracks(), settings: { ...twoTracks().settings, remindersOn: false } });
    actions.pauseTrack("ha");
    actions.resumeTrack("ha");
    expect(reminderInputs(getData()).enabled).toBe(false);
  });

  it("pausing one track never changes another track's state or reminders", () => {
    load();
    actions.pauseTrack("hb");
    expect(trackState(getData(), "ha").status).toBe("active");
    expect(reminderInputs(getData()).enabled).toBe(true);
    actions.selectTrack("hb");
    expect(reminderInputs(getData()).enabled).toBe(false);
  });

  it("paused days stay neutral: no streak change, no slip, no ageing", () => {
    const d = twoTracks();
    d.cleanDays = [1, 2, 3].map((n) => ({ habitId: "ha", day: addDays(t0, -10 - n) }));
    load(d);
    const before = trackSummary(getData(), "ha", t0);
    const age = viewCompanion(getData(), "ca").age;
    actions.pauseTrack("ha", addDays(t0, -10));
    const after = trackSummary(getData(), "ha", t0);
    expect([after.current, after.best, after.care, after.slips]).toEqual([before.current, before.best, before.care, 0]);
    expect(after.today).toBe("paused");
    expect(viewCompanion(getData(), "ca").age).toBe(age);
  });

  it("any record today, or a day not tracked, means no reminder today", () => {
    load();
    expect(reminderInputs(getData()).checkedToday).toBe(false);
    actions.recordUrge("ha", 3, "rode_it_out");
    expect(reminderInputs(getData()).checkedToday).toBe(true);
    load();
    actions.setRest("ha", t0, true);
    expect(reminderInputs(getData()).checkedToday).toBe(true);
  });

  it("the open track falls back to an active one when the remembered one is archived", () => {
    load();
    actions.archiveTrack("ha");
    expect(focusedTrackId(getData())).toBe("hb");
    expect(reminderInputs(getData())).toMatchObject({ enabled: true, name: "Miso" });
  });
});
