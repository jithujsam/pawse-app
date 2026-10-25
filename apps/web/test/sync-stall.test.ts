import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Audit P0-4. A slip's amount outside 0..10,000,000 is refused by the account's CHECK constraint
 * (entries_amount_check). The app used to save such a slip anyway; every sync then failed on the batch holding it, so no
 * valid row behind it ever reached the account, and the status just said "Sync paused" forever.
 */
import { authState, clearRefusals, networkDown, refuse, resetCalls, table, upsertCalls } from "./fake-supabase";

vi.mock("../src/supabase", async () => ({ configured: true, supabase: (await import("./fake-supabase")).client }));

const { actions, amountProblem, getData } = await import("../src/store");
const { getRejected, getSyncStatus, startSync, stopSync, syncNow } = await import("../src/sync");
const { blank } = await import("../src/persist");

const C = "11111111-1111-4111-8111-111111111111", H = "22222222-2222-4222-8222-222222222222";
const eid = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`;
const slip = (n: number, amount: number | null) => ({
  id: eid(n), habitId: H, companionId: C, day: "2026-10-02", time: null, values: {}, amount, months: 2.8, severity: 0.7, effects: [],
  explanation: "x", source: "baseline" as const, aiAdjustPct: null, createdAt: 1000 + n,
});
const amountField = { id: "amount", label: "How much?", type: "money" as const, required: true, amount: true };

function seed(entries: ReturnType<typeof slip>[]) {
  const d = blank();
  actions.applyRemote({
    ...d,
    settings: { ...d.settings, onboarded: true },
    companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: "2026-10-01", diedOn: null, finalAge: null }],
    habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields: [amountField] }],
    entries,
  });
}
const overLimit = (r: Record<string, unknown>) => r.amount != null && (Number(r.amount) > 10_000_000 || Number(r.amount) < 0);

describe("the account refuses a slip, and the rest of the history still backs up", () => {
  beforeAll(async () => {
    authState.session = { user: { id: "u1" } };
    refuse("entries", overLimit);
    // 12,000,000 is a plausible spend in rupiah or dong, and the server's limit is 10,000,000.
    seed([slip(1, 300), slip(2, 12_000_000), slip(3, 150)]);
    await startSync("u1");
  });
  afterAll(() => { stopSync(); clearRefusals(); });

  it("the valid slips reach the account and sync is healthy, not stuck", () => {
    expect(table("entries").has(eid(1))).toBe(true);
    expect(table("entries").has(eid(3))).toBe(true);
    expect(getSyncStatus().state).toBe("idle");
    expect(getSyncStatus().pending).toBe(0);
  });

  it("the refused slip is kept on the phone and reported, never dropped", () => {
    expect(table("entries").has(eid(2))).toBe(false);
    expect(getData().entries.map((e) => e.id).sort()).toEqual([eid(1), eid(2), eid(3)]);
    expect(getSyncStatus().rejected).toBe(1);
    const [r] = getRejected();
    expect(r.key).toBe(`e:${eid(2)}`);
    expect(r.message).toMatch(/check constraint/);
  });

  it("its deduction is not sent without it", () => {
    expect(table("deductions").has(eid(2))).toBe(false);
    expect(table("deductions").has(eid(1))).toBe(true);
  });

  it("an ordinary sync does not send the refused slip again", async () => {
    resetCalls();
    await syncNow();
    expect(upsertCalls.entries ?? 0).toBe(0);
    expect(getSyncStatus().state).toBe("idle");
  });

  it("new slips keep syncing behind it", async () => {
    const d = actions.logSlip(H, { amount: "420" });
    expect(d).not.toBeNull();
    await syncNow();
    expect(table("entries").has(d!.entry.id)).toBe(true);
    expect(getSyncStatus().rejected).toBe(1);
  });

  it("'Sync now' tries a refused row again, and it goes up once the server accepts it", async () => {
    clearRefusals();
    await syncNow(true);
    expect(table("entries").has(eid(2))).toBe(true);
    expect(table("deductions").has(eid(2))).toBe(true);
    expect(getSyncStatus().rejected).toBe(0);
    expect(getRejected()).toEqual([]);
  });
});

describe("finding the refused row costs a few requests, not one per row", () => {
  beforeAll(async () => {
    stopSync();
    authState.session = { user: { id: "u1" } };
    for (const t of ["entries", "deductions", "companions", "habits", "profiles", "clean_days"]) table(t).clear();
    refuse("entries", overLimit);
    seed(Array.from({ length: 40 }, (_, i) => slip(i + 1, i === 17 ? 99_000_000 : 100 + i)));
    resetCalls();
    await startSync("u1");
  });
  afterAll(() => { stopSync(); clearRefusals(); });

  it("all 39 valid slips are saved and exactly one is refused", () => {
    expect(table("entries").size).toBe(39);
    expect(table("entries").has(eid(18))).toBe(false);
    expect(getRejected().map((r) => r.key)).toEqual([`e:${eid(18)}`]);
  });
  it("using about log2(40) extra requests", () => {
    expect(upsertCalls.entries).toBeLessThanOrEqual(14);
  });
});

describe("a refusal is about the data; being offline is not", () => {
  beforeAll(async () => {
    stopSync();
    authState.session = { user: { id: "u1" } };
    for (const t of ["entries", "deductions", "companions", "habits", "profiles", "clean_days"]) table(t).clear();
    clearRefusals();
    seed([slip(1, 300)]);
    await startSync("u1");
  });
  afterAll(() => { stopSync(); networkDown(false); });

  it("a failed request is retried as a whole and no row is marked refused", async () => {
    const d = actions.logSlip(H, { amount: "50" })!;
    networkDown(true);
    await syncNow();
    expect(getSyncStatus().state).toBe("error");
    expect(getSyncStatus().rejected).toBe(0);
    expect(getSyncStatus().pending).toBeGreaterThan(0);
    networkDown(false);
    await syncNow();
    expect(table("entries").has(d.entry.id)).toBe(true);
    expect(getSyncStatus()).toMatchObject({ state: "idle", pending: 0, rejected: 0 });
  });
});

describe("deleting a refused slip clears the warning", () => {
  beforeAll(async () => {
    stopSync();
    authState.session = { user: { id: "u1" } };
    for (const t of ["entries", "deductions", "companions", "habits", "profiles", "clean_days"]) table(t).clear();
    refuse("entries", overLimit);
    seed([slip(1, 300), slip(2, 12_000_000)]);
    await startSync("u1");
  });
  afterAll(() => { stopSync(); clearRefusals(); });

  it("removes it from the refused list", async () => {
    expect(getSyncStatus().rejected).toBe(1);
    actions.deleteEntry(eid(2));
    await syncNow();
    expect(getSyncStatus()).toMatchObject({ state: "idle", pending: 0, rejected: 0 });
  });
});

describe("an amount the account can't store is never saved in the first place", () => {
  beforeAll(() => { seed([]); });
  const habit = () => getData().habits[0];

  it.each([[12_000_000, "10,000,000"], [-5, "negative"], [10_000_000.01, "10,000,000"]])("%s is refused with a reason", (n, words) => {
    expect(amountProblem(habit(), { amount: String(n) })).toContain(words);
    expect(actions.logSlip(H, { amount: String(n) })).toBeNull();
    expect(getData().entries).toHaveLength(0);
  });

  it("zero, an ordinary amount and the limit itself are fine", () => {
    for (const n of [0, 420, 10_000_000]) {
      expect(amountProblem(habit(), { amount: String(n) })).toBeNull();
      expect(actions.logSlip(H, { amount: String(n) })).not.toBeNull();
    }
    expect(getData().entries).toHaveLength(3);
  });

  it("an empty amount isn't an error: it is simply left out", () => {
    expect(amountProblem(habit(), {})).toBeNull();
    expect(amountProblem(habit(), { amount: "" })).toBeNull();
  });
});
