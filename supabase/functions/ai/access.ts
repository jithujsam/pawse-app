/**
 * Who may make a new AI request, from the server's own reading of the account (public.access_for, migration 0014).
 * No imports: runs in Deno (the function) and Node (the tests).
 *
 *   trial  with a confirmed email   allowed, at the trial's daily limit
 *   ai     the AI annual plan        allowed, at the full daily limit
 *   basic  the Basic annual plan     refused: "plan"
 *   trial  without a confirmed email refused: "verify"
 *   expired, refunded, revoked, none refused: "plan"
 *   no answer, or an unreadable one  refused: "access" (fails closed: an AI call costs money, the app keeps its baseline)
 */
export type AiGate =
  | { ok: true; tier: "trial" | "ai" }
  | { ok: false; error: "plan" | "verify" | "access"; status: number };

export function aiGate(access: unknown, failed: boolean): AiGate {
  if (failed || !access || typeof access !== "object") return { ok: false, error: "access", status: 503 };
  const a = access as Record<string, unknown>;
  if (a.ai === true && a.state === "ai") return { ok: true, tier: "ai" };
  if (a.ai === true && a.state === "trial") return { ok: true, tier: "trial" };
  if (a.state === "trial" && a.email_verified !== true) return { ok: false, error: "verify", status: 403 };
  return { ok: false, error: "plan", status: 403 };
}

/** The caller's address as the platform's proxy reports it (first hop), or null. Only ever passed on to be hashed. */
export function clientIp(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || headers.get("cf-connecting-ip")?.trim() || headers.get("x-real-ip")?.trim() || "";
  return ip && ip.length <= 64 ? ip : null;
}
