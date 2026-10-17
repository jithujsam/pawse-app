"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) return { status: "error", message: "Enter a valid email address." };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) return { status: "error", message: error.message };
  return { status: "sent", message: `Check ${email.data} for a sign-in link.` };
}
