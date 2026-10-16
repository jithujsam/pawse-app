import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";
import { setProviders } from "@/lib/adapters";
import type { WhatsAppProvider } from "@/lib/adapters/whatsapp/types";
import { drainQueue } from "@/lib/jobs";
import { createJob, launchTestJob } from "@/lib/services/jobs";
import { importCsv } from "@/lib/services/candidates";
import { freshDb, makeOrg, mockProviders, SAMPLE_JOB } from "./helpers";

/** Stands in for the live Cloud API: records anything that would reach a real phone. */
class LiveSpy implements WhatsAppProvider {
  readonly name = "cloud" as const;
  readonly sent: string[] = [];
  async sendTemplate(i: { to: string }) {
    this.sent.push(i.to);
    return { providerMessageId: "live" };
  }
  async sendText(i: { to: string }) {
    this.sent.push(i.to);
    return { providerMessageId: "live" };
  }
  parseWebhook() {
    return [];
  }
  async fetchMedia(): Promise<{ data: Buffer; mimeType: string }> {
    throw new Error("no");
  }
}

let db: DB;
let live: LiveSpy;
beforeEach(async () => {
  db = await freshDb();
  mockProviders();
  live = new LiveSpy();
  setProviders({ whatsapp: live });
});

describe("demo workspace safety", () => {
  it("never sends through the live provider for a demo org", async () => {
    const { org, user } = await makeOrg(db, "Demo");
    const job = await createJob(org.id, user.id, { ...SAMPLE_JOB, testMode: true });
    await importCsv(org.id, user.id, job.id, "name,phone,consent\nA,9876543210,yes\n");
    await db.update(organizations).set({ isDemo: true }).where(eq(organizations.id, org.id));
    await launchTestJob(org.id, user.id, job.id);
    await drainQueue();
    expect(live.sent).toEqual([]);
  });

  it("refuses CSV uploads into the shared demo workspace", async () => {
    const { org, user } = await makeOrg(db, "Demo");
    await db.update(organizations).set({ isDemo: true }).where(eq(organizations.id, org.id));
    const job = await createJob(org.id, user.id, SAMPLE_JOB);
    await expect(importCsv(org.id, user.id, job.id, "name,phone,consent\nA,9876543210,yes\n")).rejects.toThrow(/demo/);
  });

  it("does use the live provider for a real org", async () => {
    const { org, user } = await makeOrg(db, "Real");
    const job = await createJob(org.id, user.id, { ...SAMPLE_JOB, testMode: true });
    await importCsv(org.id, user.id, job.id, "name,phone,consent\nA,9876543210,yes\n");
    await launchTestJob(org.id, user.id, job.id);
    await drainQueue();
    expect(live.sent).toEqual(["+919876543210"]);
  });
});
