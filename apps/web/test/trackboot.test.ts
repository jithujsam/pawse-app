import { describe, expect, it, vi } from "vitest";

/** A phone that saved data before tracks opens the new version. */
const store = new Map<string, unknown>();
vi.mock("../src/db", () => ({
  idbAvailable: () => true,
  kv: {
    get: async (k: string) => store.get(k),
    set: async (k: string, v: unknown) => { store.set(k, structuredClone(v)); },
    del: async (k: string) => { store.delete(k); },
    clear: async () => { store.clear(); },
  },
}));

const { boot, getData, flush } = await import("../src/store");
const { trackState } = await import("../src/tracks");

const C = "00000000-0000-4000-8000-000000000001", H = "00000000-0000-4000-8000-000000000002", E = "00000000-0000-4000-8000-000000000003";
const saved = {
  v: 1,
  settings: { onboarded: true, tone: "brutal", plan: { goal: "understand", reasons: [], situations: [], firstStep: "", strategies: [], supportName: "", ifThen: [] }, restDays: ["2026-10-20"], neglectFrom: "2026-10-01" },
  companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: "2026-10-01", diedOn: null, finalAge: null }],
  habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields: [] }],
  entries: [{ id: E, habitId: H, companionId: C, day: "2026-10-02", time: null, values: {}, amount: 1, months: 2, severity: 1, effects: [], explanation: "", source: "baseline", aiAdjustPct: null, createdAt: 1 }],
  cleanDays: [], urges: [], journal: [], summaries: {}, updatedAt: 1,
};

describe("opening the new version on a phone with data from before tracks", () => {
  it("upgrades in place, keeps the old copy once, and loses nothing", async () => {
    store.set("data", structuredClone(saved));
    expect(await boot()).toEqual({ kind: "ready" });
    const d = getData();
    expect(d.v).toBe(2);
    expect(d.settings.tone).toBe("brutal");
    expect(trackState(d, H)).toMatchObject({ plan: { goal: "understand" }, restDays: ["2026-10-20"], startedOn: "2026-10-01" });
    expect(d.entries.map((e) => e.id)).toEqual([E]);
    await flush();
    expect((store.get("data") as { v: number }).v).toBe(2);
    expect(store.get("data.v1-backup")).toEqual(saved);

    // A second start reads v2 and leaves the backup alone.
    store.set("data.v1-backup", "first");
    await boot();
    expect(getData().habits[0].track).toEqual(d.habits[0].track);
    expect(store.get("data.v1-backup")).toBe("first");
  });
});
