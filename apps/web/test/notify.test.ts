import { describe, expect, it, vi } from "vitest";

// On the web nothing can schedule a reminder, so turning reminders on must not claim they're on (audit B4).
vi.stubGlobal("window", { Notification: { requestPermission: async () => "granted" } });
vi.stubGlobal("Notification", { requestPermission: async () => "granted" });

const { requestReminders, remindersSupported } = await import("../src/notify");
const { getData } = await import("../src/store");

describe("reminders outside the phone app", () => {
  it("stay off even when the browser grants permission", async () => {
    expect(remindersSupported).toBe(false);
    expect(await requestReminders("21:00", "honest", "Biscuit")).toBe(false);
    expect(getData().settings.remindersOn).toBe(false);
    expect(getData().settings.reminder).toBe("21:00");
  });
});

describe("notification plan: at most two a day", async () => {
  const { planNotifications, MAX_PER_DAY } = await import("../src/notify");
  const at = (d: number, h: number, m = 0) => new Date(2026, 9, 20 + d, h, m);
  const base = {
    now: at(0, 18), enabled: true, reminder: "20:00", tone: "honest" as const, name: "Biscuit", checkedToday: false,
    lastCheckIn: "2026-10-20", riskHour: 23, careNotes: true, care: null,
  };
  const perDay = (plan: ReturnType<typeof planNotifications>) => {
    const m = new Map<string, string[]>();
    for (const n of plan) { const k = n.at.toDateString(); m.set(k, [...(m.get(k) ?? []), n.kind]); }
    return m;
  };

  it("with empty days still open: a morning and a bedtime note, naming the pets, until the days lock", () => {
    const plan = planNotifications({ ...base, riskHour: null, careNotes: false, lastCheckIn: "2026-10-20", catchup: [{ name: "Biscuit", days: ["2026-10-18", "2026-10-19"] }, { name: "Pepper", days: ["2026-10-20"] }] });
    const day = (d: number) => plan.filter((n) => n.at.toDateString() === at(d, 0).toDateString());
    // Today: bedtime note only (9:00 has passed); it is the day's reminder, so no separate daily note.
    expect(day(0).map((n) => n.kind)).toEqual(["catchup"]);
    expect(day(0)[0].title).toBe("📝 Biscuit and Pepper need an update");
    expect(day(0)[0].body).toBe("2 open days. Update before they lock. ⏳");
    // Tomorrow both are still open, with a morning note too. On the 22nd the 18th has locked: one day each.
    expect(day(1).map((n) => n.kind)).toEqual(["catchup", "catchup"]);
    expect(day(1)[0].at.getHours()).toBe(9);
    expect(day(2)[0].body).toBe("1 open day. Update before they lock. ⏳");
    // Once every day has locked, only the usual reminder remains.
    expect(day(4).map((n) => n.kind)).toEqual(["daily"]);
    expect(plan.every((n) => !/miss/i.test(`${n.title} ${n.body}`))).toBe(true);
    const gentle = planNotifications({ ...base, tone: "gentle", riskHour: null, catchup: [{ name: "Biscuit", days: ["2026-10-20"] }] });
    expect(gentle.find((n) => n.kind === "catchup")!.title).toBe("📝 Biscuit is missing you");
  });
  it("uses the pet's name and the person's name, with an emoji, in every voice; no name given means no comma", () => {
    for (const tone of ["gentle", "honest", "brutal"] as const) {
      const plan = planNotifications({ ...base, tone, userName: "Jithu", personality: "playful", checkedToday: true, care: { kind: "clean", at: at(0, 18).getTime() }, catchup: [{ name: "Biscuit", days: ["2026-10-20"] }] });
      const day = (k: string) => plan.find((n) => n.kind === k)!;
      for (const k of ["daily", "catchup", "thanks", "risk"]) {
        const n = plan.find((x) => x.kind === k) ?? day("catchup");
        expect(`${n.title} ${n.body}`, `${tone}/${k}`).toMatch(/Biscuit/);
        expect(`${n.title} ${n.body}`, `${tone}/${k}`).toMatch(/Jithu/);
        expect(`${n.title} ${n.body}`, `${tone}/${k}`).toMatch(/\p{Extended_Pictographic}/u);
      }
    }
    const plain = planNotifications({ ...base, riskHour: null, careNotes: false }).find((n) => n.kind === "daily")!;
    expect(plain.title).toBe("✅ Check in with Biscuit");
  });
  it("nothing open means no catch-up notes", () => {
    expect(planNotifications({ ...base, catchup: [] }).some((n) => n.kind === "catchup")).toBe(false);
  });

  it("after a clean day: tonight's thank-you and the heads-up; no reminder for a day already checked in", () => {
    const plan = planNotifications({ ...base, checkedToday: true, care: { kind: "clean", at: at(0, 18).getTime() } });
    expect(perDay(plan).get(at(0, 0).toDateString())).toEqual(["thanks", "risk"]);
    // Tomorrow: the reminder and the heads-up win; the good-morning note is the one that gives way.
    expect(perDay(plan).get(at(1, 0).toDateString())).toEqual(["daily", "risk"]);
  });

  it("after a slip: no guilt note from the pet, and any thank-you planned for that day is gone", () => {
    const plan = planNotifications({ ...base, now: at(0, 21), checkedToday: true, care: { kind: "slip", at: at(0, 21).getTime() } });
    expect(plan.some((n) => n.kind === "thanks")).toBe(false);
    expect(plan.every((n) => !/eat|food|hungry/i.test(`${n.title} ${n.body}`))).toBe(true);
    expect(perDay(plan).get(at(1, 0).toDateString())).toEqual(["daily", "risk"]);
  });

  it("on a quiet day the neutral check-in note replaces that day's reminder, never adds to it", () => {
    const plan = planNotifications({ ...base, lastCheckIn: "2026-10-18", riskHour: null });
    const day = perDay(plan).get(at(0, 0).toDateString())!; // 2 quiet days since the 18th
    expect(day).toEqual(["lapse"]);
    expect(plan.filter((n) => n.kind === "daily" && n.at.toDateString() === at(0, 0).toDateString())).toHaveLength(0);
  });

  it("quiet-day notes speak in the pet's voice, name the gap and say today still counts", () => {
    for (const personality of ["playful", "calm", "sassy", "wise", "savage"] as const) for (const tone of ["gentle", "honest", "brutal"] as const) {
      const plan = planNotifications({ ...base, tone, personality, lastCheckIn: "2026-10-18", riskHour: null });
      const lapses = plan.filter((n) => n.kind === "lapse");
      expect(lapses.length, `${personality}/${tone}`).toBeGreaterThan(0);
      for (const n of lapses) {
        expect(n.body, `${personality}/${tone}`).toMatch(/\d/);
        expect(n.body).not.toMatch(/lonely|hungry|sick|abandon/i);
      }
    }
  });

  it("the pet's own lines for today replace the hand-written ones, and nothing else changes", () => {
    const voice = { waiting: "w", goalMet: "g", afterSlip: "a", away: "Two days. I chewed a cushion. Today counts.", morning: "Slept like royalty.", risk: "Slip o'clock. Change the ending.", thanks: "Goal met. Delicious." };
    for (const riskHour of [null, 23]) {
      const plain = planNotifications({ ...base, riskHour, checkedToday: true, care: { kind: "clean", at: at(0, 18).getTime() } });
      const own = planNotifications({ ...base, riskHour, voice, checkedToday: true, care: { kind: "clean", at: at(0, 18).getTime() } });
      expect(own.map((n) => [n.kind, n.at.getTime()])).toEqual(plain.map((n) => [n.kind, n.at.getTime()]));
      expect(own.find((n) => n.kind === "thanks")!.body).toBe("Goal met. Delicious. 💛");
      // With a risky hour the good-morning loses its place to the heads-up (two a day), so each is checked where it is kept.
      if (riskHour === null) expect(own.find((n) => n.kind === "morning")!.body).toBe("Slept like royalty. ☀️");
      else expect(own.find((n) => n.kind === "risk")!.body).toBe("Slip o'clock. Change the ending. 🌙");
    }
    const quiet = planNotifications({ ...base, voice, lastCheckIn: "2026-10-18", riskHour: null }).find((n) => n.kind === "lapse")!;
    expect(quiet.body).toBe("Two days. I chewed a cushion. Today counts. 🐾");
  });

  it("never more than two on any day, whatever the mix", () => {
    for (const checkedToday of [false, true]) for (const riskHour of [null, 0, 9, 21, 23]) for (const care of [null, { kind: "clean" as const, at: at(0, 7).getTime() }, { kind: "slip" as const, at: at(0, 20).getTime() }])
      for (const lastCheckIn of [null, "2026-10-10", "2026-10-18", "2026-10-20"]) for (const reminder of ["08:20", "21:15", "22:00"]) {
        const plan = planNotifications({ ...base, checkedToday, riskHour, care, lastCheckIn, reminder });
        for (const kinds of perDay(plan).values()) expect(kinds.length).toBeLessThanOrEqual(MAX_PER_DAY);
        expect(new Set(plan.map((n) => n.id)).size).toBe(plan.length);
        expect(plan.every((n) => n.at.getTime() > base.now.getTime())).toBe(true);
      }
  });

  it("nothing at all when reminders are off", () => {
    expect(planNotifications({ ...base, enabled: false, care: { kind: "clean", at: at(0, 18).getTime() } })).toEqual([]);
  });
});
