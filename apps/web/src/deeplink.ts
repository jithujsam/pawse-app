import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { friendlyAuthError } from "./authErrors";
import { recoveryActive, supabase } from "./supabase";
import { t } from "./text";
import { toast } from "./ui/Toast";
import { OPEN_QUICK } from "./widget";

/** Finishes sign-in when an email link opens the app (app.detoxcompanion://auth-callback?code=...). */
async function handle(link: string) {
  if (link.startsWith("app.detoxcompanion://open/quick")) { window.dispatchEvent(new Event(OPEN_QUICK)); return; }
  if (!supabase || !link.startsWith("app.detoxcompanion://auth-callback")) return;
  const u = new URL(link.replace("app.detoxcompanion://", "https://app/"));
  const params = new URLSearchParams(u.search || u.hash.slice(1));
  const err = params.get("error_description") ?? params.get("error");
  // Never show the server's own words: known cases get advice, everything else the one safe fallback.
  if (err) { toast(friendlyAuthError(err), { kind: "bad", ms: 5000 }); return; }
  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // A reset link signs the person in and opens the new-password screen, so it doesn't say "email confirmed".
    toast(error ? t("account.form.link_failed") : recoveryActive() ? t("account.form.link_reset") : t("account.form.link_confirmed"), { kind: error ? "bad" : "good", ms: 4000 });
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
