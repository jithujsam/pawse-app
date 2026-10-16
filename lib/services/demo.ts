import { and, desc, eq } from "drizzle-orm";
import { asSystem, withOrg } from "../db/tenant";
import { candidates, memberships, organizations, users } from "../db/schema";
import { paymentsFor, whatsappFor } from "../adapters";
import { signMockPayment } from "../adapters/payments";
import { drainQueue } from "../jobs";
import { createJob, markReviewed } from "./jobs";
import { tagCandidate } from "./candidates";
import { blindIndex, encrypt } from "../crypto";
import { consents } from "../db/schema";
import { PRIVACY_NOTICE_VERSION } from "../domain/copy";
import { createCheckout, handlePaymentWebhook } from "./payments";
import { receiveWhatsAppWebhook } from "./outreach";

export const DEMO_EMAIL = "demo@example.com";
const DEMO_ORG = "Sharma Staffing (Demo)";

const DELIVERY = {
  title: "Delivery Executive",
  description:
    "Two-wheeler delivery partner for a grocery app in Pune. Shifts of 9 hours, six days a week. Fixed salary plus incentives. Own bike and a valid licence required.",
  location: "Pune",
  testMode: false,
  questions: [
    "Do you have your own two-wheeler and a valid driving licence?",
    "How many years of delivery or field work experience do you have? Where did you work?",
    "Which areas of Pune do you know well?",
    "What is your current and expected monthly salary?",
    "How soon can you join if selected?",
  ],
  knockouts: ["Own two-wheeler and valid driving licence"],
  niceToHaves: [
    { text: "Delivery or field work experience", weight: 3 },
    { text: "Knows Pune areas well", weight: 2 },
    { text: "Can join immediately or within a week", weight: 2 },
  ],
};

// Fake numbers in a range used only for the demo.
const PEOPLE: { name: string; phone: string; lang: "en" | "hi"; script: (string | { voice: string })[] }[] = [
  {
    name: "Rohit Patil",
    phone: "+919000010001",
    lang: "en",
    script: [
      "YES",
      "Yes I have my own Activa and a valid driving licence",
      { voice: "I have 3 years delivery experience, two years with Swiggy and one year with a courier company in Pune" },
      "Kothrud, Karve Nagar, Warje, Baner. I know Pune areas very well",
      "Current 17000, expected 20000",
      "I can join immediately",
    ],
  },
  {
    name: "Sneha Kulkarni",
    phone: "+919000010002",
    lang: "en",
    script: [
      "yes",
      "Yes, own scooter and licence",
      "2 years field sales experience with a FMCG distributor",
      "Hadapsar, Kharadi, Viman Nagar",
      "Expected 19000",
      "Within one week",
    ],
  },
  {
    name: "Imran Shaikh",
    phone: "+919000010003",
    lang: "hi",
    script: [
      "haan",
      "Haan, meri khud ki bike hai aur licence bhi hai",
      { voice: "Mujhe 4 saal ka delivery experience hai Zomato aur Dunzo ke saath" },
      "Pimpri, Chinchwad, Akurdi, Nigdi sab area pata hai",
      "Abhi 16000 hai, 21000 chahiye",
      "15 din mein join kar sakta hoon",
    ],
  },
  {
    name: "Priya Deshmukh",
    phone: "+919000010004",
    lang: "en",
    script: [
      "YES",
      "I have a licence but no bike right now, I can arrange in a month",
      "1 year delivery experience",
      "Shivajinagar and Deccan",
      "18000",
      "After one month",
    ],
  },
  {
    name: "Arjun Jadhav",
    phone: "+919000010005",
    lang: "en",
    script: [
      "yes",
      "Yes I have bike and licence",
      "Fresher, no experience but I am ready to learn",
      "Wakad and Hinjewadi",
      "15000",
      "Immediately",
    ],
  },
  {
    name: "Kavita Shinde",
    phone: "+919000010006",
    lang: "hi",
    script: [
      "हाँ",
      "हाँ, मेरे पास अपनी two-wheeler scooty और valid driving licence है",
      "2 साल कूरियर कंपनी में डिलीवरी का काम किया है",
      "Katraj, Bibwewadi, Swargate",
      "Expected 18000",
      "1 हफ्ते में",
    ],
  },
  { name: "Vikram Pawar", phone: "+919000010007", lang: "en", script: ["STOP"] },
  { name: "Nikhil More", phone: "+919000010008", lang: "en", script: ["YES", "ok", "👍"] },
  { name: "Sachin Gaikwad", phone: "+919000010009", lang: "en", script: [] },
];

