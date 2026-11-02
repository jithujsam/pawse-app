import { defineConfig, loadEnv, type Plugin } from "vite";
import { config as site } from "./site.config";
import { copy } from "./src/copy";

/**
 * Builds index.html from two hand-edited files: site.config.ts (prices, spots, UPI, endpoints) and src/copy.ts (every
 * word). The page ships as plain HTML, so it reads in full without JavaScript. Template syntax in index.html:
 *   {{c.path.to.string}}                       a string from copy.ts
 *   <!--each:c.path-->…{{.}} {{.q}}…<!--/each:c.path-->   repeat for an array (strings, or objects by field)
 *   <!--if:flag-->shown<!--else-->otherwise<!--/if:flag-->   flags: qrImage, intlLink, upiReady, spotsOpen, formReady, waitlistReady, contactReady, analytics
 *   {{priceInr}} and the other config values, also usable inside copy strings.
 */
function siteHtml(env: Record<string, string>): Plugin {
  const formEndpoint = env.VITE_FORM_ENDPOINT || site.formEndpoint;
  const waitlistEndpoint = env.VITE_WAITLIST_ENDPOINT || site.waitlistEndpoint || formEndpoint;
  const spotsLeft = Math.max(0, site.spotsTotal - site.spotsTaken);
  const upiReady = !!site.upiId && !/^todo/i.test(site.upiId);
  const upiLink = upiReady
    ? `upi://pay?pa=${encodeURIComponent(site.upiId)}&pn=${encodeURIComponent(site.upiPayeeName)}&am=${site.priceInr}&cu=INR&tn=${encodeURIComponent("Pawse Founding Member")}`
    : "";
  const contactReady = !!site.contactEmail && !/^todo/i.test(site.contactEmail);
  const values: Record<string, string | number> = {
    priceInr: site.priceInr, priceUsd: site.priceUsdApprox, spotsTotal: site.spotsTotal, spotsLeft,
    refundWindow: site.refundWindow, upiId: site.upiId, qrImage: site.qrImage, upiLink, apkUrl: site.apkUrl,
    contactEmail: site.contactEmail, internationalPaymentLink: site.internationalPaymentLink, formEndpoint, waitlistEndpoint,
    analyticsHooks: site.analyticsHooks ? "on" : "off",
  };
  const flags: Record<string, boolean> = {
    qrImage: !!site.qrImage, intlLink: !!site.internationalPaymentLink, upiReady, spotsOpen: spotsLeft > 0,
    formReady: !!formEndpoint, waitlistReady: !!waitlistEndpoint, contactReady, analytics: site.analyticsHooks,
  };
  const get = (path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], { c: copy });
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(values[k] ?? "")).replace(/\{planned\}/g, '<em class="tag">Planned</em>');

  return {
    name: "pawse-site-html",
    transformIndexHtml(html) {
      // 1. repeats, innermost first
      const each = /<!--each:([\w.]+)-->((?:(?!<!--each:)[\s\S])*?)<!--\/each:\1-->/;
      for (let m = each.exec(html); m; m = each.exec(html)) {
        const [whole, path, body] = m;
        const list = (get(path) as unknown[]) ?? [];
        html = html.replace(whole, () => list.map((item) => body.replace(/\{\{\.(\w*)\}\}/g, (_x, f: string) => {
          const v = f ? (item as Record<string, unknown>)[f] : item;
          return fill(String(v ?? ""));
        })).join(""));
      }
      // 2. conditionals, innermost first (they may nest)
      const cond = /<!--if:(\w+)-->((?:(?!<!--if:)[\s\S])*?)<!--\/if:\1-->/;
      for (let m = cond.exec(html); m; m = cond.exec(html)) {
        const [whole, key, body] = m;
        const [yes, no = ""] = body.split("<!--else-->");
        html = html.replace(whole, () => (flags[key] ? yes : no));
      }
      // 3. copy strings, then config values
      html = html.replace(/\{\{c\.([\w.]+)\}\}/g, (_m, p: string) => fill(String(get("c." + p) ?? get(p) ?? "")));
      return fill(html);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [siteHtml(loadEnv(mode, process.cwd(), "VITE_"))],
  base: "/",
  build: { outDir: "dist", target: "es2020", sourcemap: false },
}));
