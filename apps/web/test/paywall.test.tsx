import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ServerAccess } from "@detox/schema";

/** The paywall as rendered: what it says for each way access ends, and what it never offers or claims. */
vi.mock("../src/supabase", () => ({
  configured: true,
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } },
  useSession: () => ({ session: { user: { id: "u1", email: "a@example.com" } }, ready: true, recovering: false }),
  AUTH_REDIRECT: "app://x",
}));

const { Paywall, daysLeft, membershipRowValue, trialEndingSoon } = await import("../src/screens/Paywall");
const { actions } = await import("../src/store");
const { blank } = await import("../src/persist");
const { CONTACT_EMAIL } = await import("../src/brand");

const access = (state: ServerAccess["state"], plan: "basic" | "ai" | null = null): ServerAccess => ({
  state, app: false, ai: false, email_verified: true, tracks: 0, valid_until: null, trial_ends_at: "2026-11-01T00:00:00+00:00",
  plan, plan_status: plan ? "expired" : null, period_end: null, server_time: "2026-11-03T00:00:00+00:00",
});
const render = (reason: "expired" | "refunded" | "revoked" | "none" | "unconfirmed", a: ServerAccess) =>
  renderToStaticMarkup(<Paywall gate={{ kind: "locked", reason, access: a }} />).replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

describe("the paywall", () => {
  it("after the trial: says seven days of full access, an annual membership, and both plans with their prices", () => {
    const html = render("expired", access("expired"));
    expect(html).toContain("pawse — Your commitment to change.");
    expect(html).toMatch(/seven days of full access/);
    expect(html).toContain("Continued access needs an annual membership.");
    expect(html).toContain("$1 a year");
    expect(html).toContain("$3 a year");
    expect(html).toMatch(/Basic.*without AI.*No new AI requests/s);
    expect(html).toMatch(/AI.*Everything in Basic, plus every AI feature/s);
    expect(html).toContain("Neither is a lifetime purchase.");
  });

  it("in every Voice: no guilt, no fear, nothing about the pet suffering", () => {
    for (const tone of ["gentle", "honest", "brutal"] as const) {
      actions.applyRemote({ ...blank(), settings: { ...blank().settings, tone } });
      for (const a of [access("expired"), access("expired", "ai")]) {
        const html = render("expired", a).toLowerCase();
        expect(html).not.toMatch(/miss(es)? you|suffer|hungry|sad|lonely|abandon|disappoint|guilt|shame|don't let|before it's too late|wait(ing)? for you|lose your/);
      }
    }
  });

  it("after a plan year: says the membership ended, in the person's Voice", () => {
    actions.applyRemote({ ...blank(), settings: { ...blank().settings, tone: "honest" } });
    expect(render("expired", access("expired", "basic"))).toContain("Your annual membership has ended.");
  });

  it("refunded, withdrawn and unconfirmed each say why", () => {
    expect(render("refunded", access("refunded", "ai"))).toContain("refunded, so access has ended");
    expect(render("revoked", access("revoked", "ai"))).toContain(CONTACT_EMAIL);
    expect(render("unconfirmed", { ...access("ai", "ai"), app: true })).toContain("more than 7 days");
  });

  it("with no payment provider: no buy button, and it says nothing was charged", () => {
    const html = render("expired", access("expired"));
    expect(html).not.toMatch(/Choose (Basic|AI)/);
    expect(html).toContain("can't be bought in this version of the app yet. Nothing has been charged.");
    expect(html).not.toMatch(/success|thank you for your purchase|you're subscribed/i);
  });

  it("the payment-information placeholder is gone", () => {
    expect(render("expired", access("expired"))).not.toContain("Payment information");
  });

  it("offers \"View my history\" when there is history to view, and only then", () => {
    const html = renderToStaticMarkup(<Paywall gate={{ kind: "locked", reason: "expired", access: access("expired") }} onViewHistory={() => undefined} />);
    expect(html).toContain("View my history");
    expect(render("expired", access("expired"))).not.toContain("View my history");
  });

  it("keeps export, sign-out and account deletion, and says the data is kept", () => {
    const html = render("expired", access("expired"));
    expect(html).toContain("Export my data");
    expect(html).toContain("Delete account");
    expect(html).toContain("Sign out");
    expect(html).toContain("Nothing is deleted or changed while access is paused.");
  });

  it("counts trial days left in whole days", () => {
    const now = Date.UTC(2026, 10, 3, 12);
    expect(daysLeft(now + 6.5 * 86_400_000, now)).toBe(6);
    expect(daysLeft(now + 1.5 * 86_400_000, now)).toBe(1);
    expect(daysLeft(now + 3_600_000, now)).toBe(0);
    expect(daysLeft(now - 1, now)).toBe(0);
  });

  it("Me's Membership row says the plan, or how long the trial has left", () => {
    const now = Date.UTC(2026, 10, 3, 12);
    const open = (state: ServerAccess["state"], until: number) => ({ kind: "open" as const, access: { ...access(state, state === "basic" || state === "ai" ? state : null), app: true, ai: state !== "basic" }, stale: false, until });
    expect(membershipRowValue(open("trial", now + 5.5 * 86_400_000), now)).toBe("Trial · 5 days left");
    expect(membershipRowValue(open("trial", now + 1.5 * 86_400_000), now)).toBe("Trial · 1 day left");
    expect(membershipRowValue(open("trial", now + 3_600_000), now)).toBe("Trial · ends today");
    expect(membershipRowValue(open("basic", now + 300 * 86_400_000), now)).toBe("Basic");
    expect(membershipRowValue(open("ai", now + 300 * 86_400_000), now)).toBe("AI");
    expect(membershipRowValue({ kind: "off" }, now)).toBeNull();
  });

  it("Home mentions the trial's end only in its last two days", () => {
    const now = Date.UTC(2026, 10, 3, 12);
    const trial = (until: number) => ({ kind: "open" as const, access: { ...access("trial"), app: true, ai: true }, stale: false, until });
    expect(trialEndingSoon(trial(now + 5.5 * 86_400_000), now)).toBeNull();
    expect(trialEndingSoon(trial(now + 2.5 * 86_400_000), now)).toBeTruthy();
    expect(trialEndingSoon(trial(now + 3_600_000), now)).toBeTruthy();
    expect(trialEndingSoon({ kind: "open", access: { ...access("ai", "ai"), app: true, ai: true }, stale: false, until: now + 86_400_000 }, now)).toBeNull();
  });
});
