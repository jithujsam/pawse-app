import { config } from "../config";
import { CloudWhatsApp } from "./whatsapp/cloud";
import { MockWhatsApp } from "./whatsapp/mock";
import type { WhatsAppProvider } from "./whatsapp/types";
import { MockSpeechToText, type SpeechToText } from "./stt";
import { MockScorer } from "./scorer/mock";
import { ClaudeScorer } from "./scorer/claude";
import type { Scorer } from "./scorer/types";
import { MockPayments, RazorpayPayments, type PaymentProvider } from "./payments";

type Providers = { whatsapp: WhatsAppProvider; stt: SpeechToText; scorer: Scorer; payments: PaymentProvider };

const g = globalThis as unknown as { __providers?: Providers };

function build(): Providers {
  const c = config();
  return {
    whatsapp: c.WHATSAPP_PROVIDER === "cloud" ? new CloudWhatsApp() : new MockWhatsApp(),
    stt: new MockSpeechToText(),
    scorer: c.SCORER_PROVIDER === "claude" ? new ClaudeScorer() : new MockScorer(),
    payments: c.PAYMENT_PROVIDER === "razorpay" ? new RazorpayPayments() : new MockPayments(),
  };
}

/** Selected by env vars; every adapter has a mock so the app runs with no keys. */
export function providers(): Providers {
  return (g.__providers ??= build());
}

export function setProviders(p: Partial<Providers>) {
  g.__providers = { ...providers(), ...p };
}

export function resetProviders() {
  g.__providers = undefined;
}
