import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { candidates, consents, jobs, messages, queue, scores, deletionRequests } from "@/lib/db/schema";
import { candidateSays, freshDb, makeOrg, mockProviders, payMock, SAMPLE_JOB } from "./helpers";
import { createJob, closeJob, getJobDetail, launchTestJob } from "@/lib/services/jobs";
import { importCsv, previewCsv, getShortlist, getCandidateDetail } from "@/lib/services/candidates";
import { createCheckout } from "@/lib/services/payments";
import { drainQueue } from "@/lib/jobs";
import type { MockWhatsApp } from "@/lib/adapters/whatsapp/mock";
import { purgeExpiredJobs } from "@/lib/services/compliance";
import { sweep } from "@/lib/services/sweep";

const CSV = [
  "name,phone,consent,language",
  "Asha Rao,9876543210,yes,en",
  "Ravi Kumar,+91 90000 00001,yes,hi",
  "No Consent,9000000002,no,en",
  "Bad Phone,12345,yes,en",
  "Asha Again,98765 43210,yes,en",
].join("\n");

let db: DB;
let wa: MockWhatsApp;

beforeEach(async () => {
  db = await freshDb();
  wa = mockProviders().whatsapp;
});

describe("full screening flow on mock providers", () => {
  it("job → CSV → pay → invite → conversation → score → shortlist → close", async () => {
    const { org, user } = await makeOrg(db);
    const job = await createJob(org.id, user.id, SAMPLE_JOB);

    // CSV preview shows errors and saves nothing.
    const preview = await previewCsv(org.id, job.id, CSV);
    expect(preview.valid.map((r) => r.name)).toEqual(["Asha Rao", "Ravi Kumar"]);
    expect(preview.errors.map((e) => e.line)).toEqual([4, 5]);
    expect(preview.duplicates).toEqual([{ line: 6, firstLine: 2 }]);
    expect(await db.select().from(candidates)).toHaveLength(0);

    const imported = await importCsv(org.id, user.id, job.id, CSV);
    expect(imported.imported).toBe(2);
    expect(await db.select().from(consents)).toHaveLength(2);

    // Nothing is sent before payment.
    await drainQueue();
    expect(wa.sent).toHaveLength(0);
    const detail = await getJobDetail(org.id, job.id);
    expect(detail.gate).toMatchObject({ ok: false, needsPayment: true });

    const payment = await createCheckout(org.id, user.id, job.id);
    expect(payment.amountInr).toBe(1499);
    expect(await payMock(payment.providerRef)).toBe("processed");
    // A replayed webhook is ignored.
    expect(await payMock(payment.providerRef)).toBe("duplicate");

    await drainQueue();
    expect(wa.sent).toHaveLength(2);
    expect(wa.sent.map((s) => s.to).sort()).toEqual(["+919000000001", "+919876543210"]);
    const [jobRow] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(jobRow.status).toBe("active");

    // Asha completes the screening, with one voice note and one repeat request.
    const asha = "+919876543210";
    await candidateSays(asha, "YES");
    await drainQueue();
    await candidateSays(asha, "Yes, I have a valid two-wheeler licence");
    await candidateSays(asha, "repeat");
    await candidateSays(asha, "4 years delivery experience with a courier company", { voice: true });
    await candidateSays(asha, "Kothrud, Baner, Hinjewadi, I know Pune areas well");
    await candidateSays(asha, "18000");
    await candidateSays(asha, "Immediately");
    await drainQueue();

    // Ravi says STOP: no further messages, consent withdrawn.
    await candidateSays("+919000000001", "STOP");
    await drainQueue();
    const sentBefore = wa.sent.length;
    await candidateSays("+919000000001", "hello?");
    await drainQueue();
    expect(wa.sent.length).toBe(sentBefore);

    const shortlist = await getShortlist(org.id, job.id);
    expect(shortlist[0]).toMatchObject({ name: "Asha Rao", status: "completed" });
    expect(shortlist[0].score?.knockoutPassed).toBe(true);
    expect(shortlist[1]).toMatchObject({ name: "Ravi Kumar", status: "opted_out" });
    const [raviConsent] = await db
      .select()
      .from(consents)
      .innerJoin(candidates, eq(candidates.id, consents.candidateId))
      .where(eq(candidates.name, "Ravi Kumar"));
    expect(raviConsent.consents.withdrawnAt).not.toBeNull();

    const ashaDetail = await getCandidateDetail(org.id, job.id, shortlist[0].id);
    expect(ashaDetail.answers).toHaveLength(5);
    expect(ashaDetail.answers[1]).toMatchObject({ source: "voice" });
    expect(ashaDetail.score?.reason).toBeTruthy();
    // The question was repeated, not skipped.
    expect(ashaDetail.messages.filter((m) => m.body === `Question 2/5: ${SAMPLE_JOB.questions[1]}`)).toHaveLength(2);

    // Every outbound message was sent exactly once.
    const out = await db.select().from(messages).where(eq(messages.direction, "out"));
    expect(out.every((m) => m.status === "sent")).toBe(true);
    expect(out.length).toBe(wa.sent.length);

    // Closing starts retention; after it ends, PII is purged.
    await closeJob(org.id, user.id, job.id);
    await drainQueue();
    const [closed] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(closed.retentionUntil).not.toBeNull();
    await purgeExpiredJobs(new Date(closed.retentionUntil!.getTime() + 1000));
    const purged = await db.select().from(candidates);
    expect(purged.every((c) => c.status === "deleted" && c.name === "Deleted candidate")).toBe(true);
    const [s] = await db.select().from(scores);
    expect(s.reason).toBe("[deleted]");
  });

  it("free test mode launches without payment and caps at 5 candidates", async () => {
    const { org, user } = await makeOrg(db);
    const job = await createJob(org.id, user.id, { ...SAMPLE_JOB, testMode: true });
    const six = ["name,phone,consent", ...Array.from({ length: 6 }, (_, i) => `C${i},900000001${i},yes`)].join("\n");
    await expect(importCsv(org.id, user.id, job.id, six)).rejects.toThrow(/5 more/);
    await importCsv(org.id, user.id, job.id, six.split("\n").slice(0, 4).join("\n"));
    await launchTestJob(org.id, user.id, job.id);
    await drainQueue();
    expect(wa.sent).toHaveLength(3);
  });

  it("never double-sends an invite, even if the job is queued twice", async () => {
    const { org, user } = await makeOrg(db);
    const job = await createJob(org.id, user.id, { ...SAMPLE_JOB, testMode: true });
    await importCsv(org.id, user.id, job.id, "name,phone,consent\nA,9876543210,yes\n");
    await launchTestJob(org.id, user.id, job.id);
    await launchTestJob(org.id, user.id, job.id);
    await drainQueue();
    // Force a re-run of the finished invite job.
    await db.update(queue).set({ status: "queued" }).where(eq(queue.kind, "send_invite"));
    await drainQueue();
    expect(wa.sent).toHaveLength(1);
  });

  it("processes a duplicate inbound webhook only once", async () => {
    const { org, user } = await makeOrg(db);
    const job = await createJob(org.id, user.id, { ...SAMPLE_JOB, testMode: true });
    await importCsv(org.id, user.id, job.id, "name,phone,consent\nA,9876543210,yes\n");
    await launchTestJob(org.id, user.id, job.id);
    await drainQueue();
    await candidateSays("+919876543210", "yes", { id: "wamid.dup" });
    await candidateSays("+919876543210", "yes", { id: "wamid.dup" });
    await drainQueue();
    const inbound = await db.select().from(messages).where(eq(messages.direction, "in"));
    expect(inbound).toHaveLength(1);
    expect(wa.sent).toHaveLength(3); // invite + intro + question 1
  });

  it("deletes a candidate's data when they reply DELETE", async () => {
    const { org, user } = await makeOrg(db);
    const job = await createJob(org.id, user.id, { ...SAMPLE_JOB, testMode: true });
    await importCsv(org.id, user.id, job.id, "name,phone,consent\nAsha,9876543210,yes\n");
    await launchTestJob(org.id, user.id, job.id);
    await drainQueue();
    await candidateSays("+919876543210", "yes");
    await candidateSays("+919876543210", "delete my data");
    await drainQueue();
    expect(wa.sent.at(-1)?.body).toContain("deleted");
    // The purge runs shortly after the confirmation is sent.
    await db.update(queue).set({ runAt: new Date() }).where(eq(queue.kind, "delete_candidate"));
    await drainQueue();
    const [c] = await db.select().from(candidates);
    expect(c).toMatchObject({ status: "deleted", name: "Deleted candidate" });
    const msgs = await db.select().from(messages);
    expect(msgs.every((m) => m.body === null)).toBe(true);
    const [dr] = await db.select().from(deletionRequests);
    expect(dr.status).toBe("completed");
  });

  it("sends one reminder after 24h of silence and times out after 72h", async () => {
    const { org, user } = await makeOrg(db);
    const job = await createJob(org.id, user.id, { ...SAMPLE_JOB, testMode: true });
    await importCsv(org.id, user.id, job.id, "name,phone,consent\nAsha,9876543210,yes\n");
    await launchTestJob(org.id, user.id, job.id);
    await drainQueue();
    const h = 3600_000;
    expect((await sweep(new Date(Date.now() + 25 * h))).reminded).toBe(1);
    expect((await sweep(new Date(Date.now() + 26 * h))).reminded).toBe(0);
    expect(wa.sent).toHaveLength(2);
    expect((await sweep(new Date(Date.now() + 80 * h))).timedOut).toBe(1);
    const [c] = await db.select().from(candidates);
    expect(c.status).toBe("no_response");
  });

  it("rejects a forged payment webhook", async () => {
    const { handlePaymentWebhook } = await import("@/lib/services/payments");
    const body = JSON.stringify({ id: "evt_x", event: "paid", ref: "anything" });
    expect(await handlePaymentWebhook(body, new Headers({ "x-mock-signature": "bad" }))).toBe("invalid");
  });
});
