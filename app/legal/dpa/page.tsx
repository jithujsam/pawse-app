import { LegalPage } from "@/components/site/SiteChrome";
import { BRAND } from "@/lib/brand";
import { config } from "@/lib/config";

export const metadata = { title: `Data processing · ${BRAND.name}` };

export default function DpaPage() {
  const c = config();
  return (
    <LegalPage title="Data Processing Terms" updated="October 2026">
      <p>
        These terms describe how we process candidate personal data on your behalf when you use {BRAND.name}. [Counsel to confirm roles under the Digital Personal
        Data Protection Act, 2023: customer as Data Fiduciary and {BRAND.name} as Data Processor, and any contract terms the Act or Rules require.]
      </p>
      <h2>1. Instructions</h2>
      <p>We process candidate data only to run the screening you set up: sending messages, collecting answers, transcribing, scoring and showing you the results.</p>
      <h2>2. Your obligations</h2>
      <p>
        You confirm that each candidate you upload has given consent to be contacted by you on WhatsApp about the role, that you have a lawful basis to share their
        data with us, and that you will act on access, correction and deletion requests you receive.
      </p>
      <h2>3. Security</h2>
      <ul>
        <li>Mobile numbers are encrypted at rest; data in transit uses TLS.</li>
        <li>Each customer&apos;s data is isolated at the database level.</li>
        <li>Access to production data is limited to staff who need it, and changes to candidate data are recorded in an audit log.</li>
        <li>Personal data is excluded from application logs.</li>
      </ul>
      <h2>4. Sub-processors</h2>
      <p>Hosting and database, Meta (WhatsApp), a speech-to-text provider, Anthropic (AI scoring), an email provider and Razorpay (payments). [Final list with locations.]</p>
      <h2>5. Retention and deletion</h2>
      <p>
        Candidate data is deleted {c.RETENTION_DAYS} days after you close a job. Candidates can request deletion by replying DELETE; you can delete a candidate&apos;s
        data from their page at any time.
      </p>
      <h2>6. Breaches</h2>
      <p>We will tell you without undue delay after becoming aware of a personal data breach affecting your candidates. [Timeline to be confirmed by counsel.]</p>
    </LegalPage>
  );
}
