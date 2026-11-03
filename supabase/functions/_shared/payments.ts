/**
 * The trusted path from a payment provider to an account's membership. Provider-independent: no provider is chosen
 * yet, so nothing here is deployed (folders starting with "_" are never deployed as functions by Supabase).
 * docs/MONETISATION.md describes how a provider plugs in.
 *
 * The contract:
 *  1. A provider adapter implements PaymentVerifier. It checks the webhook's signature with the provider's secret
 *     (from an Edge Function secret, never from the app) and turns the provider's event into a VerifiedPaymentEvent.
 *     A request whose signature doesn't check out is answered 401 and records nothing.
 *  2. processPaymentWebhook applies the event through public.apply_payment_event (service role), which records it
 *     once per (provider, event id) and changes the account's plan in the same transaction. A replayed or duplicated
 *     webhook is answered 200 "duplicate" and changes nothing.
 *  3. A malformed event, or a database error, is answered 4xx/5xx so the provider retries; nothing half-applies.
 *
 * The app never calls any of this, and nothing the app sends (a return URL, a "payment succeeded" screen) can grant
 * access: only a verified event can. The account is identified by the Supabase user id the app passes to the
 * provider's checkout as its reference (client_reference_id, metadata, or the provider's equivalent).
 * No imports: runs in Deno and in the tests (apps/web/test/payments.test.ts).
 */

export type PlanId = "basic" | "ai";
export type PaymentEventKind = "purchase" | "renewal" | "payment_failed" | "expiry" | "refund" | "revocation";

/** One provider event, after its signature was checked, in the provider's own terms mapped onto ours. */
export interface VerifiedPaymentEvent {
  /** Short provider id, the same for every event from it (e.g. its name). */
  provider: string;
  /** The provider's unique id for this event. Retries of the same event carry the same id. */
  eventId: string;
  /** The Supabase user id passed to checkout, or null if the event carries none. */
  accountId: string | null;
  kind: PaymentEventKind;
  /** For purchase and renewal: which plan was paid for. */
  plan: PlanId | null;
  /** For purchase and renewal: the paid period (ISO 8601). For expiry: the end of the period that ended. */
  periodStart: string | null;
  periodEnd: string | null;
  /** The provider's id for the purchase or subscription, so a refund of an older purchase can't end a newer one. */
  providerRef: string | null;
}

export interface PaymentVerifier {
  readonly provider: string;
  /**
   * The event if the request is genuinely from the provider, else null. `{ ignored }` for a genuine event that changes
   * nothing here (answered 200 so the provider stops retrying). Must read the raw body for the signature.
   */
  verify(req: Request): Promise<VerifiedPaymentEvent | { ignored: string } | null>;
}

/** The one database call this needs: supabase-js's `rpc` on a service-role client. */
export type Rpc = (fn: "apply_payment_event", args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

export type Outcome = "applied" | "duplicate" | "recorded" | "stale" | "needs_review" | "no_account" | "ignored";

const KINDS: readonly PaymentEventKind[] = ["purchase", "renewal", "payment_failed", "expiry", "refund", "revocation"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A paid period is a year; a little over allows for provider rounding and time zones. Upgrades may be shorter. */
const MAX_PERIOD_MS = 380 * 86_400_000;

/** Why an event can't be applied, or null if it can. */
export function problemWith(e: VerifiedPaymentEvent): string | null {
  if (!/^[a-z0-9_-]{1,40}$/.test(e.provider)) return "provider";
  if (!e.eventId || e.eventId.length > 200) return "event_id";
  if (!KINDS.includes(e.kind)) return "kind";
  if (e.accountId !== null && !UUID.test(e.accountId)) return "account";
  if (e.providerRef !== null && e.providerRef.length > 200) return "provider_ref";
  const start = e.periodStart === null ? null : Date.parse(e.periodStart);
  const end = e.periodEnd === null ? null : Date.parse(e.periodEnd);
  if (Number.isNaN(start) || Number.isNaN(end)) return "period";
  if (e.kind === "purchase" || e.kind === "renewal") {
    if (e.plan !== "basic" && e.plan !== "ai") return "plan";
    if (start === null || end === null || end <= start || end - start > MAX_PERIOD_MS) return "period";
  } else if (e.plan !== null && e.plan !== "basic" && e.plan !== "ai") return "plan";
  return null;
}

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function processPaymentWebhook(req: Request, verifier: PaymentVerifier, rpc: Rpc): Promise<Response> {
  if (req.method !== "POST") return reply(405, { ok: false });
  let verified: VerifiedPaymentEvent | { ignored: string } | null;
  try { verified = await verifier.verify(req); } catch { verified = null; }
  if (!verified) return reply(401, { ok: false, error: "signature" });
  if ("ignored" in verified) return reply(200, { ok: true, outcome: "ignored" as Outcome });
  const event = verified;
  if (event.provider !== verifier.provider) return reply(401, { ok: false, error: "signature" });
  const problem = problemWith(event);
  if (problem) return reply(400, { ok: false, error: problem });
  const { data, error } = await rpc("apply_payment_event", {
    p_provider: event.provider, p_event_id: event.eventId, p_user: event.accountId, p_kind: event.kind, p_plan: event.plan,
    p_period_start: event.periodStart, p_period_end: event.periodEnd, p_provider_ref: event.providerRef,
  });
  // The provider retries on anything but 2xx; the database applied nothing, so a retry is safe.
  if (error) return reply(500, { ok: false, error: "apply" });
  return reply(200, { ok: true, outcome: data as Outcome });
}

/** The verifier in use while no provider is connected: every request is rejected. */
export const noProvider: PaymentVerifier = { provider: "none", verify: async () => null };
