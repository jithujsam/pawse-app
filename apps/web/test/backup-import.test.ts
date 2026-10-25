import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Audit P0-3. Restoring a backup used to REPLACE everything: a smaller or older file turned every record missing from it
 * into a deletion that synced to the account and the person's other phones, and damaged rows were dropped without a
 * word. Now it only adds, after a preview, and can be undone.
 */
import { authState, table } from "./fake-supabase";

vi.mock("../src/supabase", async () => ({ configured: true, supabase: (await import("./fake-supabase")).client }));

const { actions, getData } = await import("../src/store");
const { getSyncStatus, startSync, stopSync, syncNow } = await import("../src/sync");
const { blank } = await import("../src/persist");
const { describeCounts, planImport, total, withoutAdded } = await import("../src/backup");
type Entry = import("../src/types").Entry;

const C = "11111111-1111-4111-8111-111111111111", H = "22222222-2222-4222-8222-222222222222";
const eid = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`;
const entry = (n: number, amount: number | null = 100 + n, extra: Partial<Entry> = {}): Entry => ({
  id: eid(n), habitId: H, companionId: C, day: "2026-10-02", time: null, values: {}, amount, months: 2.8, severity: 0.7, effects: [],
  explanation: "x", source: "baseline", aiAdjustPct: null, createdAt: 1000 + n, ...extra,
});
const base = () => {
  const d = blank();
  return {
    ...d,
    settings: { ...d.settings, onboarded: true, userName: "Jo" },
    companions: [{ id: C, species: "dog" as const, name: "Biscuit", bornOn: "2026-10-01", diedOn: null, finalAge: null }],
    habits: [{ id: H, name: "Orders", cls: "food_spending" as const, classWeight: 0.7, companionId: C, unit: "money" as const, fields: [] }],
  };
};
const phone = (entries: Entry[], more: Partial<ReturnType<typeof base>> & Record<string, unknown> = {}) => actions.applyRemote({ ...base(), entries, ...more } as never);
const file = (entries: Entry[], more: Record<string, unknown> = {}) => JSON.stringify({ ...base(), entries, ...more });
const live = (t: string) => [...table(t).values()].filter((r) => !r.deleted_at);
const deleted = (t: string) => [...table(t).values()].filter((r) => r.deleted_at);

describe("files that are not usable backups are refused and change nothing", () => {
  beforeEach(() => phone([entry(1)]));

  it.each([
    ["not JSON", "this is not json", "not_json"],
    ["an empty file", "", "not_json"],
    ["JSON that isn't a backup", JSON.stringify({ hello: "world" }), "not_backup"],
    ["a JSON list", JSON.stringify([1, 2, 3]), "not_backup"],
    ["null", "null", "not_backup"],
    ["a version number as text", JSON.stringify({ ...base(), v: "2" }), "not_backup"],
    ["a backup that was never set up", JSON.stringify({ ...base(), settings: { ...base().settings, onboarded: false } }), "unfinished"],
    ["a backup with no settings at all", JSON.stringify({ v: 2, companions: [], habits: [], entries: [] }), "unfinished"],
  ])("%s", (_name, text, reason) => {
    const before = getData();
    const r = actions.applyImport(text);
    expect(r).toMatchObject({ ok: false, reason });
    expect(getData()).toBe(before);
  });

  it.each([[3], [4], [99], [2.5]])("a backup from a newer version (v%s) is refused with a clear message, not half-read", (v) => {
    const before = getData();
    const r = actions.applyImport(JSON.stringify({ ...base(), v }));
    expect(r).toMatchObject({ ok: false, reason: "newer_version" });
    expect(r.ok === false && r.message).toMatch(/newer version/i);
    expect(getData()).toBe(before);
  });
});

describe("damaged and missing parts of a file are counted, never silently dropped", () => {
  beforeEach(() => phone([]));

  it("rows missing a field, with the wrong type or out of range are reported, and the rest are added", () => {
    const missingDay = { ...entry(2) } as Record<string, unknown>; delete missingDay.day;
    const text = file([entry(1), missingDay as unknown as Entry, { ...entry(3), months: "lots" as unknown as number }, entry(4, 12_000_000), entry(5, -3)]);
    const plan = planImport(text, getData());
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.add.slips).toBe(1);
    expect(plan.unreadable).toBe(4);
  });

  it("an amount the account can't store is reported, not imported (it would be refused on every sync)", () => {
    const plan = planImport(file([entry(1, 10_000_000), entry(2, 10_000_001)]), getData());
    expect(plan.ok && plan.add.slips).toBe(1);
    expect(plan.ok && plan.unreadable).toBe(1);
  });

  it("slips whose track or pet is missing from the file are reported", () => {
    const text = file([entry(1), { ...entry(2), habitId: "99999999-9999-4999-8999-999999999999" }]);
    const plan = planImport(text, getData());
    expect(plan.ok && plan.unreadable).toBe(1);
    expect(plan.ok && plan.add.slips).toBe(1);
  });

  it("a file missing a whole list still adds what it has", () => {
    const o = JSON.parse(file([])) as Record<string, unknown>;
    delete o.entries; delete o.cleanDays;
    const r = actions.applyImport(JSON.stringify(o));
    expect(r.ok).toBe(true);
  });
});

describe("repeated records in a file are counted once", () => {
  beforeEach(() => phone([]));

  it("the same slip twice, and the same goal-met day twice", () => {
    const r = planImport(file([entry(1), entry(1), entry(2)], { cleanDays: [{ habitId: H, day: "2026-10-03" }, { habitId: H, day: "2026-10-03" }] }), getData());
    expect(r.ok && r.add.slips).toBe(2);
    expect(r.ok && r.add.goalMetDays).toBe(1);
    expect(r.ok && r.duplicates).toBe(2);
  });

  it("the first copy wins when two copies of a slip disagree", () => {
    const r = actions.applyImport(file([entry(1, 111), entry(1, 999)]));
    expect(r.ok).toBe(true);
    expect(getData().entries.map((e) => e.amount)).toEqual([111]);
  });

  it("adding the same file twice adds nothing the second time", () => {
    const text = file([entry(1), entry(2)], { journal: [{ day: "2026-10-03", mood: 2, body: "rough" }] });
    const first = actions.applyImport(text);
    expect(first.ok && total(first.add)).toBeGreaterThan(0);
    const second = actions.applyImport(text);
    expect(second.ok && total(second.add)).toBe(0);
    expect(getData().entries).toHaveLength(2);
    expect(getData().journal).toHaveLength(1);
  });
});

describe("what is already here is never replaced", () => {
  it("a record that differs keeps this phone's version, and says so", () => {
    phone([entry(1, 100)]);
    const before = getData().entries[0];
    const plan = planImport(file([entry(1, 555), entry(2, 200)]), getData());
    expect(plan.ok && plan.keep.slips).toBe(1);
    expect(plan.ok && plan.add.slips).toBe(1);
    actions.applyImport(file([entry(1, 555), entry(2, 200)]));
    expect(getData().entries.find((e) => e.id === eid(1))).toBe(before);
    expect(getData().entries.find((e) => e.id === eid(1))!.amount).toBe(100);
  });

  it("identical records are 'already here'", () => {
    phone([entry(1)]);
    const plan = planImport(file([entry(1)]), getData());
    expect(plan.ok && plan.same.slips).toBe(1);
    expect(plan.ok && total(plan.add)).toBe(0);
  });

  it("settings are never taken from a file", () => {
    phone([]);
    actions.setSettings({ userName: "Me", tone: "gentle" });
    actions.applyImport(file([entry(1)], { settings: { ...base().settings, userName: "Someone else", tone: "brutal", aiConsent: true } }));
    expect(getData().settings).toMatchObject({ userName: "Me", tone: "gentle", aiConsent: false });
  });

  it("changes that arrive between the preview and the confirmation are kept", () => {
    phone([entry(1)]);
    const text = file([entry(2)]);
    expect(planImport(text, getData()).ok).toBe(true); // the preview
    actions.applyRemote({ ...getData(), entries: [...getData().entries, entry(3)] }); // a sync lands meanwhile
    actions.applyImport(text);
    expect(getData().entries.map((e) => e.id).sort()).toEqual([eid(1), eid(2), eid(3)]);
  });

  it("refuses to push the account past 50 tracks", () => {
    const habits = Array.from({ length: 49 }, (_, i) => ({ ...base().habits[0], id: `44444444-4444-4444-8444-${String(i).padStart(12, "0")}`, companionId: `55555555-5555-4555-8555-${String(i).padStart(12, "0")}` }));
    const companions = habits.map((h) => ({ ...base().companions[0], id: h.companionId }));
    actions.applyRemote({ ...base(), habits, companions } as never);
    const other = (n: string) => ({ ...base().habits[0], id: `66666666-6666-4666-8666-${n}`, companionId: `77777777-7777-4777-8777-${n}` });
    const text = JSON.stringify({ ...base(), companions: [{ ...base().companions[0], id: "77777777-7777-4777-8777-000000000001" }, { ...base().companions[0], id: "77777777-7777-4777-8777-000000000002" }], habits: [other("000000000001"), other("000000000002")], entries: [] });
    const before = getData();
    expect(actions.applyImport(text)).toMatchObject({ ok: false, reason: "too_many_tracks" });
    expect(getData()).toBe(before);
  });
});

describe("cancelling leaves everything, including the account, exactly as it was", () => {
  it("a preview changes nothing and queues nothing to sync", async () => {
    stopSync();
    authState.session = { user: { id: "u1" } };
    for (const t of ["entries", "deductions", "companions", "habits", "profiles", "clean_days"]) table(t).clear();
    phone([entry(1), entry(2)]);
    await startSync("u1");
    const before = getData();
    const serverBefore = JSON.stringify([...table("entries").entries()]);
    const plan = planImport(file([entry(1), entry(9)]), getData()); // the preview, then the person taps Cancel
    expect(plan.ok && plan.add.slips).toBe(1);
    await syncNow();
    expect(getData()).toBe(before);
    expect(getSyncStatus().pending).toBe(0);
    expect(JSON.stringify([...table("entries").entries()])).toBe(serverBefore);
    stopSync();
  });
});

describe("a restore never removes records from the account or other phones", () => {
  afterAll(() => stopSync());

  async function signedInWith(entries: Entry[]) {
    stopSync();
    authState.session = { user: { id: "u1" } };
    for (const t of ["entries", "deductions", "companions", "habits", "profiles", "clean_days", "urges", "journal"]) table(t).clear();
    phone(entries);
    await startSync("u1");
    await syncNow();
  }

  it("an older, smaller backup with a damaged row adds nothing and deletes nothing anywhere", async () => {
    await signedInWith([entry(1), entry(2), entry(3)]);
    expect(live("entries")).toHaveLength(3);
    const old = JSON.parse(file([entry(1)])) as { entries: unknown[] };
    old.entries.push({ id: "bad", months: "lots" });
    const r = actions.applyImport(JSON.stringify(old));
    expect(r.ok && r.unreadable).toBe(1);
    await syncNow();
    expect(getData().entries).toHaveLength(3);
    expect(live("entries")).toHaveLength(3);
    expect(deleted("entries")).toHaveLength(0);
  });

  it("records the file adds reach the account, and the existing ones are untouched", async () => {
    await signedInWith([entry(1), entry(2)]);
    const stampBefore = table("entries").get(eid(1))!.updated_at;
    actions.applyImport(file([entry(1), entry(2), entry(7), entry(8)]));
    await syncNow();
    expect(live("entries").map((r) => r.id).sort()).toEqual([eid(1), eid(2), eid(7), eid(8)]);
    expect(table("entries").get(eid(1))!.updated_at).toBe(stampBefore);
    expect(deleted("entries")).toHaveLength(0);
  });

  it("undo takes back only what the import added", async () => {
    await signedInWith([entry(1)]);
    const r = actions.applyImport(file([entry(1), entry(7)], { journal: [{ day: "2026-10-03", mood: 2, body: "rough" }] }));
    if (!r.ok) throw new Error("import refused");
    await syncNow();
    expect(live("entries")).toHaveLength(2);
    actions.undoImport(r.added);
    await syncNow();
    expect(getData().entries.map((e) => e.id)).toEqual([eid(1)]);
    expect(getData().journal).toHaveLength(0);
    expect(live("entries").map((x) => x.id)).toEqual([eid(1)]);
    expect(deleted("entries").map((x) => x.id)).toEqual([eid(7)]);
  });
});

describe("added tracks come with their own data and stay separate", () => {
  it("a whole extra track (pet, slips, goal-met days, plan) is added next to the existing one", () => {
    phone([entry(1)]);
    const H2 = "88888888-8888-4888-8888-888888888888", C2 = "99999999-9999-4999-8999-999999999999";
    const text = JSON.stringify({
      ...base(),
      companions: [...base().companions, { id: C2, species: "fox", name: "Ember", bornOn: "2026-10-05", diedOn: null, finalAge: null, trackId: H2 }],
      habits: [...base().habits, { id: H2, name: "Scrolling", cls: "doomscrolling", classWeight: 0.8, companionId: C2, unit: "minutes", fields: [] }],
      entries: [entry(1), { ...entry(2), habitId: H2, companionId: C2 }],
      cleanDays: [{ habitId: H2, day: "2026-10-06" }],
      summaries: { [H2]: { "2026-10-05": "A calmer week." } },
    });
    const r = actions.applyImport(text);
    expect(r.ok && describeCounts(r.add)).toEqual(["1 track", "1 pet", "1 slip", "1 goal-met day", "1 weekly summary"]);
    const d = getData();
    expect(d.habits.map((h) => h.id)).toEqual([H, H2]);
    expect(d.entries.find((e) => e.id === eid(2))).toMatchObject({ habitId: H2, companionId: C2 });
    expect(d.summaries[H2]).toEqual({ "2026-10-05": "A calmer week." });
    // undoing removes the whole added track and everything on it, leaving the first track alone
    if (!r.ok) return;
    const back = withoutAdded(d, r.added);
    expect(back.habits.map((h) => h.id)).toEqual([H]);
    expect(back.entries.map((e) => e.id)).toEqual([eid(1)]);
    expect(back.cleanDays).toHaveLength(0);
    expect(back.summaries[H2]).toBeUndefined();
  });
});
