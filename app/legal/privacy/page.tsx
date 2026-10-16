import { LegalPage } from "@/components/site/SiteChrome";
import { BRAND } from "@/lib/brand";
import { config } from "@/lib/config";

export const metadata = { title: `Privacy · ${BRAND.name}` };

export default function PrivacyPage() {
  const c = config();
  return (
    <LegalPage title="Privacy Policy" updated="October 2026">
      <p>
        This policy explains how [Company legal name] handles personal data in {BRAND.name}. Candidates contacted through {BRAND.name} should also read the{" "}
        <a href="/legal/candidate-privacy">candidate privacy notice</a>.
      </p>
      <h2>Data about recruiters (our customers)</h2>
      <ul>
        <li><strong>What:</strong> your email address, workspace name, and records of jobs you create and payments you make.</li>
        <li><strong>Why:</strong> to provide the service, sign you in, send receipts and summaries, and improve the product using aggregate usage counts.</li>
        <li><strong>Payments:</strong> UPI payments are handled by our payment provider. We don&apos;t see or store your UPI PIN or bank details.</li>
      </ul>
      <h2>Data about candidates</h2>
      <p>
        We process candidate names, mobile numbers, preferred language, WhatsApp messages, voice notes and their transcripts, answers and scores, on behalf of the
        recruiter who uploaded them. Mobile numbers are encrypted at rest. Data is used only to screen the candidate for that recruiter&apos;s role and is deleted{" "}
        {c.RETENTION_DAYS} days after the job closes, or earlier when the candidate or recruiter asks.
      </p>
      <h2>Service providers</h2>
      <p>
        We use providers to run the service: hosting and database, WhatsApp messaging (Meta), speech-to-text, an AI model provider for scoring (Anthropic), email,
        and payments (Razorpay). [List with locations and links to be finalised; confirm cross-border transfer position.]
      </p>
      <h2>Your choices</h2>
      <p>
        You can ask us for a copy of your data, to correct it or to delete it by emailing {c.SUPPORT_EMAIL}. Candidates can reply STOP to stop messages or DELETE to
        delete their data at any time.
      </p>
      <h2>Contact</h2>
      <p>[Grievance officer name and contact, if required.] {c.SUPPORT_EMAIL}</p>
    </LegalPage>
  );
}
