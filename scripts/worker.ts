// Optional long-running worker for hosts other than Vercel: drains the queue
// continuously and runs the sweep every 10 minutes.
import { asSystem } from "../lib/db/tenant";
import { enqueue } from "../lib/jobs/queue";
import { drainQueue } from "../lib/jobs";
import { captureError, log } from "../lib/log";

let stop = false;
process.on("SIGTERM", () => (stop = true));
process.on("SIGINT", () => (stop = true));

async function main() {
  log.info("worker.start");
  while (!stop) {
    try {
      const window = Math.floor(Date.now() / 600_000);
      await asSystem((tx) => enqueue(tx, "sweep", {}, { dedupeKey: `sweep:${window}` }));
      const n = await drainQueue({ deadlineMs: 30_000 });
      if (n === 0) await new Promise((r) => setTimeout(r, 2000));
    } catch (e) {
      captureError(e, { where: "worker" });
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  log.info("worker.stop");
  process.exit(0);
}
main();
