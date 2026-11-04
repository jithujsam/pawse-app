import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerAccess } from "@detox/schema";

/**
 * Membership on the phone (src/access.ts): the gate it works out from the server's answer, how that answer is kept
 * for offline use and for which account, and what a closed gate does and never does to recovery data and sync.
 */

// IndexedDB stand-in (the real persistence and cache code runs against it).
const mem = vi.hoisted(() => ({ rows: new Map<string, unknown>() }));
vi.mock("../src/db", () => ({
  idbAvailable: () => false,
  kv: {
    get: async (k: string) => (mem.rows.has(k) ? structuredClone(mem.rows.get(k)) : undefined),
    set: async (k: string, v: unknown) => { mem.rows.set(k, structuredClone(v)); },
    del: async (k: string) => { mem.rows.delete(k); },
    clear: async () => { mem.rows.clear(); },
  },
}));

// The server: my_access answers per account; sync's tables come from the in-memory Supabase stand-in.
// Sheets portal into document.body; the screens rendered here only need their own content.
vi.mock("../src/ui/Sheet", async (orig) => ({ ...(await orig<object>()), Sheet: () => null }));

const server = vi.hoisted(() => ({
  account: "u1",
  answers: {} as Record<string, unknown>,
  /** "network": the call fails; "missing": the function doesn't exist (a server before migration 0014). */
  fail: null as null | "network" | "missing",
  gate: null as null | Promise<void>,
}));
vi.mock("../src/supabase", async () => {
  const fake = await import("./fake-supabase");
  return {
    configured: true,
    supabase: {
      from: fake.client.from,
      rpc: async (fn: string) => {
        if (fn !== "my_access") return { data: null, error: { message: "unknown" } };
        const forAccount = server.account;
        if (server.gate) await server.gate;
        if (server.fail === "network") throw new Error("offline");
        if (server.fail === "missing") return { data: null, error: { code: "PGRST202", message: "Could not find the function public.my_access" } };
        return { data: server.answers[forAccount] ?? null, error: null };
      },
    },
  };
});

const { decide, allows, trackAllowance, startAccess, stopAccess, refreshAccess, getGate, can, OFFLINE_GRACE_MS } = await import("../src/access");
const { actions, getData } = await import("../src/store");
const { blank } = await import("../src/persist");
const { today } = await import("../src/dates");
const { table } = await import("./fake-supabase");
const { startSync, stopSync, getSyncStatus } = await import("../src/sync");

const DAY = 86_400_000;
const at = (ms: number) => new Date(ms).toISOString();
function answer(state: ServerAccess["state"], opts: { until?: number | null; verified?: boolean; plan?: "basic" | "ai" | null; now?: number } = {}): ServerAccess {
  const now = opts.now ?? Date.now();
  const app = state === "trial" || state === "basic" || state === "ai";
  const until = opts.until === undefined ? (app ? now + 5 * DAY : null) : opts.until;
  return {
    state, app, ai: state === "ai" || (state === "trial" && opts.verified !== false), email_verified: opts.verified !== false,
    tracks: state === "trial" ? 1 : app ? 50 : 0, valid_until: until === null ? null : at(until),
    trial_ends_at: state === "trial" ? at(until ?? now) : null, plan: opts.plan ?? (state === "basic" || state === "ai" ? state : null),
    plan_status: state === "basic" || state === "ai" ? "active" : null, period_end: state === "basic" || state === "ai" ? at(until ?? now) : null,
    server_time: at(now),
  };
}
const cache = (uid: string, access: ServerAccess, checkedAt = Date.now(), skew = 0) => ({ uid, access, checkedAt, skew });

