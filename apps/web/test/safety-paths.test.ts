import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { actions, defaultPetName, getData, scrubTracking } from "../src/store";
import { blank } from "../src/persist";
import { addDays, today } from "../src/dates";
import { emptyPlan } from "../src/store";
import { planConcern, planHasCrisis } from "../src/screens/Plan";
import { ConcernNote, GuardedInput, MultiSelect, SelectOther } from "../src/ui/Controls";
import { CRISIS_MESSAGE, RESTRICTION_NOTE } from "../src/copy";
import { OTHER_PREFIX } from "../src/questions";
import { PET_LINES } from "../src/voice";
import { NAMES } from "../src/pets";
import type { Habit, Species } from "../src/types";

/**
 * Regression cases for every way text used to get past the safety checks: tracking labels, custom questions,
 * typed answers, pet and personal names, plans and reflections, restored backups and synced rows. Each is refused at
 * the point it is saved, whatever the screen did or did not check.
 */
const t0 = today();
const C = "c1", H = "h1";
const field = (label: string, over: Partial<Habit["fields"][number]> = {}): Habit["fields"][number] => ({ id: `f_${Math.random().toString(36).slice(2, 7)}`, label, type: "text", required: false, ...over });
function load(fields: Habit["fields"] = [field("Notes (optional)")]) {
  const d = blank();
  actions.applyRemote({
    ...d,
    settings: { ...d.settings, onboarded: true, userName: "Asha" },
    companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: addDays(t0, -30), diedOn: null, finalAge: null, trackId: H }],
    habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields, track: undefined }],
  });
}
const intake = (over: Partial<Parameters<typeof actions.finishOnboarding>[0]["intake"]> = {}) => ({ what: "Ordering food or takeaway", measure: "money" as const, amountLabel: "", triggers: [] as string[], cls: "food_spending" as const, ...over });
const onboard = (over: Partial<Parameters<typeof actions.finishOnboarding>[0]> = {}) =>
  actions.finishOnboarding({ species: "cat", companionName: "", intake: intake(), tone: "honest", reminder: "20:00", baseline: null, ...over });

describe("tracking labels cannot be calorie, weight or restriction trackers", () => {
  it("onboarding refuses the count label, the name of the habit, the situations and the plan", () => {
    for (const bad of [{ intake: intake({ amountLabel: "calories" }) }, { intake: intake({ what: "Counting calories" }) }, { intake: intake({ triggers: ["skipping meals"] }) },
      { plan: { ...emptyPlan(), reasons: ["lose weight"] } }, { companionName: "I want to die" }, { userName: "calories" }]) {
      load();
      expect(onboard(bad), JSON.stringify(bad)).toBe(false);
      expect(getData().habits[0].id, "nothing was created").toBe(H);
    }
  });
  it("onboarding accepts the ordinary case, and a pet with no name gets one that suits its species", () => {
    expect(onboard()).toBe(true);
    expect(getData().companions[0].name).toBe(NAMES.cat[0]);
  });
  it("adding a track refuses a restricted name, count label, pet name or custom question", () => {
    load();
    const base = { cls: "custom" as const, unit: "count" as const, species: "dog" as Species, companionName: "Pip" };
    expect(actions.createTrack({ ...base, name: "Calorie counting" })).toBeNull();
    expect(actions.createTrack({ ...base, name: "Snacks", amountLabel: "kcal" })).toBeNull();
    expect(actions.createTrack({ ...base, name: "Snacks", companionName: "I can't go on" })).toBeNull();
    expect(actions.createTrack({ ...base, name: "Snacks", fields: [field("How much did you weigh?")] })).toBeNull();
    expect(actions.createTrack({ ...base, name: "Snacks", fields: [field("Which?", { type: "choice", options: [{ id: "a", label: "Skipped dinner" }] })] })).toBeNull();
    expect(getData().habits).toHaveLength(1);
    const id = actions.createTrack({ ...base, name: "Late-night snacks", companionName: "" });
    expect(id).not.toBeNull();
    expect(getData().companions.find((c) => c.trackId === id)!.name).toBe(NAMES.dog[0]);
  });
  it("editing a track refuses the same", () => {
    load();
    expect(actions.updateTrack(H, { name: "Counting calories" })).toBe(false);
    expect(actions.updateTrack(H, { description: "I want to lose weight" })).toBe(false);
    expect(actions.updateTrack(H, { plan: { ...emptyPlan(), reasons: ["I want to die"] } })).toBe(false);
    expect(getData().habits[0].name).toBe("Orders");
    expect(actions.updateTrack(H, { name: "Delivery orders" })).toBe(true);
  });
  it("custom check-in questions and their answers are checked when edited", () => {
    load();
    expect(actions.updateHabitFields(H, [field("How many calories?", { type: "number" })])).toBe(false);
    expect(actions.updateHabitFields(H, [field("Which?", { type: "choice", options: [{ id: "a", label: "Fasting day" }] })])).toBe(false);
    expect(actions.updateHabitFields(H, [field("Hurting myself", { type: "text" }), field("I can't go on")])).toBe(false);
    expect(getData().habits[0].fields).toHaveLength(1);
    expect(actions.updateHabitFields(H, [field("What was going on?")])).toBe(true);
  });
});

