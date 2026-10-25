import { useSyncExternalStore } from "react";
import { kv } from "./db";
import { actions, getData, onCommit } from "./store";
import { supabase } from "./supabase";
import { adoptAccount, diff, indexRows, merge, OPTIONAL_TABLES, PUSH_ORDER, slipBeatsClean, tombstone, toRemote, TRACK_COLUMNS, type Pulled, type Table } from "./syncmap";

/**
 * Offline-first sync. Every local change is recorded as a pending key; pushes are batched upserts in
 * parent-first order; pulls fetch rows changed since the last cursor. Works the same after days offline.
 */

const CONFLICT: Record<Table, string> = {
  profiles: "id", companions: "id", habits: "id", entries: "id", deductions: "entry_id",
  clean_days: "habit_id,day", weekly_reports: "habit_id,week_start", urges: "id", journal: "user_id,day",
};
/** v2 tables the server turned out not to have yet; retried after a restart. */
const missing = new Set<Table>();
const isMissingTable = (msg: string) => /does not exist|could not find the table|schema cache/i.test(msg);
const OVERLAP_MS = 5000;

interface Meta { cursor: Partial<Record<Table, string>>; pending: Record<string, number>; removed: Record<string, number> }
const emptyMeta = (): Meta => ({ cursor: {}, pending: {}, removed: {} });

export type SyncState = "off" | "idle" | "syncing" | "offline" | "error";
let status: { state: SyncState; last: number | null; pending: number } = { state: "off", last: null, pending: 0 };
const watchers = new Set<() => void>();
const setStatus = (p: Partial<typeof status>) => { status = { ...status, ...p }; watchers.forEach((w) => w()); if (typeof window !== "undefined") (window as unknown as { __companionSync: unknown }).__companionSync = status; };
export const getSyncStatus = () => status;
export const useSyncStatus = () => useSyncExternalStore((cb) => { watchers.add(cb); return () => watchers.delete(cb); }, () => status);

let userId: string | null = null;
let meta: Meta = emptyMeta();
let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let failures = 0;
/**
 * Bumped whenever this phone's sync state is thrown away (sign-out, or the phone's copy being wiped).
 * A cycle that started before the bump stops at its next step, so it can't write old cursors into the
 * fresh state or apply the account's rows onto a phone that was just wiped or signed out.
 */
let generation = 0;
/** What this phone last pushed, so its own rows coming back are not re-applied. */
const echo = new Map<string, number>();

const metaKey = (uid: string) => `sync:${uid}`;
const saveMeta = () => { if (userId) void kv.set(metaKey(userId), meta).catch(() => undefined); setStatus({ pending: Object.keys(meta.pending).length + Object.keys(meta.removed).length }); };

onCommit((prev, next, source) => {
  if (!userId) return;
  if (source === "reset") {
    // The phone's copy was wiped, not the account's. Forget what was pending and where the pulls were,
    // so the next sync is a first sync that restores the account instead of deleting it.
    meta = emptyMeta(); echo.clear(); generation++;
    // Until the restore lands, the app shows "checking your account" rather than a fresh onboarding.
    setStatus({ last: null });
    saveMeta();
    // A cycle in flight stops at its next step (stale generation); then the loop runs a fresh first sync.
    if (running) again = true; else schedule(0);
    return;
  }
  if (source !== "local") return;
  const t = Date.now();
  const { changed, removed } = diff(prev, next);
  if (!changed.length && !removed.length) return;
  for (const k of changed) { meta.pending[k] = t; delete meta.removed[k]; }
  for (const k of removed) { delete meta.pending[k]; if (tombstone(k)) meta.removed[k] = t; }
  saveMeta();
  schedule(1500);
});

function schedule(ms: number) {
  clearTimeout(timer);
  timer = setTimeout(() => { void syncNow(); }, ms);
}

export async function startSync(uid: string): Promise<void> {
  if (!supabase) return;
  if (userId === uid && status.state !== "off") return;
  userId = uid;
  meta = { ...emptyMeta(), ...((await kv.get<Meta>(metaKey(uid)).catch(() => undefined)) ?? {}) };
  setStatus({ state: "idle" });
  await syncNow();
}

export function stopSync() {
  generation++;
  userId = null; clearTimeout(timer); echo.clear();
  setStatus({ state: "off", pending: 0 });
}

