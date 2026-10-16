import { config } from "../../config";
import { log } from "../../log";

export type Mail = { to: string; subject: string; text: string };

export interface Mailer {
  readonly name: string;
  send(mail: Mail): Promise<void>;
}

/** Development mailer: keeps the last messages in memory so the UI and tests can show them. */
class ConsoleMailer implements Mailer {
  readonly name = "console";
  readonly outbox: Mail[] = [];
  async send(mail: Mail) {
    this.outbox.push(mail);
    if (this.outbox.length > 50) this.outbox.shift();
    log.info("mail.console", { subject: mail.subject });
  }
}

class ResendMailer implements Mailer {
  readonly name = "resend";
  async send(mail: Mail) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config().RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config().MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text }),
    });
    if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
  }
}

const g = globalThis as unknown as { __mailer?: Mailer };

export function mailer(): Mailer {
  return (g.__mailer ??= config().MAILER_PROVIDER === "resend" ? new ResendMailer() : new ConsoleMailer());
}

export function consoleOutbox(): Mail[] {
  const m = mailer();
  return m instanceof ConsoleMailer ? m.outbox : [];
}