describe("typed answers and notes are checked where they are saved", () => {
  it("a slip with a typed answer that tracks food or weight, or crisis words in a note, is not saved", () => {
    const q = field("What was it?", { id: "what", type: "choice", options: [{ id: "x", label: "Other" }] });
    const note = field("Notes", { id: "note", type: "text" });
    load([q, note]);
    expect(actions.logSlip(H, { what: `${OTHER_PREFIX}counted my calories` })).toBeNull();
    expect(actions.logSlip(H, { what: `x,${OTHER_PREFIX}skipping meals` })).toBeNull();
    expect(actions.logSlip(H, { note: "I want to die" })).toBeNull();
    expect(actions.logSlip(H, { note: "I can't go on" })).toBeNull();
    expect(getData().entries).toHaveLength(0);
    // Ordinary text, a picked answer and a photo are fine.
    expect(actions.logSlip(H, { what: "x", note: "Long day, ordered in", photo: "data:image/jpeg;base64,AAAA" })).not.toBeNull();
    expect(getData().entries).toHaveLength(1);
  });
  it("a note about food that is just a note is not blocked: only what defines tracking is", () => {
    load([field("Notes", { id: "note", type: "text" })]);
    expect(actions.logSlip(H, { note: "Counted calories again today" })).not.toBeNull();
  });
  it("reflections, plans, if-thens, weekly focus, journal and urge triggers are checked", () => {
    load();
    actions.setSettings({});
    actions.logSlip(H, {});
    const e = getData().entries[0];
    actions.reflectOnLapse(e.id, { before: "I want to die", adjust: "" });
    actions.reflectOnLapse(e.id, { before: "", adjust: "skip meals" });
    expect(getData().entries[0].values.lapse_before).toBeUndefined();
    expect(actions.savePlan({ ...emptyPlan(), firstStep: "eat less" }, H)).toBe(false);
    expect(actions.savePlan({ ...emptyPlan(), supportName: "I want to die" }, H)).toBe(false);
    actions.addIfThen("If tired, then skip meals", H);
    actions.addIfThen("I can't go on", H);
    actions.setWeekFocus("2026-10-26", "count calories", H);
    actions.setJournal(t0, 3, "I want to die");
    expect(getData().journal).toHaveLength(0);
    actions.setJournal(t0, 3, "Okay day");
    expect(getData().journal).toHaveLength(1);
    const u = actions.recordUrge(H, 3, "rode_it_out", { trigger: "skipping meals" });
    expect(u?.trigger).toBeNull(); // the urge is kept, the unsafe text is not
    expect(actions.recordUrge(H, 3, "rode_it_out", { trigger: "Feeling bored" })?.trigger).toBe("Feeling bored");
    expect(actions.savePlan({ ...emptyPlan(), firstStep: "Log out of one delivery app" }, H)).toBe(true);
  });
});

