"use server";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireOrg } from "@/lib/auth/session";
import { withOrg } from "@/lib/db/tenant";
import { candidates, conversations, messages } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { providers, whatsappFor } from "@/lib/adapters";
import { receiveWhatsAppWebhook } from "@/lib/services/outreach";
import { drainQueue } from "@/lib/jobs";
import { hit } from "@/lib/ratelimit";

async function guard() {
  const user = await requireOrg();
  // Only for demo workspaces, or when the whole app runs on the mock WhatsApp provider.
  if (!user.isDemo && providers().whatsapp.name !== "mock") throw new Error("Simulator is not available");
  return user;
}

export type SimMessage = { id: string; direction: "in" | "out"; body: string; voice: boolean; at: string };

export async function simulatorThread(jobId: string, candidateId: string): Promise<{ status: string; messages: SimMessage[] }> {
  const user = await guard();
  z.string().uuid().parse(jobId);
  z.string().uuid().parse(candidateId);
  return withOrg(user.orgId, async (tx) => {
    const [c] = await tx
      .select({ status: candidates.status, convId: conversations.id })
      .from(candidates)
      .leftJoin(conversations, eq(conversations.candidateId, candidates.id))
      .where(and(eq(candidates.id, candidateId), eq(candidates.jobId, jobId), eq(candidates.orgId, user.orgId)));
    if (!c) throw new Error("Not found");
    const msgs = c.convId
      ? await tx.select().from(messages).where(eq(messages.conversationId, c.convId)).orderBy(asc(messages.createdAt))
      : [];
    return {
      status: c.status,
      messages: msgs
        .filter((m) => m.direction === "in" || m.status === "sent")
        .map((m) => ({
          id: m.id,
          direction: m.direction,
          body: m.body ?? m.transcript ?? "",
          voice: m.kind === "voice",
          at: m.createdAt.toISOString(),
        })),
    };
  });
}

export async function simulatorSend(jobId: string, candidateId: string, text: string, voice: boolean) {
  const user = await guard();
  if (!hit(`sim:${user.orgId}`, 120, 60_000)) throw new Error("Slow down");
  const body = z.string().trim().min(1).max(1000).parse(text);
  const phone = await withOrg(user.orgId, async (tx) => {
    const [c] = await tx
      .select({ phoneEnc: candidates.phoneEnc })
      .from(candidates)
      .where(and(eq(candidates.id, z.string().uuid().parse(candidateId)), eq(candidates.jobId, jobId), eq(candidates.orgId, user.orgId)));
    if (!c) throw new Error("Not found");
    return decrypt(c.phoneEnc);
  });
  const id = `sim.${randomUUID()}`;
  const payload = JSON.stringify(voice ? { id, from: phone, voiceTranscript: body } : { id, from: phone, text: body });
  await receiveWhatsAppWebhook(payload, new Headers(), whatsappFor(true));
  // Process right away so the reply shows up in the simulator.
  await drainQueue({ deadlineMs: 10_000 });
}
