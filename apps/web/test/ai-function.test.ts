import { beforeEach, describe, expect, it } from "vitest";
import { aiGate, clientIp } from "../../../supabase/functions/ai/access.ts";
import { makeHandler, type Admin } from "../../../supabase/functions/ai/handler.ts";

/**
 * The AI Edge Function, called directly, the way a modified app or a script would call it. Membership is decided on
 * the server (access_for, migration 0014) before the cache, the quota or the AI provider is touched, so nothing the
 * phone does or claims can get new AI output without an active trial or the AI plan.
 */

type Access = Record<string, unknown>;
const TRIAL: Access = { state: "trial", app: true, ai: true, email_verified: true, tracks: 1 };
const AI: Access = { state: "ai", app: true, ai: true, email_verified: true, tracks: 50 };
const BASIC: Access = { state: "basic", app: true, ai: false, email_verified: true, tracks: 50 };

let accessOf: Record<string, Access | null> = {};
let accessFails = false;
let networkOk = true;
let rpcLog: { fn: string; args: Record<string, unknown> }[] = [];
let usage: Record<string, number> = {};
let cache = new Map<string, { result: unknown; created_at: string }>();
let upstreamCalls = 0;

const admin: Admin = {
  auth: {
    getUser: async (token: string) => {
      const id = { "tok-a": "user-a" }[token as "tok-a"];
      return { data: { user: id ? { id } : null } };
    },
  },
  rpc: async (fn: string, args: Record<string, unknown>) => {
    rpcLog.push({ fn, args });
    if (fn === "access_for") return accessFails ? { data: null, error: { message: "boom" } } : { data: accessOf[String(args.p_user)] ?? null, error: null };
    if (fn === "abuse_hit") return { data: networkOk, error: null };
    if (fn === "bump_ai_usage") {
      const u = String(args.p_user);
      usage[u] = (usage[u] ?? 0) + 1;
      return { data: usage[u] <= Number(args.p_limit), error: null };
    }
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  },
  from(table: string) {
    if (table === "ai_usage") return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
    return {
      select: () => ({ eq: (_c: string, key: string) => ({ maybeSingle: async () => ({ data: cache.get(key) ?? null }) }) }),
      upsert: async (row: { key: string; result: unknown; created_at: string }) => { cache.set(row.key, { result: row.result, created_at: row.created_at }); return { error: null }; },
      delete: () => ({ lt: async () => ({ error: null }) }),
    };
  },
};

/** What the provider was last asked: its temperature and system prompt, to check each kind is built as before. */
let lastUpstream: { temperature?: number; system?: string } = {};
const PET_ANSWER = { waiting: "Biscuit is waiting, dramatically.", goal_met: "Goal met. I am thriving.", after_slip: "Tonight we rally.",
  away: "Three days by the door. Today still counts.", morning: "Morning. Yesterday went well.", risk: "Your tricky hour is near.", thanks: "A good day. Noted." };
const fakeFetch = (async (_url: string, init: { body: string }) => {
  upstreamCalls++;
  const sent = JSON.parse(init.body) as { temperature: number; messages: { content: string }[] };
  lastUpstream = { temperature: sent.temperature, system: sent.messages[0].content };
  const answer = sent.messages[0].content.includes("write what the pet says") ? PET_ANSWER
    : sent.messages[0].content.includes("weekly summary") ? { summary: "Biscuit had 2 slips this week, one fewer than last week." }
    : { ai_adjust_pct: 5, body_effects: ["tired_eyes"], explanation: "Biscuit felt that one." };
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }), { status: 200 });
}) as unknown as typeof fetch;

let env: Record<string, string> = {};
const handler = () => makeHandler({ admin, env: (k) => env[k], fetch: fakeFetch });

const slip = { kind: "slip", tone: "honest", habitClass: "food_spending", companionName: "Biscuit", amount: 400, unit: "money", median: 200, triggers: [], texts: [], nthToday: 1, baselineMonths: 4, last7Slips: 2 };
const call = async (opts: { token?: string | null; body?: unknown; ip?: string } = {}) => {
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-forwarded-for": opts.ip ?? "203.0.113.9, 10.0.0.1" };
  if (opts.token !== null) headers.Authorization = `Bearer ${opts.token ?? "tok-a"}`;
  const res = await handler()(new Request("https://fn.local/ai", { method: "POST", headers, body: JSON.stringify(opts.body ?? slip) }));
  return { status: res.status, body: await res.json() as { ok: boolean; error?: string; cached?: boolean } };
};

beforeEach(() => {
  accessOf = { "user-a": TRIAL }; accessFails = false; networkOk = true;
  rpcLog = []; usage = {}; cache = new Map(); upstreamCalls = 0; lastUpstream = {};
  env = { OPENROUTER_API_KEY: "sk-or-v1-test" };
});

