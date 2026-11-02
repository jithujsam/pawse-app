import { defineConfig, loadEnv, type Plugin } from "vite";
import { config as site } from "./site.config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The page shows the app's own dog model. Rather than keep a second copy of the binary in git, the model and its
 * licence are served from apps/web/public/models in dev and copied into the build.
 */
const MODELS = fileURLToPath(new URL("../web/public/models/", import.meta.url));
const SHARED = ["dog.glb", "LICENSE.md"];
function appModels(): Plugin {
  return {
    name: "pawse-app-models",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.match(/^\/models\/([\w.-]+)$/)?.[1];
        if (!name || !SHARED.includes(name)) return next();
        res.setHeader("Content-Type", name.endsWith(".glb") ? "model/gltf-binary" : "text/markdown; charset=utf-8");
        res.end(readFileSync(MODELS + name));
      });
    },
    generateBundle() {
      for (const name of SHARED) this.emitFile({ type: "asset", fileName: `models/${name}`, source: readFileSync(MODELS + name) });
    },
  };
}


/**
 * Fills index.html from site.config.ts (and VITE_FORM_ENDPOINT / VITE_WAITLIST_ENDPOINT): {{key}} tokens, and
 * <!--if:key-->shown when set<!--else-->shown when empty<!--/if:key--> blocks. No runtime config is shipped.
 */
function siteHtml(env: Record<string, string>): Plugin {
  const formEndpoint = env.VITE_FORM_ENDPOINT || site.formEndpoint;
  const waitlistEndpoint = env.VITE_WAITLIST_ENDPOINT || site.waitlistEndpoint || formEndpoint;
  const spotsLeft = Math.max(0, site.spotsTotal - site.spotsTaken);
  const upiReady = !!site.upiId && !/^todo/i.test(site.upiId);
  const upiLink = upiReady
    ? `upi://pay?pa=${encodeURIComponent(site.upiId)}&pn=${encodeURIComponent(site.upiPayeeName)}&am=${site.priceInr}&cu=INR&tn=${encodeURIComponent("Pawse Founding Member")}`
    : "";
  const values: Record<string, string | number> = {
    priceInr: site.priceInr, priceUsd: site.priceUsdApprox, spotsTotal: site.spotsTotal, spotsLeft,
    refundWindow: site.refundWindow, upiId: site.upiId, qrImage: site.qrImage, upiLink,
    internationalPaymentLink: site.internationalPaymentLink, formEndpoint, waitlistEndpoint,
  };
  const flags: Record<string, boolean> = {
    qrImage: !!site.qrImage, intlLink: !!site.internationalPaymentLink, upiReady, spotsOpen: spotsLeft > 0,
    formReady: !!formEndpoint, waitlistReady: !!waitlistEndpoint,
  };
  return {
    name: "pawse-site-html",
    transformIndexHtml: (html) => {
      // Resolve the innermost if-blocks first, so blocks can nest.
      const inner = /<!--if:(\w+)-->((?:(?!<!--if:)[\s\S])*?)<!--\/if:\1-->/;
      for (let m = inner.exec(html); m; m = inner.exec(html)) {
        const [whole, key, body] = m;
        const [yes, no = ""] = body.split("<!--else-->");
        html = html.replace(whole, () => (flags[key] ? yes : no));
      }
      return html.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(values[k] ?? ""));
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), appModels(), siteHtml(loadEnv(mode, process.cwd(), "VITE_"))],
  base: "/",
  // Pet3D.tsx lives in apps/web; the dev server may read it.
  server: { fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
  build: {
    outDir: "dist",
    target: "es2020",
    sourcemap: false,
    // three.js is one ~250 KB (gzip) chunk by nature; it loads after first paint (src/main.ts).
    chunkSizeWarningLimit: 1000,
    rollupOptions: { output: { manualChunks: { react: ["react", "react-dom"], three: ["three", "@react-three/fiber"] } } },
  },
}));
