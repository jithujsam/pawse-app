import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { asSystem } from "../db/tenant";
import { memberships, organizations, sessions, users } from "../db/schema";
import { sha256 } from "../crypto";
import { config } from "../config";
import { SESSION_TTL_DAYS } from "./magic-link";

export const SESSION_COOKIE = "pr_session";

export type CurrentUser = {
  sessionId: string;
  userId: string;
  email: string;
  orgId: string | null;
  orgName: string | null;
  isDemo: boolean;
};

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86_400,
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return asSystem(async (tx) => {
    const [row] = await tx
      .select({
        sessionId: sessions.id,
        userId: users.id,
        email: users.email,
        orgId: sessions.orgId,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())));
    if (!row) return null;
    if (!row.orgId) return { ...row, orgName: null, isDemo: false };
    // Re-check membership on every request so removed members lose access immediately.
    const [m] = await tx
      .select({ name: organizations.name, isDemo: organizations.isDemo })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(and(eq(memberships.orgId, row.orgId), eq(memberships.userId, row.userId)));
    if (!m) return { ...row, orgId: null, orgName: null, isDemo: false };
    return { ...row, orgName: m.name, isDemo: m.isDemo };
  });
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** For pages and actions that touch tenant data. */
export async function requireOrg(): Promise<CurrentUser & { orgId: string; orgName: string }> {
  const u = await requireUser();
  if (!u.orgId || !u.orgName) redirect("/app/onboarding");
  return u as CurrentUser & { orgId: string; orgName: string };
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await asSystem((tx) => tx.delete(sessions).where(eq(sessions.tokenHash, sha256(token))));
  jar.delete(SESSION_COOKIE);
}
