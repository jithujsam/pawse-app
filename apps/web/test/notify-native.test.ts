import { describe, expect, it, vi } from "vitest";

// On the phone: re-planning replaces the previous plan, cancels old repeating schedules, and never stacks (retries included).
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });

const pending = new Map<number, { id: number; schedule: { at: Date } }>();
const cancelled: number[] = [];
let failNextSchedule = false;
vi.mock("@capacitor/core", async (orig) => ({ ...(await orig<typeof import("@capacitor/core")>()), Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } }));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    cancel: async ({ notifications }: { notifications: { id: number }[] }) => { for (const { id } of notifications) { cancelled.push(id); pending.delete(id); } },
    checkPermissions: async () => ({ display: "granted" }),
    requestPermissions: async () => ({ display: "granted" }),
    schedule: async ({ notifications }: { notifications: { id: number; schedule: { at: Date } }[] }) => {
      await new Promise((r) => setTimeout(r, 1));
      if (failNextSchedule) { failNextSchedule = false; throw new Error("plugin busy"); }
      for (const n of notifications) pending.set(n.id, n);
    },
    addListener: async () => ({ remove: () => undefined }),
  },
}));

const { updateNotifications, scheduleCare, MAX_PER_DAY } = await import("../src/notify");
const countPerDay = () => { const m = new Map<string, number>(); for (const n of pending.values()) { const k = new Date(n.schedule.at).toDateString(); m.set(k, (m.get(k) ?? 0) + 1); } return m; };

describe("applying the plan on the phone", () => {
  it("cancels the old repeating schedules from earlier versions", async () => {
    await updateNotifications({ enabled: true, reminder: "20:00", tone: "honest", name: "Biscuit", lastCheckIn: null, riskHour: 22, careNotes: true });
    for (const id of [1001, 2001, 2002, 2003, 2004, 2010, 2011, 2012, 2013]) expect(cancelled).toContain(id);
  });

  it("many quick re-plans (and a failed one) still leave at most two a day, with no duplicates", async () => {
    failNextSchedule = true;
    await Promise.all([
      scheduleCare("clean", { tone: "honest", name: "Biscuit", enabled: true }),
      updateNotifications({ riskHour: 21 }),
      scheduleCare("slip", { tone: "honest", name: "Biscuit", enabled: true }),
      updateNotifications({ checkedToday: true }),
      updateNotifications({ reminder: "21:00" }),
    ]);
    expect(pending.size).toBeGreaterThan(0);
    for (const n of countPerDay().values()) expect(n).toBeLessThanOrEqual(MAX_PER_DAY);
  });

  it("turning reminders off clears everything", async () => {
    await updateNotifications({ enabled: false });
    expect(pending.size).toBe(0);
  });
});
