// Edge function (not deployed yet): starts a Dodo Payments checkout. Deploy WITH Supabase's JWT check (only signed-in
// people). Off until DODO_CHECKOUT_ENABLED=true. Secrets: DODO_API_KEY, DODO_API_BASE, DODO_PRODUCT_BASIC,
// DODO_PRODUCT_AI, DODO_RETURN_URL. docs/DEPLOY_MEMBERSHIP.md, "Payments".
import { makeDodoCheckout } from "./handler.ts";

Deno.serve(makeDodoCheckout({ env: (k) => Deno.env.get(k), fetch }));
