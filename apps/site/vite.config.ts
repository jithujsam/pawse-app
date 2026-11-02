import { defineConfig, type Plugin } from "vite";
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

export default defineConfig({
  plugins: [react(), appModels()],
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
});
