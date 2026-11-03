import { describe, expect, it } from "vitest";
import { ServerAccess } from "../src";

const trial = {
  state: "trial", app: true, ai: true, email_verified: true, tracks: 1, valid_until: "2026-11-10T10:00:00+00:00",
  trial_ends_at: "2026-11-10T10:00:00+00:00", plan: null, plan_status: null, period_end: null, server_time: "2026-11-03T10:00:00.123456+00:00",
};

describe("the server's access answer", () => {
  it("accepts what access_for returns, Postgres timestamps included", () => {
    expect(ServerAccess.safeParse(trial).success).toBe(true);
    expect(ServerAccess.safeParse({ ...trial, state: "basic", ai: false, tracks: 50, plan: "basic", plan_status: "active", period_end: trial.valid_until }).success).toBe(true);
    expect(ServerAccess.safeParse({ ...trial, state: "expired", app: false, ai: false, tracks: 0, valid_until: null }).success).toBe(true);
  });
  it("refuses an answer that grants more than its state allows", () => {
    expect(ServerAccess.safeParse({ ...trial, state: "basic", ai: true }).success).toBe(false);
    expect(ServerAccess.safeParse({ ...trial, state: "expired", app: true }).success).toBe(false);
    expect(ServerAccess.safeParse({ ...trial, app: false }).success).toBe(false);
  });
  it("refuses unknown states, odd track counts and missing fields", () => {
    expect(ServerAccess.safeParse({ ...trial, state: "lifetime" }).success).toBe(false);
    expect(ServerAccess.safeParse({ ...trial, tracks: 999 }).success).toBe(false);
    const { server_time: _, ...rest } = trial;
    expect(ServerAccess.safeParse(rest).success).toBe(false);
  });
});
