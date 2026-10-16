import { sql } from "drizzle-orm";
import { asSystem } from "../db/tenant";
import { providers } from "../adapters";
import { captureError } from "../log";

/** No tenant data here: this backs the public status page. */
export async function getSystemStatus() {
  const p = providers();
  const modes = { whatsapp: p.whatsapp.name, payments: p.payments.name, scoring: p.scorer.name, speechToText: p.stt.name };
  try {
    const res = await asSystem((tx) =>
      tx.execute(sql`select
        count(*) filter (where status = 'queued' and run_at <= now())::int as ready,
        count(*) filter (where status = 'queued' and run_at <= now() - interval '10 minutes')::int as delayed,
        count(*) filter (where status = 'failed' and created_at > now() - interval '1 day')::int as failed_24h
        from job_queue`),
    );
    const row = (res as unknown as { rows: { ready: number; delayed: number; failed_24h: number }[] }).rows[0];
    return { database: true, queue: { ready: row.ready, delayed: row.delayed, failed24h: row.failed_24h }, modes };
  } catch (err) {
    captureError(err, { where: "status" });
    return { database: false, queue: null, modes };
  }
}
