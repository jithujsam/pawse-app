import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