export async function findDemoOrg() {
  const [row] = await asSystem((tx) =>
    tx
      .select({ orgId: organizations.id, userId: users.id })
      .from(organizations)
      .innerJoin(memberships, eq(memberships.orgId, organizations.id))
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(organizations.isDemo, true), eq(users.email, DEMO_EMAIL)))
      .orderBy(desc(organizations.createdAt))
      .limit(1),
  );
  return row ?? null;
}

let seq = 0;
async function say(phone: string, msg: string | { voice: string }) {
  const id = `demo.${Date.now()}.${++seq}`;
  const body = JSON.stringify(typeof msg === "string" ? { id, from: phone, text: msg } : { id, from: phone, voiceTranscript: msg.voice });
  await receiveWhatsAppWebhook(body, new Headers(), whatsappFor(true));
}

/** Create the demo workspace by running the real flow on simulated providers. Idempotent. */
export async function ensureDemoWorkspace() {
  const existing = await findDemoOrg();
  if (existing) return existing;

  const { orgId, userId } = await asSystem(async (tx) => {
    let [user] = await tx.select().from(users).where(eq(users.email, DEMO_EMAIL));
    if (!user) [user] = await tx.insert(users).values({ email: DEMO_EMAIL, name: "Demo Recruiter" }).returning();
    const [org] = await tx.insert(organizations).values({ name: DEMO_ORG, kind: "agency", isDemo: true }).returning();
    await tx.insert(memberships).values({ orgId: org.id, userId: user.id, role: "owner" });
    return { orgId: org.id, userId: user.id };
  });

  // Job 1: fully screened, paid, ready to review.
  const job = await createJob(orgId, userId, DELIVERY);
  await seedCandidates(orgId, userId, job.id, PEOPLE);
  const payment = await createCheckout(orgId, userId, job.id);
  const body = JSON.stringify({ id: `evt_demo_${payment.providerRef}`, event: "paid", ref: payment.providerRef });
  await handlePaymentWebhook(body, new Headers({ "x-mock-signature": signMockPayment(body) }), paymentsFor(true));
  await drainQueue();
  const longest = Math.max(...PEOPLE.map((p) => p.script.length));
  for (let i = 0; i < longest; i++) {
    for (const p of PEOPLE) if (p.script[i] !== undefined) await say(p.phone, p.script[i]);
    await drainQueue();
  }
  const top = await withOrg(orgId, (tx) =>
    tx.select({ id: candidates.id, name: candidates.name }).from(candidates).where(eq(candidates.jobId, job.id)),
  );
  for (const name of ["Rohit Patil", "Imran Shaikh"]) {
    const c = top.find((t) => t.name === name);
    if (c) await tagCandidate(orgId, userId, c.id, "shortlist");
  }
  const priya = top.find((t) => t.name === "Priya Deshmukh");
  if (priya) await tagCandidate(orgId, userId, priya.id, "reject");
  await markReviewed(orgId, userId, job.id);

  // Job 2: a free test-mode draft with three candidates, for a live walkthrough.
  const draft = await createJob(orgId, userId, {
    title: "Telecaller (Hindi)",
    description: "Outbound calls for a loan company in Lucknow. Fluent Hindi, basic computer use. Day shift, office based.",
    location: "Lucknow",
    testMode: true,
    questions: [
      "Can you speak fluent Hindi on the phone with customers?",
      "How many years of telecalling or customer support experience do you have?",
      "Have you used a computer or CRM software for calling?",
      "What is your expected monthly salary?",
      "Can you work from our office in Gomti Nagar, Lucknow?",
    ],
    knockouts: ["Fluent Hindi", "Can work from the Lucknow office"],
    niceToHaves: [
      { text: "Telecalling or customer support experience", weight: 3 },
      { text: "Uses computer or CRM software", weight: 1 },
    ],
  });
  await seedCandidates(orgId, userId, draft.id, [
    { name: "Anjali Verma", phone: "+919000020001", lang: "hi" },
    { name: "Rahul Mishra", phone: "+919000020002", lang: "hi" },
    { name: "Pooja Yadav", phone: "+919000020003", lang: "en" },
  ]);
  return { orgId, userId };
}

/** Demo-only: CSV upload is disabled for demo orgs, so seed candidates directly. */
async function seedCandidates(orgId: string, userId: string, jobId: string, people: { name: string; phone: string; lang: "en" | "hi" }[]) {
  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .insert(candidates)
      .values(people.map((p) => ({ orgId, jobId, name: p.name, phoneEnc: encrypt(p.phone), phoneHash: blindIndex(p.phone), language: p.lang })))
      .returning({ id: candidates.id });
    await tx.insert(consents).values(
      rows.map((r) => ({ orgId, candidateId: r.id, source: "csv_upload" as const, noticeVersion: PRIVACY_NOTICE_VERSION, grantedBy: userId })),
    );
  });
}
