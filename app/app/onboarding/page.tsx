import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/Shell";
import { OrgForm } from "./OrgForm";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.orgId) redirect("/app");
  return (
    <div className="max-w-xl">
      <PageHeader eyebrow="Step 1 of 3" title="Set up your workspace">
        Candidates see this name in the first WhatsApp message, so use the name they&apos;ll recognise.
      </PageHeader>
      <div className="card">
        <OrgForm />
      </div>
      <ol className="mt-6 text-sm space-y-1" style={{ color: "var(--color-on-surface-variant)" }}>
        <li>1. Name your agency or company</li>
        <li>2. Describe the role and write 5 screening questions</li>
        <li>3. Upload candidates and start a free test with up to 5 people</li>
      </ol>
    </div>
  );
}
