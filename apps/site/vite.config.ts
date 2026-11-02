import { defineConfig, loadEnv, type Plugin } from "vite";
import { config as site } from "./site.config";
import { copy } from "./src/copy";

/**
 * Builds index.html from two hand-edited files: site.config.ts (prices, spots, UPI, endpoints) and src/copy.ts (every
 * word). The page ships as plain HTML, so it reads in full without JavaScript. Template syntax in index.html:
 *   {{c.path.to.string}}                       a string from copy.ts
 *   <!--each:c.path-->…{{.}} {{.q}}…<!--/each:c.path-->   repeat for an array (strings, or objects by field)
 *   <!--if:flag-->shown<!--else-->otherwise<!--/if:flag-->   flags: payReady, waitReady, waitOnly, anyAction, spotsCounted, spotsOpen, siteUrl
 *   {{priceInr}} and the other config values, also usable inside copy strings.
 */
function siteHtml(env: Record<string, string>): Plugin {
  const formEndpoint = env.VITE_FORM_ENDPOINT || site.formEndpoint;
  const waitlistEndpoint = env.VITE_WAITLIST_ENDPOINT || site.waitlistEndpoint || formEndpoint;
  const spotsLeft = Math.max(0, Math.min(site.spotsTotal, site.spotsLeft));
  const spotsOpen = spotsLeft > 0;
  // The pay button needs all three. Otherwise the page shows the waitlist, with no setup talk.
  const payReady = spotsOpen && !!site.upiId.trim() && !!site.qrImage.trim() && !!formEndpoint;
  const waitReady = !!waitlistEndpoint;
  const values: Record<string, string | number> = {
    priceInr: site.priceInr, spotsTotal: site.spotsTotal, spotsLeft, refundWindow: site.refundWindow,
    upiId: site.upiId.trim(), qrImage: site.qrImage.trim(), formEndpoint, waitlistEndpoint,
    upiLink: payReady ? `upi://pay?pa=${encodeURIComponent(site.upiId.trim())}&pn=${encodeURIComponent(site.upiPayeeName)}&am=${site.priceInr}&cu=INR&tn=${encodeURIComponent("Pawse Founding Member")}` : "",
    siteUrl: site.siteUrl.replace(/\/$/, ""),
    privacyUrl: site.privacyUrl || "#privacy",
    faqJsonLd: "",
  };
  const flags: Record<string, boolean> = {
    payReady, waitReady, waitOnly: !payReady && waitReady, anyAction: payReady || waitReady,
    spotsCounted: spotsOpen && spotsLeft < site.spotsTotal, spotsOpen, siteUrl: !!site.siteUrl,
  };
  const get = (path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], { c: copy });
  const plain = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(values[k] ?? "")).replace(/<[^>]+>/g, "");
  values.faqJsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: copy.faq.items.map((i) => ({ "@type": "Question", name: plain(i.q), acceptedAnswer: { "@type": "Answer", text: plain(i.a) } })) }).replace(/</g, "\\u003c");
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(values[k] ?? ""));
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  /** Extra fields for a feature: its screenshot (or a plain labelled placeholder) and its tag. */
  const extras = (it: Record<string, unknown>): Record<string, unknown> => ({
    ...it,
    media: it.img
      ? `<img src="${esc(String(it.img))}" alt="${esc(String(it.alt))}" width="390" height="844" loading="lazy" decoding="async">`
      : `<div class="placeholder" role="img" aria-label="${esc(String(it.alt))}"><b>${esc(String(it.title))}</b><span>${copy.features.placeholder}</span></div>`,
    tagHtml: it.tag ? `<span class="tag">${esc(String(it.tag))}</span>` : "",
  });

  return {
    name: "pawse-site-html",
    transformIndexHtml(html) {
      // 1. repeats, innermost first
      const each = /<!--each:([\w.]+)-->((?:(?!<!--each:)[\s\S])*?)<!--\/each:\1-->/;
      for (let m = each.exec(html); m; m = each.exec(html)) {
        const [whole, path, body] = m;
        const list = (get(path) as unknown[]) ?? [];
        html = html.replace(whole, () => list.map((item) => body.replace(/\{\{\.(\w*)\}\}/g, (_x, f: string) => {
          const v = f ? extras(item as Record<string, unknown>)[f] : item;
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
