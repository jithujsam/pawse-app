import { z } from "zod";

/**
 * The server's answer to "what may this account do right now" (public.my_access, migration 0013). The app checks the
 * shape before it trusts any of it; anything malformed counts as no answer. The server stays the authority: this is
 * what the app shows and how it gates its own screens, while the server enforces everything that costs money.
 */
const when = z.string().datetime({ offset: true }).nullable();
export const ACCESS_STATES = ["trial", "basic", "ai", "expired", "refunded", "revoked", "none"] as const;
export const ServerAccess = z.object({
  state: z.enum(ACCESS_STATES),
  app: z.boolean(),
  ai: z.boolean(),
  email_verified: z.boolean(),
  tracks: z.number().int().min(0).max(50),
  valid_until: when,
  trial_ends_at: when,
  plan: z.enum(["basic", "ai"]).nullable(),
  plan_status: z.enum(["active", "expired", "refunded", "revoked"]).nullable(),
  period_end: when,
  server_time: z.string().datetime({ offset: true }),
}).refine((a) => !a.ai || a.app, "AI access always comes with app access")
  .refine((a) => a.app === (a.state === "trial" || a.state === "basic" || a.state === "ai"), "app access matches the state")
  .refine((a) => !a.ai || a.state === "trial" || a.state === "ai", "only the trial and the AI plan include AI");
export type ServerAccess = z.infer<typeof ServerAccess>;
