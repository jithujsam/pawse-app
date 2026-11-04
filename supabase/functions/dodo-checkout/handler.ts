// Dodo Payments checkout: for a signed-in person, asks Dodo for a hosted checkout page for one annual plan, tagged
// with the account's id so the payment comes back to the right account. A Basic member moving to AI changes their
// existing subscription instead (after confirming in the app), so they never pay for two. It grants nothing: access
// changes only when Dodo's signed webhook arrives (dodo-webhook). Answers 503 until its secrets are set.
import { checkoutRequest, dodoApiBase, upgradeRequest, validReturnUrl } from "../_shared/dodo.ts";
import type { PlanId } from "../_shared/payments.ts";

export interface CheckoutDeps { env: (k: string) => string | undefined; fetch: typeof fetch }

const ORIGINS = ["https://localhost", "capacitor://localhost", "http://localhost", "http://localhost:5173", "http://localhost:4173"];
const SUB_ID = /^[A-Za-z0-9_-]{1,100}$/;

export function makeDodoCheckout({ env, fetch }: CheckoutDeps): (req: Request) => Promise<Response> {
  const allowed = new Set([...ORIGINS, ...(env("ALLOWED_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean)]);
  return async (req) => {
    const origin = req.headers.get("Origin") ?? "";
    const headers = {
      "Access-Control-Allow-Origin": allowed.has(origin) ? origin : "https://localhost",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json", "Cache-Control": "no-store",
    };
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (req.method === "OPTIONS") return new Response("ok", { headers });
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

    // Configuration, all server-side. The product ids are the only products this function will ever sell.
    const apiKey = env("DODO_PAYMENTS_API_KEY"), returnUrl = env("DODO_PAYMENTS_RETURN_URL");
    const apiBase = dodoApiBase(env("DODO_PAYMENTS_ENVIRONMENT"), env("DODO_PAYMENTS_LIVE_ENABLED"));
    const products: Record<PlanId, string> = { basic: env("DODO_BASIC_PRODUCT_ID") ?? "", ai: env("DODO_AI_PRODUCT_ID") ?? "" };
    const url = env("SUPABASE_URL"), serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!apiKey || !apiBase || !validReturnUrl(returnUrl) || !products.basic || !products.ai || products.basic === products.ai || !url || !serviceKey) {
      return json({ ok: false, error: "not_enabled" }, 503);
    }
    const service = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
    const dodo = (path: string, body: unknown) => fetch(`${apiBase}${path}`, {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);

    // Who is asking: the person's own login token, checked by Supabase Auth. Never an id from the request body.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
    if (!token) return json({ ok: false, error: "unauthorized" }, 401);
    const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } }).catch(() => null);
    const user = who && who.ok ? await who.json() as { id?: string; email?: string } : null;
    if (!user?.id) return json({ ok: false, error: "unauthorized" }, 401);

    // Only a plan name comes from the app; anything else in the body (a product id, a price) is ignored.
    let plan: PlanId, upgrade = false;
    try {
      const b = await req.json() as { plan?: unknown; upgrade?: unknown };
      if (b.plan !== "basic" && b.plan !== "ai") throw 0;
      plan = b.plan; upgrade = b.upgrade === true;
    } catch { return json({ ok: false, error: "bad_request" }, 400); }

    // Never sell a plan the account already has, or Basic on top of an active AI plan.
    const acc = await fetch(`${url}/rest/v1/rpc/access_for`, { method: "POST", headers: service, body: JSON.stringify({ p_user: user.id }) }).catch(() => null);
    const access = acc && acc.ok ? await acc.json() as { state?: string } | null : null;
    if (!access) return json({ ok: false, error: "access" }, 503);
    if (access.state === "ai" || (access.state === "basic" && plan === "basic")) return json({ ok: false, error: "already_active" }, 409);

    // Basic → AI: change the existing Dodo subscription rather than start a second one.
    if (access.state === "basic" && plan === "ai") {
      const ent = await fetch(`${url}/rest/v1/entitlements?select=provider,provider_ref,status,plan&user_id=eq.${user.id}`, { headers: service }).catch(() => null);
      const row = ent && ent.ok ? ((await ent.json()) as { provider?: string; provider_ref?: string | null; status?: string; plan?: string }[])[0] : undefined;
      if (row?.provider === "dodo" && row.status === "active" && row.plan === "basic" && row.provider_ref && SUB_ID.test(row.provider_ref)) {
        if (!upgrade) return json({ ok: false, error: "confirm_upgrade" }, 409);
        const res = await dodo(`/subscriptions/${encodeURIComponent(row.provider_ref)}/change-plan`, upgradeRequest(products, user.id));
        if (!res || !res.ok) {
          console.error(`dodo-checkout: change-plan answered ${res ? res.status : "no response"}`);
          return json({ ok: false, error: "provider" }, 502);
        }
        return json({ ok: true, upgrade_requested: true });
      }
      // A Basic plan from elsewhere (a manual grant): a new AI checkout is the way up.
    }

    const res = await dodo("/checkouts", checkoutRequest(plan, user.id, user.email ?? null, products, returnUrl!));
    const out = res && res.ok ? await res.json() as { checkout_url?: unknown } : null;
    const checkoutUrl = typeof out?.checkout_url === "string" && out.checkout_url.startsWith("https://") ? out.checkout_url : null;
    if (!checkoutUrl) {
      console.error(`dodo-checkout: checkouts answered ${res ? res.status : "no response"}`);
      return json({ ok: false, error: "provider" }, 502);
    }
    return json({ ok: true, checkout_url: checkoutUrl });
  };
}
