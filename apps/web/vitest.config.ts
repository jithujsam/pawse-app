import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import vite from "./vite.config";

// The AI Edge Function (supabase/functions/ai) runs in Deno and imports zod as "npm:zod@3.23.8". Its tests run here,
// so that one specifier points at the zod the workspace already has (packages/schema's). No new dependency.
const fromSchema = createRequire(join(__dirname, "..", "..", "packages", "schema", "package.json"));
const zod = dirname(fromSchema.resolve("zod/package.json"));

export default mergeConfig(vite, defineConfig({
  resolve: { alias: { "npm:zod@3.23.8": zod } },
}));
