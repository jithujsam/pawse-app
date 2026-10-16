import Link from "next/link";
import { PublicPage } from "@/components/site/SiteChrome";
import { config } from "@/lib/config";
import { formatInr } from "@/lib/domain/billing";

const STEPS = [
  {
    title: "Describe the role",
    body: "Add the job, five screening questions (we can draft them for you) and what a good candidate looks like: must-haves and nice-to-haves.",
  },
  {
    title: "Upload your candidate list",
    body: "A CSV of names and mobile numbers. We check every +91 number, remove duplicates and skip anyone without consent, before anything is sent.",
  },
  {
    title: "Candidates answer on WhatsApp",
    body: "Each person gets a message from your agency's name, replies YES, and answers one question at a time by text or voice note. Anyone can reply STOP.",
  },
  {
    title: "Get a ranked shortlist",
    body: "Answers are transcribed and scored against your rubric, with the reason and full transcript. You decide who to call, then export or share.",
  },
];

const FAQ = [
  {
    q: "Do candidates need to install anything?",
    a: "No. They reply on WhatsApp, which they already use. Voice notes work, so candidates who prefer speaking to typing aren't left out.",
  },
  {
    q: "Which languages work?",
    a: "English and Hindi today. You choose the language per candidate in your CSV. More Indian languages are planned once we've tested transcription quality for them.",
  },
  {
    q: "Who decides who gets rejected?",
    a: "You do. The score is a suggestion with the reason and evidence next to it. You can open any transcript, change a score and tag candidates yourself. Nobody is rejected automatically.",
  },
  {
    q: "What does it cost?",
    a: `${formatInr(config().PRICE_PER_JOB_INR)} per job, for up to ${config().MAX_CANDIDATES_PER_JOB} candidates, paid by UPI. No subscription and no card. Your first test with up to ${config().TEST_MODE_MAX_CANDIDATES} candidates is free.`,
  },
  {
    q: "What happens to candidate data?",
    a: `It's used only for the role you're hiring for. Candidates can reply STOP or DELETE at any time. When you close a job, its candidate data is deleted after ${config().RETENTION_DAYS} days.`,
  },
  {
    q: "Is this a replacement for my ATS?",
    a: "No. It does one job: the first-round screen. Export the shortlist as a CSV into whatever you use today.",
  },
];

export default function Home() {
  const price = formatInr(config().PRICE_PER_JOB_INR);
  return (
    <PublicPage>
      <section className="relative overflow-hidden">
        <div className="glow-circle w-[420px] h-[420px] -top-24 -right-24" style={{ background: "rgba(173,241,207,0.25)" }} />
        <div className="relative max-w-6xl mx-auto px-5 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="eyebrow mb-5" style={{ color: "var(--color-primary)" }}>
              For Indian recruiters and staffing agencies
            </p>
            <h1 className="text-4xl md:text-6xl mb-6 text-balance" style={{ lineHeight: 1.1 }}>
              Stop phoning 200 people to find the 20 worth calling.
            </h1>
            <p className="text-lg mb-8 max-w-xl" style={{ color: "var(--color-on-surface-variant)", lineHeight: 1.6 }}>
              Upload your candidate list. They answer your screening questions on WhatsApp, by text or voice note. You get a ranked shortlist as the answers come in,
              with the reasons and transcripts.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <Link href="/login" className="btn-base btn-primary">
                Run my first role free
              </Link>
              <form action="/api/demo" method="post">
                <button className="btn-base btn-ghost">See a demo workspace</button>
              </form>
            </div>
            <p className="text-sm mt-4" style={{ color: "var(--color-on-surface-variant)" }}>
              {price} per job · pay by UPI · no subscription
            </p>
          </div>
          <PhonePreview />
        </div>
      </section>

      <section id="how-it-works" className="py-20" style={{ background: "var(--color-surface-container-lowest)" }}>
        <div className="max-w-6xl mx-auto px-5">
          <p className="eyebrow mb-3" style={{ color: "var(--color-primary)" }}>
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl mb-12 max-w-2xl">Your questions, your rubric, their phone.</h2>
          <ol className="grid md:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card">
                <div className="type-stat text-4xl mb-3" style={{ color: "var(--color-primary)" }}>
                  {i + 1}
                </div>
                <h3 className="text-xl mb-2">{s.title}</h3>
                <p className="text-sm" style={{ color: "var(--color-on-surface-variant)", lineHeight: 1.6 }}>
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-3 gap-6">
          {[
            ["Built for how candidates reply", "Voice notes, Hinglish, “repeat please”, a late reply at midnight. The conversation handles it, and hands the candidate to you if they get stuck."],
            ["You stay in charge", "Every score shows its reason and the answer it came from. Edit any score, read any transcript, message any candidate directly."],
            ["Pay per job, in rupees", `One price per role, paid by UPI before messages go out. No monthly plan to cancel. Test free with ${config().TEST_MODE_MAX_CANDIDATES} candidates first.`],
          ].map(([t, b]) => (
            <div key={t}>
              <h3 className="text-2xl mb-2">{t}</h3>
              <p className="text-sm" style={{ color: "var(--color-on-surface-variant)", lineHeight: 1.6 }}>
                {b}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20" style={{ background: "var(--color-surface-container-lowest)" }}>
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl mb-8">Questions</h2>
          <div className="space-y-2">
            {FAQ.map((f) => (
              <details key={f.q} className="card card-sm group">
                <summary className="cursor-pointer font-medium list-none flex justify-between gap-4">
                  {f.q}
                  <span className="transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="text-sm mt-3" style={{ color: "var(--color-on-surface-variant)", lineHeight: 1.6 }}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 text-center" style={{ background: "var(--color-primary)", color: "#fff" }}>
        <div className="max-w-2xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl mb-4">Try it on your next role.</h2>
          <p className="mb-8 opacity-90">Set up a job in about 10 minutes. Screen your first 5 candidates free.</p>
          <Link href="/login" className="btn-base" style={{ background: "#fff", color: "var(--color-primary)" }}>
            Run my first role
          </Link>
        </div>
      </section>
    </PublicPage>
  );
}

function PhonePreview() {
  const msgs: [string, boolean][] = [
    ["Sharma Staffing is hiring for Delivery Executive. Reply YES to answer 5 short questions (text or voice note). Reply STOP at any time to opt out.", false],
    ["YES", true],
    ["Question 1/5: Do you have your own two-wheeler and a valid driving licence?", false],
    ["🎤 Voice note · 0:12", true],
    ["Question 2/5: How many years of delivery experience do you have?", false],
  ];
  return (
    <div className="mx-auto w-full max-w-xs" aria-label="Example WhatsApp conversation">
      <div className="rounded-[2rem] border-8 overflow-hidden shadow-xl" style={{ borderColor: "#0B1C30" }}>
        <div className="px-4 py-3 text-white text-sm" style={{ background: "#075E54" }}>
          Sharma Staffing
        </div>
        <div className="p-3 space-y-2" style={{ background: "#ECE5DD" }}>
          {msgs.map(([m, mine], i) => (
            <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="rounded-lg px-3 py-2 text-xs max-w-[85%] shadow-sm" style={{ background: mine ? "#DCF8C6" : "#fff", color: "#111" }}>
                {m}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
