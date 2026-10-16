import { and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { asSystem, withOrg } from "../db/tenant";
import type { Tx } from "../db/client";
import {
  answers,
  candidates,
  consents,
  conversations,
  costEvents,
  deletionRequests,
  jobs,
  messages,
  organizations,
  questions,
} from "../db/schema";
import { providers } from "../adapters";
import { config } from "../config";
import { decrypt, blindIndex } from "../crypto";
import { audit } from "../domain/audit";
import { inviteParams, inviteText, reminderText, type Lang } from "../domain/copy";
import { step, type EngineState } from "../domain/conversation";
import { Defer, enqueue } from "../jobs/queue";
import { normalizeIndianMobile } from "../domain/phone";
import { log } from "../log";
import { Forbidden, NotFound } from "./jobs";

const ACTIVE_STATES = ["awaiting_optin", "asking", "no_response", "declined", "needs_human"] as const;

async function underRateLimit(): Promise<boolean> {
  const [{ n }] = await asSystem((tx) =>
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.direction, "out"), gt(messages.sentAt, sql`now() - interval '1 minute'`))),
  );
  return n < config().WHATSAPP_SENDS_PER_MINUTE;
}

export function privacyUrl() {
  return `${config().APP_URL}/legal/candidate-privacy`;
}

/** Job handler: first contact with the approved template. Exactly one per candidate. */
export async function sendInvite(payload: { orgId: string; candidateId: string }) {
  const { orgId, candidateId } = payload;
  const prepared = await withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({ c: candidates, job: jobs, org: organizations })
      .from(candidates)
      .innerJoin(jobs, eq(jobs.id, candidates.jobId))
      .innerJoin(organizations, eq(organizations.id, candidates.orgId))
      .where(and(eq(candidates.id, candidateId), eq(candidates.orgId, orgId)));
    if (!row || row.c.status !== "pending" || row.job.status !== "active") return null;
    const [consent] = await tx
      .select()
      .from(consents)
      .where(and(eq(consents.candidateId, candidateId), isNull(consents.withdrawnAt)));
    if (!consent) return null; // never message without a consent record

    let [conv] = await tx.select().from(conversations).where(eq(conversations.candidateId, candidateId));
    if (!conv) {
      [conv] = await tx.insert(conversations).values({ orgId, jobId: row.job.id, candidateId }).returning();
    }
    const params = { org: row.org.name, role: row.job.title, days: config().RETENTION_DAYS, privacyUrl: privacyUrl() };
    await tx
      .insert(messages)
      .values({
        orgId,
        conversationId: conv.id,
        direction: "out",
        kind: "template",
        body: inviteText(row.c.language, params),
        sentBy: "system",
        dedupeKey: `invite:${candidateId}`,
        status: "queued",
      })
      .onConflictDoNothing();
    const [msg] = await tx.select().from(messages).where(eq(messages.dedupeKey, `invite:${candidateId}`));
    if (msg.status === "sent") return null;
    return { msg, conv, phone: decrypt(row.c.phoneEnc), lang: row.c.language, params, jobId: row.job.id };
  });
  if (!prepared) return;
  if (!(await underRateLimit())) throw new Defer(20);

  const res = await providers().whatsapp.sendTemplate({
    to: prepared.phone,
    template: "invite",
    language: prepared.lang,
    params: inviteParams(prepared.params),
  });
  await withOrg(orgId, async (tx) => {
    const now = new Date();
    await tx
      .update(messages)
      .set({ status: "sent", providerMessageId: res.providerMessageId, sentAt: now })
      .where(eq(messages.id, prepared.msg.id));
    await tx.update(candidates).set({ status: "invited" }).where(and(eq(candidates.id, candidateId), eq(candidates.status, "pending")));
    await tx.update(conversations).set({ lastOutboundAt: now }).where(eq(conversations.id, prepared.conv.id));
    await tx.insert(costEvents).values({ orgId, jobId: prepared.jobId, kind: "wa_template", quantity: 1 });
  });
}

