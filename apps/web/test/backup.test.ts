import { describe, expect, it } from "vitest";
import { actions, getData } from "../src/store";
import { blank } from "../src/persist";
import { open, seal, newKey } from "../src/vault";
import { planImport, total } from "../src/backup";

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
  /** A phone that is set up but holds none of the backup's records. */
  const emptyPhone = () => { const d = blank(); actions.applyRemote({ ...d, settings: { ...d.settings, onboarded: true } }); };

  it("a backup file adds everything it holds, photos and reflections included", () => {
    actions.applyRemote(sample());
    const file = actions.exportJson();
    emptyPhone();
    const r = actions.applyImport(file);
    expect(r.ok && total(r.add)).toBe(5); // 1 pet, 1 track, 1 slip, 1 goal-met day, 1 reflection
    const d = getData();
    expect(d.entries[0].values.photo).toBe(PHOTO);
    expect(d.journal[0].body).toBe("rough day at work");
    expect(d.cleanDays).toHaveLength(1);
    expect(d.settings.userName).toBe(""); // settings are the phone's own and are never taken from a file
  });

  it("refuses files that aren't a finished Pawse backup, and leaves the data alone", () => {
    actions.applyRemote(sample());
    const before = getData();
    for (const f of ["not json", "{}", JSON.stringify({ v: 2 }), JSON.stringify(blank())]) expect(actions.applyImport(f).ok).toBe(false);
    expect(getData()).toBe(before);
  });

  it("reports damaged rows instead of dropping them without a word, and adds the good ones", () => {
    const s = sample();
    emptyPhone();
    const file = JSON.stringify({ ...s, entries: [...s.entries, { id: "bad", months: "lots" }] });
    const plan = planImport(file, getData());
    expect(plan.ok && plan.unreadable).toBe(1);
    const r = actions.applyImport(file);
    expect(r.ok && r.unreadable).toBe(1);
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
    const { onPinChange, vault } = await import("../src/store");
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
