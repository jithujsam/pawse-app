"use server";

import { requestMagicLink } from "@/lib/auth/magic-link";
import { clientIp, hit } from "@/lib/ratelimit";

export type LinkState = null | { ok: true; devLink?: string } | { ok: false; error: string };

export async function requestLinkAction(_prev: LinkState, form: FormData): Promise<LinkState> {
  if (!hit(`login:${await clientIp()}`, 10, 15 * 60_000)) {
    return { ok: false, error: "Too many attempts. Try again in a few minutes." };
  }
  return requestMagicLink(String(form.get("email") ?? ""));
}
