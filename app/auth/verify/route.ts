import { NextResponse, type NextRequest } from "next/server";
import { verifyMagicLink } from "@/lib/auth/magic-link";
import { setSessionCookie } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const result = await verifyMagicLink(token);
  if (!result) return NextResponse.redirect(new URL("/login?error=expired", req.url));
  await setSessionCookie(result.sessionToken);
  return NextResponse.redirect(new URL(result.hasOrg ? "/app" : "/app/onboarding", req.url));
}
