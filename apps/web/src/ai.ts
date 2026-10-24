import { AiSlipResult, AiWeeklyResult, type SlipRequest, type WeeklyRequest } from "@detox/schema";
import { applyAiAdjustment } from "@detox/engine";
import { supabase } from "./supabase";
import { AI_CACHE_KEY } from "./store";

type Cache = Record<string, unknown>;
const readCache = (): Cache => { try { return JSON.parse(localStorage.getItem(AI_CACHE_KEY) ?? "{}"); } catch { return {}; } };
const writeCache = (c: Cache) => { try { const keys = Object.keys(c); if (keys.length > 200) delete c[keys[0]]; localStorage.setItem(AI_CACHE_KEY, JSON.stringify(c)); } catch { /* ignore */ } };

async function call(body: SlipRequest | WeeklyRequest): Promise<unknown | null> {
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

export interface SlipAi { months: number; adjustPct: number; effects: string[]; explanation: string }

/** Any failure, invalid output or missing account returns null, and the baseline stands. */
export async function aiForSlip(req: SlipRequest): Promise<SlipAi | null> {
  const key = aiCacheKey(req);
  const cache = readCache();
  const raw = cache[key] ?? (await call(req));
  const parsed = AiSlipResult.safeParse(raw);
  if (!parsed.success) return null;
  if (!cache[key]) { cache[key] = raw; writeCache(cache); }
  return {
    months: applyAiAdjustment(req.baselineMonths, parsed.data.ai_adjust_pct),
    adjustPct: parsed.data.ai_adjust_pct,
    effects: parsed.data.body_effects,
    explanation: parsed.data.explanation,
  };
}

export async function aiWeekly(req: WeeklyRequest): Promise<string | null> {
  const parsed = AiWeeklyResult.safeParse(await call(req));
  return parsed.success ? parsed.data.summary : null;
}
