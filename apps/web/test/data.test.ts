import { describe, expect, it } from "vitest";
import { blank, migrateIds, normalize } from "../src/persist";
import { diff, merge, stripPhotos, toRemote, tombstone, type Pulled } from "../src/syncmap";
import { afterFailure, isWeakPin, newKey, open, seal } from "../src/vault";
import type { AppData } from "../src/types";

const UUID = /^[0-9a-f-]{36}$/;

function sample(): AppData {
  const d = blank();
  return {
    ...d,
    settings: { ...d.settings, onboarded: true },
    companions: [{ id: "c1", species: "dog", name: "Biscuit", bornOn: "2026-10-01", diedOn: null, finalAge: null }],
    habits: [{ id: "h1", name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: "c1", unit: "money", fields: [{ id: "amount", label: "How much?", type: "money", required: true, amount: true }] }],
    entries: [{ id: "e1", habitId: "h1", companionId: "c1", day: "2026-10-02", time: null, values: { amount: "300", photo: "data:image/jpeg;base64,AAAA" }, amount: 300, months: 2.8, severity: 0.7, effects: ["heavier"], explanation: "x", source: "baseline", aiAdjustPct: null, createdAt: 1 }],
    cleanDays: [{ habitId: "h1", day: "2026-10-03" }],
  };
}

describe("loading saved data", () => {
  it("fills settings added in later versions", () => {
    const old = { ...sample(), settings: { tone: "gentle", onboarded: true } };
    const d = normalize(old)!;
    expect(d.settings.tone).toBe("gentle");
    expect(d.settings.autoLock).toBe("1m");
    expect(d.settings.haptics).toBe(true);
  });
  it("keeps the good rows when one row is damaged", () => {
    const raw = { ...sample(), entries: [...sample().entries, { id: "bad", months: "lots" }] };
    const d = normalize(raw)!;
    expect(d.entries.map((e) => e.id)).toEqual(["e1"]);
    expect(d.companions).toHaveLength(1);
  });
  it("rejects things that aren't app data", () => {
    expect(normalize(null)).toBeNull();
    expect(normalize({ v: 2 })).toBeNull();
    expect(normalize("hello")).toBeNull();
  });
  it("drops rows whose parent is gone", () => {
    const raw = { ...sample(), habits: [] };
    const d = normalize(raw)!;
    expect(d.entries).toHaveLength(0);
    expect(d.cleanDays).toHaveLength(0);
  });
  it("remaps old short ids to UUIDs and keeps every reference", () => {
    const d = migrateIds(sample());
    const c = d.companions[0], h = d.habits[0], e = d.entries[0];
    expect(c.id).toMatch(UUID);
    expect(h.companionId).toBe(c.id);
    expect(e.habitId).toBe(h.id);
    expect(e.companionId).toBe(c.id);
    expect(d.cleanDays[0].habitId).toBe(h.id);
    expect(migrateIds(d)).toBe(d);
  });
});

describe("sync mapping", () => {
  it("finds exactly the rows that changed", () => {
    const a = sample();
    const b = { ...a, entries: [...a.entries, { ...a.entries[0], id: "e2" }], cleanDays: [] };
    expect(diff(a, b)).toEqual({ changed: ["e:e2"], removed: ["k:h1:2026-10-03"] });
    expect(diff(a, { ...a, settings: { ...a.settings, tone: "brutal" } }).changed).toEqual(["s"]);
  });
  it("never uploads photos", () => {
    expect(stripPhotos({ amount: "3", photo: "data:image/png;base64,xx" })).toEqual({ amount: "3" });
    const rows = toRemote("e:e1", sample(), "u", 5);
    expect(rows.map((r) => r.table)).toEqual(["entries", "deductions"]);
    expect(JSON.stringify(rows)).not.toContain("data:image");
  });
  it("keeps phone-only settings off the server", () => {
    const [p] = toRemote("s", sample(), "u", 5);
    expect(p.row.settings).not.toHaveProperty("haptics");
    expect(p.row.settings).not.toHaveProperty("autoLock");
  });
  it("maps deletes to soft-delete matches", () => {
    expect(tombstone("k:h1:2026-10-03")).toEqual({ table: "clean_days", match: { habit_id: "h1", day: "2026-10-03" } });
    expect(tombstone("s")).toBeNull();
  });

  const empty = (): Pulled => ({ profiles: [], companions: [], habits: [], entries: [], deductions: [], clean_days: [], weekly_reports: [] });

  it("applies a newer remote row and keeps the local photo", () => {
    const p = empty();
    p.entries = [{ id: "e1", habit_id: "h1", companion_id: "c1", occurred_on: "2026-10-02", occurred_at: null, values: { amount: "400" }, amount: 400, client_created_at: 1, client_updated_at: 50 }];
    p.deductions = [{ entry_id: "e1", months_lost: 3.5, severity: 0.9, body_effects: [], explanation: "y", source: "ai", ai_adjust_pct: 10, client_updated_at: 50 }];
    const { data } = merge(sample(), p, {});
    expect(data.entries[0].amount).toBe(400);
    expect(data.entries[0].months).toBe(3.5);
    expect(data.entries[0].values.photo).toContain("data:image");
  });
  it("lets an unsent newer local change win (last write wins)", () => {
    const p = empty();
    p.companions = [{ id: "c1", species: "cat", name: "Old", born_on: "2026-10-01", client_updated_at: 10 }];
    const { data, applied } = merge(sample(), p, { "c:c1": 20 });
    expect(data.companions[0].name).toBe("Biscuit");
    expect(applied).toEqual([]);
  });
  it("removes rows deleted on another phone", () => {
    const p = empty();
    p.clean_days = [{ habit_id: "h1", day: "2026-10-03", deleted_at: "2026-10-04T00:00:00Z", client_updated_at: 9 }];
    expect(merge(sample(), p, {}).data.cleanDays).toHaveLength(0);
  });
});

describe("app lock", () => {
  it("encrypts and only the right PIN opens it", async () => {
    const k = await newKey("4826");
    const sealed = await seal(k, { secret: "late-night orders" });
    expect(JSON.stringify(sealed)).not.toContain("late-night");
    expect((await open("4826", sealed))?.value).toEqual({ secret: "late-night orders" });
    expect(await open("4827", sealed)).toBeNull();
  }, 20_000);
  it("flags easy PINs", () => {
    for (const p of ["1111", "1234", "4321", "123456"]) expect(isWeakPin(p)).toBe(true);
    expect(isWeakPin("4826")).toBe(false);
  });
  it("backs off after five wrong tries", () => {
    let l = { fails: 0, until: 0 };
    for (let i = 0; i < 4; i++) l = afterFailure(l, 0);
    expect(l.until).toBe(0);
    l = afterFailure(l, 0); expect(l.until).toBe(30_000);
    l = afterFailure(l, 0); expect(l.until).toBe(60_000);
    for (let i = 0; i < 10; i++) l = afterFailure(l, 0);
    expect(l.until).toBe(15 * 60_000);
  });
});