describe("AI function: who may call it", () => {
  it("no token: 401, and nothing is looked up or spent", async () => {
    const r = await call({ token: null });
    expect(r.status).toBe(401);
    expect(rpcLog).toEqual([]);
    expect(upstreamCalls).toBe(0);
  });

  it("a token the auth server doesn't know: 401", async () => {
    expect((await call({ token: "forged" })).status).toBe(401);
    expect(upstreamCalls).toBe(0);
  });

  it("an active trial with a confirmed email gets AI, at the trial's daily limit", async () => {
    const r = await call();
    expect(r.body.ok).toBe(true);
    expect(rpcLog.find((x) => x.fn === "bump_ai_usage")?.args.p_limit).toBe(20);
    expect(upstreamCalls).toBe(1);
  });

  it("the AI plan gets AI, at the full daily limit, and isn't held to the trial's network limit", async () => {
    accessOf["user-a"] = AI; networkOk = false;
    const r = await call();
    expect(r.body.ok).toBe(true);
    expect(rpcLog.find((x) => x.fn === "bump_ai_usage")?.args.p_limit).toBe(80);
    expect(rpcLog.some((x) => x.fn === "abuse_hit")).toBe(false);
  });

  it("the Basic plan is refused every new AI request: 403 plan, before quota or provider", async () => {
    accessOf["user-a"] = BASIC;
    const r = await call();
    expect(r).toEqual({ status: 403, body: { ok: false, error: "plan" } });
    expect(rpcLog.map((x) => x.fn)).toEqual(["access_for"]);
    expect(upstreamCalls).toBe(0);
  });

  for (const state of ["expired", "refunded", "revoked", "none"]) {
    it(`${state}: refused`, async () => {
      accessOf["user-a"] = { state, app: false, ai: false, email_verified: true, tracks: 0 };
      expect(await call()).toEqual({ status: 403, body: { ok: false, error: "plan" } });
      expect(upstreamCalls).toBe(0);
    });
  }

  it("a trial whose email isn't confirmed is refused AI: 403 verify", async () => {
    accessOf["user-a"] = { ...TRIAL, ai: false, email_verified: false };
    expect(await call()).toEqual({ status: 403, body: { ok: false, error: "verify" } });
    expect(upstreamCalls).toBe(0);
  });

  it("the membership lookup failing refuses the call (fails closed)", async () => {
    accessFails = true;
    expect(await call()).toEqual({ status: 503, body: { ok: false, error: "access" } });
    expect(upstreamCalls).toBe(0);
  });

  it("an account the server has no answer for is refused", async () => {
    accessOf = {};
    expect((await call()).body.error).toBe("access");
  });

  it("whatever the request body claims about the plan, the server's record decides", async () => {
    accessOf["user-a"] = BASIC;
    const r = await call({ body: { ...slip, plan: "ai", state: "ai" } });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(upstreamCalls).toBe(0);
  });
});

describe("AI function: the cache is not a way around membership", () => {
  it("an expired account can't get a cached answer for a new request", async () => {
    accessOf["user-a"] = AI;
    expect((await call()).body.ok).toBe(true);
    accessOf["user-a"] = { state: "expired", app: false, ai: false, email_verified: true, tracks: 0 };
    const again = await call();
    expect(again.body).toEqual({ ok: false, error: "plan" });
  });

  it("with AI access, a cached answer is served without asking the provider or using quota", async () => {
    accessOf["user-a"] = AI;
    await call();
    rpcLog = [];
    const again = await call();
    expect(again.body.cached).toBe(true);
    expect(upstreamCalls).toBe(1);
    expect(rpcLog.some((x) => x.fn === "bump_ai_usage")).toBe(false);
  });
});

describe("AI function: cost controls", () => {
  it("a trial past its daily limit gets 'limit'", async () => {
    env.AI_TRIAL_DAILY_LIMIT = "2";
    for (let i = 0; i < 2; i++) expect((await call({ body: { ...slip, nthToday: i + 1 } })).body.ok).toBe(true);
    expect((await call({ body: { ...slip, nthToday: 9 } })).body).toEqual({ ok: false, error: "limit" });
    expect(upstreamCalls).toBe(2);
  });

  it("trial AI from a busy network is limited (by a hashed address, server-side)", async () => {
    networkOk = false;
    expect((await call()).body).toEqual({ ok: false, error: "limit" });
    expect(upstreamCalls).toBe(0);
    const hit = rpcLog.find((x) => x.fn === "abuse_hit");
    expect(hit?.args).toMatchObject({ p_kind: "trial_ai", p_ip: "203.0.113.9" });
  });

  it("AI_GLOBAL_DAILY_LIMIT=0 turns AI off for everyone, paid or not", async () => {
    accessOf["user-a"] = AI; env.AI_GLOBAL_DAILY_LIMIT = "0";
    expect((await call()).body).toEqual({ ok: false, error: "limit" });
    expect(upstreamCalls).toBe(0);
  });
});

