import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { asSystem } from "@/lib/db/tenant";
import { createSession } from "@/lib/auth/magic-link";
import { setSessionCookie } from "@/lib/auth/session";
import { ensureDemoWorkspace, findDemoOrg } from "@/lib/services/demo";
import { track } from "@/lib/domain/audit";
import { clientIp, hit } from "@/lib/ratelimit";

/** One-click sign-in to the shared demo workspace (simulated messages and payments only). */
export async function POST(req: NextRequest) {
  if (!config().DEMO_MODE) return new NextResponse("Demo is disabled", { status: 404 });
  if (!hit(`demo:${await clientIp()}`, 20, 60 * 60_000)) return new NextResponse("Too many requests", { status: 429 });

  let demo = await findDemoOrg();
  if (!demo) {
    // Seeding calls the scorer for each candidate; only do it inline when that is free.
    if (config().SCORER_PROVIDER !== "mock") {
      return new NextResponse("Demo data not seeded. Run `npm run db:seed`.", { status: 503 });
    }
    demo = await ensureDemoWorkspace();
  }
  const { userId, orgId } = demo;
  const session = await asSystem(async (tx) => {
    await track(tx, "demo_login", { orgId, userId });
    return createSession(tx, userId);
  });
  await setSessionCookie(session.sessionToken);
  return NextResponse.redirect(new URL("/app", req.url), 303);
}
