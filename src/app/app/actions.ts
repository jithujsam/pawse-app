"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type CreateWorkspaceState = { error?: string };

const workspaceSchema = z.object({
  name: z.string().trim().min(1, "Enter a workspace name.").max(120),
  country: z.enum(["US", "GB"]),
});

export async function createWorkspace(_prev: CreateWorkspaceState, formData: FormData): Promise<CreateWorkspaceState> {
  const parsed = workspaceSchema.safeParse({ name: formData.get("name"), country: formData.get("country") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_workspace", { ws_name: parsed.data.name, ws_country: parsed.data.country });
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  redirect("/app/upload");
}
