import { describe, expect, it } from "vitest";
import { outreachGate, remainingCapacity, formatInr, type GateInput } from "@/lib/domain/billing";

const base: GateInput = {
  testMode: false,
  candidateCount: 10,
  hasPaidPayment: false,
  maxCandidates: 200,
  testModeMax: 5,
  questionCount: 5,
  jobStatus: "draft",
};

describe("outreachGate", () => {
  it("blocks paid jobs until payment confirms", () => {
    expect(outreachGate(base)).toEqual({ ok: false, reason: expect.stringContaining("Payment"), needsPayment: true });
    expect(outreachGate({ ...base, hasPaidPayment: true })).toEqual({ ok: true });
  });

  it("lets test mode run free up to 5 candidates, never more", () => {
    expect(outreachGate({ ...base, testMode: true, candidateCount: 5 })).toEqual({ ok: true });
    expect(outreachGate({ ...base, testMode: true, candidateCount: 6 }).ok).toBe(false);
    expect(outreachGate({ ...base, testMode: true, candidateCount: 6, hasPaidPayment: true }).ok).toBe(false);
  });

  it("requires questions and candidates before asking for money", () => {
    expect(outreachGate({ ...base, questionCount: 2 })).toMatchObject({ ok: false, reason: expect.stringContaining("questions") });
    expect(outreachGate({ ...base, candidateCount: 0 })).toMatchObject({ ok: false, reason: expect.stringContaining("candidate") });
    expect(outreachGate({ ...base, questionCount: 2 }).ok === false && "needsPayment" in outreachGate({ ...base, questionCount: 2 })).toBe(false);
  });

  it("caps candidates per job and refuses closed jobs", () => {
    expect(outreachGate({ ...base, candidateCount: 201, hasPaidPayment: true }).ok).toBe(false);
    expect(outreachGate({ ...base, jobStatus: "closed", hasPaidPayment: true }).ok).toBe(false);
  });
});

describe("helpers", () => {
  it("computes remaining capacity", () => {
    expect(remainingCapacity(true, 3, 200, 5)).toBe(2);
    expect(remainingCapacity(false, 199, 200, 5)).toBe(1);
    expect(remainingCapacity(true, 9, 200, 5)).toBe(0);
  });
  it("formats rupees in the Indian system", () => expect(formatInr(149900)).toBe("₹1,49,900"));
});
