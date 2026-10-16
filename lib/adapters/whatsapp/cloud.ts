import { config } from "../../config";
import { hmacHex, safeEqual } from "../../crypto";
import { normalizeIndianMobile } from "../../domain/phone";
import type { InboundMessage, SendResult, TemplateName, WhatsAppProvider } from "./types";

/**
 * WhatsApp Cloud API (Meta Graph). NOT yet tested against a live number:
 * see TODO.md. Template names map to templates you have approved in Meta
 * Business Manager; the parameter order must match the approved body.
 */
export class CloudWhatsApp implements WhatsAppProvider {
  readonly name = "cloud" as const;

  private get base() {
    const c = config();
    return `https://graph.facebook.com/${c.WHATSAPP_GRAPH_VERSION}`;
  }

  private async post(body: unknown): Promise<SendResult> {
    const c = config();
    const res = await fetch(`${this.base}/${c.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok || !json.messages?.[0]?.id) {
      throw new Error(`WhatsApp send failed (${res.status}): ${json.error?.message ?? "unknown"}`);
    }
    return { providerMessageId: json.messages[0].id };
  }

  sendTemplate(input: { to: string; template: TemplateName; language: "en" | "hi"; params: string[] }) {
    const c = config();
    const name = input.template === "invite" ? c.WHATSAPP_INVITE_TEMPLATE : c.WHATSAPP_REMINDER_TEMPLATE;
    return this.post({
      messaging_product: "whatsapp",
      to: input.to.replace("+", ""),
      type: "template",
      template: {
        name,
        language: { code: input.language === "hi" ? "hi" : "en" },
        components: [{ type: "body", parameters: input.params.map((text) => ({ type: "text", text })) }],
      },
    });
  }

  sendText(input: { to: string; body: string }) {
    return this.post({
      messaging_product: "whatsapp",
      to: input.to.replace("+", ""),
      type: "text",
      text: { body: input.body, preview_url: false },
    });
  }

  parseWebhook(rawBody: string, headers: Headers): InboundMessage[] | null {
    const secret = config().WHATSAPP_APP_SECRET;
    const sig = headers.get("x-hub-signature-256") ?? "";
    if (!secret || !safeEqual(sig, `sha256=${hmacHex(secret, rawBody)}`)) return null;

    type Msg = { id: string; from: string; timestamp: string; type: string; text?: { body: string }; audio?: { id: string; mime_type: string } };
    const body = JSON.parse(rawBody) as { entry?: { changes?: { value?: { messages?: Msg[] } }[] }[] };
    const out: InboundMessage[] = [];
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const m of change.value?.messages ?? []) {
          const from = normalizeIndianMobile(`+${m.from}`);
          if (!from) continue;
          const base = { providerMessageId: m.id, from, timestamp: new Date(Number(m.timestamp) * 1000) };
          if (m.type === "text" && m.text) out.push({ ...base, kind: "text", text: m.text.body });
          else if (m.type === "audio" && m.audio) out.push({ ...base, kind: "voice", mediaId: m.audio.id, mimeType: m.audio.mime_type });
          // Interactive button replies (e.g. a quick-reply "YES" on the template).
          else if (m.type === "button") out.push({ ...base, kind: "text", text: (m as unknown as { button: { text: string } }).button.text });
          else out.push({ ...base, kind: "other" });
        }
      }
    }
    return out;
  }

  async fetchMedia(mediaId: string) {
    const c = config();
    const auth = { Authorization: `Bearer ${c.WHATSAPP_TOKEN}` };
    const meta = await fetch(`${this.base}/${mediaId}`, { headers: auth });
    if (!meta.ok) throw new Error(`media lookup failed: ${meta.status}`);
    const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
    const file = await fetch(url, { headers: auth });
    if (!file.ok) throw new Error(`media download failed: ${file.status}`);
    return { data: Buffer.from(await file.arrayBuffer()), mimeType: mime_type };
  }
}
