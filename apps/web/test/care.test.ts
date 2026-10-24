import { describe, expect, it } from "vitest";
import { careNote, recoveryLine, say, type Event } from "../src/voice";
import { blank, normalize } from "../src/persist";
import { toRemote, merge, type Pulled } from "../src/syncmap";
import { treatsLeft } from "../src/store";
import { COATS, coatFor, mix } from "../src/pets";
import type { AppData, Personality, Tone } from "../src/types";

const EVENTS: Event[] = ["petted", "giggle", "dizzy", "stroke", "fed", "full", "strike", "treat", "noTreats", "cleanThanks", "shrug", "binge", "slip"];
const PERS: Personality[] = ["playful", "calm", "sassy", "wise"];
const TONES: Tone[] = ["gentle", "honest", "brutal"];
const SHAME = /\b(loser|stupid|idiot|pathetic|worthless|disgusting|weak|failure|addict)\b/i;

describe("companion voice", () => {
  it("has a line for every event, personality and tone, and none of them shame the person", () => {
    for (const e of EVENTS) for (const p of PERS) for (const t of TONES) {
      const line = say(e, p, t, 42);
      expect(line.length, `${e}/${p}/${t}`).toBeGreaterThan(3);
      expect(line).not.toMatch(SHAME);
      expect(line).not.toContain("{d}");
    }
  });
  it("the shrug-off names the streak that earned it", () => {
    for (const p of PERS) for (const t of TONES) expect(say("shrug", p, t, 63)).toContain("63");
  });
  it("notifications speak as the pet, in every voice", () => {
    for (const k of ["thanks", "strike", "morning"] as const) for (const p of PERS) for (const t of TONES) {
      const n = careNote(k, p, t, "Miso");
      expect(n.title).toContain("Miso");
      expect(n.body.length).toBeGreaterThan(5);
    }
  });
  it("the recovery line carries the engine's numbers", () => {
    for (const t of TONES) {
      const l = recoveryLine(t, "Miso", 3, { days: 12, label: "Young" });
      expect(l).toContain("3 clean days");
      expect(l).toContain("12 clean days");
    }
    expect(recoveryLine("honest", "Miso", 1, null)).toContain("1 clean day ");
  });
});

function sample(): AppData {
  const d = blank();
  return {
    ...d,
    settings: { ...d.settings, onboarded: true, treatsGiven: 1 },
    companions: [{ id: "c1", species: "fox", coat: "arctic", personality: "sassy", name: "Ember", bornOn: "2026-10-01", diedOn: null, finalAge: null }],
    habits: [{ id: "h1", name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: "c1", unit: "money", fields: [] }],
    entries: [{ id: "e1", habitId: "h1", companionId: "c1", day: "2026-10-05", time: null, values: {}, amount: 1, months: 2, severity: 1, effects: [], explanation: "", source: "baseline", aiAdjustPct: null, createdAt: 1 }],
    cleanDays: [{ habitId: "h1", day: "2026-10-02" }, { habitId: "h1", day: "2026-10-03" }, { habitId: "h1", day: "2026-10-04" }],
  };
}

describe("care data", () => {
  it("treats: one per clean day, minus those given", () => {
    expect(treatsLeft(sample(), "h1")).toBe(2);
    expect(treatsLeft({ ...sample(), settings: { ...sample().settings, treatsGiven: 9 } }, "h1")).toBe(0);
  });
  it("coat, personality and care settings survive storage and sync", () => {
    const d = normalize(JSON.parse(JSON.stringify(sample())))!;
    expect(d.companions[0]).toMatchObject({ species: "fox", coat: "arctic", personality: "sassy" });
    const [row] = toRemote("c:c1", d, "u", 5);
    expect(row.row).toMatchObject({ species: "fox", coat: "arctic", personality: "sassy" });
    const empty: Pulled = { profiles: [], companions: [{ ...row.row, born_on: "2026-10-01", client_updated_at: 9 }], habits: [], entries: [], deductions: [], clean_days: [], weekly_reports: [] };
    const back = merge({ ...d, companions: [] }, empty, {}).data;
    expect(back.companions[0]).toMatchObject({ coat: "arctic", personality: "sassy" });
  });
  it("older companions without a coat get the species' first coat", () => {
    expect(coatFor("dog").id).toBe(COATS.dog[0].id);
    expect(coatFor("owl", "nope").id).toBe(COATS.owl[0].id);
  });
  it("mixes colours", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#123456", "#ffffff", 0)).toBe("#123456");
  });
});

import { riskyHour } from "../src/store";
import { tombstone } from "../src/syncmap";

describe("urges, journal and risky hours", () => {
  const withUrges = (): AppData => ({
    ...sample(),
    urges: [{ id: "11111111-1111-4111-8111-111111111111", habitId: "h1", day: "2026-10-06", time: "22:10", strength: 4, outcome: "rode_it_out", createdAt: 5 }],
    journal: [{ day: "2026-10-06", mood: 4, body: "Walked instead." }],
  });
  it("round-trips urges and journal through storage and sync", () => {
    const d = normalize(JSON.parse(JSON.stringify(withUrges())))!;
    expect(d.urges).toHaveLength(1);
    expect(d.journal[0].body).toBe("Walked instead.");
    const [u] = toRemote("u:11111111-1111-4111-8111-111111111111", d, "uid", 7);
    expect(u).toMatchObject({ table: "urges", row: { habit_id: "h1", strength: 4, outcome: "rode_it_out", occurred_at: "22:10" } });
    const [j] = toRemote("j:2026-10-06", d, "uid", 7);
    expect(j).toMatchObject({ table: "journal", row: { day: "2026-10-06", mood: 4, user_id: "uid" } });
    expect(tombstone("j:2026-10-06")).toEqual({ table: "journal", match: { day: "2026-10-06" } });
    const pulled: Pulled = { profiles: [], companions: [], habits: [], entries: [], deductions: [], clean_days: [], weekly_reports: [],
      urges: [{ ...u.row, client_updated_at: 9 }], journal: [{ ...j.row, client_updated_at: 9 }] };
    const back = merge({ ...d, urges: [], journal: [] }, pulled, {}).data;
    expect(back.urges[0]).toMatchObject({ strength: 4, time: "22:10" });
    expect(back.journal[0]).toMatchObject({ mood: 4, body: "Walked instead." });
  });
  it("finds the risky hour only once there's a clear pattern", () => {
    const e = sample().entries[0];
    const at = (h: number, i: number) => ({ ...e, id: `e${i}`, time: `${String(h).padStart(2, "0")}:15` });
    expect(riskyHour({ ...sample(), entries: [at(22, 1), at(23, 2), at(22, 3), at(9, 4)] }, "h1")).toBeNull();
    expect(riskyHour({ ...sample(), entries: [at(22, 1), at(23, 2), at(22, 3), at(9, 4), at(21, 5), at(14, 6)] }, "h1")).toBe(22);
    expect(riskyHour({ ...sample(), entries: [1, 5, 9, 13, 17, 21].map((h, i) => at(h, i)) }, "h1")).toBeNull();
  });
});
