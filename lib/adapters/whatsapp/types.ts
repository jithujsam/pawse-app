export type InboundMessage = {
  providerMessageId: string;
  from: string; // E.164
  kind: "text" | "voice" | "other";
  text?: string;
  mediaId?: string;
  mimeType?: string;
  timestamp: Date;
};

export type TemplateName = "invite" | "reminder";

export type SendResult = { providerMessageId: string };

export interface WhatsAppProvider {
  readonly name: "mock" | "cloud";
  sendTemplate(input: {
    to: string;
    template: TemplateName;
    language: "en" | "hi";
    params: string[];
  }): Promise<SendResult>;
  sendText(input: { to: string; body: string }): Promise<SendResult>;
  /** Verify the signature and extract messages. Returns null if the signature is bad. */
  parseWebhook(rawBody: string, headers: Headers): InboundMessage[] | null;
  fetchMedia(mediaId: string): Promise<{ data: Buffer; mimeType: string }>;
}
