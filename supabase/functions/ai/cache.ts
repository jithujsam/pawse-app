/** AI answers are kept 7 days, then are neither served nor kept. */
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Rows created before this are expired. */
export const cacheCutoff = (now = Date.now()): string => new Date(now - CACHE_TTL_MS).toISOString();

/** Bumped when what the function answers changes. 2: a slip's answer is one sentence, so answers cached before it (which carry an adjustment) are never served again. */
const VERSION = 2;

/**
 * Cache key for AI results: this person plus the whole validated request, so a result is only reused for exactly
 * the same request from the same person. A cached sentence can quote the request (pet name, amounts, notes), so it
 * must never be served to anyone else. Plain Web Crypto: runs in Deno (the function) and Node (the tests).
 */
export async function cacheKey(userId: string, request: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([VERSION, userId, request])));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
