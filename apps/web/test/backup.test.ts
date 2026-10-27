import { describe, expect, it } from "vitest";
import { actions, getData } from "../src/store";
import { blank } from "../src/persist";
import { open, seal, newKey } from "../src/vault";

const C = "11111111-1111-4111-8111-111111111111", H = "22222222-2222-4222-8222-222222222222";
const PHOTO = "data:image/jpeg;base64,/9j/AAAA";
function sample() {
  const d = blank();
  return {
    ...d,
    settings: { ...d.settings, onboarded: true, goal: "Late-night orders", userName: "Jo" },
    companions: [{ id: C, species: "dog" as const, name: "Biscuit", bornOn: "2026-10-01", diedOn: null, finalAge: null }],
    habits: [{ id: H, name: "Orders", cls: "food_spending" as const, classWeight: 0.7, companionId: C, unit: "money" as const, fields: [] }],
    entries: [{ id: "33333333-3333-4333-8333-333333333333", habitId: H, companionId: C, day: "2026-10-02", time: "23:10", values: { photo: PHOTO, what: "Pizza" }, amount: 420, months: 4.2, severity: 1.05, effects: [], explanation: "x", source: "baseline" as const, aiAdjustPct: null, createdAt: 5 }],
    cleanDays: [{ habitId: H, day: "2026-10-03" }],
    journal: [{ day: "2026-10-03", mood: 2, body: "rough day at work" }],
  };
}

describe("backup and restore", () => {
  it("a backup file restores everything, photos and reflections included", () => {
    actions.applyRemote(sample());
    const file = actions.exportJson();
    actions.applyRemote(blank());
    expect(actions.importJson(file)).toBe(true);
    const d = getData();
    expect(d.entries[0].values.photo).toBe(PHOTO);
    expect(d.journal[0].body).toBe("rough day at work");
    expect(d.cleanDays).toHaveLength(1);
    expect(d.settings.onboarded).toBe(true);
    expect(d.settings.userName).toBe("Jo");
  });

  it("refuses files that aren't a finished Pawse backup, and leaves the data alone", () => {
    actions.applyRemote(sample());
    for (const f of ["not json", "{}", JSON.stringify({ v: 2 }), JSON.stringify(blank())]) expect(actions.importJson(f)).toBe(false);
    expect(getData().entries).toHaveLength(1);
  });

  it("keeps the good rows when one row in the file is damaged", () => {
    const s = sample();
    const file = JSON.stringify({ ...s, entries: [...s.entries, { id: "bad", months: "lots" }] });
    expect(actions.importJson(file)).toBe(true);
    expect(getData().entries).toHaveLength(1);
  });
});

describe("PIN encryption", () => {
  it("the sealed copy reveals nothing readable, and only the right PIN opens it", async () => {
    const k = await newKey("4826");
    const sealed = await seal(k, sample());
    const raw = JSON.stringify(sealed);
    for (const secret of ["Biscuit", "Pizza", "rough day", "Late-night"]) expect(raw).not.toContain(secret);
    expect(await open("4827", sealed)).toBeNull();
    expect(((await open("4826", sealed))!.value as ReturnType<typeof sample>).journal[0].body).toBe("rough day at work");
  });

  it("each seal uses a fresh IV, so the same data never looks the same twice", async () => {
    const k = await newKey("4826");
    const [a, b] = [await seal(k, sample()), await seal(k, sample())];
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });
});

describe("app lock changes", () => {
  it("tell listeners (the widget) when the PIN is turned on and off", async () => {
    const { boot, onPinChange, vault } = await import("../src/store");
    await boot(); // the PIN can only be changed once the data is loaded, as in the app
    let n = 0;
    const off = onPinChange(() => n++);
    await vault.setPin("4826");
    expect(vault.hasPin()).toBe(true);
    await vault.removePin();
    expect(vault.hasPin()).toBe(false);
    expect(n).toBe(2);
    off();
  });
});

describe("restoring a backup only adds (the additive rule)", () => {
  const E1 = "33333333-3333-4333-8333-333333333331", E2 = "33333333-3333-4333-8333-333333333332", E3 = "33333333-3333-4333-8333-333333333333";
  const entry = (id: string, months: number, createdAt: number) => ({
    id, habitId: H, companionId: C, day: "2026-10-02", time: null, values: {}, amount: null, months, severity: 1, effects: [], explanation: "", source: "baseline" as const, aiAdjustPct: null, createdAt,
  });

  it("keeps this phone's version of anything with the same id, and adds what it doesn't have", () => {
    const backup = { ...sample(), entries: [entry(E1, 9, 1), entry(E2, 2, 2)], summaries: {} };
    actions.applyRemote({ ...sample(), entries: [entry(E1, 4, 1), entry(E3, 1, 3)], settings: { ...sample().settings, userName: "Sam", onboarded: true } });
    const file = JSON.stringify(backup);
    expect(actions.importJson(file)).toBe(true);
    const d = getData();
    expect(d.entries.find((e) => e.id === E1)!.months).toBe(4); // this phone's edit wins
    expect(d.entries.find((e) => e.id === E2)!.months).toBe(2); // missing here, so added
    expect(d.entries.find((e) => e.id === E3)).toBeDefined(); // nothing is deleted
    expect(d.settings.userName).toBe("Sam"); // settings are never replaced
  });

  it("doesn't add a second clean day for the same habit and day, or a second journal entry for the same day", () => {
    actions.applyRemote({ ...sample(), entries: [] });
    const before = getData();
    actions.importJson(JSON.stringify({ ...sample(), entries: [], cleanDays: [{ habitId: H, day: "2026-10-03" }], journal: [{ day: "2026-10-03", mood: 1, body: "other" }] }));
    expect(getData().cleanDays.filter((c) => c.day === "2026-10-03")).toHaveLength(1);
    expect(getData().journal.filter((j) => j.day === "2026-10-03")).toHaveLength(1);
    expect(getData().journal[0].body).toBe(before.journal[0].body);
  });

  it("keeps this phone's weekly summary for a week it already has, and adds the other weeks", () => {
    actions.applyRemote({ ...sample(), summaries: { [H]: { "2026-10-05": "Local words." } } });
    actions.importJson(JSON.stringify({ ...sample(), summaries: { [H]: { "2026-10-05": "Backup words.", "2026-09-28": "Older week." } } }));
    expect(getData().summaries[H]).toEqual({ "2026-10-05": "Local words.", "2026-09-28": "Older week." });
  });

  it("leaves out rows whose pet is missing, so nothing orphaned is added", () => {
    actions.applyRemote({ ...sample(), entries: [] });
    actions.importJson(JSON.stringify({ ...sample(), entries: [{ ...entry(E2, 2, 2), companionId: "99999999-9999-4999-8999-999999999999" }] }));
    expect(getData().entries.some((e) => e.id === E2)).toBe(false);
  });

  it("undoing a restored entry twice brings it back only once", () => {
    actions.applyRemote({ ...sample(), entries: [entry(E1, 4, 1)] });
    actions.restoreEntry(entry(E1, 4, 1));
    actions.restoreEntry(entry(E1, 4, 1));
    expect(getData().entries.filter((e) => e.id === E1)).toHaveLength(1);
  });
});
