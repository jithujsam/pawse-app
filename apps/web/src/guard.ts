import { hasCrisisLanguage } from "./crisis";

/**
 * One safety check for every place a person can type. Two concerns, in this order:
 *  - "crisis": language about harming themselves. PRD section 15 says this is checked in any field.
 *  - "restriction": calories, weight, dieting or restricting food. pawse never tracks these (CLAUDE.md), so they can't
 *    become what a track is called, what it counts, a custom question or a typed answer.
 *
 * Narrative text (a note on a slip, a reflection, the journal) is checked for crisis language only; anything that
 * defines or labels what the app tracks, or is a typed answer to a question, is checked for both. The store applies the
 * same checks again, so a path that skips the screen's own check still can't save the text.
 */
export type Concern = "crisis" | "restriction";
export type Strictness = "all" | "crisis";

/** Lower-case, accents and zero-width characters removed, look-alike digits and symbols mapped to letters. */
export function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ​-‏⁠﻿]/g, "")
    .toLowerCase()
    .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/@/g, "a").replace(/\$/g, "s")
    .replace(/\s+/g, " ")
    .trim();
}

const RESTRICTION: RegExp[] = [
  /calori|calory|\bkcals?\b|\bkj\b|\bmacros?\b|\bbmi\b/,
  /\bdiet(s|ing|er)?\b|\bketo\b|\bfasting\b|\bfasts? (for|day|window)|water fast|intermittent/,
  /weigh[- ]?ins?\b|\bweigh(s|ed|ing)?\b|\b(my|body) weight\b|(lose|losing|lost|gain|gaining|drop|dropping|shed|shedding) (some |the |more |extra |too much )?(weight|pounds|kilos|kgs?|lbs)\b|\bweight[- ]loss\b|\bgoal weight\b|\bscales?\b.*\b(weigh|kg|lbs|pounds)\b/,
  /(lose|losing|drop|dropping|shed|shedding|gain|gaining)\s+\d+(\.\d+)?\s*(kg|kgs|kilos?|lbs?|pounds?|stone)\b/,
  /\bstarv|\bpurg|\blaxative|\banorex|\bbulimi|\bpro[- ]?(ana|mia)\b|\bthin[- ]?spo|\bbinge[- ]?(eat|purg)|\bover[- ]?eat|\bunder[- ]?eat/,
  /\bskip(ping|ped)? (a |my |the |some )?(meals?|food|breakfast|lunch|dinner|eating)\b|\beat(ing)? (less|nothing|too (much|little))\b|\b(not|stop|stopped|stopping) eating\b|\brestrict(ing|ed|ion)? (food|eating|meals?|calories|intake)\b|\bcut(ting)? (out )?(carbs|meals?|food)\b|\bfood (rules?|intake|log|diary)\b/,
  /\btoo fat\b|\bfeel(ing)? fat\b|\bam fat\b|\bget(ting)? thin(ner)?\b|\bflat stomach\b|\bbody (fat|image)\b/,
];
/** Tokens that stay detectable when spaced or punctuated out (c a l o r i e s). */
const STRONG = ["calorie", "kcal", "anorexi", "bulimi", "starv", "laxative"];

/** The text as typed (accents and zero-width characters removed), and again with look-alike digits turned into letters. */
const variants = (text: string): string[] => {
  const plain = text.normalize("NFKD").replace(/[\u0300-\u036f\u200b-\u200f\u2060\ufeff]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const n = normalise(text);
  // "1" can stand for i or l (ca1ories), so both readings are checked.
  const l = n.replace(/i(?=[^a-z]|$)/g, "i");
  const alt = text.normalize("NFKD").replace(/[\u0300-\u036f\u200b-\u200f\u2060\ufeff]/g, "").toLowerCase().replace(/1/g, "l").replace(/0/g, "o").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/@/g, "a").replace(/\$/g, "s").replace(/\s+/g, " ").trim();
  return [...new Set([plain, n, l, alt])];
};

export function isRestrictionRelated(text: string): boolean {
  const vs = variants(text);
  if (!vs[0]) return false;
  if (vs.some((v) => RESTRICTION.some((p) => p.test(v)))) return true;
  return vs.some((v) => { const sq = v.replace(/[^a-z]/g, ""); return sq !== v && STRONG.some((s) => sq.includes(s)); });
}

const CRISIS_EXTRA: RegExp[] = [/\bwish i (was|were) dead\b/i, /\bnot worth living\b/i, /\bno point (in )?(living|going on|being alive)\b/i, /\bcut(ting)? myself (open|again|badly|deliberately|on purpose)\b/i, /\bcutting myself\b(?! (some|off|out))/i, /\bcut myself$/i, /\bdon'?t want to wake up\b/i];
export const hasCrisis = (text: string): boolean => hasCrisisLanguage(text) || CRISIS_EXTRA.some((p) => p.test(text.toLowerCase()));

/** What a piece of text needs: the crisis message, the restriction note, or nothing. */
export function concernIn(text: string | null | undefined, strict: Strictness = "all"): Concern | null {
  if (!text) return null;
  if (hasCrisis(text)) return "crisis";
  if (strict === "all" && isRestrictionRelated(text)) return "restriction";
  return null;
}

/** The first concern found across several texts, crisis ranking above restriction. */
export function concernInAny(texts: Iterable<string | null | undefined>, strict: Strictness = "all"): Concern | null {
  let found: Concern | null = null;
  for (const t of texts) {
    const c = concernIn(t, strict);
    if (c === "crisis") return c;
    if (c) found = c;
  }
  return found;
}

/** Every string inside a value (arrays and plain objects included), for checking a whole record at once. */
export function* stringsIn(v: unknown): Generator<string> {
  if (typeof v === "string") yield v;
  else if (Array.isArray(v)) for (const x of v) yield* stringsIn(x);
  else if (v && typeof v === "object") for (const x of Object.values(v)) yield* stringsIn(x);
}
