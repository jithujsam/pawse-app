/**
 * The boundary between the app and the payment provider, Dodo Payments (docs/MONETISATION.md §7).
 *
 * The app never grants anything itself. It asks the dodo-checkout function for Dodo's hosted checkout page and opens
 * it; whatever that page, a return link or a closed browser says, access changes only when Dodo's signed webhook
 * reaches the server (dodo-webhook → apply_payment_event), and the app only ever learns it by asking the server
 * again (refreshAccess → my_access).
 */
import type { Gate } from "./access";

export type PlanId = "basic" | "ai";

/** What starting a checkout led to. Errors (no network, provider down, not configured) throw. */
export type CheckoutStart =
  /** Dodo's checkout page is open in the phone's browser. */
  | { kind: "opened" }
  /** Basic → AI on an existing subscription: the server needs the person's confirmation before Dodo charges anything. */
  | { kind: "confirm_upgrade" }
  /** Basic → AI was sent to Dodo; AI turns on when its signed webhook arrives. */
  | { kind: "upgrade_requested" }
  /** The server says the account already has this plan (or AI). */
  | { kind: "already_active" };

export interface CheckoutProvider {
  /** A short id for the provider, e.g. its name. "none" while nothing is connected. */
  readonly id: string;
  /** False when nothing can be bought in this build. */
  readonly available: boolean;
  /** Starts buying a plan for the signed-in account. `upgrade` is the person's confirmation of a Basic → AI change. */
  startCheckout(plan: PlanId, opts?: { upgrade?: boolean }): Promise<CheckoutStart>;
}

export const noCheckout: CheckoutProvider = {
  id: "none",
  available: false,
  startCheckout: () => Promise.reject(new Error("No payment provider is connected")),
};

/** Where a checkout was started from this phone, so the app can look for the payment after a restart. */
const PENDING_KEY = "pawse.checkout.pending";
/** How long after starting a checkout the app keeps looking for its payment on the next launch. */
export const PENDING_MS = 2 * 3600_000;

export interface Pending { plan: PlanId; at: number; before: string | null }
/** Remembers a checkout started on this phone, and the paid plan the account had then (paidKey), to tell a change. */
export function markPending(plan: PlanId, before: string | null, now = Date.now()) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ plan, at: now, before })); } catch { /* ignore */ }
}
/** The checkout started on this phone in the last two hours, if any. */
export function peekPending(now = Date.now()): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as Partial<Pending> | null;
    return p && (p.plan === "basic" || p.plan === "ai") && typeof p.at === "number" && now - p.at < PENDING_MS && now >= p.at
      ? { plan: p.plan, at: p.at, before: typeof p.before === "string" ? p.before : null } : null;
  } catch { return null; }
}
export function clearPending() { try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } }

/**
 * Dodo Payments. Asks the dodo-checkout function for a checkout page for the signed-in account and opens it in the
 * phone's browser (a Custom Tab). The function takes only the plan's name: products and prices live on the server.
 */
export const dodoCheckout: CheckoutProvider = {
  id: "dodo",
  available: true,
  async startCheckout(plan, opts = {}) {
    const { supabase } = await import("./supabase");
    const { getGate } = await import("./access");
    const before = paidKey(getGate());
    if (!supabase) throw new Error("No account service");
    const { data, error } = await supabase.functions.invoke("dodo-checkout", { body: { plan, ...(opts.upgrade ? { upgrade: true } : {}) } });
    const out = (data ?? (await errorBody(error))) as { ok?: boolean; checkout_url?: unknown; upgrade_requested?: unknown; error?: unknown } | null;
    if (out?.error === "confirm_upgrade") return { kind: "confirm_upgrade" };
    if (out?.error === "already_active") return { kind: "already_active" };
    if (out?.ok && out.upgrade_requested === true) return { kind: "upgrade_requested" };
    const url = out?.ok ? out.checkout_url : null;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new Error("Checkout unavailable");
    markPending(plan, before);
    const { openExternal } = await import("./native");
    openExternal(url);
    return { kind: "opened" };
  },
};

/** supabase-js reports a non-2xx answer as an error carrying the Response; its JSON says why (409 confirm_upgrade…). */
async function errorBody(error: unknown): Promise<unknown> {
  const res = (error as { context?: unknown } | null)?.context;
  if (res instanceof Response) { try { return await res.clone().json(); } catch { return null; } }
  return null;
}

/**
 * The checkout this build offers. Off unless the build is made with VITE_CHECKOUT=dodo, once the dodo-checkout and
 * dodo-webhook functions are live with their secrets. Without it, nothing can be bought, and the paywall says so.
 */
export const checkout: CheckoutProvider = import.meta.env.VITE_CHECKOUT === "dodo" ? dodoCheckout : noCheckout;

// ---------- coming back from the checkout ----------

/**
 * What the checkout page said when it sent the person back. Only a hint for the wording: it is never trusted for
 * access (anyone can open the return link by hand).
 *   claimed  the page says paid or active        failed     the payment failed
 *   pending  still processing                    cancelled  the person left without paying
 *   unknown  anything else (or no return link: the browser was just closed)
 */
export type ReturnHint = "claimed" | "pending" | "failed" | "cancelled" | "unknown";

