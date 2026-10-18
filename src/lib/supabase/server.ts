import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** A Supabase client acting as the signed-in user. Create one per request. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

export type Workspace = { id: string; name: string; country: "US" | "GB"; role: "owner" | "editor" | "viewer" };

/** The signed-in user and their workspace (null until onboarding). Redirects to /login when signed out. */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, workspaces (id, name, country)")
    .eq("user_id", data.user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const ws = membership?.workspaces as unknown as Omit<Workspace, "role"> | null;
  const workspace: Workspace | null = ws ? { ...ws, role: membership!.role as Workspace["role"] } : null;
  return { supabase, user: data.user, workspace };
}
