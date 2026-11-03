import { AiPetResult, AiSlipResult, type PetRequest, type SlipRequest } from "@detox/schema";
import { supabase } from "./supabase";
import { AI_CACHE_KEY } from "./store";
import { can } from "./access";
import type { Personality, Tone } from "./types";

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

async function call(body: SlipRequest | PetRequest): Promise<unknown | null> {
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
 * A new AI request, only when the membership includes AI (the trial or the AI plan). Basic, or access that has
 * ended: nothing is sent. The AI function refuses it on the server anyway, whatever the app does; this only saves a
 * call that can't succeed. Text already written (on past slips, or cached on this phone) is never affected.
 */
const callIfIncluded = (body: SlipRequest | PetRequest): Promise<unknown | null> => (can("ai") ? call(body) : Promise.resolve(null));

/**
 * The whole request is the key: pet name, notes, amounts and counts all shape the sentence, so a result is
 * only reused for exactly the same slip. This phone's cache is wiped on sign-out and when someone else signs in.
 */
export const aiCacheKey = (req: SlipRequest | PetRequest): string => JSON.stringify(req);

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
  const raw = cache[key]?.raw ?? (await callIfIncluded(req));
  const parsed = AiSlipResult.safeParse(raw);
  if (!parsed.success) return null;
  if (!cache[key]) { cache[key] = { at: Date.now(), raw }; writeCache(cache); }
  return { effects: parsed.data.body_effects, explanation: parsed.data.explanation };
}

// ---------- the pet's own lines (PRD §24) ----------

/** A day's lines in the pet's personality. Every one replaces a hand-written line only while it is present and valid. */
export interface PetLines { waiting: string; goalMet: string; afterSlip: string; away: string; morning: string; risk: string; thanks: string }

const toLines = (r: AiPetResult): PetLines => ({
  waiting: r.waiting, goalMet: r.goal_met, afterSlip: r.after_slip, away: r.away, morning: r.morning, risk: r.risk, thanks: r.thanks,
});
/** Where the latest lines for a pet sit in the cache, with the personality and Voice they were written in. */
const latestKey = (companionId: string) => `pet:${companionId}`;

const signedIn = async (): Promise<boolean> => {
  if (!supabase) return false;
  const { data: s } = await supabase.auth.getSession();
  return !!s.session;
};

/**
 * Today's lines for one pet: at most one AI call per pet per day (the request carries the date), cached for the
 * retention limit like every AI answer. Signed out, failed or invalid: null, and the hand-written lines stand.
 */
export async function aiPetLines(companionId: string, req: PetRequest): Promise<PetLines | null> {
  if (!(await signedIn())) return null;
  const key = aiCacheKey(req);
  const cache = readCache();
  const raw = cache[key]?.raw ?? (await callIfIncluded(req));
  const parsed = AiPetResult.safeParse(raw);
  if (!parsed.success) return null;
  const at = cache[key]?.at ?? Date.now();
  cache[key] = { at, raw };
  cache[latestKey(companionId)] = { at, raw: { personality: req.personality, tone: req.tone, lines: raw } };
  writeCache(cache);
  return toLines(parsed.data);
}

/**
 * The newest lines written for this pet, for notifications planned ahead. Only while signed in, and only if they
 * were written in the pet's current personality and Voice, so a change of either never shows the old character.
 */
export async function latestPetLines(companionId: string, personality: Personality | undefined, tone: Tone): Promise<PetLines | null> {
  if (!(await signedIn())) return null;
  const e = readCache()[latestKey(companionId)]?.raw as { personality?: unknown; tone?: unknown; lines?: unknown } | undefined;
  if (!e || e.personality !== (personality ?? "playful") || e.tone !== tone) return null;
  const parsed = AiPetResult.safeParse(e.lines);
  return parsed.success ? toLines(parsed.data) : null;
}
