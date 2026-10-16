import { sql } from "drizzle-orm";
import { asSystem } from "../db/tenant";
import { FUNNEL } from "../domain/audit";

/** Platform-wide numbers for the operator. Counts only, no candidate data. */
export async function opsOverview(days = 30) {
  return asSystem(async (tx) => {
    const funnel = await tx.execute(sql`
      select name, count(*)::int as events, count(distinct coalesce(org_id::text, user_id::text))::int as actors
      from analytics_events
      where created_at > now() - make_interval(days => ${days})
      group by name`);
    const costs = await tx.execute(sql`
      select j.id, j.title, o.name as org, o.is_demo,
        coalesce(sum(c.quantity) filter (where c.kind = 'wa_template'), 0)::int as templates,
        coalesce(sum(c.quantity) filter (where c.kind = 'wa_session'), 0)::int as session_msgs,
        coalesce(sum(c.quantity) filter (where c.kind = 'stt_seconds'), 0)::int as stt_seconds,
        coalesce(sum(c.quantity) filter (where c.kind = 'llm_input_tokens'), 0)::int as llm_in,
        coalesce(sum(c.quantity) filter (where c.kind = 'llm_output_tokens'), 0)::int as llm_out,
        (select count(*) from candidates x where x.job_id = j.id)::int as candidates,
        (select count(*) from candidates x where x.job_id = j.id and x.status not in ('pending','invited'))::int as responded
      from jobs j join organizations o on o.id = j.org_id
      left join cost_events c on c.job_id = j.id
      where j.created_at > now() - make_interval(days => ${days})
      group by j.id, o.name, o.is_demo
      order by j.created_at desc limit 100`);
    const rows = (r: unknown) => (r as { rows: Record<string, unknown>[] }).rows;
    const f = rows(funnel);
    return {
      funnel: FUNNEL.map((name) => {
        const row = f.find((x) => x.name === name);
        return { name, events: Number(row?.events ?? 0), actors: Number(row?.actors ?? 0) };
      }),
      jobs: rows(costs),
    };
  });
}
