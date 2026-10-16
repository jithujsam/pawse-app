import { and, asc, eq } from "drizzle-orm";
import { withOrg } from "../db/tenant";
import type { Tx } from "../db/client";
import { answers, candidates, consents, conversations, messages, questions, scores } from "../db/schema";
import { parseCandidatesCsv, type CsvResult } from "../domain/csv";
import { blindIndex, decrypt, encrypt } from "../crypto";
import { audit, track } from "../domain/audit";
import { remainingCapacity } from "../domain/billing";
import { PRIVACY_NOTICE_VERSION } from "../domain/copy";
import { config } from "../config";
import { Forbidden, NotFound, loadJob, queueInvites } from "./jobs";
import { rankKey, type Breakdown } from "../domain/scoring";

export type CsvPreview = CsvResult & { capacity: number; overCapacity: number };

async function validate(tx: Tx, orgId: string, jobId: string, text: string): Promise<CsvPreview> {
  const job = await loadJob(tx, orgId, jobId);
  if (job.status === "closed") throw new Forbidden("This job is closed.");
  const existing = new Set(
    (await tx.select({ h: candidates.phoneHash }).from(candidates).where(eq(candidates.jobId, jobId))).map((r) => r.h),
  );
  const result = parseCandidatesCsv(text);
  const fresh = [];
  for (const row of result.valid) {
    if (existing.has(blindIndex(row.phone))) {
      result.errors.push({ line: row.line, field: "phone", message: "Already uploaded for this job" });
    } else fresh.push(row);
  }
  result.valid = fresh;
  result.errors.sort((a, b) => a.line - b.line);
  const c = config();
  const capacity = remainingCapacity(job.testMode, existing.size, c.MAX_CANDIDATES_PER_JOB, c.TEST_MODE_MAX_CANDIDATES);
  return { ...result, capacity, overCapacity: Math.max(0, result.valid.length - capacity) };
}

/** Validate without saving, for the preview screen. */
export async function previewCsv(orgId: string, jobId: string, text: string) {
  return withOrg(orgId, (tx) => validate(tx, orgId, jobId, text));
}

/** Re-validate on the server and save the valid rows with a consent record each. */
export async function importCsv(orgId: string, userId: string, jobId: string, text: string) {
  return withOrg(orgId, async (tx) => {
    const preview = await validate(tx, orgId, jobId, text);
    if (preview.overCapacity > 0) {
      throw new Forbidden(`This job can take ${preview.capacity} more candidate(s); the file has ${preview.valid.length} valid rows.`);
    }
    if (!preview.valid.length) throw new Forbidden("No valid rows to import.");
    const inserted = await tx
      .insert(candidates)
      .values(
        preview.valid.map((r) => ({
          orgId,
          jobId,
          name: r.name,
          phoneEnc: encrypt(r.phone),
          phoneHash: blindIndex(r.phone),
          language: r.language,
        })),
      )
      .returning({ id: candidates.id });
    await tx.insert(consents).values(
      inserted.map((c) => ({ orgId, candidateId: c.id, source: "csv_upload" as const, noticeVersion: PRIVACY_NOTICE_VERSION, grantedBy: userId })),
    );
    await audit(tx, orgId, "candidates.imported", "job", jobId, { userId }, { count: inserted.length, rejected: preview.errors.length });
    await track(tx, "csv_uploaded", { orgId, userId }, { rows: inserted.length });
    const job = await loadJob(tx, orgId, jobId);
    if (job.status === "active") await queueInvites(tx, orgId, jobId);
    return { imported: inserted.length, rejected: preview.errors.length, duplicates: preview.duplicates.length };
  });
}

export type ShortlistRow = Awaited<ReturnType<typeof getShortlist>>[number];

export async function getShortlist(orgId: string, jobId: string) {
  return withOrg(orgId, async (tx) => {
    await loadJob(tx, orgId, jobId);
    const rows = await tx
      .select({
        id: candidates.id,
        name: candidates.name,
        phoneEnc: candidates.phoneEnc,
        language: candidates.language,
        status: candidates.status,
        tag: candidates.tag,
        score: {
          total: scores.total,
          editedTotal: scores.editedTotal,
          knockoutPassed: scores.knockoutPassed,
          reason: scores.reason,
          summary: scores.summary,
        },
      })
      .from(candidates)
      .leftJoin(scores, eq(scores.candidateId, candidates.id))
      .where(and(eq(candidates.jobId, jobId), eq(candidates.orgId, orgId)));
    return rows
      .map(({ phoneEnc, score, ...r }) => ({
        ...r,
        phone: r.status === "deleted" ? "" : decrypt(phoneEnc),
        score: score && score.total !== null ? (score as { total: number; editedTotal: number | null; knockoutPassed: boolean; reason: string; summary: string }) : null,
      }))
      .sort((a, b) => rankKey(b) - rankKey(a) || a.name.localeCompare(b.name));
  });
}

export async function getCandidateDetail(orgId: string, jobId: string, candidateId: string) {
  return withOrg(orgId, async (tx) => {
    const job = await loadJob(tx, orgId, jobId);
    const [c] = await tx
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, candidateId), eq(candidates.jobId, jobId), eq(candidates.orgId, orgId)));
    if (!c) throw new NotFound();
    const [conv] = await tx.select().from(conversations).where(eq(conversations.candidateId, c.id));
    const msgs = conv
      ? await tx.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(asc(messages.createdAt))
      : [];
    const ans = conv
      ? await tx
          .select({ q: questions.text, pos: questions.position, text: answers.text, source: answers.source })
          .from(answers)
          .innerJoin(questions, eq(questions.id, answers.questionId))
          .where(eq(answers.conversationId, conv.id))
          .orderBy(asc(questions.position))
      : [];
    const [score] = await tx.select().from(scores).where(eq(scores.candidateId, c.id));
    const [consent] = await tx.select().from(consents).where(eq(consents.candidateId, c.id));
    return {
      job,
      candidate: { ...c, phone: c.status === "deleted" ? "" : decrypt(c.phoneEnc) },
      conversation: conv ?? null,
      messages: msgs,
      answers: ans,
      score: score ? { ...score, breakdown: score.breakdown as Breakdown } : null,
      consent: consent ?? null,
    };
  });
}

export async function tagCandidate(orgId: string, userId: string, candidateId: string, tag: "shortlist" | "reject" | null) {
  await withOrg(orgId, async (tx) => {
    const [c] = await tx
      .update(candidates)
      .set({ tag })
      .where(and(eq(candidates.id, candidateId), eq(candidates.orgId, orgId)))
      .returning({ id: candidates.id });
    if (!c) throw new NotFound();
    await audit(tx, orgId, "candidate.tagged", "candidate", candidateId, { userId }, { tag });
  });
}

export async function editScore(orgId: string, userId: string, candidateId: string, total: number, note: string) {
  if (!Number.isInteger(total) || total < 0 || total > 100) throw new Forbidden("Score must be 0-100.");
  await withOrg(orgId, async (tx) => {
    const [s] = await tx
      .update(scores)
      .set({ editedTotal: total, editedBy: userId, editNote: note.slice(0, 500), updatedAt: new Date() })
      .where(and(eq(scores.candidateId, candidateId), eq(scores.orgId, orgId)))
      .returning({ id: scores.id, total: scores.total });
    if (!s) throw new NotFound();
    await audit(tx, orgId, "score.edited", "candidate", candidateId, { userId }, { from: s.total, to: total });
  });
}