/** Forgets this phone's sync position, used when the person signs out and wipes the phone. */
export async function forgetSync(uid: string) { await kv.del(metaKey(uid)).catch(() => undefined); }

export function syncNow(): Promise<void> {
  if (!supabase || !userId) return Promise.resolve();
  // No network: say so straight away instead of waiting on requests that can't succeed.
  if (typeof navigator !== "undefined" && navigator.onLine === false) { setStatus({ state: "offline" }); return Promise.resolve(); }
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      do { again = false; await cycle(userId!); } while (again && userId);
      failures = 0;
      // Signed out mid-cycle: stay "off" rather than reporting a backup that belongs to nobody.
      if (userId) setStatus({ state: "idle", last: Date.now() });
    } catch (e) {
      failures++;
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setStatus({ state: offline ? "offline" : "error" });
      if (!offline) schedule(Math.min(300_000, 5000 * 3 ** (failures - 1)));
      if (import.meta.env.DEV) console.warn("sync failed", e instanceof Error ? e.message : e);
    } finally { running = null; }
  })();
  setStatus({ state: "syncing" });
  return running;
}

async function pullTable(table: Table, uid: string): Promise<Record<string, unknown>[]> {
  const since = meta.cursor[table];
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase!.from(table).select("*").order("updated_at", { ascending: true }).range(from, from + 999);
    q = table === "profiles" ? q.eq("id", uid) : q.eq("user_id", uid);
    if (since) q = q.gt("updated_at", new Date(new Date(since).getTime() - OVERLAP_MS).toISOString());
    const { data, error } = await q;
    if (error && OPTIONAL_TABLES.includes(table) && isMissingTable(error.message)) { missing.add(table); return []; }
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function cycle(uid: string) {
  const gen = generation;
  const stale = () => gen !== generation;
  const first = Object.keys(meta.cursor).length === 0;

  // 1. pull
  const pulled = {} as Pulled;
  // All tables at once: one round trip instead of seven.
  const rows = await Promise.all(PUSH_ORDER.map((t) => (missing.has(t) ? Promise.resolve([]) : pullTable(t, uid))));
  if (stale()) return;
  PUSH_ORDER.forEach((t, i) => { pulled[t] = rows[i]; });
  const seen: Partial<Record<Table, string>> = {};
  for (const t of PUSH_ORDER) for (const r of pulled[t] ?? []) if (!seen[t] || String(r.updated_at) > seen[t]!) seen[t] = String(r.updated_at);
  const drop = (rows: Record<string, unknown>[], key: (r: Record<string, unknown>) => string) =>
    rows.filter((r) => echo.get(key(r)) !== Number(r.client_updated_at));
  pulled.companions = drop(pulled.companions, (r) => `c:${r.id}`);
  pulled.habits = drop(pulled.habits, (r) => `h:${r.id}`);
  pulled.entries = drop(pulled.entries, (r) => `e:${r.id}`);
  pulled.clean_days = drop(pulled.clean_days, (r) => `k:${r.habit_id}:${r.day}`);
  pulled.deductions = drop(pulled.deductions, (r) => `e:${r.entry_id}`);
  pulled.profiles = drop(pulled.profiles, () => "s");
  pulled.weekly_reports = drop(pulled.weekly_reports, (r) => `w:${r.habit_id}:${r.week_start}`);
  pulled.urges = drop(pulled.urges ?? [], (r) => `u:${r.id}`);
  pulled.journal = drop(pulled.journal ?? [], (r) => `j:${r.day}`);

  let local = getData();
  if (first) {
    // A phone joining an account that already has a companion: the account's companion stays, and anything
    // logged here first moves onto it (syncmap.adoptAccount). An empty account just receives this phone's data.
    const adopted = adoptAccount(local, pulled);
    const t = Date.now();
    if (adopted) {
      local = adopted.data;
      meta.pending = {}; meta.removed = {};
      for (const k of adopted.push) meta.pending[k] = t;
    } else {
      for (const k of indexRows(local).keys()) meta.pending[k] ??= t;
    }
  }
  const { data: mergedRows, applied } = merge(local, pulled, meta.pending);
  for (const k of applied) delete meta.pending[k];
  // A slip and a clean mark on the same day (from two phones): the slip wins, and the clean mark is removed everywhere.
  const { data: merged, removed: overruled } = slipBeatsClean(mergedRows);
  if (overruled.length) { const t = Date.now(); for (const k of overruled) { delete meta.pending[k]; meta.removed[k] = t; } }
  if (merged !== getData() && (applied.length || overruled.length || local !== getData())) actions.applyRemote(merged);

  for (const t of PUSH_ORDER) if (seen[t]) meta.cursor[t] = seen[t];
  if (first) for (const t of PUSH_ORDER) meta.cursor[t] ??= new Date(0).toISOString();
  saveMeta();

  // 2. push deletions
  for (const [k, t] of Object.entries(meta.removed)) {
    const ts = tombstone(k);
    if (!ts) { delete meta.removed[k]; continue; }
    if (missing.has(ts.table)) continue;
    let q = supabase!.from(ts.table).update({ deleted_at: new Date(t).toISOString(), client_updated_at: t });
    for (const [col, v] of Object.entries(ts.match)) q = q.eq(col, v);
    const { error } = await q;
    if (stale()) return;
    if (error) throw new Error(`delete ${k}: ${error.message}`);
    if (meta.removed[k] === t) delete meta.removed[k];
    echo.set(k, t);
  }

  // 3. push changes, parents first
  const snapshot = { ...meta.pending };
  const data = getData();
  const byTable = new Map<Table, Record<string, unknown>[]>();
  for (const [k, t] of Object.entries(snapshot)) {
    for (const u of toRemote(k, data, uid, t)) byTable.set(u.table, [...(byTable.get(u.table) ?? []), u.row]);
  }
  const held = new Set<string>();
  for (const t of PUSH_ORDER) {
    const rows = byTable.get(t);
    if (!rows?.length) continue;
    // Rows for a table the server lacks stay pending until it exists.
    if (missing.has(t)) { for (const [k] of Object.entries(snapshot)) if (toRemote(k, data, uid, 0).some((u) => u.table === t)) held.add(k); continue; }
    for (let i = 0; i < rows.length; i += 500) {
      let batch = rows.slice(i, i + 500);
      let { error } = await supabase!.from(t).upsert(batch, { onConflict: CONFLICT[t] });
      // A server that hasn't had the v2 migration yet doesn't know coat and personality: keep syncing without them.
      if (error && t === "companions" && /coat|personality/i.test(error.message)) {
        batch = batch.map(({ coat: _c, personality: _p, ...rest }) => rest);
        ({ error } = await supabase!.from(t).upsert(batch, { onConflict: CONFLICT[t] }));
      }
      // Before migration 0006 the server has no track columns: keep syncing habits and companions without them.
      // Track state then stays on this phone until the migration runs (docs/MULTI_TRACK_ARCHITECTURE.md, R1).
      if (error && (t === "habits" || t === "companions") && /column/i.test(error.message) && TRACK_COLUMNS[t].some((c) => new RegExp(`\\b${c}\\b`).test(error!.message))) {
        const drop = new Set<string>(TRACK_COLUMNS[t]);
        batch = batch.map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => !drop.has(k))));
        ({ error } = await supabase!.from(t).upsert(batch, { onConflict: CONFLICT[t] }));
      }
      // Before migration 0005 the server has no urge strategy or trigger columns: keep syncing urges without them.
      if (error && t === "urges" && /(strategy|trigger)['"]? column|column ['"]?(urges\.)?(strategy|trigger)/i.test(error.message)) {
        batch = batch.map(({ strategy: _s, trigger: _t, ...rest }) => rest);
        ({ error } = await supabase!.from(t).upsert(batch, { onConflict: CONFLICT[t] }));
      }
      if (stale()) return;
      if (error) throw new Error(`${t}: ${error.message}`);
    }
  }
  for (const [k, t] of Object.entries(snapshot)) {
    if (held.has(k)) continue;
    if (meta.pending[k] === t) delete meta.pending[k];
    echo.set(k, t);
  }
  saveMeta();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { if (userId) void syncNow(); });
  window.addEventListener("offline", () => { if (userId) setStatus({ state: "offline" }); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && userId) void syncNow(); });
  setInterval(() => { if (userId && document.visibilityState === "visible") void syncNow(); }, 5 * 60_000);
}
