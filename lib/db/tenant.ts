import { sql } from "drizzle-orm";
import { getDb, type Tx } from "./client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Run `fn` inside a transaction that can only see rows of `orgId`.
 * Postgres row-level security enforces this even if a query forgets its
 * `where org_id = ...` clause. All recruiter-facing data access goes through here.
 */
export async function withOrg<T>(orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(orgId)) throw new Error("withOrg: invalid org id");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
    await tx.execute(sql`set local role app_user`);
    return fn(tx as Tx);
  });
}

/**
 * System context (webhooks, queue workers, auth). Bypasses RLS, so callers
 * must scope queries themselves. Keep usage small and reviewed.
 */
export async function asSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => fn(tx as Tx));
}