/** Job handler: send queued free-form messages in order, skipping ones already sent. */
export async function sendMessages(payload: { orgId: string; messageIds: string[] }) {
  const { orgId, messageIds } = payload;
  for (const id of messageIds) {
    const prepared = await withOrg(orgId, async (tx) => {
      const [row] = await tx
        .select({ m: messages, c: candidates, conv: conversations })
        .from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversationId))
        .innerJoin(candidates, eq(candidates.id, conversations.candidateId))
        .where(and(eq(messages.id, id), eq(messages.orgId, orgId)));
      if (!row || row.m.status !== "queued" || row.c.status === "deleted") return null;
      return row;
    });
    if (!prepared) continue;
    const res = await providers().whatsapp.sendText({ to: decrypt(prepared.c.phoneEnc), body: prepared.m.body ?? "" });
    await withOrg(orgId, async (tx) => {
      const now = new Date();
      await tx.update(messages).set({ status: "sent", providerMessageId: res.providerMessageId, sentAt: now }).where(eq(messages.id, id));
      await tx.update(conversations).set({ lastOutboundAt: now }).where(eq(conversations.id, prepared.conv.id));
      await tx.insert(costEvents).values({ orgId, jobId: prepared.conv.jobId, kind: "wa_session", quantity: 1 });
    });
  }
}

/** Webhook entry point: verify, then queue each message for processing (deduped by provider id). */
export async function receiveWhatsAppWebhook(rawBody: string, headers: Headers): Promise<boolean> {
  const inbound = providers().whatsapp.parseWebhook(rawBody, headers);
  if (!inbound) return false;
  if (!inbound.length) return true;
  await asSystem(async (tx) => {
    for (const m of inbound) {
      await enqueue(
        tx,
        "process_inbound",
        { ...m, timestamp: m.timestamp.toISOString() },
        { dedupeKey: `in:${providers().whatsapp.name}:${m.providerMessageId}` },
      );
    }
  });
  return true;
}

type InboundPayload = {
  providerMessageId: string;
  from: string;
  kind: "text" | "voice" | "other";
  text?: string;
  mediaId?: string;
  mimeType?: string;
};

/** Find the conversation an inbound phone number belongs to. Cross-tenant by necessity. */
async function routeInbound(phone: string) {
  return asSystem(async (tx) => {
    const rows = await tx
      .select({ orgId: candidates.orgId, candidateId: candidates.id, convId: conversations.id, state: conversations.state })
      .from(candidates)
      .innerJoin(conversations, eq(conversations.candidateId, candidates.id))
      .where(eq(candidates.phoneHash, blindIndex(phone)))
      .orderBy(desc(conversations.lastOutboundAt));
    // Prefer a conversation that is still in progress; else the most recent one.
    return rows.find((r) => (ACTIVE_STATES as readonly string[]).includes(r.state)) ?? rows[0] ?? null;
  });
}

