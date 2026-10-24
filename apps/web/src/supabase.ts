import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// The project URL and publishable key are public by design: every row is protected by RLS, and the
// AI key lives only in the edge function. Env vars override them for other projects.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://syysftnaubbpolrmicvd.supabase.co";
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "sb_publishable_KjWDtqAbi7daxhIbs9X_BA_q0ftE35o";

export const configured = Boolean(url && anon);
export const supabase: SupabaseClient | null = configured
  ? createClient(url!, anon!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null;

export function useSession(): { session: Session | null; ready: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}
