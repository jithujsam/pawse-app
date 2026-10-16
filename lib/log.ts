// Structured JSON logger that strips PII before anything is written.
// Never log message bodies, names or phone numbers: pass ids instead.

type Level = "debug" | "info" | "warn" | "error";

const PII_KEYS = /^(phone|phone_e164|name|body|text|transcript|email|token|answer|message)$/i;
const PHONE_RE = /\+?\d[\d\s-]{8,}\d/g;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[depth]";
  if (typeof value === "string") {
    return value.replace(PHONE_RE, "[phone]").replace(EMAIL_RE, "[email]");
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redact(value.message) };
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = PII_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test" && level !== "error" && !process.env.LOG_IN_TESTS) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, f?: Record<string, unknown>) => write("debug", msg, f),
  info: (msg: string, f?: Record<string, unknown>) => write("info", msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => write("warn", msg, f),
  error: (msg: string, f?: Record<string, unknown>) => write("error", msg, f),
};

/** Single place to report errors. Wire an error tracker (e.g. Sentry) in here. */
export function captureError(err: unknown, context?: Record<string, unknown>) {
  log.error("error", { err, ...context });
}
