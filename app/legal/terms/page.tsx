import { LegalPage } from "@/components/site/SiteChrome";
import { BRAND } from "@/lib/brand";
import { config } from "@/lib/config";

export const metadata = { title: `Terms · ${BRAND.name}` };

export default function TermsPage() {
  const c = config();
  return (
    <LegalPage title="Terms of Service" updated="October 2026">
      <h2>1. Who we are</h2>
      <p>
        {BRAND.name} (&ldquo;we&rdquo;) is operated by [Company legal name], [registered address]. These terms apply to recruiters, agencies and companies
        (&ldquo;you&rdquo;) who use {BRAND.name} to screen job candidates.
      </p>
      <h2>2. What the service does</h2>
      <p>
        You give us a job description, screening questions, a scoring rubric and a list of candidates. We contact those candidates on WhatsApp on your behalf, collect
        their answers, transcribe voice notes and produce a suggested score and ranking. Scores are produced partly by automated systems, including AI models, and
        may be wrong. You make every hiring decision.
      </p>
      <h2>3. Your responsibilities</h2>
      <ul>
        <li>You only upload candidates who have agreed to be contacted by you on WhatsApp about job opportunities, and you can show how that consent was given.</li>
        <li>Your questions and rubric must not discriminate on grounds prohibited by law, and must relate to the job.</li>
        <li>You keep your account secure and are responsible for activity in your workspace.</li>
        <li>You do not use the service to send spam, marketing unrelated to the job, or unlawful content.</li>
      </ul>
      <h2>4. Fees and payment</h2>
      <p>
        Fees are per job and shown before you pay, in Indian rupees. Payment is taken by UPI through our payment provider before messages are sent. Refunds follow
        our refund policy. [Tax treatment, including GST, to be confirmed.]
      </p>
      <h2>5. Data</h2>
      <p>
        You decide why and how candidate data is used; we process it on your instructions as described in our Data Processing terms and Privacy Policy. Candidate
        data for a job is deleted {c.RETENTION_DAYS} days after you close the job, or earlier on request.
      </p>
      <h2>6. Availability and changes</h2>
      <p>
        We work to keep the service available but do not guarantee it will be uninterrupted. WhatsApp delivery depends on Meta&apos;s platform, which we do not
        control. We may change these terms with notice by email.
      </p>
      <h2>7. Liability</h2>
      <p>[Limitation of liability, indemnity and governing law clauses to be drafted by counsel.]</p>
      <h2>8. Contact</h2>
      <p>{c.SUPPORT_EMAIL}</p>
    </LegalPage>
  );
}
