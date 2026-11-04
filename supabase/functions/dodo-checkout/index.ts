// Edge function: starts a Dodo Payments checkout for the signed-in person. Deploy WITH Supabase's JWT check (only
// signed-in people). Secrets: DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_ENVIRONMENT (test_mode; live_mode also needs
// DODO_PAYMENTS_LIVE_ENABLED=true), DODO_BASIC_PRODUCT_ID, DODO_AI_PRODUCT_ID, DODO_PAYMENTS_RETURN_URL.
// docs/DEPLOY_MEMBERSHIP.md, "Payments".
import { makeDodoCheckout } from "./handler.ts";

Deno.serve(makeDodoCheckout({ env: (k) => Deno.env.get(k), fetch }));
