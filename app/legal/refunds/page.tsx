import { LegalPage } from "@/components/site/SiteChrome";
import { BRAND } from "@/lib/brand";
import { config } from "@/lib/config";

export const metadata = { title: `Refunds · ${BRAND.name}` };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy" updated="October 2026">
      <p>You pay per job, before any messages are sent. Here&apos;s when we refund.</p>
      <ul>
        <li>
          <strong>Before any message goes out:</strong> if you paid but no candidate has been messaged yet (for example, a payment went through twice), we refund in
          full.
        </li>
        <li>
          <strong>If we couldn&apos;t deliver:</strong> if a problem on our side meant your candidates weren&apos;t messaged or your shortlist wasn&apos;t produced, we
          refund in full or re-run the job, your choice.
        </li>
        <li>
          <strong>After screening has run:</strong> payments aren&apos;t refundable once messages have been sent, because WhatsApp and processing costs have been
          incurred. If you&apos;re unhappy with the results, write to us and we&apos;ll look at it.
        </li>
      </ul>
      <p>
        To request a refund, email {config().SUPPORT_EMAIL} with your receipt number. Approved refunds go back to the original UPI account, usually within 5 to 7
        working days depending on your bank. [Timelines to confirm with payment provider.]
      </p>
      <p className="text-sm">{BRAND.name} does not offer subscriptions, so there is nothing to cancel.</p>
    </LegalPage>
  );
}
