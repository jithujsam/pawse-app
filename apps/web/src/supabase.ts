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

/**
 * The sign-in this phone saved last time, read straight from storage. When the app opens, the access token is often
 * out of date and must be refreshed over the network. If that is slow or the phone is offline, `getSession()` answers
 * "no session" even though the person is still signed in. Without this, the login screen flashed before the home screen.
 */
export function savedSession(): Session | null {
  try {
    const key = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session> | null;
    return s && typeof s.access_token === "string" && typeof s.refresh_token === "string" && s.user?.id ? (s as Session) : null;
  } catch { return null; }
}

// A password-reset link can finish before the first screen has mounted (a cold start from the link). The event is
// caught here, at load, and kept until the new-password screen has been shown, so it can't be missed.
let recoveryPending = false;
supabase?.auth.onAuthStateChange((e) => {
  if (e === "PASSWORD_RECOVERY") recoveryPending = true;
  if (e === "SIGNED_OUT") recoveryPending = false;
});

/** True while a reset link has been accepted and the new-password screen hasn't been shown and finished yet. */
export const recoveryActive = () => recoveryPending;
export const endRecovery = () => { recoveryPending = false; };

export function useSession(): { session: Session | null; ready: boolean; recovering: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [recovering, setRecovering] = useState(recoveryPending);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    if (recoveryPending) setRecovering(true);
    supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      // No session but a saved sign-in: the refresh is slow or failed. Stay signed in; if the account really rejects
      // it, the client signs out and the event below sends the person to the login screen.
      setSession(data.session ?? savedSession());
      setReady(true);
    }).catch(() => { if (live) { setSession(savedSession()); setReady(true); } });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY") setRecovering(true);
      if (e === "SIGNED_OUT") setRecovering(false);
      if (s) setSession(s);
      else if (e === "SIGNED_OUT" || !savedSession()) setSession(null);
    });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  return { session, ready, recovering };
}