describe("pet and personal names", () => {
  it("renaming refuses a name that needs the safety note, and keeps the pet's name", () => {
    load();
    expect(actions.renameCompanion(C, "I want to die")).toBe(false);
    expect(actions.renameCompanion(C, "calories")).toBe(false);
    expect(getData().companions[0].name).toBe("Biscuit");
    expect(actions.renameCompanion(C, "Pip")).toBe(true);
    expect(getData().companions[0].name).toBe("Pip");
  });
  it("the name someone is called is checked, and an unsafe adopt name falls back to the species default", () => {
    load();
    actions.setSettings({ userName: "I want to die" });
    expect(getData().settings.userName).toBe("Asha");
    actions.setSettings({ userName: "Meera", haptics: false });
    expect(getData().settings.userName).toBe("Meera");
    expect(getData().settings.haptics).toBe(false);
    actions.adopt(H, "I can't go on", "fox");
    expect(getData().companions.at(-1)!.name).toBe(NAMES.fox[0]);
  });
  it("default names fit the species and never override a chosen name", () => {
    for (const sp of Object.keys(NAMES) as Species[]) expect(defaultPetName(sp)).toBe(NAMES[sp][0]);
    load();
    actions.adopt(H, "Mochi", "dog");
    expect(getData().companions.at(-1)!.name).toBe("Mochi");
  });
});

describe("data that arrives from outside", () => {
  const withBad = () => {
    const d = blank();
    return { ...d, settings: { ...d.settings, onboarded: true },
      companions: [{ id: C, species: "dog" as const, name: "Biscuit", bornOn: addDays(t0, -30), diedOn: null, finalAge: null, trackId: H }],
      habits: [{ id: H, name: "Calorie counter", cls: "custom" as const, classWeight: 1, companionId: C, unit: "count" as const,
        fields: [field("What was going on?"), field("How many calories?", { type: "number" }), field("Which?", { type: "choice", options: [{ id: "a", label: "I want to die" }] })] }] };
  };
  it("a restored backup or a synced row loses any question that would track food or weight, and keeps the rest", () => {
    const scrubbed = scrubTracking(withBad());
    expect(scrubbed.habits[0].name).toBe("My habit");
    expect(scrubbed.habits[0].fields.map((f) => f.label)).toEqual(["What was going on?"]);
    const clean = { ...withBad(), habits: [{ ...withBad().habits[0], name: "Orders", fields: [field("Fine")] }] };
    expect(scrubTracking(clean)).toBe(clean); // nothing to do: same object, nothing rewritten
    actions.applyRemote(withBad());
    expect(getData().habits[0].fields).toHaveLength(1);
    expect(actions.importJson(JSON.stringify(withBad()))).toBe(true);
    expect(getData().habits[0].fields).toHaveLength(1);
  });
});

describe("plans", () => {
  it("planConcern covers every typed part, planHasCrisis only crisis", () => {
    expect(planConcern({ ...emptyPlan(), reasons: ["Money"], firstStep: "Log out" })).toBeNull();
    expect(planConcern({ ...emptyPlan(), situations: ["after dieting"] })).toBe("restriction");
    expect(planConcern({ ...emptyPlan(), ifThen: ["if I can't go on"] })).toBe("crisis");
    expect(planConcern({ ...emptyPlan(), supportName: "calories" })).toBe("restriction");
    expect(planHasCrisis({ ...emptyPlan(), firstStep: "eat less" })).toBe(false);
  });
});

describe("the fields show the note as soon as it is needed", () => {
  it("a typed answer shows the right note under the field", () => {
    const so = (value: string) => renderToString(createElement(SelectOther, { value, options: [{ value: "a", label: "A" }], onChange: () => undefined, label: "x" }));
    expect(so("calories")).toContain("can&#x27;t track eating less");
    expect(so("I want to die")).toContain("contact local emergency services");
    expect(so("Walking more")).not.toContain("banner");
    expect(renderToString(createElement(GuardedInput, { value: "I can't go on", onChange: () => undefined }))).toContain("role=\"alert\"");
    expect(renderToString(createElement(GuardedInput, { value: "count calories", strict: "crisis", onChange: () => undefined }))).not.toContain("banner");
    expect(renderToString(createElement(ConcernNote, { concern: null }))).toBe("");
    expect(renderToString(createElement(MultiSelect, { value: [], options: [], onChange: () => undefined, label: "x" }))).not.toContain("banner");
    expect(CRISIS_MESSAGE).toMatch(/Tele-MANAS.*988.*Samaritans/);
    expect(RESTRICTION_NOTE).toMatch(/calories or weight/);
  });
});

describe("pet dialogue", () => {
  it("lists the same events in the table and the type, so nothing unlisted can be said", () => {
    expect(Object.keys(PET_LINES).sort()).toEqual(["binge", "cleanThanks", "dizzy", "giggle", "petted", "rodeOut", "shrug", "slip", "stroke", "urgeStart"]);
  });
});
