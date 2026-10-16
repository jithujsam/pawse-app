import { auditLog, analyticsEvents } from "../db/schema";
import type { Conn } from "../db/client";

type Actor = { userId?: string | null; kind?: "user" | "system" | "candidate" };

export async function audit(
  conn: Conn,
  orgId: string,
  action: string,
  entity: string,
  entityId: string | null,
  actor: Actor = {},
  meta: Record<string, unknown> = {},
) {
  await conn.insert(auditLog).values({
    orgId,
    action,
    entity,
    entityId,
    actorUserId: actor.userId ?? null,
    actor: actor.kind ?? (actor.userId ? "user" : "system"),
    meta,
  });
}

export const FUNNEL = ["signup", "org_created", "job_created", "csv_uploaded", "paid", "shortlist_viewed"] as const;
export type FunnelEvent = (typeof FUNNEL)[number] | "demo_login" | "job_closed" | "export_csv";

/** First-party funnel analytics. Never put PII in props. */
export async function track(
  conn: Conn,
  name: FunnelEvent,
  ids: { orgId?: string | null; userId?: string | null } = {},
  props: Record<string, string | number | boolean> = {},
) {
  await conn.insert(analyticsEvents).values({ name, orgId: ids.orgId ?? null, userId: ids.userId ?? null, props });
}
