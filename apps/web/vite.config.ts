import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import version from "./version.json";

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version.name), __APP_CODE__: JSON.stringify(version.code) },
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Long-lived vendor chunks cache separately from app code.
        manualChunks: { react: ["react", "react-dom"], motion: ["motion/react"], supabase: ["@supabase/supabase-js"] },
      },
    },
  },
});
