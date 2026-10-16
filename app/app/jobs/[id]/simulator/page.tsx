import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth/session";
import { getJobDetail, NotFound } from "@/lib/services/jobs";
import { getShortlist } from "@/lib/services/candidates";
import { providers } from "@/lib/adapters";
import { PageHeader } from "@/components/app/Shell";
import { Simulator } from "./Simulator";

export default async function SimulatorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOrg();
  if (!user.isDemo && providers().whatsapp.name !== "mock") redirect("/app");
  const { id } = await params;
  const d = await getJobDetail(user.orgId, id).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  const people = (await getShortlist(user.orgId, id))
    .filter((c) => c.status !== "deleted" && c.status !== "pending")
    .map((c) => ({ id: c.id, name: c.name, phone: c.phone, status: c.status }));
  return (
    <>
      <PageHeader eyebrow={<Link href={`/app/jobs/${id}`}>← {d.job.title}</Link>} title="Phone simulator">
        Play the candidate. Messages here go through the same engine as real WhatsApp, but nothing reaches a real phone.
      </PageHeader>
      <Simulator jobId={id} people={people} />
    </>
  );
}
