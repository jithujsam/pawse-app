// Dodo Payments webhook: the address Dodo calls when a payment, renewal, refund or cancellation happens. It checks
// Dodo's signature, then records the event once (apply_payment_event, migration 0014). Nothing the app sends can
// grant access; only a signed event from Dodo can. Refuses everything until its secrets are set.
import { dodoVerifier } from "../_shared/dodo.ts";
import { processPaymentWebhook, type Rpc } from "../_shared/payments.ts";

export interface WebhookDeps { env: (k: string) => string | undefined; fetch: typeof fetch }

export function makeDodoWebhook({ env, fetch }: WebhookDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const secret = env("DODO_WEBHOOK_SECRET"), basic = env("DODO_PRODUCT_BASIC"), ai = env("DODO_PRODUCT_AI");
    const url = env("SUPABASE_URL"), key = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret || !basic || !ai || !url || !key) {
      return new Response(JSON.stringify({ ok: false, error: "not_configured" }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    // The database's one write path for plans, as the service role. A failure is a 500, so Dodo retries the event.
    const rpc: Rpc = async (fn, args) => {
      try {
        const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
          method: "POST",
          headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        if (!r.ok) return { data: null, error: { status: r.status } };
        return { data: await r.json(), error: null };
      } catch (e) { return { data: null, error: e }; }
    };
    return processPaymentWebhook(req, dodoVerifier({ webhookSecret: secret, products: { basic, ai } }), rpc);
  };
}