describe("the gate, from what the server said", () => {
  const now = Date.UTC(2026, 10, 3, 12);
  it("signed out: nothing to gate", () => expect(decide(null, null, now, null)).toEqual({ kind: "off" }));
  it("signed in, no answer yet: loading; can't reach the server: unverifiable; server without membership: off", () => {
    expect(decide(null, "u1", now, null).kind).toBe("loading");
    expect(decide(null, "u1", now, "network").kind).toBe("unverifiable");
    expect(decide(null, "u1", now, "invalid").kind).toBe("unverifiable");
    expect(decide(null, "u1", now, "missing").kind).toBe("off");
  });
  it("never reads another account's answer", () => {
    expect(decide(cache("u2", answer("ai", { now }), now), "u1", now, "network").kind).toBe("unverifiable");
  });
  it("trial, Basic and AI are open; AI only for the trial and the AI plan", () => {
    for (const s of ["trial", "basic", "ai"] as const) {
      const g = decide(cache("u1", answer(s, { now }), now), "u1", now, null);
      expect(g.kind).toBe("open");
      expect(allows(g, "app")).toBe(true);
      expect(allows(g, "ai")).toBe(s !== "basic");
    }
  });
  it("a trial without a confirmed email is open, without AI", () => {
    const g = decide(cache("u1", answer("trial", { now, verified: false }), now), "u1", now, null);
    expect(allows(g, "app")).toBe(true);
    expect(allows(g, "ai")).toBe(false);
  });
  it("expired, refunded and revoked are locked, and say why", () => {
    for (const s of ["expired", "refunded", "revoked"] as const) {
      const g = decide(cache("u1", answer(s, { now }), now), "u1", now, null);
      expect(g).toMatchObject({ kind: "locked", reason: s });
      expect(allows(g, "app")).toBe(false);
      expect(allows(g, "ai")).toBe(false);
      expect(allows(g, "new_track", 0)).toBe(false);
    }
  });
  it("an end date passing locks the app, even offline, without asking the server", () => {
    const c = cache("u1", answer("trial", { now, until: now + DAY }), now);
    expect(decide(c, "u1", now + DAY - 1000, "network").kind).toBe("open");
    expect(decide(c, "u1", now + DAY, "network")).toMatchObject({ kind: "locked", reason: "expired" });
  });
  it("trusts an answer offline for the grace period, then asks to reconnect", () => {
    const c = cache("u1", answer("ai", { now, until: now + 300 * DAY }), now);
    expect(decide(c, "u1", now + OFFLINE_GRACE_MS - 1000, "network")).toMatchObject({ kind: "open", stale: true });
    expect(decide(c, "u1", now + OFFLINE_GRACE_MS + 1000, "network")).toMatchObject({ kind: "locked", reason: "unconfirmed" });
  });
  it("the grace period is seven days", () => expect(OFFLINE_GRACE_MS).toBe(7 * DAY));
  it("a phone clock that runs ahead or behind is corrected by the server's time", () => {
    // The phone was 2 days fast when it checked: the end date is read in server time.
    const c = cache("u1", answer("trial", { now, until: now + 3 * DAY }), now + 2 * DAY, -2 * DAY);
    expect(decide(c, "u1", now + 2 * DAY + 2 * DAY, null).kind).toBe("open");
    expect(decide(c, "u1", now + 2 * DAY + 3 * DAY, null).kind).toBe("locked");
  });
  it("one recovery track in the trial, 50 with a plan, none once locked", () => {
    const trial = decide(cache("u1", answer("trial", { now }), now), "u1", now, null);
    expect(allows(trial, "new_track", 0)).toBe(true);
    expect(allows(trial, "new_track", 1)).toBe(false);
    expect(trackAllowance(trial)).toBe(1);
    const basic = decide(cache("u1", answer("basic", { now }), now), "u1", now, null);
    expect(allows(basic, "new_track", 49)).toBe(true);
    expect(trackAllowance(basic)).toBe(50);
    expect(trackAllowance({ kind: "off" })).toBe(50);
  });
  it("while the phone can't tell, AI is left to the server; the app waits", () => {
    expect(allows({ kind: "loading" }, "app")).toBe(false);
    expect(allows({ kind: "unverifiable" }, "app")).toBe(false);
    expect(allows({ kind: "unverifiable" }, "ai")).toBe(true);
    expect(allows({ kind: "off" }, "app")).toBe(true);
  });
});

