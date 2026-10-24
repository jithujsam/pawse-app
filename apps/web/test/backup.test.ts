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
    settings: { ...d.settings, onboarded: true, goal: "Late-night orders" },
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
