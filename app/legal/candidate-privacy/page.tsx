import { LegalPage } from "@/components/site/SiteChrome";
import { BRAND } from "@/lib/brand";
import { config } from "@/lib/config";
import { PRIVACY_NOTICE_VERSION } from "@/lib/domain/copy";

export const metadata = { title: `Candidate privacy notice · ${BRAND.name}` };

/** Linked from the first WhatsApp message every candidate receives. Keep it short and plain. */
export default function CandidatePrivacyPage() {
  const c = config();
  return (
    <LegalPage title="If we messaged you about a job" updated={`October 2026 · version ${PRIVACY_NOTICE_VERSION}`}>
      <p>
        A recruiter or company used {BRAND.name} to send you screening questions on WhatsApp for a job. Their name was in the first message. They gave us your name
        and number and told us you agreed to be contacted about jobs.
      </p>
      <h2>What we collect</h2>
      <p>Your name, mobile number, the language you prefer, and your replies, including voice notes and a written transcript of them.</p>
      <h2>Why</h2>
      <p>
        To ask you the recruiter&apos;s questions, turn voice notes into text, and give the recruiter a summary and suggested score of your answers. A person at the
        recruiter decides whether to contact you. Your answers aren&apos;t used for any other job or sold to anyone.
      </p>
      <h2>How long we keep it</h2>
      <p>Until {c.RETENTION_DAYS} days after the recruiter closes the job. Then it&apos;s deleted.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Reply <strong>STOP</strong> at any time to stop messages about this job.</li>
        <li>Reply <strong>DELETE</strong> to delete your answers and details for this job straight away.</li>
        <li>Email {c.SUPPORT_EMAIL} to ask what we hold about you or to correct it.</li>
      </ul>
      <h2>Hindi · हिंदी</h2>
      <p>
        किसी रिक्रूटर ने नौकरी के लिए आपसे WhatsApp पर सवाल पूछने के लिए {BRAND.name} का इस्तेमाल किया है। आपके जवाब सिर्फ़ इसी नौकरी के लिए इस्तेमाल होते हैं और नौकरी बंद होने के{" "}
        {c.RETENTION_DAYS} दिन बाद हटा दिए जाते हैं। मैसेज बंद करने के लिए STOP लिखें, अपनी जानकारी तुरंत हटाने के लिए DELETE लिखें।
      </p>
    </LegalPage>
  );
}
