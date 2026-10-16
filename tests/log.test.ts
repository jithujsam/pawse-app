import { describe, expect, it } from "vitest";
import { redact } from "@/lib/log";

describe("redact", () => {
  it("removes PII keys and phone numbers/emails inside strings", () => {
    expect(
      redact({ phone: "+919876543210", name: "Asha", jobId: "j1", note: "call +91 98765 43210 or a@b.co", nested: { body: "hi" } }),
    ).toEqual({ phone: "[redacted]", name: "[redacted]", jobId: "j1", note: "call [phone] or [email]", nested: { body: "[redacted]" } });
  });
});
