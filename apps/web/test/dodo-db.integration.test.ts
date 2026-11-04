import { beforeAll, describe, expect, it } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ACCOUNT_METADATA_KEY } from "../../../supabase/functions/_shared/dodo.ts";
import { makeDodoWebhook } from "../../../supabase/functions/dodo-webhook/handler.ts";

/**
 * Dodo webhooks end to end on the server side: signed deliveries → the dodo-webhook handler → the real
 * apply_payment_event in a real Postgres with every migration. Opt-in, because it needs a disposable database:
 *   DODO_IT_PG="host=/var/tmp/pawse-pg port=54329 user=postgres" pnpm --filter web exec vitest run test/dodo-db.integration.test.ts
 * It drops and recreates the database "dodo_it" on that server. Never point it at a real project.
 */
const CONN = process.env.DODO_IT_PG;
const DB = "dodo_it";
const ROOT = join(__dirname, "../../../supabase");

const psql = (sql: string, db = DB) => execFileSync("psql", [`${CONN} dbname=${db}`, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8" }).trim();

const SECRET_BYTES = randomBytes(32);
const SECRET = "whsec_" + SECRET_BYTES.toString("base64");
const PRODUCTS = { basic: "pdt_basic_it", ai: "pdt_ai_it" };
const T = "11111111-0000-4000-8000-0000000000aa"; // the dedicated test account
const O = "22222222-0000-4000-8000-0000000000bb"; // another account
const at = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
let clock = Date.now() - 3_600_000;
const tick = () => new Date((clock += 1000)).toISOString();

/** fetch for the handler: the PostgREST rpc call becomes a real SQL call as the service role. */
const dbFetch = (async (url: string, init: { body: string }) => {
  if (!url.endsWith("/rest/v1/rpc/apply_payment_event")) return new Response("", { status: 404 });
  const j = init.body.replace(/'/g, "''");
  try {
    const out = psql(`set role service_role; select public.apply_payment_event(j->>'p_provider', j->>'p_event_id', (j->>'p_user')::uuid, j->>'p_kind', j->>'p_plan',
      (j->>'p_period_start')::timestamptz, (j->>'p_period_end')::timestamptz, j->>'p_provider_ref', j->>'p_payment_ref', j->>'p_customer_ref',
      (j->>'p_event_at')::timestamptz, (j->>'p_renews')::boolean) from (select '${j}'::jsonb j) x;`);
    return new Response(JSON.stringify(out.split("\n").pop()), { status: 200 });
  } catch { return new Response("", { status: 500 }); }
}) as unknown as typeof fetch;

const webhook = makeDodoWebhook({
  env: (k) => ({ DODO_PAYMENTS_WEBHOOK_KEY: SECRET, DODO_BASIC_PRODUCT_ID: PRODUCTS.basic, DODO_AI_PRODUCT_ID: PRODUCTS.ai, SUPABASE_URL: "https://db.local", SUPABASE_SERVICE_ROLE_KEY: "service" } as Record<string, string>)[k],
  fetch: dbFetch,
});
async function deliver(type: string, data: Record<string, unknown>, opts: { id?: string; badSig?: boolean } = {}) {
  const body = JSON.stringify({ business_id: "bus_it", type, timestamp: tick(), data });
  const id = opts.id ?? "msg_" + randomBytes(6).toString("hex"), ts = Math.floor(Date.now() / 1000);
  const key = opts.badSig ? randomBytes(32) : SECRET_BYTES;
  const sig = "v1," + createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  const res = await webhook(new Request("https://fn.local/dodo-webhook", { method: "POST", body, headers: { "webhook-id": id, "webhook-timestamp": String(ts), "webhook-signature": sig } }));
  return { status: res.status, ...(await res.json()) as { outcome?: string } };
}
const sub = (over: Record<string, unknown> = {}) => ({
  subscription_id: "sub_T", product_id: PRODUCTS.basic, status: "active", cancel_at_next_billing_date: false,
  previous_billing_date: at(0), next_billing_date: at(365), metadata: { [ACCOUNT_METADATA_KEY]: T }, customer: { customer_id: "cus_T" }, ...over,
});
const state = (u: string) => psql(`select public.access_for('${u}') ->> 'state'`);
const recovery = () => psql(`select md5(string_agg(h::text, ';' order by id)) from public.habits h where user_id = '${T}'`);

describe.skipIf(!CONN)("Dodo webhooks against a real database (opt-in)", () => {
  let recoveryBefore = "";
  beforeAll(() => {
    psql(`drop database if exists ${DB}`, "postgres");
    psql(`create database ${DB}`, "postgres");
    // The stub's roles are cluster-wide and may exist already (another test database): that one line may fail.
    execFileSync("psql", [`${CONN} dbname=${DB}`, "-X", "-q", "-f", join(ROOT, "tests/local-auth-stub.sql")], { stdio: "ignore" });
    for (const f of readdirSync(join(ROOT, "migrations")).filter((f) => /^00\d\d_.*\.sql$/.test(f)).sort()) {
      execFileSync("psql", [`${CONN} dbname=${DB}`, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", join(ROOT, "migrations", f)], { stdio: "ignore" });
    }
    psql(`insert into auth.users (id, email, created_at) values ('${T}', 'test@pawse.invalid', now() - interval '30 days'), ('${O}', 'other@pawse.invalid', now() - interval '30 days');
      insert into public.companions (id, user_id, species, name, born_on) values ('c1111111-0000-4000-8000-0000000000aa', '${T}', 'dog', 'Biscuit', '2026-10-01');
      insert into public.habits (id, user_id, companion_id, name, class, class_weight, unit, fields) values ('d1111111-0000-4000-8000-0000000000aa', '${T}', 'c1111111-0000-4000-8000-0000000000aa', 'Scrolling', 'doomscrolling', 0.8, 'minutes', '[]');`);
    recoveryBefore = recovery();
  }, 60_000);

  it("before paying: the test account's trial has ended", () => expect(state(T)).toBe("expired"));

  it("an invalid signature is refused and writes nothing", async () => {
    expect((await deliver("subscription.active", sub(), { badSig: true })).status).toBe(401);
    expect(psql("select count(*) from public.payment_events")).toBe("0");
  });

  it("Basic purchase: payment then subscription.active → Basic, app without AI", async () => {
    expect(await deliver("payment.succeeded", { payment_id: "pay_1", subscription_id: "sub_T", metadata: { [ACCOUNT_METADATA_KEY]: T }, customer: { customer_id: "cus_T" } })).toMatchObject({ status: 200, outcome: "recorded" });
    expect(await deliver("subscription.active", sub(), { id: "msg_active" })).toMatchObject({ status: 200, outcome: "applied" });
    expect(psql(`select public.access_for('${T}') @> '{"state":"basic","app":true,"ai":false}'`)).toBe("t");
    expect(psql(`select provider_ref || ' ' || provider_customer from public.entitlements where user_id = '${T}'`)).toBe("sub_T cus_T");
  });

  it("the same webhook delivered twice: duplicate, one row", async () => {
    expect(await deliver("subscription.active", sub(), { id: "msg_active" })).toMatchObject({ status: 200, outcome: "duplicate" });
    expect(psql("select count(*) from public.payment_events where event_id = 'msg_active'")).toBe("1");
    expect(psql(`select count(*) from public.entitlements where user_id = '${T}'`)).toBe("1");
  });

  it("upgrade to AI on the same subscription (plan_changed, no metadata needed) → AI", async () => {
    expect(await deliver("subscription.plan_changed", sub({ product_id: PRODUCTS.ai, metadata: {} }))).toMatchObject({ outcome: "applied" });
    expect(psql(`select public.access_for('${T}') @> '{"state":"ai","ai":true}'`)).toBe("t");
  });

  it("renewal extends the year; a failed renewal payment changes nothing", async () => {
    expect(await deliver("subscription.renewed", sub({ product_id: PRODUCTS.ai, previous_billing_date: at(365), next_billing_date: at(730), metadata: {} }))).toMatchObject({ outcome: "applied" });
    expect(psql(`select period_end > now() + interval '700 days' from public.entitlements where user_id = '${T}'`)).toBe("t");
    expect(await deliver("payment.failed", { payment_id: "pay_f", subscription_id: "sub_T", metadata: {} })).toMatchObject({ outcome: "recorded" });
    expect(state(T)).toBe("ai");
  });

  it("cancellation: renewal off, access runs to the end of the paid year", async () => {
    expect(await deliver("subscription.cancelled", sub({ product_id: PRODUCTS.ai, status: "cancelled", metadata: {} }))).toMatchObject({ outcome: "recorded" });
    expect(psql(`select renews from public.entitlements where user_id = '${T}'`)).toBe("f");
    expect(state(T)).toBe("ai");
  });

  it("a refund nobody can trace is held for review; nobody loses access", async () => {
    expect(await deliver("refund.succeeded", { refund_id: "ref_x", payment_id: "pay_unknown", is_partial: false, metadata: {} })).toMatchObject({ outcome: "needs_review" });
    expect(state(T)).toBe("ai");
  });

  it("an event naming another account for this subscription is applied to neither", async () => {
    expect(await deliver("subscription.active", sub({ product_id: PRODUCTS.ai, metadata: { [ACCOUNT_METADATA_KEY]: O } }))).toMatchObject({ outcome: "needs_review" });
    expect(state(O)).toBe("expired");
    expect(state(T)).toBe("ai");
  });

  it("a full refund of the payment ends access at once (found through the payment)", async () => {
    expect(await deliver("refund.succeeded", { refund_id: "ref_1", payment_id: "pay_1", is_partial: false, metadata: {}, customer: { customer_id: "cus_T" } })).toMatchObject({ outcome: "applied" });
    expect(psql(`select public.access_for('${T}') @> '{"state":"refunded","app":false,"ai":false}'`)).toBe("t");
  });

  it("recovery rows are exactly as before every payment event", () => expect(recovery()).toBe(recoveryBefore));
});
