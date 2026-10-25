import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { toast } from "./ui/Toast";

/** The build's own version, from version.json (see vite.config.ts). */
export const APP_VERSION = { name: __APP_VERSION__, code: __APP_CODE__ };

/** Public download repo. latest.json there describes the newest Android build. */
export const RELEASES_PAGE = "https://github.com/jithujsam/pawse-releases";
const LATEST_URL = "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/latest.json";

export interface Latest { name: string; code: number; url: string; notes?: string; sha256?: string }

export async function checkForUpdate(): Promise<Latest | null> {
  try {
    const res = await fetch(`${LATEST_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as Partial<Latest>;
    const ok = typeof j.code === "number" && typeof j.name === "string" && typeof j.url === "string" && j.url.startsWith("https://");
    return ok && j.code! > APP_VERSION.code ? (j as Latest) : null;
  } catch {
    return null;
  }
}

/** Opens the download in the phone's browser, which hands the APK to the installer. */
export const openDownload = (url: string) => { window.location.href = url; };

interface UpdaterPlugin {
  download(o: { url: string; sha256: string }): Promise<void>;
  install(): Promise<void>;
  addListener(e: "progress", fn: (p: { percent: number }) => void): Promise<{ remove: () => Promise<void> }>;
}
const Updater = registerPlugin<UpdaterPlugin>("Updater");

export type InstallResult = "installing" | "permission" | "browser" | "failed" | "mismatch";

/** Only a 64-character hex digest can be checked; anything else sends people to the browser download instead. */
export const canInstallInApp = (l: Latest): boolean => Capacitor.getPlatform() === "android" && /^[0-9a-f]{64}$/i.test(l.sha256 ?? "");

/**
 * Downloads the APK inside the app, checks it against latest.json's SHA-256, then opens Android's installer.
 * "permission": Android's "install unknown apps" switch is off; its setting screen was opened, so call again after.
 */
export async function installUpdate(l: Latest, onProgress?: (percent: number) => void): Promise<InstallResult> {
  if (!canInstallInApp(l)) { openDownload(l.url); return "browser"; }
  const sub = await Updater.addListener("progress", (p) => onProgress?.(p.percent)).catch(() => null);
  try {
    await Updater.download({ url: l.url, sha256: l.sha256! });
    await Updater.install();
    return "installing";
  } catch (e) {
    const msg = (e as { message?: string }).message;
    return msg === "permission" ? "permission" : msg === "checksum" ? "mismatch" : "failed";
  } finally {
    void sub?.remove();
  }
}

/** Install with plain-language feedback. Returns true if Android's installer opened (or the browser took over). */
export async function runUpdate(l: Latest, onProgress?: (percent: number) => void): Promise<boolean> {
  const r = await installUpdate(l, onProgress);
  if (r === "permission") toast("Allow Pawse to install updates, then tap Update again", { ms: 8000 });
  else if (r === "mismatch") toast("The download didn't match its checksum, so it was discarded", { kind: "bad", ms: 8000 });
  else if (r === "failed") toast("The download didn't finish. Check your connection and try again", { kind: "bad" });
  return r === "installing" || r === "browser";
}

/** Checks once per launch on the phone app; the web app updates itself. */
export function useUpdate(): Latest | null {
  const [latest, setLatest] = useState<Latest | null>(null);
  useEffect(() => { if (Capacitor.isNativePlatform()) void checkForUpdate().then(setLatest); }, []);
  return latest;
}
