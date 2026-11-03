/**
 * The boundary between the app and a payment provider. No provider is connected yet (docs/MONETISATION.md), so
 * `checkout` is the one that says so: the paywall shows no buy buttons and claims nothing was bought.
 *
 * When a provider is chosen, its adapter implements CheckoutProvider and opens the provider's own hosted checkout.
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

export const checkout: CheckoutProvider = noCheckout;
