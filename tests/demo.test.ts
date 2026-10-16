import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { candidates, jobs, memberships, organizations, users } from "@/lib/db/schema";
import { DEMO_EMAIL, DemoSeedingInProgress, ensureDemoWorkspace, findDemoOrg } from "@/lib/services/demo";
import { freshDb, mockProviders } from "./helpers";

let db: DB;
beforeEach(async () => {
  db = await freshDb();
  mockProviders();
});

async function halfSeededDemoOrg(ageMinutes: number) {
  const [user] = await db.insert(users).values({ email: DEMO_EMAIL }).onConflictDoNothing().returning();
  const u = user ?? (await db.select().from(users).where(eq(users.email, DEMO_EMAIL)))[0];
  const [org] = await db
    .insert(organizations)
    .values({ name: "half", kind: "agency", isDemo: true, createdAt: sql`now() - make_interval(mins => ${ageMinutes})` })
    .returning();
  await db.insert(memberships).values({ orgId: org.id, userId: u.id });
  return org;
}

describe("demo workspace seeding", () => {
  it("seeds once, and is found afterwards", async () => {
    expect(await findDemoOrg()).toBeNull();
    const a = await ensureDemoWorkspace();
    const b = await ensureDemoWorkspace();
    expect(b.orgId).toBe(a.orgId);
    expect(await db.select().from(jobs)).toHaveLength(2);
    expect((await db.select().from(candidates)).length).toBe(12);
  });

  it("does not treat an interrupted seed as ready, and replaces it once it's stale", async () => {
    const stale = await halfSeededDemoOrg(10);
    expect(await findDemoOrg()).toBeNull();
    const fresh = await ensureDemoWorkspace();
    expect(fresh.orgId).not.toBe(stale.id);
    expect(await db.select().from(organizations).where(eq(organizations.id, stale.id))).toHaveLength(0);
  });

  it("tells a second visitor to wait while seeding is in progress", async () => {
    await halfSeededDemoOrg(0);
    await expect(ensureDemoWorkspace()).rejects.toBeInstanceOf(DemoSeedingInProgress);
  });
});
