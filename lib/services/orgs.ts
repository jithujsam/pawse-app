import { eq } from "drizzle-orm";
import { z } from "zod";
import { asSystem } from "../db/tenant";
import { memberships, organizations, sessions } from "../db/schema";
import { audit, track } from "../domain/audit";

export const orgInput = z.object({
  name: z.string().trim().min(2, "Organisation name is too short").max(120),
  kind: z.enum(["agency", "company"]),
});

/**
 * Creating an org happens before any tenant context exists, so it runs as
 * system. It only ever links the calling user to the new org.
 */
export async function createOrganization(userId: string, sessionId: string, input: z.infer<typeof orgInput>, isDemo = false) {
  return asSystem(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name: input.name, kind: input.kind, isDemo }).returning();
    await tx.insert(memberships).values({ orgId: org.id, userId, role: "owner" });
    await tx.update(sessions).set({ orgId: org.id }).where(eq(sessions.id, sessionId));
    await audit(tx, org.id, "org.created", "organization", org.id, { userId });
    await track(tx, "org_created", { orgId: org.id, userId });
    return org;
  });
}
