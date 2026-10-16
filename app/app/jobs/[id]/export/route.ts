import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getJobDetail, NotFound } from "@/lib/services/jobs";
import { getShortlist } from "@/lib/services/candidates";
import { toCsv } from "@/lib/domain/csv";
import { withOrg } from "@/lib/db/tenant";
import { audit, track } from "@/lib/domain/audit";
import { candidateStatusLabel } from "@/components/app/StatusBadge";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.orgId) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const orgId = user.orgId;
  try {
    const d = await getJobDetail(orgId, id);
    if (!d.job.reviewedAt) return new NextResponse("Mark the shortlist as reviewed before exporting.", { status: 409 });
    const rows = await getShortlist(orgId, id);
    const csv = toCsv([
      ["Rank", "Name", "Phone", "Status", "Tag", "Score", "AI score", "Must-haves met", "Reason", "Summary"],
      ...rows.map((r, i) => [
        i + 1,
        r.name,
        r.phone,
        candidateStatusLabel(r.status),
        r.tag ?? "",
        r.score ? (r.score.editedTotal ?? r.score.total) : "",
        r.score?.total ?? "",
        r.score ? (r.score.knockoutPassed ? "Yes" : "No") : "",
        r.score?.reason ?? "",
        r.score?.summary ?? "",
      ]),
    ]);
    await withOrg(orgId, async (tx) => {
      await audit(tx, orgId, "shortlist.exported", "job", id, { userId: user.userId }, { rows: rows.length });
      await track(tx, "export_csv", { orgId, userId: user.userId });
    });
    const safe = d.job.title.replace(/[^\w-]+/g, "-").slice(0, 40);
    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="shortlist-${safe}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof NotFound) return new NextResponse("Not found", { status: 404 });
    throw e;
  }
}