describe("aiGate and clientIp", () => {
  it("decides from the server's answer only", () => {
    expect(aiGate(TRIAL, false)).toEqual({ ok: true, tier: "trial" });
    expect(aiGate(AI, false)).toEqual({ ok: true, tier: "ai" });
    expect(aiGate(BASIC, false)).toMatchObject({ ok: false, error: "plan" });
    expect(aiGate({ state: "basic", ai: true }, false)).toMatchObject({ ok: false, error: "plan" }); // an inconsistent answer never grants AI
    expect(aiGate(TRIAL, true)).toMatchObject({ ok: false, error: "access" });
    expect(aiGate(null, false)).toMatchObject({ ok: false, error: "access" });
    expect(aiGate("ai", false)).toMatchObject({ ok: false, error: "access" });
  });

  it("reads the first forwarded address, and nothing oversized", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.2" }))).toBe("198.51.100.1");
    expect(clientIp(new Headers({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp(new Headers({ "x-forwarded-for": "x".repeat(100) }))).toBeNull();
  });
});

describe("AI function: every request kind (slip, pet, weekly) goes through membership", () => {
  const pet = { kind: "pet", tone: "brutal", personality: "savage", species: "dog", companionName: "Biscuit", habitClass: "food_spending",
    day: "2026-11-03", streak: 4, quietDays: 0, last7Slips: 2, stage: "adult" };
  const weekly = { kind: "weekly", tone: "honest", habitClass: "food_spending", companionName: "Biscuit", unit: "money",
    thisWeek: { slips: 2, spend: 800, months: 3 }, lastWeek: { slips: 3, spend: 900, months: 4 }, worstWeekday: "Friday", age: 31, currency: "INR" };
  const slipWithPersonality = { ...slip, personality: "savage" };
  const requests: [string, unknown][] = [["slip (as 5.0.20 sends it)", slip], ["slip with personality", slipWithPersonality], ["pet", pet], ["weekly", weekly]];

  for (const [name, body] of requests) {
    it(`${name}: trial and the AI plan get an answer`, async () => {
      for (const access of [TRIAL, AI]) {
        accessOf["user-a"] = access; cache = new Map();
        const r = await call({ body });
        expect(r.body.ok, `${name} ${access.state}`).toBe(true);
      }
    });
    it(`${name}: Basic, expired, refunded, revoked and an unconfirmed trial are refused before the provider`, async () => {
      const refused: [Access, string][] = [
        [BASIC, "plan"], [{ state: "expired", app: false, ai: false }, "plan"], [{ state: "refunded", app: false, ai: false }, "plan"],
        [{ state: "revoked", app: false, ai: false }, "plan"], [{ ...TRIAL, ai: false, email_verified: false }, "verify"],
      ];
      for (const [access, error] of refused) {
        accessOf["user-a"] = access;
        expect((await call({ body })).body, `${name} ${access.state}`).toEqual({ ok: false, error });
      }
      expect(upstreamCalls).toBe(0);
    });
    it(`${name}: a cached answer needs AI access too`, async () => {
      accessOf["user-a"] = AI;
      expect((await call({ body })).body.ok).toBe(true);
      expect((await call({ body })).body.cached).toBe(true);
      accessOf["user-a"] = BASIC;
      expect((await call({ body })).body).toEqual({ ok: false, error: "plan" });
      expect(upstreamCalls).toBe(1);
    });
  }

  it("pet lines are written in the personality and at the livelier temperature; slips keep theirs", async () => {
    accessOf["user-a"] = AI;
    const r = await call({ body: pet });
    expect(r.body).toMatchObject({ ok: true, result: PET_ANSWER });
    expect(lastUpstream.temperature).toBe(0.8);
    expect(lastUpstream.system).toMatch(/Personality: Brutal: a witty, sarcastic diva/);
    await call({ body: slipWithPersonality });
    expect(lastUpstream.temperature).toBe(0.4);
    expect(lastUpstream.system).toMatch(/Personality of the pet, which shapes the wording: Brutal/);
    await call({ body: slip });
    expect(lastUpstream.system).not.toMatch(/Personality of the pet/);
  });

  it("an unknown personality or an extra field is a bad request, never a call", async () => {
    accessOf["user-a"] = AI;
    expect((await call({ body: { ...pet, personality: "evil" } })).status).toBe(400);
    expect((await call({ body: { ...slip, plan: "ai" } })).status).toBe(400);
    expect(upstreamCalls).toBe(0);
  });

  it("an unsafe pet line from the provider is refused, so the app keeps its hand-written lines", async () => {
    accessOf["user-a"] = AI;
    const unsafe = (async () => { upstreamCalls++; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ...PET_ANSWER, away: "I was so lonely without you." }) } }] })); }) as unknown as typeof fetch;
    const r = await makeHandler({ admin, env: (k) => env[k], fetch: unsafe })(new Request("https://fn.local/ai", { method: "POST", headers: { Authorization: "Bearer tok-a" }, body: JSON.stringify(pet) }));
    expect(await r.json()).toEqual({ ok: false, error: "invalid" });
  });
});
