// Edge function (not deployed yet): Dodo Payments' webhook. Deploy WITHOUT Supabase's JWT check (Dodo can't send a
// Supabase login token); Dodo's own signature is checked instead. Secrets: DODO_WEBHOOK_SECRET, DODO_PRODUCT_BASIC,
// DODO_PRODUCT_AI. docs/DEPLOY_MEMBERSHIP.md, "Payments".
import { makeDodoWebhook } from "./handler.ts";

Deno.serve(makeDodoWebhook({ env: (k) => Deno.env.get(k), fetch }));
