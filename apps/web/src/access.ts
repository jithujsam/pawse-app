import { useSyncExternalStore } from "react";
import { ServerAccess } from "@detox/schema";
import { kv } from "./db";
import { supabase } from "./supabase";
import { withTimeout } from "./net";
import { setTrackLimit, setWriteGate } from "./store";

/**
 * Membership on this phone: the one place the app asks "may this person use the app, or AI, right now?".
 *
 * The server decides (public.my_access, migration 0014) and enforces everything that costs money (the AI function).
 * This module only mirrors that answer so the app can show the paywall and stop new records once access has ended.
 * It never deletes, hides or changes recovery data, and it never touches sync: rows logged earlier keep backing up
 * whatever the membership says.
 *
 * Offline: the last answer the server gave is kept on this phone for its account, and trusted for OFFLINE_GRACE_MS
 * after it was fetched, never past the end of the trial or plan it describes. A phone that has never had an answer,
 * and can't reach the server, can't be let in and isn't shut out: it shows "can't check" with Retry, Export and Account.
 */

/** How long an answer from the server is trusted without hearing from it again. */
export const OFFLINE_GRACE_MS = 7 * 24 * 3600_000;
/** How often the answer is refreshed while the app is open and in view. */
export const REFRESH_MS = 30 * 60_000;
/** Coming back to the app re-checks, but not more than this often. */
const FOREGROUND_MIN_MS = 60_000;
const NET_MS = 10_000;

export interface CachedAccess {
  uid: string;
  access: ServerAccess;
  /** This phone's clock when the server answered. */
  checkedAt: number;
  /** Server time minus this phone's time at that moment, so a phone clock that is off doesn't move an end date. */
  skew: number;
}

/** Why the last check failed: the server lacks membership (pre-0014), the network or session failed, or the answer was malformed. */
export type CheckError = "missing" | "network" | "invalid";

export type Gate =
  /** Signed out, or membership isn't switched on on this server (migration 0014 not applied). Nothing is gated. */
  | { kind: "off" }
  /** Signed in and waiting for the first answer, with nothing cached. */
  | { kind: "loading" }
  /** No answer cached and the server can't be reached: can't let in, can't shut out. */
  | { kind: "unverifiable" }
  | { kind: "open"; access: ServerAccess; stale: boolean; until: number | null }
  | { kind: "locked"; reason: "expired" | "refunded" | "revoked" | "none" | "unconfirmed"; access: ServerAccess };

/**
 * The gate from what is known. Pure: the tests drive it with any clock.
 * `now` is this phone's clock. A clock moved back can't stretch the grace period: time is never earlier than the check.
 */
export function decide(cached: CachedAccess | null, uid: string | null, now: number, lastError: CheckError | null): Gate {
  if (!uid) return { kind: "off" };
  const c = cached && cached.uid === uid ? cached : null;
  if (!c) {
    if (lastError === "missing") return { kind: "off" };
    if (lastError) return { kind: "unverifiable" };
    return { kind: "loading" };
  }
  const a = c.access;
  if (!a.app) return { kind: "locked", reason: a.state === "refunded" || a.state === "revoked" || a.state === "none" ? a.state : "expired", access: a };
  const t = Math.max(now, c.checkedAt);
  const serverNow = t + c.skew;
  const end = a.valid_until ? Date.parse(a.valid_until) : null;
  if (end !== null && serverNow >= end) return { kind: "locked", reason: "expired", access: { ...a, app: false, ai: false } };
  if (t - c.checkedAt > OFFLINE_GRACE_MS) return { kind: "locked", reason: "unconfirmed", access: a };
  return { kind: "open", access: a, stale: lastError !== null, until: end };
}

/** Features that membership decides. New paid features join this list, and every screen asks through `allows`. */
export type Feature =
  /** Normal use: check-ins, slips, urges, plans, journal, edits. */
  | "app"
  /** New AI requests. The AI function enforces this on the server whatever the app thinks. */
  | "ai"
  /** Opening a recovery track beyond the plan's allowance (one during the trial). */
  | "new_track";

