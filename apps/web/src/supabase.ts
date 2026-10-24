import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";

// The project URL and publishable key are public by design: every row is protected by RLS, and the
// AI key lives only in the edge function. Env vars override them for other projects.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://syysftnaubbpolrmicvd.supabase.co";
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "sb_publishable_KjWDtqAbi7daxhIbs9X_BA_q0ftE35o";

export const configured = Boolean(url && anon);
const native = Capacitor.isNativePlatform();

/** Where email links (confirm, reset password) send people. On the phone that is the app itself. */
export const AUTH_REDIRECT = native ? "app.detoxcompanion://auth-callback" : `${location.origin}${location.pathname}`;

// PKCE: the link carries a one-time code that only this install can exchange, because the verifier never leaves it.
export const supabase: SupabaseClient | null = configured
  ? createClient(url!, anon!, { auth: { persistSession: true, autoRefreshToken: true, flowType: "pkce", detectSessionInUrl: !native } })
  : null;

export function useSession(): { session: Session | null; ready: boolean; recovering: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => { setSession(s); if (e === "PASSWORD_RECOVERY") setRecovering(true); if (e === "SIGNED_OUT") setRecovering(false); });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready, recovering };
}
