import { randomUUID } from "node:crypto";
import type { InboundMessage, WhatsAppProvider } from "./types";

/**
 * Local WhatsApp. Outbound messages are only recorded in our messages table;
 * the in-app simulator plays the candidate and posts replies to the webhook.
 * A voice note is simulated as media id `mock:<base64 transcript>`.
 */
export class MockWhatsApp implements WhatsAppProvider {
  readonly name = "mock" as const;
  readonly sent: { to: string; body: string }[] = [];

  async sendTemplate(input: { to: string; template: string; params: string[] }) {
    this.sent.push({ to: input.to, body: `[template:${input.template}] ${input.params.join(" | ")}` });
    return { providerMessageId: `mock-${randomUUID()}` };
  }

  async sendText(input: { to: string; body: string }) {
    this.sent.push(input);
    return { providerMessageId: `mock-${randomUUID()}` };
  }

  parseWebhook(rawBody: string): InboundMessage[] | null {
    let data: unknown;
    try {
      data = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const d = data as { id?: string; from?: string; text?: string; voiceTranscript?: string };
    if (typeof d.from !== "string" || typeof d.id !== "string") return null;
    if (typeof d.voiceTranscript === "string") {
      return [
        {
          providerMessageId: d.id,
          from: d.from,
          kind: "voice",
          mediaId: `mock:${Buffer.from(d.voiceTranscript).toString("base64")}`,
          mimeType: "audio/ogg",
          timestamp: new Date(),
        },
      ];
    }
    return [{ providerMessageId: d.id, from: d.from, kind: "text", text: String(d.text ?? ""), timestamp: new Date() }];
  }

  async fetchMedia(mediaId: string) {
    if (!mediaId.startsWith("mock:")) throw new Error("unknown mock media");
    return { data: Buffer.from(mediaId.slice(5), "base64"), mimeType: "audio/ogg" };
  }
}
