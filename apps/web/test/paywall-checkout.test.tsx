import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ServerAccess } from "@detox/schema";

/** The paywall and Me → Membership in a build with checkout on (VITE_CHECKOUT=dodo): which plans can be bought where. */
vi.stubEnv("VITE_CHECKOUT", "dodo");
const gate = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("../src/supabase", () => ({
  configured: true,
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } },
  useSession: () => ({ session: { user: { id: "u1", email: "a@example.com" } }, ready: true, recovering: false }),
  AUTH_REDIRECT: "app://x",
}));
vi.mock("../src/access", async (orig) => ({ ...(await orig<object>()), useGate: () => gate.value, getGate: () => gate.value }));

const { Paywall, MembershipCard } = await import("../src/screens/Paywall");
const { checkout } = await import("../src/billing");

const access = (state: ServerAccess["state"]): ServerAccess => ({
  state, app: state === "trial" || state === "basic" || state === "ai", ai: state === "ai" || state === "trial", email_verified: true,
  tracks: 50, valid_until: "2027-11-04T00:00:00Z", trial_ends_at: null, plan: state === "basic" || state === "ai" ? state : null,
  plan_status: null, period_end: null, server_time: "2026-11-04T00:00:00Z",
});
const clean = (html: string) => html.replace(/&#x27;/g, "'");
const card = (state: ServerAccess["state"]) => {
  gate.value = { kind: "open", access: access(state), stale: false, until: Date.parse("2027-11-04T00:00:00Z") };
  return clean(renderToStaticMarkup(<MembershipCard />));
};

describe("with checkout on", () => {
  it("is the Dodo provider", () => expect(checkout).toMatchObject({ id: "dodo", available: true }));

  it("the paywall offers both plans, says who takes the payment, and claims nothing", () => {
    const html = clean(renderToStaticMarkup(<Paywall gate={{ kind: "locked", reason: "expired", access: access("expired") }} />));
    expect(html).toContain("Choose Basic");
    expect(html).toContain("Choose AI");
    expect(html).toContain("Dodo Payments");
    expect(html).not.toContain("can't be bought in this version");
    expect(html).not.toMatch(/payment (received|confirmed)|you're subscribed|thank you for your purchase/i);
  });

  it("Me → Membership during the trial: both plans can be bought early", () => {
    const html = card("trial");
    expect(html).toContain("Choose Basic");
    expect(html).toContain("Choose AI");
  });

  it("Me → Membership on Basic: only the upgrade to AI, never Basic again", () => {
    const html = card("basic");
    expect(html).toContain("Upgrade to AI");
    expect(html).not.toContain("Choose Basic");
  });

  it("Me → Membership on AI: nothing more to buy", () => {
    const html = card("ai");
    expect(html).not.toMatch(/Choose (Basic|AI)|Upgrade to AI/);
  });
});
