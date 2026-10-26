import { t } from "./text";

/**
 * Turns whatever the account service says into a message a person can act on. Known cases get specific advice;
 * everything else gets one safe fallback, so a raw server message, code or token never reaches the screen.
 */
export const AUTH_FALLBACK = t("account.errors.fallback");

export function friendlyAuthError(raw: unknown): string {
  const msg = typeof raw === "string" ? raw : raw instanceof Error ? raw.message : "";
  if (/invalid login|invalid credentials/i.test(msg)) return t("account.errors.invalid_login");
  if (/already registered|already been registered/i.test(msg)) return t("account.errors.already");
  if (/email rate limit/i.test(msg)) return t("account.errors.email_rate");
  if (/rate limit|too many/i.test(msg)) return t("account.errors.rate");
  if (/email not confirmed/i.test(msg)) return t("account.errors.unconfirmed");
  if (/network|fetch|failed to|timeout|timed out/i.test(msg)) return t("account.errors.network");
  if (/weak|pwned|leaked|compromised/i.test(msg)) return t("account.errors.leaked");
  if (/same password|different from the old/i.test(msg)) return t("account.errors.same_password");
  if (/expired|invalid.*(token|link)|otp/i.test(msg)) return t("account.errors.expired");
  if (/password.*(short|least|characters)/i.test(msg)) return t("account.errors.short");
  return AUTH_FALLBACK;
}

/** 0..4, rewarding length and variety. Good enough to nudge, not to gatekeep. */
export function passwordScore(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  if (/^(.)\1+$/.test(p) || /password|123456|qwerty/i.test(p)) s = 0;
  return Math.min(4, s);
}

/** The smallest score a new password may have. */
export const MIN_PASSWORD_SCORE = 2;

/**
 * Why the account button is waiting, in words, or null when it can be pressed. Used under the button so a disabled
 * action always says what to do next.
 */
export function accountBlocker(o: { mode: "up" | "in"; email: string; password: string }): string | null {
  if (!/^\S+@\S+\.\S+$/.test(o.email.trim())) return t("account.blockers.email");
  if (!o.password) return o.mode === "up" ? t("account.blockers.choose_password") : t("account.blockers.enter_password");
  if (o.mode === "in") return null;
  if (o.password.length < 8) return t("account.blockers.too_short");
  if (passwordScore(o.password) < MIN_PASSWORD_SCORE) return t("account.blockers.too_weak");
  return null;
}

/** The same for the new-password page after a reset link. */
export function newPasswordBlocker(password: string): string | null {
  return accountBlocker({ mode: "up", email: "x@x.x", password });
}
