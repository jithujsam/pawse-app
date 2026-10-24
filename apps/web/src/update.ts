import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

/** The build's own version, from version.json (see vite.config.ts). */
export const APP_VERSION = { name: __APP_VERSION__, code: __APP_CODE__ };

/** Public download repo. latest.json there describes the newest Android build. */
export const RELEASES_PAGE = "https://github.com/jithujsam/pawse-releases";
const LATEST_URL = "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/latest.json";

export interface Latest { name: string; code: number; url: string; notes?: string }

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

/** Checks once per launch on the phone app; the web app updates itself. */
export function useUpdate(): Latest | null {
  const [latest, setLatest] = useState<Latest | null>(null);
  useEffect(() => { if (Capacitor.isNativePlatform()) void checkForUpdate().then(setLatest); }, []);
  return latest;
}
