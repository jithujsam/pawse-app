// Edge function: the only place the OpenRouter key exists. Deploy with verify_jwt on, after migration 0013.
//   supabase secrets set OPENROUTER_API_KEY=...    (never commit it, never ship it in the app)
// The request handling lives in handler.ts so it can be tested; this file only connects it to Deno and Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { makeHandler } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(makeHandler({ admin, env: (k) => Deno.env.get(k), fetch }));
