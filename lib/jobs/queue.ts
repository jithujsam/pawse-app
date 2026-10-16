import { sql } from "drizzle-orm";
import { queue } from "../db/schema";
import type { Conn } from "../db/client";
import { asSystem } from "../db/tenant";
import { captureError, log } from "../log";

export type JobKind =
  | "send_invite"
  | "send_message"
  | "process_inbound"
  | "score_candidate"
  | "close_summary"
  | "delete_candidate"
  | "sweep";

export type QueueRow = typeof queue.$inferSelect;
export type Handler = (payload: Record<string, unknown>, row: QueueRow) => Promise<void>;

/** Thrown by a handler to put the job back without counting an attempt (e.g. rate limit). */
export class Defer extends Error {
  constructor(public readonly seconds: number) {
    super("defer");
  }
}

/**
 * Enqueue inside the caller's transaction, so the job exists only if the data
 * change commits. A repeated dedupeKey is ignored (idempotent enqueue).
 */
export async function enqueue(
  conn: Conn,
  kind: JobKind,
  payload: Record<string, unknown>,
  opts: { dedupeKey?: string; runAt?: Date; maxAttempts?: number } = {},
) {
  await conn
    .insert(queue)
    .values({
      kind,
      payload,
      dedupeKey: opts.dedupeKey ?? null,
      runAt: opts.runAt ?? new Date(),
      maxAttempts: opts.maxAttempts ?? 5,
    })
    .onConflictDoNothing({ target: queue.dedupeKey });
}

export function backoffSeconds(attempt: number): number {
  return Math.min(10 * 2 ** (attempt - 1), 3600); // 10s, 20s, 40s ... capped at 1h
}

async function claim(limit: number): Promise<QueueRow[]> {
  return asSystem(async (tx) => {
    // Recover jobs whose worker died mid-run.
    await tx.execute(
      sql`update job_queue set status = 'queued', locked_at = null
          where status = 'running' and locked_at < now() - interval '5 minutes'`,
    );
    const res = await tx.execute(sql`
      update job_queue set status = 'running', locked_at = now(), attempts = attempts + 1
      where id in (
        select id from job_queue
        where status = 'queued' and run_at <= now()
        order by run_at, id
        limit ${limit}
        for update skip locked
      )
      returning *`);
    const rows = (res as unknown as { rows: Record<string, unknown>[] }).rows;
    return rows.map((r) => ({
      id: Number(r.id),
      kind: r.kind as string,
      payload: r.payload as Record<string, unknown>,
      dedupeKey: r.dedupe_key as string | null,
      status: r.status as QueueRow["status"],
      attempts: Number(r.attempts),
      maxAttempts: Number(r.max_attempts),
      runAt: new Date(r.run_at as string),
      lockedAt: r.locked_at ? new Date(r.locked_at as string) : null,
      lastError: r.last_error as string | null,
      createdAt: new Date(r.created_at as string),
    }));
  });
}

async function finish(row: QueueRow, err?: unknown) {
  await asSystem(async (tx) => {
    if (!err) {
      await tx.execute(sql`update job_queue set status = 'done', locked_at = null, last_error = null where id = ${row.id}`);
      return;
    }
    if (err instanceof Defer) {
      await tx.execute(sql`update job_queue set status = 'queued', locked_at = null, attempts = attempts - 1,
        run_at = now() + make_interval(secs => ${err.seconds}) where id = ${row.id}`);
      return;
    }
    const message = err instanceof Error ? err.message.slice(0, 500) : "unknown error";
    if (row.attempts >= row.maxAttempts) {
      await tx.execute(sql`update job_queue set status = 'failed', locked_at = null, last_error = ${message} where id = ${row.id}`);
      captureError(err, { job: row.kind, jobId: row.id, final: true });
    } else {
      const delay = backoffSeconds(row.attempts);
      await tx.execute(sql`update job_queue set status = 'queued', locked_at = null, last_error = ${message},
        run_at = now() + make_interval(secs => ${delay}) where id = ${row.id}`);
      log.warn("job.retry", { job: row.kind, jobId: row.id, attempt: row.attempts, delay });
    }
  });
}

/** Process ready jobs until the queue is empty or the budget runs out. Returns jobs processed. */
export async function drain(
  handlers: Record<string, Handler>,
  opts: { maxJobs?: number; deadlineMs?: number } = {},
): Promise<number> {
  const maxJobs = opts.maxJobs ?? 200;
  const deadline = Date.now() + (opts.deadlineMs ?? 20_000);
  let processed = 0;
  while (processed < maxJobs && Date.now() < deadline) {
    const batch = await claim(Math.min(10, maxJobs - processed));
    if (!batch.length) break;
    for (const row of batch) {
      const handler = handlers[row.kind];
      try {
        if (!handler) throw new Error(`No handler for ${row.kind}`);
        await handler(row.payload as Record<string, unknown>, row);
        await finish(row);
      } catch (err) {
        await finish(row, err);
      }
      processed++;
    }
  }
  return processed;
}
