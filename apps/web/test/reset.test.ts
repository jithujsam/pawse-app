import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Wiping this phone must never wipe the account (audit B1). A tiny in-memory stand-in for the
 * Supabase tables lets the real sync loop run end to end.
 */
type Row = Record<string, unknown>;
const server = new Map<string, Map<string, Row>>();
const KEYS: Record<string, string[]> = {
  profiles: ["id"], companions: ["id"], habits: ["id"], entries: ["id"], deductions: ["entry_id"],
  clean_days: ["habit_id", "day"], weekly_reports: ["habit_id", "week_start"], urges: ["id"], journal: ["user_id", "day"],
};
let clock = 0;
const table = (t: string) => { if (!server.has(t)) server.set(t, new Map()); return server.get(t)!; };
const keyOf = (t: string, r: Row) => KEYS[t].map((k) => String(r[k])).join("|");
const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++clock * 1000).toISOString();

function query(t: string) {
  const eqs: [string, unknown][] = [];
  let patch: Row | null = null;
  const q = {
    select: () => q, order: () => q, range: () => q, gt: () => q,
    eq: (c: string, v: unknown) => { eqs.push([c, v]); return q; },
    update: (p: Row) => { patch = p; return q; },
    upsert: (rows: Row[]) => {
      for (const r of rows) { const k = keyOf(t, r); table(t).set(k, { ...table(t).get(k), ...r, updated_at: stamp() }); }
      return Promise.resolve({ error: null });
    },
    then: (res: (v: { data: Row[] | null; error: null }) => unknown) => {
      const match = [...table(t).values()].filter((r) => eqs.every(([c, v]) => r[c] === v));
      if (patch) { for (const r of match) Object.assign(r, patch, { updated_at: stamp() }); return Promise.resolve(res({ data: null, error: null })); }
      return Promise.resolve(res({ data: match.map((r) => ({ ...r })), error: null }));
    },
  };
  return q;
}

vi.mock("../src/supabase", () => ({ configured: true, supabase: { from: (t: string) => query(t) } }));

const { actions, getData } = await import("../src/store");
const { startSync, syncNow, stopSync } = await import("../src/sync");
const { blank } = await import("../src/persist");

const C = "11111111-1111-4111-8111-111111111111", H = "22222222-2222-4222-8222-222222222222", E = "33333333-3333-4333-8333-333333333333";

function seed() {
  const d = blank();
  actions.applyRemote({
    ...d,
    settings: { ...d.settings, onboarded: true, goal: "Orders" },
    companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: "2026-10-01", diedOn: null, finalAge: null }],
    habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields: [] }],
    entries: [{ id: E, habitId: H, companionId: C, day: "2026-10-02", time: null, values: {}, amount: 300, months: 2.8, severity: 0.7, effects: [], explanation: "x", source: "baseline", aiAdjustPct: null, createdAt: 1 }],
    cleanDays: [{ habitId: H, day: "2026-10-03" }],
  });
}

describe("erasing this phone", () => {
  beforeAll(async () => {
    seed();
    await startSync("u1");
  });

  it("first backs the account up", () => {
    expect(table("entries").size).toBe(1);
    expect((table("profiles").get("u1")!.settings as { onboarded: boolean }).onboarded).toBe(true);
  });

  it("leaves every row in the account untouched and brings the history back", async () => {
    await actions.resetAll();
    expect(getData().entries).toHaveLength(0);
    await syncNow();
    await syncNow();
    for (const t of ["companions", "habits", "entries", "clean_days"]) {
      for (const r of table(t).values()) expect(r.deleted_at ?? null).toBeNull();
    }
    expect((table("profiles").get("u1")!.settings as { onboarded: boolean }).onboarded).toBe(true);
    expect(getData().settings.onboarded).toBe(true);
    expect(getData().entries.map((e) => e.id)).toEqual([E]);
    expect(getData().companions.map((c) => c.id)).toEqual([C]);
  });

  it("an ordinary local delete still reaches the account", async () => {
    actions.deleteEntry(E);
    await syncNow();
    expect(table("entries").get(E)!.deleted_at).toBeTruthy();
    stopSync();
  });
});
