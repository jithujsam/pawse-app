import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { addDays, daysBetween, range, today, weekStart } from "../src/dates";
import { countTriggers } from "../src/questions";

// Days are the phone's local calendar days. Check the arithmetic across DST changes and at midnight.
const tz = process.env.TZ;
afterEach(() => { vi.useRealTimers(); });
afterAll(() => { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz; });

const JAN_OFFSET: Record<string, number> = { "America/New_York": 300, "Europe/London": 0, "Asia/Kolkata": -330, "Australia/Sydney": -660 };

describe.each(Object.keys(JAN_OFFSET))("calendar days in %s", (zone) => {
  it("step one day at a time across the DST changes", () => {
    process.env.TZ = zone;
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(JAN_OFFSET[zone]); // the zone really is in effect
    for (const [a, b] of [["2026-03-07", "2026-03-08"], ["2026-03-08", "2026-03-09"], ["2026-03-28", "2026-03-29"], ["2026-03-29", "2026-03-30"],
      ["2026-10-03", "2026-10-04"], ["2026-10-04", "2026-10-05"], ["2026-10-31", "2026-11-01"], ["2026-11-01", "2026-11-02"]]) {
      expect(addDays(a, 1)).toBe(b);
      expect(addDays(b, -1)).toBe(a);
      expect(daysBetween(a, b)).toBe(1);
    }
    expect(range("2026-01-01", "2026-12-31")).toHaveLength(365);
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // a Sunday belongs to the week that started Monday
  });

  it("today() turns over exactly at local midnight", () => {
    process.env.TZ = zone;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 23, 59, 59));
    expect(today()).toBe("2026-10-24");
    vi.setSystemTime(new Date(2026, 9, 25, 0, 0, 0));
    expect(today()).toBe("2026-10-25");
  });
});

describe("late night", () => {
  it("counts as a trigger from 22:00 to 03:59 only", () => {
    const hours = Array.from({ length: 24 }, (_, h) => countTriggers([], {}, h));
    expect(hours.map((n, h) => (n ? h : -1)).filter((h) => h >= 0)).toEqual([0, 1, 2, 3, 22, 23]);
    expect(countTriggers([], {}, null)).toBe(0); // no time known: never guessed
  });
});
