import { requireOrg } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/Shell";
import { JobForm } from "../JobForm";

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  await requireOrg();
  const { first } = await searchParams;
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow={first ? "Step 2 of 3" : "New job"} title="Describe the role" />
      <JobForm first={Boolean(first)} />
    </div>
  );
}