// ---------- the live module ----------

const C = "11111111-1111-4111-8111-111111111111", H = "22222222-2222-4222-8222-222222222222", E = "33333333-3333-4333-8333-333333333333";
function seed() {
  const d = blank();
  actions.applyRemote({
    ...d,
    settings: { ...d.settings, onboarded: true },
    companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: "2026-10-01", diedOn: null, finalAge: null, trackId: H }],
    habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields: [] }],
    // A slip whose explanation the AI wrote, before access ended.
    entries: [{ id: E, habitId: H, companionId: C, day: "2026-10-02", time: null, values: {}, amount: 300, months: 2.8, severity: 0.7, effects: ["tired_eyes"], explanation: "Biscuit noticed the late order.", source: "ai", aiAdjustPct: null, createdAt: 1 }],
    cleanDays: [{ habitId: H, day: "2026-10-03" }],
    journal: [{ day: "2026-10-03", mood: 3, body: "ok day" }],
  });
}
const newTrack = (name: string) => actions.createTrack({ name, cls: "custom", unit: "none", species: "cat", companionName: "Miso" });

beforeEach(() => {
  stopAccess();
  mem.rows.clear();
  server.account = "u1"; server.answers = {}; server.fail = null; server.gate = null;
});

describe("loading, caching and switching accounts", () => {
  it("reads the server's answer after sign-in and keeps it for that account", async () => {
    server.answers.u1 = answer("trial");
    await startAccess("u1");
    expect(getGate()).toMatchObject({ kind: "open", access: { state: "trial" } });
    expect(mem.rows.get("access:u1")).toMatchObject({ uid: "u1", access: { state: "trial" } });
  });

  it("offline at the next launch: the kept answer is used, marked stale", async () => {
    server.answers.u1 = answer("ai", { until: Date.now() + 200 * DAY });
    await startAccess("u1");
    stopAccess();
    server.fail = "network";
    await startAccess("u1");
    expect(getGate()).toMatchObject({ kind: "open", stale: true, access: { state: "ai" } });
  });

  it("another account signing in never inherits the last one's membership", async () => {
    server.answers.u1 = answer("ai", { until: Date.now() + 200 * DAY });
    await startAccess("u1");
    stopAccess();
    server.account = "u2"; server.fail = "network";
    await startAccess("u2");
    expect(getGate().kind).toBe("unverifiable");
    expect(can("app")).toBe(false);
  });

  it("an answer that arrives after sign-out is dropped", async () => {
    server.answers.u1 = answer("ai");
    let release!: () => void;
    server.gate = new Promise((r) => { release = r; });
    const started = startAccess("u1");
    await Promise.resolve();
    stopAccess();
    release();
    await started;
    expect(getGate()).toEqual({ kind: "off" });
    expect(mem.rows.has("access:u1")).toBe(false);
  });

  it("an erase (sign-out wipes this phone) takes the kept answer with it", async () => {
    server.answers.u1 = answer("ai");
    await startAccess("u1");
    await actions.resetAll();
    expect([...mem.rows.keys()].some((k) => k.startsWith("access:"))).toBe(false);
  });

  it("reinstalling can't restart a trial: a fresh phone asks the server, which says it ended", async () => {
    server.answers.u1 = answer("expired");
    await startAccess("u1");
    expect(getGate()).toMatchObject({ kind: "locked", reason: "expired" });
  });

  it("a malformed or over-generous answer is not trusted", async () => {
    server.answers.u1 = { ...answer("basic"), ai: true };
    await startAccess("u1");
    expect(getGate().kind).toBe("unverifiable");
    server.answers.u1 = { state: "ai" };
    await refreshAccess();
    expect(getGate().kind).toBe("unverifiable");
  });

  it("a server without membership (before migration 0014) gates nothing", async () => {
    server.fail = "missing";
    await startAccess("u1");
    expect(getGate()).toEqual({ kind: "off" });
    expect(can("app")).toBe(true);
  });

  it("a purchase or renewal shows up on the next check", async () => {
    server.answers.u1 = answer("expired");
    await startAccess("u1");
    expect(getGate().kind).toBe("locked");
    server.answers.u1 = answer("basic", { until: Date.now() + 365 * DAY });
    await refreshAccess();
    expect(getGate()).toMatchObject({ kind: "open", access: { state: "basic" } });
  });
});

