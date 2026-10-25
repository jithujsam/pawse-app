import { AiSlipResult, AiWeeklyResult, type SlipRequest, type WeeklyRequest } from "@detox/schema";
import { supabase } from "./supabase";
import { AI_CACHE_KEY, getData } from "./store";

/** Answers are kept on the phone 7 days. Entries from before this (no `at`) are dropped when read. */
export const AI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
type Cache = Record<string, { at: number; raw: unknown }>;
const readCache = (): Cache => {
  try {
    const now = Date.now();
    return Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem(AI_CACHE_KEY) ?? "{}") as Cache).filter(([, v]) => typeof v?.at === "number" && now - v.at < AI_CACHE_TTL_MS));
  } catch { return {}; }
};
const writeCache = (c: Cache) => { try { const keys = Object.keys(c); if (keys.length > 200) delete c[keys[0]]; localStorage.setItem(AI_CACHE_KEY, JSON.stringify(c)); } catch { /* ignore */ } };

/**
 * AI writing is opt-in (You > AI writing). Every request passes through here, so nothing is sent, and no earlier answer is
 * shown, unless the person has said yes. The server checks the same setting (supabase/functions/ai).
 */
export const aiAllowed = (): boolean => getData().settings.aiConsent === true;

async function call(body: SlipRequest | WeeklyRequest): Promise<unknown | null> {
  if (!aiAllowed() || !supabase) return null;
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return null;
  try {
    const { data, error } = await supabase.functions.invoke("ai", { body });
    if (error || !data?.ok) return null;
    return data.result;
  } catch { return null; }
}

/**
 * The whole request is the key: pet name, amounts and counts all shape the sentence, so a result is
 * only reused for exactly the same slip. This phone's cache is wiped on sign-out and when someone else signs in.
 */
export const aiCacheKey = (req: SlipRequest): string => JSON.stringify(req);

/** What the AI gives back for a slip: one sentence. It never carries a number the app would store. */
export interface SlipAi { explanation: string }

/**
 * One sentence about a slip, to show beside the app's own words. Consent off, any failure, invalid output or a missing
 * account returns null, and the app's own text stands. Whatever else an older server sends (an adjustment, body
 * effects) is ignored: the AI never changes a stored number, the pet's age or what the pet shows.
 */
export async function aiForSlip(req: SlipRequest): Promise<SlipAi | null> {
  if (!aiAllowed()) return null;
  const key = aiCacheKey(req);
  const cache = readCache();
  const hit = cache[key];
  const raw = hit ? hit.raw : await call(req);
  const parsed = AiSlipResult.safeParse(raw);
  if (!parsed.success) return null;
  if (!hit) { cache[key] = { at: Date.now(), raw }; writeCache(cache); }
  return { explanation: parsed.data.explanation };
}

export async function aiWeekly(req: WeeklyRequest): Promise<string | null> {
  const parsed = AiWeeklyResult.safeParse(await call(req));
  return parsed.success ? parsed.data.summary : null;
}
