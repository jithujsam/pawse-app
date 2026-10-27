import { AiSlipResult, type SlipRequest } from "@detox/schema";
import { supabase } from "./supabase";
import { AI_CACHE_KEY } from "./store";

/** AI-written text is kept for seven days at most, on the phone and on the server. */
export const AI_RETENTION_MS = 7 * 24 * 3600_000;

type Cache = Record<string, { at: number; raw: unknown }>;
/** Reads the phone's cache and drops anything older than the retention limit (or in the old, untimed format). */
const readCache = (): Cache => {
  try {
    const stored = JSON.parse(localStorage.getItem(AI_CACHE_KEY) ?? "{}") as Record<string, unknown>;
    const fresh: Cache = {};
    for (const [k, v] of Object.entries(stored)) {
      const e = v as { at?: unknown; raw?: unknown } | null;
      if (e && typeof e.at === "number" && Date.now() - e.at < AI_RETENTION_MS) fresh[k] = { at: e.at, raw: e.raw };
    }
    return fresh;
  } catch { return {}; }
};
const writeCache = (c: Cache) => { try { const keys = Object.keys(c); if (keys.length > 200) delete c[keys[0]]; localStorage.setItem(AI_CACHE_KEY, JSON.stringify(c)); } catch { /* ignore */ } };

async function call(body: SlipRequest): Promise<unknown | null> {
  if (!supabase) return null;
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return null;
  try {
    const { data, error } = await supabase.functions.invoke("ai", { body });
    if (error || !data?.ok) return null;
    return data.result;
  } catch { return null; }
}

/**
 * The whole request is the key: pet name, notes, amounts and counts all shape the sentence, so a result is
 * only reused for exactly the same slip. This phone's cache is wiped on sign-out and when someone else signs in.
 */
export const aiCacheKey = (req: SlipRequest): string => JSON.stringify(req);

/**
 * What the AI may add to a slip: a sentence and up to three body-effect tags. It never changes the months lost,
 * the streak, the recovery date or any other calculation: those come from the deterministic engine alone.
 */
export interface SlipAi { effects: string[]; explanation: string }

/**
 * Any failure, invalid output or missing account returns null, and the baseline stands. Nothing is sent, and no
 * cached answer is shown, unless the person is signed in: signing out stops AI wording, as the privacy page says.
 */
export async function aiForSlip(req: SlipRequest): Promise<SlipAi | null> {
  if (!supabase) return null;
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return null;
  const key = aiCacheKey(req);
  const cache = readCache();
  const raw = cache[key]?.raw ?? (await call(req));
  const parsed = AiSlipResult.safeParse(raw);
  if (!parsed.success) return null;
  if (!cache[key]) { cache[key] = { at: Date.now(), raw }; writeCache(cache); }
  return { effects: parsed.data.body_effects, explanation: parsed.data.explanation };
}
