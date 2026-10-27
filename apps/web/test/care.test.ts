import { describe, expect, it } from "vitest";
import { careNote, recoveryLine, say, type Event } from "../src/voice";
import { absorbedLine, bingeLine, dyingBanner, greeting, quietBanner, welcomeBackLine } from "../src/copy";
import { blank, normalize } from "../src/persist";
import { toRemote, merge, type Pulled } from "../src/syncmap";
import { treatsLeft } from "../src/store";
import { defaultTrackState } from "../src/tracks";
import { COATS, coatFor, mix, tuxedoPixels } from "../src/pets";
import type { AppData, Personality, Tone } from "../src/types";

const EVENTS: Event[] = ["petted", "giggle", "dizzy", "stroke", "cleanThanks", "shrug", "binge", "slip", "rodeOut", "urgeStart"];
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
  it("slip-card, banner and welcome-back lines exist in all three tones, differ by tone, and never shame", () => {
    const lines = (t: Tone) => [dyingBanner(t, "Miso", 92), welcomeBackLine(t, "Miso"), absorbedLine(t, "Miso", 40, 4, true), absorbedLine(t, "Miso", 40, 2.5, false), bingeLine(t, "Miso"), quietBanner(t, "Miso")];
    const [g, h, b] = TONES.map(lines);
    for (const set of [g, h, b]) for (const l of set) { expect(l).not.toMatch(SHAME); expect(l.length).toBeGreaterThan(10); }
    for (let i = 0; i < h.length; i++) { expect(g[i]).not.toBe(h[i]); expect(b[i]).not.toBe(h[i]); }
    expect(absorbedLine("honest", "Miso", 40, 2.5, false)).toContain("2.5 months");
    expect(dyingBanner("brutal", "Miso", 92.4)).toContain("health 8%");
  });
  it("no line makes the pet's care conditional, refuses food, or disapproves of the person", () => {
    const CONDITIONAL = /\b(earn(ed)?|deserve|won'?t eat|refus\w*|hunger strike|on strike|disappoint\w*|disgust\w*|punish\w*|spoils? the meal|I saw that|not hungry|fast today|credit|forgave)\b/i;
    for (const e of EVENTS) for (const p of PERS) for (const t of TONES) for (let i = 0; i < 6; i++) expect(say(e, p, t, 12), `${e}/${p}/${t}`).not.toMatch(CONDITIONAL);
    for (const k of ["thanks", "morning", "risk"] as const) for (const p of PERS) for (const t of TONES) expect(careNote(k, p, t, "Miso").body).not.toMatch(CONDITIONAL);
  });
  it("an unknown tone or personality still gets a line, never undefined", () => {
    expect(say("slip", "playful", "mystery" as Tone)).toMatch(/\w/);
    expect(say("slip", "mystery" as Personality, "honest")).toMatch(/\w/);
    expect(careNote("risk", "mystery" as Personality, "mystery" as Tone, "Miso").body).toMatch(/\w/);
  });
  it("the shrug-off names the streak that earned it", () => {
    for (const p of PERS) for (const t of TONES) expect(say("shrug", p, t, 63)).toContain("63");
  });
  it("notifications speak as the pet, in every voice", () => {
    for (const k of ["thanks", "morning", "risk"] as const) for (const p of PERS) for (const t of TONES) {
      const n = careNote(k, p, t, "Miso");
      expect(n.title).toContain("Miso");
      expect(n.body.length).toBeGreaterThan(5);
    }
  });
  it("the recovery line carries the engine's numbers", () => {
    for (const t of TONES) {
      const l = recoveryLine(t, "Miso", 3, { days: 12, label: "Young" });
      expect(l).toContain("3 good days");
      expect(l).toContain("12 good days");
    }
    expect(recoveryLine("honest", "Miso", 1, null)).toContain("1 good day ");
  });
});

function sample(): AppData {
  const d = blank();
  return {
    ...d,
    settings: { ...d.settings, onboarded: true },
    companions: [{ id: "c1", species: "fox", coat: "arctic", personality: "sassy", name: "Ember", bornOn: "2026-10-01", diedOn: null, finalAge: null }],
    habits: [{ id: "h1", name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: "c1", unit: "money", fields: [], track: { ...defaultTrackState("2026-10-01"), treatsGiven: 1 } }],
    entries: [{ id: "e1", habitId: "h1", companionId: "c1", day: "2026-10-05", time: null, values: {}, amount: 1, months: 2, severity: 1, effects: [], explanation: "", source: "baseline", aiAdjustPct: null, createdAt: 1 }],
    cleanDays: [{ habitId: "h1", day: "2026-10-02" }, { habitId: "h1", day: "2026-10-03" }, { habitId: "h1", day: "2026-10-04" }],
  };
}

describe("care data", () => {
  it("treats: one per clean day, minus those given", () => {
    expect(treatsLeft(sample(), "h1")).toBe(2);
    const s = sample();
    expect(treatsLeft({ ...s, habits: s.habits.map((h) => ({ ...h, track: { ...h.track!, treatsGiven: 9 } })) }, "h1")).toBe(0);
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
  it("tuxedo repaint: dark fur goes light grey, light areas stay white, alpha is kept", () => {
    const px = new Uint8ClampedArray([40, 40, 40, 255, 250, 250, 250, 128]);
    tuxedoPixels(px);
    expect(px[0]).toBeGreaterThan(30);
    expect(px[0]).toBeLessThan(110);
    expect(px[4]).toBeGreaterThan(240);
    expect([px[3], px[7]]).toEqual([255, 128]);
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

describe("greeting", () => {
  it("uses the person's name in every tone and time of day, and reads cleanly without one", () => {
    for (const tone of TONES) for (const h of [8, 14, 19, 2]) {
      expect(greeting(tone, h, "Jo")).toContain("Jo");
      expect(greeting(tone, h, "  ")).not.toMatch(/,\s*[.?]|,\s*$/);
      expect(greeting(tone, h)).toBe(greeting(tone, h, ""));
    }
  });
});
