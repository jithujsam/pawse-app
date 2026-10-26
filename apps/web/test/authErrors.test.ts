import { describe, expect, it } from "vitest";
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
