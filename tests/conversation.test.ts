import { describe, expect, it } from "vitest";
import { classify, step, type EngineState, type EngineInput } from "@/lib/domain/conversation";

const QS = ["Do you have a licence?", "How many years of experience?", "Expected salary?"];
const s0: EngineState = { state: "awaiting_optin", currentQuestion: 0, repromptCount: 0, lateReplyNotified: false };
const input = (text: string, extra: Partial<EngineInput> = {}): EngineInput => ({
  kind: "text",
  text,
  questions: QS,
  jobOpen: true,
  language: "en",
  ...extra,
});
const replies = (effects: { type: string; body?: string }[]) => effects.filter((e) => e.type === "reply").map((e) => e.body);

describe("classify", () => {
  it.each([
    ["YES", "yes"],
    ["haan", "yes"],
    ["हाँ", "yes"],
    ["Stop", "stop"],
    ["STOP!!", "stop"],
    ["band karo", "stop"],
    ["delete my data", "delete"],
    ["can you repeat", "repeat"],
    ["I don't understand", "confused"],
    ["samajh nahi aaya", "confused"],
    ["ok", "filler"],
    ["😀", "filler"],
    ["5 years at Swiggy", "answer"],
    ["No", "no"],
  ])("%s -> %s", (t, intent) => expect(classify(t, "text")).toBe(intent));

  it("treats stickers and images as filler", () => expect(classify("", "other")).toBe("filler"));
  it("does not treat a long answer containing 'stop' as opt-out", () =>
    expect(classify("I worked at a bus stop kiosk for three years selling tea and snacks", "text")).toBe("answer"));
});

describe("step", () => {
  it("runs the happy path: YES, answers, done", () => {
    let r = step(s0, input("yes"));
    expect(r.next.state).toBe("asking");
    expect(replies(r.effects)).toEqual(["Thanks! There are 3 questions. Answer each one by text or a voice note.", "Question 1/3: Do you have a licence?"]);
    r = step(r.next, input("yes"));
    expect(r.effects).toContainEqual({ type: "record_answer", questionIndex: 0, text: "yes", source: "text" });
    r = step(r.next, input("4 years", { kind: "voice" }));
    expect(r.effects).toContainEqual({ type: "record_answer", questionIndex: 1, text: "4 years", source: "voice" });
    r = step(r.next, input("18000 per month"));
    expect(r.next.state).toBe("done");
    expect(r.effects.map((e) => e.type)).toEqual(["record_answer", "completed", "reply"]);
  });

  it("honours STOP at any point and then stays silent", () => {
    const asking = { ...s0, state: "asking" as const, currentQuestion: 1 };
    const r = step(asking, input("STOP"));
    expect(r.next.state).toBe("opted_out");
    expect(r.effects.map((e) => e.type)).toEqual(["opted_out", "reply"]);
    const after = step(r.next, input("hello?"));
    expect(after.effects).toEqual([]);
  });

  it("repeats the current question without counting a reprompt", () => {
    const asking = { ...s0, state: "asking" as const, currentQuestion: 1 };
    const r = step(asking, input("repeat"));
    expect(replies(r.effects)).toEqual(["Question 2/3: How many years of experience?"]);
    expect(r.next.repromptCount).toBe(0);
  });

  it("re-asks once on off-script, then flags for a human", () => {
    const asking = { ...s0, state: "asking" as const, currentQuestion: 1 };
    const r1 = step(asking, input("ok"));
    expect(r1.next.repromptCount).toBe(1);
    expect(replies(r1.effects)[0]).toContain("couldn't read that");
    const r2 = step(r1.next, input("👍"));
    expect(r2.next.state).toBe("needs_human");
    expect(r2.effects.some((e) => e.type === "needs_human")).toBe(true);
    // A recruiter takes over: no more automatic replies.
    expect(step(r2.next, input("hello")).effects).toEqual([]);
  });

  it("explains once on 'I don't understand', then flags", () => {
    const asking = { ...s0, state: "asking" as const, currentQuestion: 2 };
    const r1 = step(asking, input("I don't understand"));
    expect(replies(r1.effects)[0]).toContain("in your own words");
    expect(step(r1.next, input("what")).next.state).toBe("needs_human");
  });

  it("resets the reprompt counter after a real answer", () => {
    const r = step({ ...s0, state: "asking", currentQuestion: 1, repromptCount: 1 }, input("3 years"));
    expect(r.next.repromptCount).toBe(0);
  });

  it("accepts a bare yes as an answer to a yes/no question but not an open one", () => {
    expect(step({ ...s0, state: "asking", currentQuestion: 0 }, input("yes")).effects[0].type).toBe("record_answer");
    expect(step({ ...s0, state: "asking", currentQuestion: 1 }, input("yes")).effects[0].type).toBe("reply");
  });

  it("re-prompts an unclear opt-in once, then hands off", () => {
    const r1 = step(s0, input("who is this"));
    expect(r1.next.state).toBe("awaiting_optin");
    expect(step(r1.next, input("??? hello")).next.state).toBe("needs_human");
  });

  it("handles NO, and a later change of mind", () => {
    const r = step(s0, input("no"));
    expect(r.next.state).toBe("declined");
    expect(step(r.next, input("haan")).next.state).toBe("asking");
  });

  it("answers a late reply once after completion", () => {
    const done = { ...s0, state: "done" as const };
    const r1 = step(done, input("did you get it?"));
    expect(replies(r1.effects)[0]).toContain("already have your answers");
    expect(step(r1.next, input("hello")).effects).toEqual([]);
  });

  it("tells candidates once when the role has closed", () => {
    const r1 = step({ ...s0, state: "asking" }, input("5 years", { jobOpen: false }));
    expect(replies(r1.effects)[0]).toContain("closed");
    expect(r1.effects.some((e) => e.type === "record_answer")).toBe(false);
    expect(step(r1.next, input("hi", { jobOpen: false })).effects).toEqual([]);
  });

  it("resumes a no-response conversation where it stopped", () => {
    const r = step({ ...s0, state: "no_response", currentQuestion: 2 }, input("20000"));
    expect(r.effects[0]).toMatchObject({ type: "record_answer", questionIndex: 2 });
  });

  it("processes DELETE even after opt-out", () => {
    const r = step({ ...s0, state: "opted_out" }, input("delete"));
    expect(r.effects.map((e) => e.type)).toContain("deletion_requested");
  });

  it("speaks Hindi to Hindi candidates", () => {
    const r = step(s0, input("haan", { language: "hi" }));
    expect(replies(r.effects)[1]).toMatch(/^सवाल 1\/3/);
  });
});
