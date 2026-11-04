// Edge function: Dodo Payments' webhook. Deploy WITHOUT Supabase's JWT check (Dodo can't send a Supabase login
// token); Dodo's own signature is checked instead. Secrets: DODO_PAYMENTS_WEBHOOK_KEY, DODO_BASIC_PRODUCT_ID,
// DODO_AI_PRODUCT_ID. docs/DEPLOY_MEMBERSHIP.md, "Payments".
import { makeDodoWebhook } from "./handler.ts";

Deno.serve(makeDodoWebhook({ env: (k) => Deno.env.get(k), fetch }));
