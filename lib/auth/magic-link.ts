import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { asSystem } from "../db/tenant";
import { loginTokens, memberships, sessions, users } from "../db/schema";
import { randomToken, sha256 } from "../crypto";
import { config } from "../config";
import { mailer } from "../adapters/mailer";
import { BRAND } from "../brand";
import { track } from "../domain/audit";

const TOKEN_TTL_MIN = 15;
export const SESSION_TTL_DAYS = 14;
const MAX_LINKS_PER_WINDOW = 5;

export const emailSchema = z.string().trim().toLowerCase().email().max(200);

export type RequestLinkResult = { ok: true; devLink?: string } | { ok: false; error: string };

export async function requestMagicLink(rawEmail: string): Promise<RequestLinkResult> {
  if (mailer().name === "console" && config().NODE_ENV === "production") {
    return { ok: false, error: "Email sign-in isn't switched on yet. Use the demo workspace, or contact us for access." };
  }
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const email = parsed.data;
  const token = randomToken();

  const limited = await asSystem(async (tx) => {
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(loginTokens)
      .where(and(eq(loginTokens.email, email), gt(loginTokens.createdAt, sql`now() - interval '15 minutes'`)));
    if (n >= MAX_LINKS_PER_WINDOW) return true;
    await tx.insert(loginTokens).values({
      email,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MIN * 60_000),
    });
    return false;
  });
  if (limited) return { ok: false, error: "Too many sign-in links requested. Try again in 15 minutes." };

  const link = `${config().APP_URL}/auth/verify?token=${encodeURIComponent(token)}`;
  await mailer().send({
    to: email,
    subject: `Your ${BRAND.name} sign-in link`,
    text: `Sign in to ${BRAND.name}: ${link}\n\nThis link works once and expires in ${TOKEN_TTL_MIN} minutes. If you didn't ask for it, ignore this email.`,
  });
  // Without a real mail provider, show the link on screen, but only outside production:
  // in production that would let anyone sign in as any email address.
  const showLink = mailer().name === "console" && config().NODE_ENV !== "production";
  return { ok: true, devLink: showLink ? link : undefined };
}

/** Consume a magic-link token and create a session. Returns the raw session token for the cookie. */
export async function verifyMagicLink(token: string): Promise<{ sessionToken: string; hasOrg: boolean } | null> {
  if (!token || token.length > 200) return null;
  return asSystem(async (tx) => {
    const [row] = await tx
      .update(loginTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(loginTokens.tokenHash, sha256(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, new Date())))
      .returning();
    if (!row) return null;

    let [user] = await tx.select().from(users).where(eq(users.email, row.email));
    if (!user) {
      [user] = await tx.insert(users).values({ email: row.email }).returning();
      await track(tx, "signup", { userId: user.id });
    }
    return createSession(tx, user.id);
  });
}

export async function createSession(
  tx: Parameters<Parameters<typeof asSystem>[0]>[0],
  userId: string,
): Promise<{ sessionToken: string; hasOrg: boolean }> {
  const [m] = await tx.select().from(memberships).where(eq(memberships.userId, userId)).limit(1);
  const sessionToken = randomToken();
  await tx.insert(sessions).values({
    userId,
    tokenHash: sha256(sessionToken),
    orgId: m?.orgId ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000),
  });
  return { sessionToken, hasOrg: Boolean(m) };
}
