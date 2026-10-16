import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { queue } from "@/lib/db/schema";
import { Defer, backoffSeconds, drain, enqueue } from "@/lib/jobs/queue";
import { freshDb } from "./helpers";

let db: DB;
beforeEach(async () => {
  db = await freshDb();
});

describe("queue", () => {
  it("dedupes on key", async () => {
    await enqueue(db, "sweep", {}, { dedupeKey: "k" });
    await enqueue(db, "sweep", {}, { dedupeKey: "k" });
    expect(await db.select().from(queue)).toHaveLength(1);
  });

  it("retries with backoff, then fails after max attempts", async () => {
    await enqueue(db, "sweep", {}, { maxAttempts: 2 });
    let calls = 0;
    const handlers = {
      sweep: async () => {
        calls++;
        throw new Error("boom");
      },
    };
    await drain(handlers);
    let [row] = await db.select().from(queue);
    expect(row).toMatchObject({ status: "queued", attempts: 1, lastError: "boom" });
    expect(row.runAt.getTime()).toBeGreaterThan(Date.now() + 5_000);

    await db.update(queue).set({ runAt: new Date() }).where(eq(queue.id, row.id));
    await drain(handlers);
    [row] = await db.select().from(queue);
    expect(row).toMatchObject({ status: "failed", attempts: 2 });
    expect(calls).toBe(2);
  });

  it("defers without spending an attempt", async () => {
    await enqueue(db, "sweep", {});
    await drain({
      sweep: async () => {
        throw new Defer(30);
      },
    });
    const [row] = await db.select().from(queue);
    expect(row).toMatchObject({ status: "queued", attempts: 0 });
  });

  it("backoff grows and is capped", () => {
    expect([1, 2, 3].map(backoffSeconds)).toEqual([10, 20, 40]);
    expect(backoffSeconds(20)).toBe(3600);
  });
});