describe("a closed paywall never touches recovery data", () => {
  beforeEach(() => { seed(); });

  it("stops new check-ins, slips, urges, reflections and tracks", async () => {
    server.answers.u1 = answer("expired");
    await startAccess("u1");
    const before = JSON.stringify({ ...getData(), updatedAt: 0 });
    expect(actions.logSlip(H, {}, today())).toBeNull();
    expect(actions.markClean(H, today())).toBe(false);
    expect(actions.recordUrge(H, 3, "rode_it_out")).toBeNull();
    actions.setJournal(today(), 4, "new words");
    actions.setTone("brutal");
    expect(newTrack("Second")).toBeNull();
    expect(JSON.stringify({ ...getData(), updatedAt: 0 })).toBe(before);
  });

  it("keeps every record, the AI's past explanations included, and export still has all of it", async () => {
    for (const state of ["expired", "refunded", "revoked"] as const) {
      server.answers.u1 = answer(state);
      await startAccess("u1");
      const file = JSON.parse(actions.exportJson());
      expect(file.habits).toHaveLength(1);
      expect(file.entries[0]).toMatchObject({ id: E, source: "ai", explanation: "Biscuit noticed the late order.", effects: ["tired_eyes"] });
      expect(file.cleanDays).toHaveLength(1);
      expect(file.journal).toHaveLength(1);
      stopAccess();
    }
  });

  it("rows from the account's other phones still arrive", async () => {
    server.answers.u1 = answer("expired");
    await startAccess("u1");
    actions.applyRemote({ ...getData(), cleanDays: [...getData().cleanDays, { habitId: H, day: "2026-10-04" }] });
    expect(getData().cleanDays).toHaveLength(2);
  });

  it("renewing opens everything exactly as it was, and new records work again", async () => {
    server.answers.u1 = answer("expired");
    await startAccess("u1");
    const before = JSON.stringify({ ...getData(), updatedAt: 0 });
    server.answers.u1 = answer("ai", { until: Date.now() + 365 * DAY });
    await refreshAccess();
    expect(JSON.stringify({ ...getData(), updatedAt: 0 })).toBe(before);
    expect(actions.markClean(H, today())).toBe(true);
  });

  it("Basic: the whole app works, AI is not asked", async () => {
    server.answers.u1 = answer("basic", { until: Date.now() + 365 * DAY });
    await startAccess("u1");
    expect(actions.markClean(H, today())).toBe(true);
    expect(can("ai")).toBe(false);
    expect(newTrack("Second")).not.toBeNull();
  });
});

describe("the trial's one track", () => {
  beforeEach(() => { seed(); });

  it("the trial allows one track; a plan allows more", async () => {
    server.answers.u1 = answer("trial");
    await startAccess("u1");
    expect(newTrack("Second")).toBeNull();
    expect(getData().habits).toHaveLength(1);
    server.answers.u1 = answer("ai", { until: Date.now() + 365 * DAY });
    await refreshAccess();
    expect(newTrack("Second")).not.toBeNull();
    expect(getData().habits).toHaveLength(2);
  });

  it("restoring a backup keeps every track in it, whatever the plan allows", async () => {
    server.answers.u1 = answer("ai", { until: Date.now() + 365 * DAY });
    await startAccess("u1");
    newTrack("Second"); newTrack("Third");
    const file = actions.exportJson();
    actions.applyRemote({ ...blank(), settings: { ...blank().settings } });
    server.answers.u1 = answer("trial");
    await refreshAccess();
    expect(actions.importJson(file)).toBe(true);
    expect(getData().habits).toHaveLength(3);
  });

  it("a plan ending later leaves every track, active or archived, where it was", async () => {
    server.answers.u1 = answer("ai", { until: Date.now() + 365 * DAY });
    await startAccess("u1");
    const second = newTrack("Second")!;
    expect(actions.archiveTrack(second)).toBe(true);
    const before = JSON.stringify(getData().habits);
    server.answers.u1 = answer("trial");
    await refreshAccess();
    server.answers.u1 = answer("expired");
    await refreshAccess();
    expect(JSON.stringify(getData().habits)).toBe(before);
  });
});

