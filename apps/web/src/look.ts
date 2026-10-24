import { kv } from "./db";
import type { Settings } from "./types";

/** Applies the chosen theme and accent to the page, and remembers them for the lock screen. */
export function applyLook(theme: Settings["theme"] = "system", accent: Settings["accent"] = "pet") {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme; else root.dataset.theme = theme;
  if (accent === "pet") delete root.dataset.accent; else root.dataset.accent = accent;
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? "#0f1012" : "#f2f4f7"));
  void kv.set("look", { theme, accent }).catch(() => undefined);
}

/** Before the app has loaded its data (or while locked), use the last look we saw. */
export async function restoreLook() {
  const l = await kv.get<{ theme: Settings["theme"]; accent: Settings["accent"] }>("look").catch(() => undefined);
  if (l) applyLook(l.theme, l.accent);
}
