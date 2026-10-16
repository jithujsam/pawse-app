import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { candidates, jobs, TENANT_TABLES } from "@/lib/db/schema";
import { withOrg } from "@/lib/db/tenant";
import { freshDb, makeOrg, mockProviders, SAMPLE_JOB } from "./helpers";
import { createJob, getJobDetail, closeJob } from "@/lib/services/jobs";
import { importCsv, getShortlist, tagCandidate, editScore, getCandidateDetail } from "@/lib/services/candidates";

let db: DB;
beforeEach(async () => {
  db = await freshDb();
  mockProviders();
});

describe("tenant isolation", () => {
  it("every tenant table has row-level security enabled", async () => {
    const res = await db.execute(
      sql`select relname from pg_class where relrowsecurity and relnamespace = 'public'::regnamespace`,
    );
    const rls = new Set((res as unknown as { rows: { relname: string }[] }).rows.map((r) => r.relname));
    for (const t of TENANT_TABLES) expect(rls.has(t), `${t} has RLS`).toBe(true);
  });

  it("org B cannot read or change org A's job through the services", async () => {
    const a = await makeOrg(db, "A");
    const b = await makeOrg(db, "B");
    const job = await createJob(a.org.id, a.user.id, SAMPLE_JOB);
    await importCsv(a.org.id, a.user.id, job.id, "name,phone,consent\nAsha,9876543210,yes\n");
    const [cand] = await db.select().from(candidates);

    await expect(getJobDetail(b.org.id, job.id)).rejects.toThrow();
    await expect(getShortlist(b.org.id, job.id)).rejects.toThrow();
    await expect(getCandidateDetail(b.org.id, job.id, cand.id)).rejects.toThrow();
    await expect(importCsv(b.org.id, b.user.id, job.id, "name,phone,consent\nX,9000000001,yes\n")).rejects.toThrow();
    await expect(tagCandidate(b.org.id, b.user.id, cand.id, "reject")).rejects.toThrow();
    await expect(editScore(b.org.id, b.user.id, cand.id, 1, "")).rejects.toThrow();
    await expect(closeJob(b.org.id, b.user.id, job.id)).rejects.toThrow();
    const [c] = await db.select().from(candidates);
    expect(c.tag).toBeNull();
  });

  it("RLS blocks a query that forgets its org filter", async () => {
    const a = await makeOrg(db, "A");
    const b = await makeOrg(db, "B");
    await createJob(a.org.id, a.user.id, SAMPLE_JOB);
    const leaked = await withOrg(b.org.id, (tx) => tx.select().from(jobs)); // no where clause on purpose
    expect(leaked).toEqual([]);
    const updated = await withOrg(b.org.id, (tx) => tx.update(jobs).set({ title: "pwned" }).returning());
    expect(updated).toEqual([]);
  });

  it("tenant code can queue work and record analytics, but cannot read system tables", async () => {
    const a = await makeOrg(db, "A");
    // createJob enqueues nothing but records analytics; importCsv records analytics too.
    await createJob(a.org.id, a.user.id, SAMPLE_JOB);
    const res = await db.execute(sql`select relname from pg_class where relrowsecurity and relnamespace = 'public'::regnamespace`);
    const rls = new Set((res as unknown as { rows: { relname: string }[] }).rows.map((r) => r.relname));
    for (const t of ["users", "sessions", "login_tokens", "webhook_events", "job_queue", "analytics_events"]) expect(rls.has(t), t).toBe(true);
    expect(await withOrg(a.org.id, (tx) => tx.execute(sql`select * from users`)).then((r) => (r as unknown as { rows: unknown[] }).rows)).toEqual([]);
    expect(await withOrg(a.org.id, (tx) => tx.execute(sql`select * from sessions`)).then((r) => (r as unknown as { rows: unknown[] }).rows)).toEqual([]);
    expect(await withOrg(a.org.id, (tx) => tx.execute(sql`select * from job_queue where payload->>'orgId' <> ${a.org.id}`)).then((r) => (r as unknown as { rows: unknown[] }).rows)).toEqual([]);
  });

  it("tenant code can only queue work for its own org", async () => {
    const a = await makeOrg(db, "A");
    const b = await makeOrg(db, "B");
    const { enqueue } = await import("@/lib/jobs/queue");
    await withOrg(a.org.id, (tx) => enqueue(tx, "sweep", { orgId: a.org.id }));
    await expect(withOrg(a.org.id, (tx) => enqueue(tx, "sweep", { orgId: b.org.id }))).rejects.toThrow();
    // Org B can't see org A's queued work.
    const seen = await withOrg(b.org.id, (tx) => tx.execute(sql`select * from job_queue`));
    expect((seen as unknown as { rows: unknown[] }).rows).toEqual([]);
  });

  it("rejects a non-uuid org id", async () => {
    await expect(withOrg("x' or 1=1 --", async () => 1)).rejects.toThrow();
  });
});
