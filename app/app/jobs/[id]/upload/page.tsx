import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/session";
import { getJobDetail, NotFound } from "@/lib/services/jobs";
import { PageHeader } from "@/components/app/Shell";
import { Uploader } from "./Uploader";

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOrg();
  const { id } = await params;
  const d = await getJobDetail(user.orgId, id).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow={d.job.title} title="Upload candidates">
        A CSV with columns <code>name</code>, <code>phone</code>, <code>consent</code> and optional <code>language</code> (English or Hindi).{" "}
        <a href="/sample-candidates.csv" download className="underline">
          Download a sample CSV
        </a>
        .
      </PageHeader>
      <div className="card mb-4 text-sm space-y-1" style={{ color: "var(--color-on-surface-variant)" }}>
        <p>
          <strong>Consent:</strong> put <code>yes</code> only for people who agreed to be contacted on WhatsApp about jobs, for example when they applied. Rows without
          consent are never messaged.
        </p>
        <p>We check every number is a valid Indian mobile (+91), remove duplicates and show you the problems before anything is saved.</p>
      </div>
      <Uploader jobId={id} />
      <Link href={`/app/jobs/${id}`} className="text-sm underline mt-6 inline-block">
        Back to job
      </Link>
    </div>
  );
}
