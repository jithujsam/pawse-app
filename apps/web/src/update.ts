import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { toast } from "./ui/Toast";
import { t } from "./text";

/** The build's own version, from version.json (see vite.config.ts). */
export const APP_VERSION = { name: __APP_VERSION__, code: __APP_CODE__ };

/** Public download repo. latest.json there describes the newest Android build. */
export const RELEASES_PAGE = "https://github.com/jithujsam/pawse-releases";
const LATEST_URL = "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/latest.json";

export interface Latest { name: string; code: number; url: string; notes?: string; sha256?: string }

const RELEASE_HOST = "https://raw.githubusercontent.com/jithujsam/pawse-releases/";

/** Reads latest.json strictly: anything malformed is treated as no usable update, never trusted. */
export function parseLatest(j: unknown): Latest | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name.trim() || o.name.length > 20) return null;
  if (typeof o.code !== "number" || !Number.isInteger(o.code) || o.code < 1) return null;
  if (typeof o.url !== "string" || !o.url.startsWith(RELEASE_HOST)) return null;
  if (o.sha256 !== undefined && (typeof o.sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(o.sha256))) return null;
  const notes = typeof o.notes === "string" ? o.notes.slice(0, 600) : undefined;
  return { name: o.name, code: o.code, url: o.url, notes, sha256: o.sha256 as string | undefined };
}

/** "error" means we couldn't tell (offline, GitHub down, bad file), which is not the same as "up to date". */
export type UpdateCheck = { status: "available"; latest: Latest } | { status: "latest" } | { status: "error" };

export async function checkUpdate(): Promise<UpdateCheck> {
  try {
    const res = await fetch(`${LATEST_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { status: "error" };
    const latest = parseLatest(await res.json());
    if (!latest) return { status: "error" };
    return latest.code > APP_VERSION.code ? { status: "available", latest } : { status: "latest" };
  } catch {
    return { status: "error" };
  }
}

/** Opens the download in the phone's browser, which hands the APK to the installer. */
export const openDownload = (url: string) => { window.location.href = url; };

interface UpdaterPlugin {
  download(o: { url: string; sha256: string }): Promise<void>;
  install(o: { sha256: string }): Promise<void>;
  addListener(e: "progress", fn: (p: { percent: number }) => void): Promise<{ remove: () => Promise<void> }>;
}
const Updater = registerPlugin<UpdaterPlugin>("Updater");

export type InstallResult = "installing" | "permission" | "browser" | "failed" | "mismatch";

/** Only a 64-character hex digest can be checked; anything else sends people to the browser download instead. */
export const canInstallInApp = (l: Latest): boolean => Capacitor.getPlatform() === "android" && /^[0-9a-f]{64}$/i.test(l.sha256 ?? "");

/**
 * Downloads the APK inside the app (or reuses the copy already downloaded for this exact checksum), checks it against latest.json's SHA-256, then opens Android's installer.
 * "permission": Android's "install unknown apps" switch is off; its setting screen was opened, so call again after.
 */
export async function installUpdate(l: Latest, onProgress?: (percent: number) => void): Promise<InstallResult> {
  if (!canInstallInApp(l)) { openDownload(l.url); return "browser"; }
  const sub = await Updater.addListener("progress", (p) => onProgress?.(p.percent)).catch(() => null);
  try {
    await Updater.download({ url: l.url, sha256: l.sha256! });
    await Updater.install({ sha256: l.sha256! });
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
  if (r === "permission") toast(t("update.toasts.permission"), { ms: 8000 });
  else if (r === "mismatch") toast(t("update.toasts.mismatch"), { kind: "bad", ms: 8000 });
  else if (r === "failed") toast(t("update.toasts.failed"), { kind: "bad" });
  return r === "installing" || r === "browser";
}

/** The popup shows again after this long if the person chose Later. */
export const SNOOZE_MS = 24 * 60 * 60 * 1000;
/** Coming back to the app re-checks, but no more often than this. */
export const RECHECK_MS = 60 * 60 * 1000;
const PREFS_KEY = "pawse.update";

export interface UpdatePrefs { skipped?: number; snoozeUntil?: number }
export const readPrefs = (): UpdatePrefs => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as UpdatePrefs; } catch { return {}; } };
const writePrefs = (p: UpdatePrefs) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private mode: the popup just shows again next launch */ } };

/** The popup is for a version the person hasn't skipped and hasn't snoozed. The Home banner ignores both. */
export function shouldPrompt(l: Latest, prefs: UpdatePrefs, now: number): boolean {
  return prefs.skipped !== l.code && (prefs.snoozeUntil ?? 0) <= now;
}

// One shared result, so the popup and the Home banner agree and a track switch never re-fetches.
let shared: Latest | null = null;
let checkedAt = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

async function refresh(force = false): Promise<UpdateCheck> {
  if (!force && Date.now() - checkedAt < RECHECK_MS) return shared ? { status: "available", latest: shared } : { status: "latest" };
  const r = await checkUpdate();
  if (r.status !== "error") { checkedAt = Date.now(); shared = r.status === "available" ? r.latest : null; emit(); }
  return r;
}

function useShared(): Latest | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    if (!Capacitor.isNativePlatform()) return () => { subs.delete(f); };
    void refresh();
    const onVis = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { subs.delete(f); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  return shared;
}

/** The newest version, for the Home banner. Phone app only; the web app updates itself. */
export const useUpdate = (): Latest | null => useShared();

/** Drives the launch popup: `latest` is set only while the popup should be showing. */
export function useUpdatePrompt() {
  const found = useShared();
  const [hidden, setHidden] = useState(false);
  const open = !!found && !hidden && shouldPrompt(found, readPrefs(), Date.now());
  return {
    latest: open ? found : null,
    later: () => { writePrefs({ ...readPrefs(), snoozeUntil: Date.now() + SNOOZE_MS }); setHidden(true); },
    skip: () => { if (found) writePrefs({ ...readPrefs(), skipped: found.code }); setHidden(true); },
    close: () => setHidden(true),
  };
}
