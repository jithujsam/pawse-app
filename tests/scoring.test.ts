import { describe, expect, it } from "vitest";
import { ScoreParseError, computeTotals, parseAndComputeScore, rankKey, type RubricItem } from "@/lib/domain/scoring";
import { MockScorer } from "@/lib/adapters/scorer/mock";

const rubric: RubricItem[] = [
  { id: "k1", kind: "knockout", text: "Valid driving licence", weight: 1 },
  { id: "n1", kind: "nice", text: "Delivery experience", weight: 3 },
  { id: "n2", kind: "nice", text: "Knows Pune", weight: 1 },
];
const good = {
  knockouts: [{ id: "k1", met: "yes", evidence: "Yes, I have a licence" }],
  nice_to_haves: [
    { id: "n1", rating: 3, evidence: "5 years at a courier" },
    { id: "n2", rating: 0, evidence: "" },
  ],
  summary: "Experienced rider.",
  reason: "Meets must-haves, strong experience.",
};

describe("parseAndComputeScore", () => {
  it("computes a weighted total in code", () => {
    const s = parseAndComputeScore(good, rubric);
    expect(s.knockoutPassed).toBe(true);
    expect(s.total).toBe(75); // (3/3*3 + 0/3*1) / 4
    expect(s.breakdown.niceToHaves[0]).toMatchObject({ text: "Delivery experience", weight: 3, rating: 3 });
  });

  it("fails knockouts that are 'no' or 'unclear'", () => {
    for (const met of ["no", "unclear"]) {
      const s = parseAndComputeScore({ ...good, knockouts: [{ id: "k1", met, evidence: "" }] }, rubric);
      expect(s.knockoutPassed).toBe(false);
    }
  });

  it.each([
    ["not an object", "hello"],
    ["missing field", { ...good, reason: undefined }],
    ["rating out of range", { ...good, nice_to_haves: [{ id: "n1", rating: 7, evidence: "" }, good.nice_to_haves[1]] }],
    ["bad enum", { ...good, knockouts: [{ id: "k1", met: "maybe", evidence: "" }] }],
    ["missing rubric item", { ...good, nice_to_haves: [good.nice_to_haves[0]] }],
    ["unknown id", { ...good, knockouts: [{ id: "zzz", met: "yes", evidence: "" }] }],
    ["duplicate id", { ...good, nice_to_haves: [good.nice_to_haves[0], good.nice_to_haves[0]] }],
  ])("rejects %s", (_label, raw) => {
    expect(() => parseAndComputeScore(raw, rubric)).toThrow(ScoreParseError);
  });

  it("scores 100 or 0 when there are no nice-to-haves", () => {
    expect(computeTotals({ knockouts: [], niceToHaves: [] })).toEqual({ total: 100, knockoutPassed: true });
    expect(computeTotals({ knockouts: [{ id: "k", text: "", met: "no", evidence: "" }], niceToHaves: [] }).total).toBe(0);
  });
});

describe("rankKey", () => {
  it("puts knockout passes first, uses edited score, then incomplete", () => {
    const pass60 = rankKey({ status: "completed", score: { total: 60, editedTotal: null, knockoutPassed: true } });
    const fail99 = rankKey({ status: "completed", score: { total: 99, editedTotal: null, knockoutPassed: false } });
    const edited = rankKey({ status: "completed", score: { total: 10, editedTotal: 90, knockoutPassed: true } });
    const pending = rankKey({ status: "invited", score: null });
    expect(edited).toBeGreaterThan(pass60);
    expect(pass60).toBeGreaterThan(fail99);
    expect(fail99).toBeGreaterThan(pending);
  });
});

describe("MockScorer output", () => {
  it("always parses against the rubric", async () => {
    const res = await new MockScorer().score({
      jobTitle: "x",
      jobDescription: "y",
      rubric,
      answers: [
        { question: "Licence?", answer: "Yes I have a valid driving licence" },
        { question: "Experience?", answer: "3 years delivery experience in Pune" },
      ],
    });
    const s = parseAndComputeScore(res.raw, rubric);
    expect(s.knockoutPassed).toBe(true);
    expect(s.total).toBeGreaterThan(50);
  });
});
