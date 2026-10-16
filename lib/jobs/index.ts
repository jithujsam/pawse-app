import { drain, type Handler } from "./queue";
import { processInbound, sendInvite, sendMessages } from "../services/outreach";
import { scoreCandidate } from "../services/scoring";
import { deleteCandidateJob } from "../services/compliance";
import { closeSummary, sweep } from "../services/sweep";
import { captureError } from "../log";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const handlers: Record<string, Handler> = {
  send_invite: (p) => sendInvite(p as any),
  send_message: (p) => sendMessages(p as any),
  process_inbound: (p) => processInbound(p as any),
  score_candidate: (p) => scoreCandidate(p as any),
  delete_candidate: (p) => deleteCandidateJob(p as any),
  close_summary: (p) => closeSummary(p as any),
  sweep: async () => {
    await sweep();
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export function drainQueue(opts?: { maxJobs?: number; deadlineMs?: number }) {
  return drain(handlers, opts);
}

let draining: Promise<unknown> | null = null;

/**
 * Process queued work soon after a request that enqueued it.
 * On Vercel this runs inside `after()`; the cron route is the safety net.
 */
export function kickQueue() {
  if (draining) return draining;
  draining = drainQueue({ deadlineMs: 15_000 })
    .catch((err) => captureError(err, { where: "kickQueue" }))
    .finally(() => {
      draining = null;
    });
  return draining;
}