/** Job handler: run one inbound message through the conversation engine. */
export async function processInbound(payload: InboundPayload) {
  const phone = normalizeIndianMobile(payload.from);
  if (!phone) return;
  const route = await routeInbound(phone);
  if (!route) {
    log.info("inbound.unknown_sender");
    return;
  }
  const { orgId } = route;

  // Transcribe before opening the transaction: network calls must not hold locks.
  let text = payload.text ?? "";
  let sttSeconds = 0;
  if (payload.kind === "voice" && payload.mediaId) {
    const media = await providers().whatsapp.fetchMedia(payload.mediaId);
    const [cand] = await withOrg(orgId, (tx) =>
      tx.select({ language: candidates.language }).from(candidates).where(eq(candidates.id, route.candidateId)),
    );
    const t = await providers().stt.transcribe({ data: media.data, mimeType: media.mimeType, language: cand.language });
    text = t.text;
    sttSeconds = t.seconds;
  }

  await withOrg(orgId, async (tx) => {
    const inserted = await tx
      .insert(messages)
      .values({
        orgId,
        conversationId: route.convId,
        direction: "in",
        kind: payload.kind === "voice" ? "voice" : "text",
        body: payload.kind === "voice" ? null : text.slice(0, 4000),
        transcript: payload.kind === "voice" ? text.slice(0, 4000) : null,
        sentBy: "candidate",
        dedupeKey: `in:${payload.providerMessageId}`,
        providerMessageId: payload.providerMessageId,
        status: "received",
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) return; // already processed
    const inbound = inserted[0];

    // Lock the conversation so two messages from one candidate are handled in order.
    const [conv] = await tx.select().from(conversations).where(eq(conversations.id, route.convId)).for("update");
    const [cand] = await tx.select().from(candidates).where(eq(candidates.id, conv.candidateId));
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, conv.jobId));
    const qs = await tx.select().from(questions).where(eq(questions.jobId, job.id)).orderBy(asc(questions.position));
    if (sttSeconds) await tx.insert(costEvents).values({ orgId, jobId: job.id, kind: "stt_seconds", quantity: sttSeconds });

    const before: EngineState = {
      state: conv.state,
      currentQuestion: conv.currentQuestion,
      repromptCount: conv.repromptCount,
      lateReplyNotified: conv.lateReplyNotified,
    };
    const { next, effects } = step(before, {
      kind: payload.kind,
      text,
      questions: qs.map((q) => q.text),
      jobOpen: job.status === "active",
      language: cand.language as Lang,
    });

    await tx
      .update(conversations)
      .set({ ...next, lastInboundAt: new Date() })
      .where(eq(conversations.id, conv.id));

    const replyIds: string[] = [];
    let i = 0;
    for (const e of effects) {
      switch (e.type) {
        case "reply": {
          const [m] = await tx
            .insert(messages)
            .values({
              orgId,
              conversationId: conv.id,
              direction: "out",
              kind: "text",
              body: e.body,
              sentBy: "system",
              dedupeKey: `reply:${inbound.id}:${i++}`,
              status: "queued",
            })
            .returning({ id: messages.id });
          replyIds.push(m.id);
          break;
        }
        case "record_answer":
          await tx
            .insert(answers)
            .values({ orgId, conversationId: conv.id, questionId: qs[e.questionIndex].id, messageId: inbound.id, text: e.text, source: e.source })
            .onConflictDoNothing();
          if (cand.status === "invited") await setStatus(tx, cand.id, "in_progress");
          break;
        case "completed":
          await setStatus(tx, cand.id, "completed");
          await enqueue(tx, "score_candidate", { orgId, candidateId: cand.id }, { dedupeKey: `score:${cand.id}`, maxAttempts: 3 });
          break;
        case "declined":
          await setStatus(tx, cand.id, "declined");
          break;
        case "opted_out":
          await setStatus(tx, cand.id, "opted_out");
          await tx.update(consents).set({ withdrawnAt: new Date() }).where(and(eq(consents.candidateId, cand.id), isNull(consents.withdrawnAt)));
          await audit(tx, orgId, "consent.withdrawn", "candidate", cand.id, { kind: "candidate" });
          break;
        case "needs_human":
          await setStatus(tx, cand.id, "needs_human");
          await audit(tx, orgId, "conversation.needs_human", "candidate", cand.id, { kind: "system" }, { reason: e.reason });
          break;
        case "deletion_requested": {
          const [dr] = await tx
            .insert(deletionRequests)
            .values({ orgId, candidateId: cand.id, requestedVia: "whatsapp" })
            .returning({ id: deletionRequests.id });
          await audit(tx, orgId, "deletion.requested", "candidate", cand.id, { kind: "candidate" });
          // Runs after the confirmation reply is sent, since sending needs the phone number.
          await enqueue(tx, "delete_candidate", { orgId, candidateId: cand.id, requestId: dr.id }, {
            dedupeKey: `delete:${cand.id}`,
            runAt: new Date(Date.now() + 30_000),
          });
          break;
        }
      }
    }
    if (replyIds.length) {
      await enqueue(tx, "send_message", { orgId, messageIds: replyIds }, { dedupeKey: `send:${inbound.id}` });
    }
  });
}

