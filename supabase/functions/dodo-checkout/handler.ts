// Dodo Payments checkout: for a signed-in person, asks Dodo for a checkout page for one annual plan, tagged with the
// account's id so the payment comes back to the right account. It grants nothing: access changes only when Dodo's
// signed webhook arrives (dodo-webhook). Switched off until DODO_CHECKOUT_ENABLED is "true" and its secrets are set.
import { checkoutRequest } from "../_shared/dodo.ts";
import type { PlanId } from "../_shared/payments.ts";

export interface CheckoutDeps { env: (k: string) => string | undefined; fetch: typeof fetch }

const ORIGINS = ["https://localhost", "capacitor://localhost", "http://localhost", "http://localhost:5173", "http://localhost:4173"];

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

    const enabled = env("DODO_CHECKOUT_ENABLED") === "true";
    const apiKey = env("DODO_API_KEY"), apiBase = env("DODO_API_BASE"), returnUrl = env("DODO_RETURN_URL");
    const products = { basic: env("DODO_PRODUCT_BASIC") ?? "", ai: env("DODO_PRODUCT_AI") ?? "" };
    const url = env("SUPABASE_URL"), serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!enabled || !apiKey || !apiBase || !returnUrl || !products.basic || !products.ai || !url || !serviceKey) return json({ ok: false, error: "not_enabled" }, 503);
    if (!/^https:\/\/(test|live)\.dodopayments\.com$/.test(apiBase)) return json({ ok: false, error: "not_enabled" }, 503);

    // Who is asking: the person's own login token, checked by Supabase Auth.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
    if (!token) return json({ ok: false, error: "unauthorized" }, 401);
    const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } }).catch(() => null);
    const user = who && who.ok ? await who.json() as { id?: string; email?: string } : null;
    if (!user?.id) return json({ ok: false, error: "unauthorized" }, 401);

    let plan: PlanId;
    try { const b = await req.json() as { plan?: unknown }; if (b.plan !== "basic" && b.plan !== "ai") throw 0; plan = b.plan; }
    catch { return json({ ok: false, error: "bad_request" }, 400); }

    // Never sell a plan the account already has, or Basic on top of an active AI plan.
    const acc = await fetch(`${url}/rest/v1/rpc/access_for`, {
      method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_user: user.id }),
    }).catch(() => null);
    const access = acc && acc.ok ? await acc.json() as { state?: string } | null : null;
    if (!access) return json({ ok: false, error: "access" }, 503);
    if (access.state === "ai" || (access.state === "basic" && plan === "basic")) return json({ ok: false, error: "already_active" }, 409);

    const res = await fetch(`${apiBase}/checkouts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(checkoutRequest(plan, user.id, user.email ?? null, products, returnUrl)),
    }).catch(() => null);
    const out = res && res.ok ? await res.json() as { checkout_url?: unknown } : null;
    const checkoutUrl = typeof out?.checkout_url === "string" && out.checkout_url.startsWith("https://") ? out.checkout_url : null;
    if (!checkoutUrl) return json({ ok: false, error: "provider" }, 502);
    return json({ ok: true, checkout_url: checkoutUrl });
  };
}
