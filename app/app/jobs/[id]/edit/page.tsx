import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth/session";
import { getJobDetail, NotFound } from "@/lib/services/jobs";
import { PageHeader } from "@/components/app/Shell";
import { JobForm } from "../../JobForm";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOrg();
  const { id } = await params;
  const d = await getJobDetail(user.orgId, id).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  if (d.job.status !== "draft") redirect(`/app/jobs/${id}`);
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Edit job" title={d.job.title} />
      <JobForm
        jobId={id}
        initial={{
          title: d.job.title,
          description: d.job.description,
          location: d.job.location,
          testMode: d.job.testMode,
          questions: d.questions.map((q) => q.text),
          knockouts: d.rubric.filter((r) => r.kind === "knockout").map((r) => r.text),
          niceToHaves: d.rubric.filter((r) => r.kind === "nice").map((r) => ({ text: r.text, weight: r.weight })),
        }}
      />
    </div>
  );
}
