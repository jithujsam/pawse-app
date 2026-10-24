import { AiSlipResult, AiWeeklyResult, type SlipRequest, type WeeklyRequest } from "@detox/schema";
import { applyAiAdjustment } from "@detox/engine";
import { supabase } from "./supabase";

const CACHE_KEY = "companion/ai-cache/v1";
type Cache = Record<string, unknown>;
const readCache = (): Cache => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}"); } catch { return {}; } };
const writeCache = (c: Cache) => { try { const keys = Object.keys(c); if (keys.length > 200) delete c[keys[0]]; localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* ignore */ } };

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

export interface SlipAi { months: number; adjustPct: number; effects: string[]; explanation: string }

/** Any failure, invalid output or missing account returns null, and the baseline stands. */
export async function aiForSlip(req: SlipRequest): Promise<SlipAi | null> {
  const key = JSON.stringify([req.habitClass, req.tone, req.unit, Math.round((req.amount ?? 0) / Math.max(1, req.median ?? 1) * 4), req.triggers.length, req.nthToday, Math.round(req.baselineMonths)]);
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
