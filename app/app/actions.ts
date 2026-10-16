"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg, requireUser } from "@/lib/auth/session";
import { createOrganization, orgInput } from "@/lib/services/orgs";
import {
  closeJob,
  createJob,
  Forbidden,
  jobInput,
  launchTestJob,
  markReviewed,
  NotFound,
  setShareLink,
  updateJob,
} from "@/lib/services/jobs";
import { editScore, importCsv, previewCsv, tagCandidate, type CsvPreview } from "@/lib/services/candidates";
import { createCheckout } from "@/lib/services/payments";
import { sendDirectMessage } from "@/lib/services/outreach";
import { deleteCandidateByRecruiter } from "@/lib/services/compliance";
import { providers } from "@/lib/adapters";
import { kickQueue } from "@/lib/jobs";
import { captureError } from "@/lib/log";
import { hit } from "@/lib/ratelimit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const uuid = z.string().uuid();

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? "Invalid input" };
  if (err instanceof Forbidden) return { ok: false, error: err.message };
  if (err instanceof NotFound) return { ok: false, error: "Not found." };
  captureError(err, { where: "action" });
  return { ok: false, error: "Something went wrong. Please try again." };
}

function processSoon() {
  after(() => kickQueue());
}

export async function createOrgAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const input = orgInput.parse({ name: form.get("name"), kind: form.get("kind") });
    await createOrganization(user.userId, user.sessionId, input);
  } catch (err) {
    return fail(err);
  }
  redirect("/app/jobs/new?first=1");
}

export async function saveJobAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireOrg();
  let jobId: string;
  try {
    const input = jobInput.parse(JSON.parse(String(form.get("payload") ?? "{}")));
    const existing = form.get("jobId");
    if (existing) {
      jobId = uuid.parse(existing);
      await updateJob(user.orgId, user.userId, jobId, input);
    } else {
      jobId = (await createJob(user.orgId, user.userId, input)).id;
    }
  } catch (err) {
    return fail(err);
  }
  redirect(`/app/jobs/${jobId}${form.get("jobId") ? "" : "/upload"}`);
}

export async function suggestQuestionsAction(job: { title: string; description: string; location: string }) {
  const user = await requireOrg();
  if (!hit(`suggest:${user.orgId}`, 20, 60 * 60_000)) return { ok: false as const, error: "Too many suggestions this hour." };
  const parsed = z
    .object({ title: z.string().trim().min(2).max(120), description: z.string().trim().max(5000), location: z.string().trim().max(120) })
    .safeParse(job);
  if (!parsed.success) return { ok: false as const, error: "Add a job title first." };
  try {
    return { ok: true as const, questions: await providers().scorer.suggestQuestions(parsed.data) };
  } catch (err) {
    captureError(err, { where: "suggestQuestions" });
    return { ok: false as const, error: "Couldn't suggest questions right now. Write your own or try again." };
  }
}

export async function previewCsvAction(jobId: string, text: string): Promise<{ ok: true; preview: CsvPreview } | { ok: false; error: string }> {
  const user = await requireOrg();
  try {
    return { ok: true, preview: await previewCsv(user.orgId, uuid.parse(jobId), text) };
  } catch (err) {
    return fail(err);
  }
}

export async function importCsvAction(jobId: string, text: string): Promise<ActionResult> {
  const user = await requireOrg();
  try {
    await importCsv(user.orgId, user.userId, uuid.parse(jobId), text);
  } catch (err) {
    return fail(err);
  }
  processSoon();
  redirect(`/app/jobs/${jobId}?uploaded=1`);
}

export async function checkoutAction(form: FormData) {
  const user = await requireOrg();
  const jobId = uuid.parse(form.get("jobId"));
  let url: string;
  try {
    url = (await createCheckout(user.orgId, user.userId, jobId)).linkUrl;
  } catch (err) {
    const f = fail(err);
    redirect(`/app/jobs/${jobId}?error=${encodeURIComponent(f.error)}`);
  }
  redirect(url);
}

export async function launchTestAction(form: FormData) {
  const user = await requireOrg();
  const jobId = uuid.parse(form.get("jobId"));
  try {
    await launchTestJob(user.orgId, user.userId, jobId);
  } catch (err) {
    redirect(`/app/jobs/${jobId}?error=${encodeURIComponent(fail(err).error)}`);
  }
  processSoon();
  redirect(`/app/jobs/${jobId}?launched=1`);
}

export async function closeJobAction(form: FormData) {
  const user = await requireOrg();
  const jobId = uuid.parse(form.get("jobId"));
  await closeJob(user.orgId, user.userId, jobId);
  processSoon();
  redirect(`/app/jobs/${jobId}?closed=1`);
}

export async function markReviewedAction(form: FormData) {
  const user = await requireOrg();
  const jobId = uuid.parse(form.get("jobId"));
  await markReviewed(user.orgId, user.userId, jobId);
  revalidatePath(`/app/jobs/${jobId}/shortlist`);
}

export async function shareLinkAction(form: FormData) {
  const user = await requireOrg();
  const jobId = uuid.parse(form.get("jobId"));
  try {
    await setShareLink(user.orgId, user.userId, jobId, form.get("enable") === "1");
  } catch (err) {
    redirect(`/app/jobs/${jobId}/shortlist?error=${encodeURIComponent(fail(err).error)}`);
  }
  revalidatePath(`/app/jobs/${jobId}/shortlist`);
}

export async function tagAction(form: FormData) {
  const user = await requireOrg();
  const candidateId = uuid.parse(form.get("candidateId"));
  const raw = String(form.get("tag") ?? "");
  const tag = raw === "shortlist" || raw === "reject" ? raw : null;
  await tagCandidate(user.orgId, user.userId, candidateId, tag);
  revalidatePath(String(form.get("back") ?? "/app").startsWith("/app/") ? String(form.get("back")) : "/app");
}

export async function editScoreAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireOrg();
  try {
    const candidateId = uuid.parse(form.get("candidateId"));
    const total = z.coerce.number().int().min(0, "Score must be 0-100").max(100, "Score must be 0-100").parse(form.get("total"));
    await editScore(user.orgId, user.userId, candidateId, total, String(form.get("note") ?? ""));
    revalidatePath(`/app/jobs/${form.get("jobId")}/candidates/${candidateId}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function directMessageAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireOrg();
  try {
    const candidateId = uuid.parse(form.get("candidateId"));
    await sendDirectMessage(user.orgId, user.userId, candidateId, String(form.get("body") ?? ""));
    processSoon();
    revalidatePath(`/app/jobs/${form.get("jobId")}/candidates/${candidateId}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteCandidateAction(form: FormData) {
  const user = await requireOrg();
  const jobId = uuid.parse(form.get("jobId"));
  const candidateId = uuid.parse(form.get("candidateId"));
  if (form.get("confirm") !== "DELETE") redirect(`/app/jobs/${jobId}/candidates/${candidateId}?error=${encodeURIComponent("Type DELETE to confirm.")}`);
  await deleteCandidateByRecruiter(user.orgId, user.userId, candidateId);
  redirect(`/app/jobs/${jobId}/candidates/${candidateId}`);
}
