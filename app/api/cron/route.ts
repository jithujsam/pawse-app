import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { safeEqual } from "@/lib/crypto";
import { asSystem } from "@/lib/db/tenant";
import { enqueue } from "@/lib/jobs/queue";
import { drainQueue } from "@/lib/jobs";

export const maxDuration = 60;

/**
 * Called by Vercel Cron (see vercel.json) with `Authorization: Bearer $CRON_SECRET`.
 * Queues one sweep per 10-minute window and drains the queue.
 */
export async function GET(req: NextRequest) {
  const secret = config().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new NextResponse("Unauthorized", { status: 401 });
  const window = Math.floor(Date.now() / 600_000);
  await asSystem((tx) => enqueue(tx, "sweep", {}, { dedupeKey: `sweep:${window}` }));
  const processed = await drainQueue({ deadlineMs: 50_000, maxJobs: 500 });
  return NextResponse.json({ ok: true, processed });
}
