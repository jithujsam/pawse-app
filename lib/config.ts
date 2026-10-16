import { z } from "zod";

// Every setting comes from the environment. See .env.example for meanings.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default(vercelUrl() ?? "http://localhost:3000"),

  DATABASE_URL: z.string().optional(),
  PGLITE_DIR: z.string().default(".data/pglite"),

  SESSION_SECRET: z.string().min(16).default("dev-session-secret-change-me"),
  DATA_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "DATA_ENCRYPTION_KEY must be 64 hex chars")
    .default("0".repeat(64)),

  WHATSAPP_PROVIDER: z.enum(["mock", "cloud"]).default("mock"),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_GRAPH_VERSION: z.string().default("v21.0"),
  WHATSAPP_INVITE_TEMPLATE: z.string().default("screening_invite"),
  WHATSAPP_REMINDER_TEMPLATE: z.string().default("screening_reminder"),
  WHATSAPP_SENDS_PER_MINUTE: z.coerce.number().int().positive().default(60),

  STT_PROVIDER: z.enum(["mock"]).default("mock"),

  SCORER_PROVIDER: z.enum(["mock", "claude"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),

  PAYMENT_PROVIDER: z.enum(["mock", "razorpay"]).default("mock"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  MOCK_PAYMENT_SECRET: z.string().default("mock-payment-secret"),

  MAILER_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("ReplyHire <hello@example.com>"),

  PRICE_PER_JOB_INR: z.coerce.number().int().positive().default(1499),
  MAX_CANDIDATES_PER_JOB: z.coerce.number().int().positive().default(200),
  TEST_MODE_MAX_CANDIDATES: z.coerce.number().int().positive().default(5),
  RETENTION_DAYS: z.coerce.number().int().positive().default(90),

  CRON_SECRET: z.string().optional(),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  OPS_EMAILS: z.string().default(""),
  SUPPORT_EMAIL: z.string().default("support@example.com"),
});

export type Config = z.infer<typeof schema>;

/** On Vercel, default APP_URL to the production domain (or the preview URL on previews). */
function vercelUrl(): string | undefined {
  const e = process.env;
  const host = e.VERCEL_ENV === "production" ? (e.VERCEL_PROJECT_PRODUCTION_URL ?? e.VERCEL_URL) : e.VERCEL_URL;
  return host ? `https://${host}` : undefined;
}

let cached: Config | undefined;

export function config(): Config {
  if (!cached) {
    cached = schema.parse(process.env);
    if (cached.NODE_ENV === "production") assertProductionSafe(cached);
  }
  return cached;
}

/** Reset for tests that change env vars. */
export function resetConfig() {
  cached = undefined;
}

function assertProductionSafe(c: Config) {
  // Refuse to boot production with development defaults.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const problems: string[] = [];
  if (!c.DATABASE_URL) problems.push("DATABASE_URL is required in production");
  if (c.SESSION_SECRET === "dev-session-secret-change-me") problems.push("SESSION_SECRET must be set");
  if (/^0+$/.test(c.DATA_ENCRYPTION_KEY)) problems.push("DATA_ENCRYPTION_KEY must be set");
  if (problems.length) throw new Error(`Unsafe production config: ${problems.join("; ")}`);
}

export function isOpsEmail(email: string) {
  return config()
    .OPS_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
