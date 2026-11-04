// Dodo Payments webhook: the address Dodo calls when a payment, renewal, plan change, cancellation, refund or dispute
// happens. It checks Dodo's signature on the raw body, then records the event once (apply_payment_event, migrations
// 0014 and 0016). Nothing the app sends can grant access; only a signed event from Dodo can. Refuses everything until
// its secrets are set.
import { dodoVerifier } from "../_shared/dodo.ts";
import { processPaymentWebhook, type Rpc } from "../_shared/payments.ts";

export interface WebhookDeps { env: (k: string) => string | undefined; fetch: typeof fetch }

export function makeDodoWebhook({ env, fetch }: WebhookDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const secret = env("DODO_PAYMENTS_WEBHOOK_KEY"), basic = env("DODO_BASIC_PRODUCT_ID"), ai = env("DODO_AI_PRODUCT_ID");
    const url = env("SUPABASE_URL"), key = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret || !basic || !ai || basic === ai || !url || !key) {
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
        if (!r.ok) {
          console.error(`dodo-webhook: ${fn} answered ${r.status}`);
          return { data: null, error: { status: r.status } };
        }
        return { data: await r.json(), error: null };
      } catch (e) { return { data: null, error: e }; }
    };
    const res = await processPaymentWebhook(req, dodoVerifier({ webhookSecret: secret, products: { basic, ai } }), rpc);
    // One line per delivery in the function's logs: status and outcome only, never the payload or an account id.
    if (res.status !== 200) console.warn(`dodo-webhook: answered ${res.status}`);
    return res;
  };
}
