import Link from "next/link";
import { PublicPage } from "@/components/site/SiteChrome";
import { config } from "@/lib/config";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `Help · ${BRAND.name}` };

const TOPICS: { q: string; a: React.ReactNode }[] = [
  {
    q: "How do I run my first role?",
    a: (
      <>
        Sign in, name your workspace, then create a job. Tick <em>Free test mode</em>, upload a CSV with up to 5 people (try your own number first), and click{" "}
        <em>Start free test</em>. Most people are done in under 10 minutes.
      </>
    ),
  },
  {
    q: "What should my CSV look like?",
    a: (
      <>
        Columns <code>name</code>, <code>phone</code>, <code>consent</code>, and optionally <code>language</code> (English or Hindi). Phone numbers can be written
        with or without +91, spaces or dashes. <a href="/sample-candidates.csv" download className="underline">Download the sample CSV</a>.
      </>
    ),
  },
  {
    q: "What does the consent column mean?",
    a: "Put yes only for people who agreed to be contacted on WhatsApp about jobs, for example on your application form. We never message a row without it, and we keep a record of the consent with each candidate.",
  },
  {
    q: "What if a candidate doesn't reply?",
    a: "We send one reminder after 24 hours. If there's still no reply after 72 hours, they're marked No response. If they reply later, they carry on where they left off.",
  },
  {
    q: "What does “Needs you” mean?",
    a: "The candidate replied with something we couldn't use twice in a row (for example a sticker, or “ok” to an open question). Automatic messages stop and you can message or call them from the candidate page.",
  },
  {
    q: "How is the score worked out?",
    a: "Each answer is checked against your must-haves (met, not met or unclear) and nice-to-haves (0 to 3, multiplied by the weight you set). Candidates who meet every must-have rank first. The score is a suggestion: edit it if you disagree.",
  },
  {
    q: "A candidate asked us to delete their data.",
    a: "Candidates can reply DELETE on WhatsApp, which removes their data automatically. You can also delete a candidate's data from their page. Either way it can't be undone.",
  },
  {
    q: "How do I pay?",
    a: "On the job page, click Pay by UPI. You'll get a UPI payment page; messages start going out as soon as the payment is confirmed. Your receipt is on the job page.",
  },
];

export default function HelpPage() {
  return (
    <PublicPage>
      <section className="max-w-3xl mx-auto px-5 py-16">
        <h1 className="text-4xl mb-4">Help</h1>
        <p className="mb-10" style={{ color: "var(--color-on-surface-variant)" }}>
          Can&apos;t find what you need? Email <a href={`mailto:${config().SUPPORT_EMAIL}`} className="underline">{config().SUPPORT_EMAIL}</a> and we&apos;ll reply
          within one working day. Something broken? Check the <Link href="/status" className="underline">status page</Link>.
        </p>
        <div className="space-y-6">
          {TOPICS.map((t) => (
            <section key={t.q}>
              <h2 className="text-2xl mb-2">{t.q}</h2>
              <p className="text-sm" style={{ color: "var(--color-on-surface-variant)", lineHeight: 1.7 }}>
                {t.a}
              </p>
            </section>
          ))}
        </div>
      </section>
    </PublicPage>
  );
}
