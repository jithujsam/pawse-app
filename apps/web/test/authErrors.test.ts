import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { accountBlocker, AUTH_FALLBACK, friendlyAuthError, newPasswordBlocker, passwordScore } from "../src/authErrors";

describe("account error messages", () => {
  it("maps known problems to advice", () => {
    expect(friendlyAuthError("Invalid login credentials")).toMatch(/don't match/);
    expect(friendlyAuthError("User already registered")).toMatch(/already an account/);
    expect(friendlyAuthError("email rate limit exceeded")).toMatch(/Too many emails/);
    expect(friendlyAuthError("Email not confirmed")).toMatch(/Confirm your email/);
    expect(friendlyAuthError(new Error("TypeError: Failed to fetch"))).toMatch(/Couldn't reach/);
    expect(friendlyAuthError("Password is known to be weak and easy to guess (pwned)")).toMatch(/data leaks/);
  });
  it("the sign-up hook's network limit gets its own advice, not 'wait a minute'", () => {
    // The exact text the hook sends (supabase/migrations/0014_membership.sql), so the app and the server can't drift apart.
    const sql = readFileSync(join(__dirname, "..", "..", "..", "supabase", "migrations", "0014_membership.sql"), "utf8");
    const sent = /'message', '(signup_rate_limited:[^']+)'/.exec(sql)?.[1];
    expect(sent).toBeTruthy();
    const shown = friendlyAuthError(new Error(sent));
    expect(shown).toMatch(/new accounts have been made on this network/);
    expect(shown).toMatch(/Try again in an hour/);
    expect(shown).toMatch(/sign in instead/);
    expect(shown).not.toMatch(/Wait a minute/);
    // Supabase's own rate limits keep their short advice.
    expect(friendlyAuthError("Request rate limit reached")).toMatch(/Wait a minute/);
  });
  it("handles the delete-needs-a-recent-sign-in refusal and email-link errors", () => {
    expect(friendlyAuthError("sign in again to delete your account")).toMatch(/sign in again/i);
    expect(friendlyAuthError("Email link is invalid or has expired")).toMatch(/expired/);
    expect(friendlyAuthError("access_denied")).toBe(AUTH_FALLBACK);
    expect(friendlyAuthError("footprint")).toBe(AUTH_FALLBACK);
  });
  it("never shows an unknown server message, token or stack", () => {
    for (const raw of ["duplicate key value violates unique constraint \"users_pkey\"", "JWT eyJhbGciOi.secret.token expired?", "at Object.<anonymous> (/srv/app.js:1:1)", undefined, null, 42, {}])
      expect(friendlyAuthError(raw)).not.toMatch(/duplicate key|eyJ|srv\/app|constraint/);
    expect(friendlyAuthError("something odd")).toBe(AUTH_FALLBACK);
    expect(friendlyAuthError(undefined)).toBe(AUTH_FALLBACK);
  });
});

describe("a waiting button says what to do", () => {
  it("explains each missing piece, in order", () => {
    expect(accountBlocker({ mode: "up", email: "", password: "" })).toMatch(/email/);
    expect(accountBlocker({ mode: "up", email: "a@b.co", password: "" })).toMatch(/Choose a password/);
    expect(accountBlocker({ mode: "up", email: "a@b.co", password: "short" })).toMatch(/at least 8/);
    expect(accountBlocker({ mode: "up", email: "a@b.co", password: "abcdefgh" })).toMatch(/stronger/);
    expect(accountBlocker({ mode: "up", email: "a@b.co", password: "Abcdefgh1!" })).toBeNull();
    expect(accountBlocker({ mode: "in", email: "a@b.co", password: "x" })).toBeNull();
    expect(accountBlocker({ mode: "in", email: "a@b.co", password: "" })).toMatch(/Enter your password/);
  });
  it("applies the same rule to a new password", () => {
    expect(newPasswordBlocker("")).toMatch(/Choose a password/);
    expect(newPasswordBlocker("correct horse battery")).toBeNull();
    expect(passwordScore("password1234")).toBe(0);
  });
});
