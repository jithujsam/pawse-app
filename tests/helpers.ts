import { createPglite, setDb, type DB } from "@/lib/db/client";
import { setProviders, resetProviders } from "@/lib/adapters";
import { MockWhatsApp } from "@/lib/adapters/whatsapp/mock";
import { MockPayments, signMockPayment } from "@/lib/adapters/payments";
import { MockScorer } from "@/lib/adapters/scorer/mock";
import { MockSpeechToText } from "@/lib/adapters/stt";
import { memberships, organizations, users } from "@/lib/db/schema";
import { receiveWhatsAppWebhook } from "@/lib/services/outreach";
import { handlePaymentWebhook } from "@/lib/services/payments";

export async function freshDb(): Promise<DB> {
  const db = await createPglite();
  setDb(db);
  return db;
}

export function mockProviders() {
  resetProviders();
  const whatsapp = new MockWhatsApp();
  setProviders({ whatsapp, payments: new MockPayments(), scorer: new MockScorer(), stt: new MockSpeechToText() });
  return { whatsapp };
}

export async function makeOrg(db: DB, name = "Acme Staffing", email = `owner-${Math.random()}@example.com`) {
  const [org] = await db.insert(organizations).values({ name, kind: "agency" }).returning();
  const [user] = await db.insert(users).values({ email }).returning();
  await db.insert(memberships).values({ orgId: org.id, userId: user.id });
  return { org, user };
}

let seq = 0;
export async function candidateSays(from: string, text: string, opts: { voice?: boolean; id?: string } = {}) {
  const id = opts.id ?? `wamid.test.${++seq}`;
  const body = JSON.stringify(opts.voice ? { id, from, voiceTranscript: text } : { id, from, text });
  return receiveWhatsAppWebhook(body, new Headers());
}

export async function payMock(ref: string, eventId = `evt_${ref}`) {
  const body = JSON.stringify({ id: eventId, event: "paid", ref });
  return handlePaymentWebhook(body, new Headers({ "x-mock-signature": signMockPayment(body) }));
}

export const SAMPLE_JOB = {
  title: "Delivery Executive",
  description: "Deliver parcels across Pune. Two-wheeler and licence required.",
  location: "Pune",
  testMode: false,
  questions: [
    "Do you have a valid two-wheeler driving licence?",
    "How many years of delivery experience do you have?",
    "Which areas of Pune do you know well?",
    "What is your expected monthly salary?",
    "How soon can you join?",
  ],
  knockouts: ["Valid two-wheeler driving licence"],
  niceToHaves: [
    { text: "Delivery experience", weight: 3 },
    { text: "Knows Pune areas", weight: 2 },
  ],
};
