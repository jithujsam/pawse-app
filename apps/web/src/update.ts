import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { toast } from "./ui/Toast";
import { t } from "./text";
import { openExternal } from "./native";

/** The build's own version, from version.json (see vite.config.ts). */
export const APP_VERSION = { name: __APP_VERSION__, code: __APP_CODE__ };

/** Public download repo. latest.json there describes the newest Android build. */
export const RELEASES_PAGE = "https://github.com/jithujsam/pawse-releases";
const LATEST_URL = "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/latest.json";

/** One released version. `history` in latest.json holds the versions before the newest, newest first. */
export interface Version { name: string; code: number; notes?: string }
export interface Latest extends Version { url: string; sha256?: string; history?: Version[] }

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
  return { name: o.name, code: o.code, url: o.url, notes, sha256: o.sha256 as string | undefined, history: parseHistory(o.history) };
}

/** Older versions from latest.json. Bad entries are dropped one by one; a missing or broken list is just empty. */
function parseHistory(j: unknown): Version[] {
  if (!Array.isArray(j)) return [];
  return j.flatMap((x): Version[] => {
    if (!x || typeof x !== "object") return [];
    const v = x as Record<string, unknown>;
    if (typeof v.name !== "string" || !v.name.trim() || v.name.length > 20) return [];
    if (typeof v.code !== "number" || !Number.isInteger(v.code) || v.code < 1) return [];
    return [{ name: v.name, code: v.code, notes: typeof v.notes === "string" ? v.notes.slice(0, 600) : undefined }];
  }).slice(0, 10);
}

/** Every version newer than the installed one, newest first, so the popup can show all that are pending. */
export function pendingUpdates(l: Latest): Version[] {
  const all: Version[] = [{ name: l.name, code: l.code, notes: l.notes }, ...(l.history ?? [])];
  return all
    .filter((v, i) => v.code > APP_VERSION.code && all.findIndex((x) => x.code === v.code) === i)
    .sort((a, b) => b.code - a.code);
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

/** Opens the download in the phone's browser (an in-app Custom Tab on Android), which hands the APK to the installer. */
export const openDownload = (url: string) => { openExternal(url); };

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

/** Coming back to the app re-checks, but no more often than this. */
export const RECHECK_MS = 60 * 60 * 1000;
const PREFS_KEY = "pawse.update";

/** skipped: "Don't remind" for that version. later: the newest version the person chose Later on. */
export interface UpdatePrefs { skipped?: number; later?: number }
export const readPrefs = (): UpdatePrefs => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as UpdatePrefs; } catch { return {}; } };
const writePrefs = (p: UpdatePrefs) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private mode: the popup just shows again next launch */ } };

/** The launch popup shows once per new version: not after Later or Don't remind on it, and again only when a newer one arrives. */
export function shouldPrompt(l: Latest, prefs: UpdatePrefs): boolean {
  return prefs.skipped !== l.code && (prefs.later ?? 0) < l.code;
}

// One shared result, so the popup, the Home banner and the navbar dot agree and a track switch never re-fetches.
let shared: Latest | null = null;
let checkedAt = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

// Popup state lives here too, so Settings can open the same popup the launch check opens.
let forceOpen = false;
let dismissed = false;

// A failed check is retried a few times, so a cold start before the network is up doesn't miss the update.
const RETRY_MS = 30 * 1000;
const RETRY_LIMIT = 5;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

async function refresh(force = false): Promise<UpdateCheck> {
  if (!force && Date.now() - checkedAt < RECHECK_MS) return shared ? { status: "available", latest: shared } : { status: "latest" };
  const r = await checkUpdate();
  if (r.status === "error") {
    if (failures < RETRY_LIMIT) { failures++; clearTimeout(retryTimer); retryTimer = setTimeout(() => void refresh(true), RETRY_MS); }
    return r;
  }
  failures = 0;
  checkedAt = Date.now();
  shared = r.status === "available" ? r.latest : null;
  emit();
  return r;
}

/** Settings → Check for updates. Opens the same popup as launch, even after Later or Don't remind, because the person asked. */
export async function checkNow(): Promise<UpdateCheck> {
  const r = await refresh(true);
  if (r.status === "available") showUpdate();
  return r;
}

/** Opens the update popup now, whatever Later or Don't remind said. */
export function showUpdate() {
  forceOpen = true;
  dismissed = false;
  emit();
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

const closePrompt = () => { forceOpen = false; dismissed = true; emit(); };

/** Drives the popup: `latest` is set only while it should be showing (launch rules, or a Settings check). */
export function useUpdatePrompt() {
  const found = useShared();
  const open = !!found && !dismissed && (forceOpen || shouldPrompt(found, readPrefs()));
  return {
    latest: open ? found : null,
    later: () => { if (found) writePrefs({ ...readPrefs(), later: found.code }); closePrompt(); },
    skip: () => { if (found) writePrefs({ ...readPrefs(), skipped: found.code }); closePrompt(); },
    close: closePrompt,
  };
}

/** The newest version while it's still wanted: drives the navbar dot and the About badge. A skipped version gets neither. */
export function useUpdatePending(): Latest | null {
  const found = useShared();
  return found && readPrefs().skipped !== found.code ? found : null;
}
