import { kv } from "./db";
import type { Settings } from "./types";
import { setBarStyle } from "./native";

let last: { theme: Settings["theme"]; accent: Settings["accent"] } | null = null;
// With the system theme, the phone switching between light and dark while the app is open re-applies the look.
if (typeof matchMedia !== "undefined") matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (last?.theme === "system") applyLook(last.theme, last.accent); });

/** Applies the chosen theme and accent to the page, and remembers them for the lock screen. */
export function applyLook(theme: Settings["theme"] = "system", accent: Settings["accent"] = "pet") {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme; else root.dataset.theme = theme;
  if (accent === "pet") delete root.dataset.accent; else root.dataset.accent = accent;
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  // The status bar follows the page's own ground colour: pure black in dark mode, so AMOLED pixels stay off.
  const fallback = dark ? "#000000" : "#faf7f2";
  const paint = () => document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", groundHex() ?? fallback));
  paint();
  requestAnimationFrame(paint);
  setBarStyle(dark);
  last = { theme, accent };
  void kv.set("look", { theme, accent }).catch(() => undefined);
}

/** Before the app has loaded its data (or while locked), use the last look we saw. */
export async function restoreLook() {
  const l = await kv.get<{ theme: Settings["theme"]; accent: Settings["accent"] }>("look").catch(() => undefined);
  if (l) applyLook(l.theme, l.accent);
}

/** The resolved --ground colour as #rrggbb. */
const groundHex = () => hex(getComputedStyle(document.body).backgroundColor);

/** Any CSS colour as #rrggbb, read back through a canvas so any colour syntax works. */
function hex(colour: string): string | null {
  try {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!ctx || !colour.trim()) return null;
    ctx.fillStyle = "#000";
    ctx.fillStyle = colour.trim();
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a ? `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}` : null;
  } catch { return null; }
}