/** Whether the gate allows a feature. `tracks` is how many recovery tracks exist now (for "new_track"). */
export function allows(gate: Gate, feature: Feature, tracks = 0): boolean {
  if (gate.kind === "off") return true; // nothing to enforce: the server isn't running membership
  if (feature === "ai") return gate.kind === "open" ? gate.access.ai : gate.kind === "loading" || gate.kind === "unverifiable"; // the server decides
  if (gate.kind !== "open") return false;
  if (feature === "new_track") return tracks < gate.access.tracks;
  return true;
}

/** The number of tracks the plan allows; 50 (the app's own limit) when membership isn't deciding. */
export const trackAllowance = (gate: Gate): number => (gate.kind === "open" ? gate.access.tracks : gate.kind === "off" ? 50 : 0);

// ---------- live state ----------

let uid: string | null = null;
let cached: CachedAccess | null = null;
let lastError: CheckError | null = null;
let gate: Gate = { kind: "off" };
let lastCheck = 0;
let checking: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
/** Bumped on every start and stop, so an answer for an account that has since signed out is dropped. */
let generation = 0;
const watchers = new Set<() => void>();
const cacheKey = (u: string) => `access:${u}`;

function publish() {
  gate = decide(cached, uid, Date.now(), lastError);
  watchers.forEach((w) => w());
}

export const getGate = () => gate;
export const useGate = () => useSyncExternalStore((cb) => { watchers.add(cb); return () => watchers.delete(cb); }, () => gate, () => gate);
export const can = (feature: Feature, tracks = 0) => allows(gate, feature, tracks);

// The store asks before every change made on this phone, so a closed paywall can't be stepped around by a screen
// that forgot to check. Rows from the account and erases are never stopped. Reads never are.
setWriteGate(() => allows(gate, "app"));
setTrackLimit(() => trackAllowance(gate));

const isMissing = (e: { code?: string; message?: string }) => e.code === "PGRST202" || /could not find the function|does not exist|schema cache/i.test(e.message ?? "");

/** Asks the server. Keeps the last good answer if it can't. */
export function refreshAccess(): Promise<void> {
  if (!supabase || !uid) return Promise.resolve();
  if (checking) return checking;
  const gen = generation;
  const forUid = uid;
  checking = (async () => {
    try {
      const { data, error } = await withTimeout(Promise.resolve(supabase!.rpc("my_access")), NET_MS);
      if (gen !== generation) return;
      if (error) { lastError = isMissing(error) ? "missing" : "network"; return; }
      const parsed = ServerAccess.safeParse(data);
      if (!parsed.success) { lastError = "invalid"; return; }
      const now = Date.now();
      cached = { uid: forUid, access: parsed.data, checkedAt: now, skew: Date.parse(parsed.data.server_time) - now };
      lastError = null;
      await kv.set(cacheKey(forUid), cached).catch(() => undefined);
    } catch {
      if (gen === generation) lastError = "network";
    } finally {
      if (gen === generation) { lastCheck = Date.now(); checking = null; publish(); }
    }
  })();
  return checking;
}

/** Starts membership for a signed-in account: this phone's last answer for it first, then the server's. */
export async function startAccess(forUid: string): Promise<void> {
  if (uid === forUid && timer) return;
  stopAccess();
  const gen = generation;
  uid = forUid;
  publish();
  const saved = await kv.get<CachedAccess>(cacheKey(forUid)).catch(() => undefined);
  if (gen !== generation) return;
  cached = saved && saved.uid === forUid && ServerAccess.safeParse(saved.access).success ? saved : null;
  publish();
  timer = setInterval(() => { if (typeof document === "undefined" || document.visibilityState === "visible") void refreshAccess(); }, REFRESH_MS);
  await refreshAccess();
}

/** Signed out or switched account: forget this account's answer in memory. The phone's copy goes with the wipe on sign-out. */
export function stopAccess() {
  generation++;
  clearInterval(timer); timer = undefined;
  uid = null; cached = null; lastError = null; checking = null; lastCheck = 0;
  publish();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { if (uid) void refreshAccess(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !uid) return;
    // The clock moves on while the app is closed: an end date may have passed. Then ask the server, at most once a minute.
    publish();
    if (Date.now() - lastCheck > FOREGROUND_MIN_MS) void refreshAccess();
  });
  // An open app passes an end date without any event: look again every minute (local only, no network).
  setInterval(() => { if (uid) publish(); }, 60_000);
}
