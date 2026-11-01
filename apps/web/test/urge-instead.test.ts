import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/supabase", async () => ({ configured: true, supabase: (await import("./fake-supabase")).client }));

import { actions, getData } from "../src/store";
import { blank } from "../src/persist";
import { defaultTrackState } from "../src/tracks";
import { merge, toRemote, type Pulled } from "../src/syncmap";
import { missingGroup } from "../src/sync";
import { whatHelps } from "../src/goal";

const H = "11111111-1111-4111-8111-111111111111", C = "22222222-2222-4222-8222-222222222222", USER = "33333333-3333-4333-8333-333333333333";
const PHOTO = "data:image/jpeg;base64,/9j/AAAA";

beforeAll(() => {
  const d = blank();
  actions.applyRemote({
    ...d, settings: { ...d.settings, onboarded: true, activeHabit: H },
    companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: "2026-10-01", diedOn: null, finalAge: null, trackId: H }],
    habits: [{ id: H, name: "Smoking", cls: "smoking", classWeight: 1.4, companionId: C, unit: "count", fields: [], track: defaultTrackState("2026-10-01") }],
  });
});

describe("what I did instead", () => {
  it("is kept on the urge, trimmed and capped, with the photo", () => {
    const u = actions.recordUrge(H, 4, "rode_it_out", { instead: `  ${"Read a few pages of my book ".repeat(3)}  `, photo: PHOTO })!;
    expect(u.instead!.length).toBeLessThanOrEqual(40);
    expect(u.instead!.startsWith("Read a few pages")).toBe(true);
    expect(u.photo).toBe(PHOTO);
  });

  it("can be added after the urge eased", () => {
    const u = actions.recordUrge(H, 3, "rode_it_out")!;
    expect(u.instead).toBeUndefined();
    expect(actions.setUrgeInstead(u.id, { instead: "Walk", photo: PHOTO })).toBe(true);
    expect(getData().urges.find((x) => x.id === u.id)).toMatchObject({ instead: "Walk", photo: PHOTO });
    expect(actions.setUrgeInstead("missing", { instead: "Walk" })).toBe(false);
  });

  it("goes through the same safety check as every typed text: crisis or food and weight text is never saved", () => {
    const u = actions.recordUrge(H, 3, "rode_it_out")!;
    expect(actions.setUrgeInstead(u.id, { instead: "I want to end my life" })).toBe(false);
    expect(actions.setUrgeInstead(u.id, { instead: "Count calories" })).toBe(false);
    expect(getData().urges.find((x) => x.id === u.id)!.instead).toBeUndefined();
    const r = actions.recordUrge(H, 3, "rode_it_out", { instead: "I want to end my life" })!;
    expect(r.instead).toBeUndefined();
  });

  it("only keeps a photo that is a small image", () => {
    const u = actions.recordUrge(H, 2, "rode_it_out", { photo: "https://example.com/x.jpg" })!;
    expect(u.photo).toBeUndefined();
    const big = actions.recordUrge(H, 2, "rode_it_out", { photo: `data:image/jpeg;base64,${"A".repeat(400_001)}` })!;
    expect(big.photo).toBeUndefined();
    expect(actions.setUrgeInstead(u.id, { photo: "not an image" })).toBe(false);
  });

  it("feeds what helps", () => {
    const { helpers } = whatHelps(getData(), H);
    expect(helpers.find((h) => h.what === "Walk")).toMatchObject({ total: 1, managed: 1 });
  });
});

describe("syncing it", () => {
  const urge = () => getData().urges.find((u) => u.instead === "Walk")!;

  it("sends what I did instead to the account, and never the photo", () => {
    const rows = toRemote(`u:${urge().id}`, getData(), USER, 5);
    expect(rows).toHaveLength(1);
    expect(rows[0].table).toBe("urges");
    expect(rows[0].row).toMatchObject({ instead: "Walk" });
    expect(JSON.stringify(rows[0].row)).not.toContain("base64");
    expect(Object.keys(rows[0].row)).not.toContain("photo");
  });

  it("keeps the photo already on this phone when the account's copy of the urge arrives", () => {
    const local = getData();
    const u = urge();
    const row = { id: u.id, habit_id: H, occurred_on: u.day, occurred_at: u.time, strength: u.strength, outcome: u.outcome, strategy: null, trigger: null, instead: "Walk", client_created_at: u.createdAt, client_updated_at: 9, updated_at: new Date().toISOString(), deleted_at: null };
    const pulled = { profiles: [], companions: [], habits: [], entries: [], deductions: [], clean_days: [], weekly_reports: [], urges: [row], journal: [] } as unknown as Pulled;
    const { data } = merge(local, pulled, {});
    expect(data.urges.find((x) => x.id === u.id)).toMatchObject({ instead: "Walk", photo: PHOTO });
  });

  it("an account whose database has no 'instead' column yet still takes every urge (the column is sent without it)", () => {
    expect(missingGroup("urges", `Could not find the 'instead' column of 'urges' in the schema cache`)).toEqual(["instead"]);
    expect(missingGroup("urges", `Could not find the 'strategy' column of 'urges' in the schema cache`)).toEqual(["strategy", "trigger"]);
  });
});