export const CHECKOUT_RETURN = "app.detoxcompanion://checkout-return";

/** Reads app.detoxcompanion://checkout-return?… (Dodo adds status, payment_id or subscription_id; we add pawse_checkout). */
export function readReturn(link: string): ReturnHint {
  let q: URLSearchParams;
  try { q = new URL(link.replace("app.detoxcompanion://", "https://app/")).searchParams; } catch { return "unknown"; }
  if (q.get("pawse_checkout") === "cancelled") return "cancelled";
  const status = (q.get("status") ?? "").toLowerCase();
  if (status === "active" || status === "succeeded" || status === "paid") return "claimed";
  if (status === "failed") return "failed";
  if (status === "cancelled" || status === "canceled" || status === "expired") return "cancelled";
  if (status === "processing" || status === "pending" || status.startsWith("requires_")) return "pending";
  return "unknown";
}

/** A paid plan as the gate shows it, so a change (new plan, later end date) can be told apart. Null without one. */
export function paidKey(g: Gate): string | null {
  return g.kind === "open" && (g.access.state === "basic" || g.access.state === "ai") ? `${g.access.state}:${g.access.valid_until ?? ""}` : null;
}

export interface ConfirmDeps {
  refresh: () => Promise<void>;
  gate: () => Gate;
  wait: (ms: number) => Promise<void>;
  say: (text: string, kind?: "good" | "bad") => void;
  text: (id: "checking" | "confirmed" | "pending" | "failed" | "cancelled", plan?: PlanId) => string;
}

/** When to ask the server again after a checkout: at once, then backing off, about two minutes in all. */
export const CONFIRM_SCHEDULE_MS = [0, 2000, 4000, 7000, 10_000, 15_000, 20_000, 30_000, 40_000];

let running: Promise<"confirmed" | "not_yet"> | null = null;
let latestHint: ReturnHint = "unknown";

/**
 * After a checkout: asks the server for the account's membership until a new or longer paid plan shows up, then
 * says so. The hint only chooses the words. A cancelled or failed checkout is said at once (after one check, in case
 * a payment did go through); everything else waits for the server. Nothing here ever grants access.
 * Only one runs at a time; a later hint (the return link arriving after the browser closed) updates the words.
 */
export function confirmAfterCheckout(hint: ReturnHint, before: string | null, deps: ConfirmDeps): Promise<"confirmed" | "not_yet"> {
  if (hint !== "unknown") latestHint = hint;
  if (running) return running;
  latestHint = hint;
  running = (async () => {
    try {
      const quick = latestHint === "cancelled" || latestHint === "failed";
      if (!quick) deps.say(deps.text("checking"));
      for (const [i, ms] of (quick ? [0] : CONFIRM_SCHEDULE_MS).entries()) {
        if (ms) await deps.wait(ms - (i > 0 ? CONFIRM_SCHEDULE_MS[i - 1] : 0));
        await deps.refresh();
        const now = paidKey(deps.gate());
        if (now !== null && now !== before) {
          const g = deps.gate();
          deps.say(deps.text("confirmed", g.kind === "open" && g.access.state === "ai" ? "ai" : "basic"), "good");
          return "confirmed";
        }
        if (latestHint === "cancelled" || latestHint === "failed") break;
      }
      deps.say(deps.text(latestHint === "cancelled" ? "cancelled" : latestHint === "failed" ? "failed" : "pending"), latestHint === "failed" ? "bad" : undefined);
      return "not_yet";
    } finally { running = null; }
  })();
  return running;
}

const say = (id: "checking" | "confirmed" | "pending" | "failed" | "cancelled", plan: PlanId | undefined, t: typeof import("./text").t) => ({
  checking: () => t("membership.checkout.checking"),
  confirmed: () => t("membership.checkout.confirmed", { plan: plan === "ai" ? t("membership.paywall.ai_name") : t("membership.paywall.basic_name") }),
  pending: () => t("membership.checkout.pending"),
  failed: () => t("membership.checkout.failed"),
  cancelled: () => t("membership.checkout.cancelled"),
})[id]();

/**
 * The app's side of coming back from a checkout: the return link (with its hint), the browser being closed, or the
 * app starting again within two hours of a checkout begun on this phone (it may have been closed mid-checkout, or
 * the webhook may have been slow). Asks the server, says what it found, and never grants anything.
 */
export async function afterCheckout(hint: ReturnHint): Promise<void> {
  const [{ refreshAccess, getGate }, { t }, { toast }] = await Promise.all([import("./access"), import("./text"), import("./ui/Toast")]);
  const pending = peekPending();
  const before = pending ? pending.before : paidKey(getGate());
  const result = await confirmAfterCheckout(hint, before, {
    refresh: refreshAccess, gate: getGate, wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    say: (text, kind) => toast(text, { kind, ms: 6000 }), text: (id, plan) => say(id, plan, t),
  });
  if (result === "confirmed" || hint !== "unknown") clearPending();
}

/** On start-up, once membership has been read: picks up a checkout begun on this phone in the last two hours. */
export async function resumePendingCheckout(): Promise<void> {
  if (!peekPending()) return;
  await afterCheckout("unknown");
  clearPending();
}

/** For tests: forget a confirmation in progress. */
export function resetConfirm() { running = null; latestHint = "unknown"; }