describe("sync keeps backing up behind the paywall", () => {
  it("changes made before access ended still reach the account, and nothing is refused", async () => {
    table("companions").clear(); table("habits").clear(); table("entries").clear(); table("clean_days").clear();
    server.answers.u1 = answer("trial");
    await startAccess("u1");
    seed();
    expect(actions.markClean(H, "2026-10-05")).toBe(true);
    server.answers.u1 = answer("expired");
    await refreshAccess();
    expect(getGate().kind).toBe("locked");
    await startSync("u1");
    expect(getSyncStatus()).toMatchObject({ state: "idle", pending: 0 });
    expect([...table("clean_days").values()].map((r) => r.day).sort()).toEqual(["2026-10-03", "2026-10-05"]);
    expect(table("entries").size).toBe(1);
    stopSync();
  });
});

describe("past AI text stays viewable; only new AI waits (Basic, expired, refunded, revoked)", () => {
  const WEEK = "2026-09-28";
  beforeEach(() => {
    seed();
    actions.applyRemote({ ...getData(), summaries: { [H]: { [WEEK]: "A steadier week: two quiet evenings in a row." } } });
  });
  const view = async (state: "basic" | "expired" | "refunded" | "revoked") => {
    server.answers.u1 = answer(state, state === "basic" ? { until: Date.now() + 365 * DAY } : {});
    await startAccess("u1");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DayDetail } = await import("../src/screens/Calendar");
    const { Report } = await import("../src/screens/Report");
    const day = renderToStaticMarkup(createElement(DayDetail, { day: "2026-10-02", standalone: true }));
    const insights = renderToStaticMarkup(createElement(Report));
    return { day, insights };
  };

  for (const state of ["basic", "expired", "refunded", "revoked"] as const) {
    it(`${state}: the slip's AI explanation and earlier weekly summaries are on screen, and no new AI is allowed`, async () => {
      const { day, insights } = await view(state);
      expect(day).toContain("Biscuit noticed the late order.");
      expect(insights).toContain("Earlier summaries");
      expect(insights).toContain("A steadier week: two quiet evenings in a row.");
      expect(can("ai")).toBe(false);
      expect(getGate().kind).toBe(state === "basic" ? "open" : "locked");
    });
  }

  it("the AI plan: the same text is on screen, and new AI is allowed", async () => {
    server.answers.u1 = answer("ai", { until: Date.now() + 365 * DAY });
    await startAccess("u1");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DayDetail } = await import("../src/screens/Calendar");
    expect(renderToStaticMarkup(createElement(DayDetail, { day: "2026-10-02", standalone: true }))).toContain("Biscuit noticed the late order.");
    expect(can("ai")).toBe(true);
  });

  it("trying to record behind a closed paywall says so (the app shows the paywall), and changes nothing", async () => {
    const { onWriteRefused } = await import("../src/store");
    server.answers.u1 = answer("expired");
    await startAccess("u1");
    let refused = 0;
    const off = onWriteRefused(() => { refused++; });
    const before = JSON.stringify({ ...getData(), updatedAt: 0 });
    expect(actions.logSlip(H, {}, today())).toBeNull();
    expect(actions.markClean(H, today())).toBe(false);
    expect(actions.recordUrge(H, 3, "rode_it_out")).toBeNull();
    expect(refused).toBe(3);
    expect(JSON.stringify({ ...getData(), updatedAt: 0 })).toBe(before);
    // Background saves (settings, sync bookkeeping) never raise it.
    actions.setTone("brutal");
    expect(refused).toBe(3);
    off();
  });
});