async function setStatus(tx: Tx, candidateId: string, status: typeof candidates.$inferSelect.status) {
  await tx.update(candidates).set({ status }).where(eq(candidates.id, candidateId));
}

/** Recruiter writes to a candidate from the transcript screen. */
export async function sendDirectMessage(orgId: string, userId: string, candidateId: string, body: string) {
  const text = body.trim();
  if (!text || text.length > 2000) throw new Forbidden("Message must be 1-2000 characters.");
  await withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({ c: candidates, conv: conversations })
      .from(candidates)
      .innerJoin(conversations, eq(conversations.candidateId, candidates.id))
      .where(and(eq(candidates.id, candidateId), eq(candidates.orgId, orgId)));
    if (!row) throw new NotFound();
    if (row.c.status === "opted_out" || row.c.status === "deleted") throw new Forbidden("This candidate opted out. You can't message them.");
    // WhatsApp only allows free-form messages within 24 hours of the candidate's last message.
    const lastIn = row.conv.lastInboundAt?.getTime() ?? 0;
    if (providers().whatsapp.name === "cloud" && Date.now() - lastIn > 24 * 3600_000) {
      throw new Forbidden("WhatsApp only allows direct messages within 24 hours of the candidate's last reply.");
    }
    const [m] = await tx
      .insert(messages)
      .values({ orgId, conversationId: row.conv.id, direction: "out", kind: "text", body: text, sentBy: "recruiter", status: "queued" })
      .returning({ id: messages.id });
    await audit(tx, orgId, "message.direct", "candidate", candidateId, { userId });
    await enqueue(tx, "send_message", { orgId, messageIds: [m.id] }, { dedupeKey: `send:direct:${m.id}` });
  });
}

/** Sweep helper: send one template reminder to candidates who went quiet. */
export async function sendReminder(orgId: string, conversationId: string) {
  const prepared = await withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({ c: candidates, conv: conversations, job: jobs, org: organizations })
      .from(conversations)
      .innerJoin(candidates, eq(candidates.id, conversations.candidateId))
      .innerJoin(jobs, eq(jobs.id, conversations.jobId))
      .innerJoin(organizations, eq(organizations.id, conversations.orgId))
      .where(eq(conversations.id, conversationId));
    if (!row || row.job.status !== "active" || !["awaiting_optin", "asking"].includes(row.conv.state)) return null;
    if (["opted_out", "deleted"].includes(row.c.status)) return null;
    await tx
      .insert(messages)
      .values({
        orgId,
        conversationId,
        direction: "out",
        kind: "template",
        body: reminderText(row.c.language, { org: row.org.name, role: row.job.title }),
        sentBy: "system",
        dedupeKey: `reminder:${conversationId}`,
        status: "queued",
      })
      .onConflictDoNothing();
    const [msg] = await tx.select().from(messages).where(eq(messages.dedupeKey, `reminder:${conversationId}`));
    if (msg.status === "sent") return null; // at most one reminder per conversation
    await tx.update(conversations).set({ reminderSentAt: new Date() }).where(eq(conversations.id, conversationId));
    return { msg, row };
  });
  if (!prepared) return;
  const res = await providers().whatsapp.sendTemplate({
    to: decrypt(prepared.row.c.phoneEnc),
    template: "reminder",
    language: prepared.row.c.language,
    params: [prepared.row.org.name, prepared.row.job.title],
  });
  await withOrg(orgId, async (tx) => {
    await tx.update(messages).set({ status: "sent", providerMessageId: res.providerMessageId, sentAt: new Date() }).where(eq(messages.id, prepared.msg.id));
    await tx.insert(costEvents).values({ orgId, jobId: prepared.row.job.id, kind: "wa_template", quantity: 1 });
  });
}

