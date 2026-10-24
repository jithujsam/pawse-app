import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";
import { toast } from "./ui/Toast";

/** Finishes sign-in when an email link opens the app (app.detoxcompanion://auth-callback?code=...). */
async function handle(link: string) {
  if (!supabase || !link.startsWith("app.detoxcompanion://auth-callback")) return;
  const u = new URL(link.replace("app.detoxcompanion://", "https://app/"));
  const params = new URLSearchParams(u.search || u.hash.slice(1));
  const err = params.get("error_description") ?? params.get("error");
  if (err) { toast(/expired|invalid/i.test(err) ? "That link has expired. Sign in, or ask for a new one." : err, { kind: "bad", ms: 5000 }); return; }
  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    toast(error ? "Couldn't finish signing in from that link. Try signing in with your password." : "Email confirmed. You're signed in.", { kind: error ? "bad" : "good", ms: 4000 });
    return;
  }
  // Older implicit-style links carry the tokens directly.
  const access_token = params.get("access_token"), refresh_token = params.get("refresh_token");
  if (access_token && refresh_token) await supabase.auth.setSession({ access_token, refresh_token });
}

export function listenForAuthLinks() {
  if (!Capacitor.isNativePlatform()) return;
  void App.getLaunchUrl().then((r) => { if (r?.url) void handle(r.url); });
  void App.addListener("appUrlOpen", ({ url }) => { void handle(url); });
}
