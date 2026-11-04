/**
 * The boundary between the app and the payment provider, Dodo Payments. Checkout isn't switched on yet
 * (docs/MONETISATION.md), so `checkout` is the one that says so: the paywall shows no buy buttons and claims nothing
 * was bought.
 *
 * The provider's adapter implements CheckoutProvider and opens the provider's own hosted checkout.
 * The app never grants anything itself: whatever the checkout page or a return link says, access changes only when
 * the provider's signed webhook reaches the server (supabase/functions/_shared/payments.ts → apply_payment_event)
 * and the app reads the result with refreshAccess().
 */
export type PlanId = "basic" | "ai";

export interface CheckoutProvider {
  /** A short id for the provider, e.g. its name. "none" while nothing is connected. */
  readonly id: string;
  /** False when nothing can be bought in this build. */
  readonly available: boolean;
  /** Opens the provider's checkout for a plan, for the signed-in account. Resolves when the checkout view closes, not when payment succeeds. */
  startCheckout(plan: PlanId, accountId: string): Promise<void>;
}

export const noCheckout: CheckoutProvider = {
  id: "none",
  available: false,
  startCheckout: () => Promise.reject(new Error("No payment provider is connected")),
};

/**
 * Dodo Payments (docs/DEPLOY_MEMBERSHIP.md, "Payments"). Asks the dodo-checkout function for a checkout page for the
 * signed-in account and opens it. Nothing here grants access: the app re-checks membership when the person returns,
 * and only Dodo's signed webhook changes it on the server.
 */
export const dodoCheckout: CheckoutProvider = {
  id: "dodo",
  available: true,
  async startCheckout(plan: PlanId) {
    const { supabase } = await import("./supabase");
    if (!supabase) throw new Error("No account service");
    const { data, error } = await supabase.functions.invoke("dodo-checkout", { body: { plan } });
    const url = (data as { ok?: boolean; checkout_url?: unknown } | null)?.checkout_url;
    if (error || typeof url !== "string" || !url.startsWith("https://")) throw new Error("Checkout unavailable");
    const { openExternal } = await import("./native");
    openExternal(url);
  },
};

/**
 * The page the paywall's "Payment information" button opens while nothing can be bought: a plain web page that says
 * payments are being prepared. It is one build setting, VITE_PAYMENT_URL, so the later payment link replaces it with
 * a rebuild and no code change. Only an https address is used; anything else (or nothing) means no button.
 * Opening it never grants anything: access changes only on the server.
 */
export function paymentInfoUrl(raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v.startsWith("https://")) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && u.hostname && !u.username && !u.password ? u.toString() : null;
  } catch { return null; }
}
export const PAYMENT_INFO_URL = paymentInfoUrl(import.meta.env.VITE_PAYMENT_URL as string | undefined);

/**
 * The checkout this build offers. Off unless the build is made with VITE_CHECKOUT=dodo, after the dodo-checkout and
 * dodo-webhook functions are live with their secrets. Until then nothing can be bought, and the paywall says so.
 */
export const checkout: CheckoutProvider = import.meta.env.VITE_CHECKOUT === "dodo" ? dodoCheckout : noCheckout;
