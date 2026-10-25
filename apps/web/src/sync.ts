import { useSyncExternalStore } from "react";
import { kv } from "./db";
import { addDays, today } from "./dates";
import { AI_RETENTION_DAYS } from "./progress";
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

/**
 * `rejected`: rows the server refused because of what is in them (an amount over its limit, say). They stay on this
 * phone, are not retried on every cycle (that stalled everything behind them), and are shown to the person. A local
 * change to the row, "Sync now" and the next app start all try them again.
 */
interface Meta { cursor: Partial<Record<Table, string>>; pending: Record<string, number>; removed: Record<string, number>; rejected: Record<string, { at: number; message: string }> }
const emptyMeta = (): Meta => ({ cursor: {}, pending: {}, removed: {}, rejected: {} });

export type SyncState = "off" | "idle" | "syncing" | "offline" | "error";
let status: { state: SyncState; last: number | null; pending: number; rejected: number } = { state: "off", last: null, pending: 0, rejected: 0 };
const watchers = new Set<() => void>();
const setStatus = (p: Partial<typeof status>) => { status = { ...status, ...p }; watchers.forEach((w) => w()); if (typeof window !== "undefined") (window as unknown as { __companionSync: unknown }).__companionSync = status; };
export const getSyncStatus = () => status;
/** The rows the server refused, with its reason, for support and tests. */
export const getRejected = () => Object.entries(meta.rejected).map(([key, r]) => ({ key, ...r }));
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
let purgedSummaries = false;
/** What this phone last pushed, so its own rows coming back are not re-applied. */
const echo = new Map<string, number>();

const metaKey = (uid: string) => `sync:${uid}`;
const saveMeta = () => { if (userId) void kv.set(metaKey(userId), meta).catch(() => undefined); setStatus({ pending: Object.keys(meta.pending).length + Object.keys(meta.removed).length, rejected: Object.keys(meta.rejected).length }); };

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
  if (source !== "local" && source !== "import") return;
  // An import is stamped as old as can be: where the account already holds the record, its version wins in merge(), so a
  // backup can never overwrite a newer edit made on another phone. Only records the account lacks are sent.
  const t = source === "import" ? 1 : Date.now();
  const { changed, removed } = diff(prev, next);
  if (!changed.length && !removed.length) return;
  for (const k of changed) { meta.pending[k] = t; delete meta.removed[k]; delete meta.rejected[k]; }
  for (const k of removed) { delete meta.pending[k]; delete meta.rejected[k]; if (tombstone(k)) meta.removed[k] = t; }
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
  purgedSummaries = false;
  retryRejected(); // the server's rules may have changed since: each launch gives refused rows another try
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

/**
 * Deletes the account after the password is typed again. Signing in afresh makes the access token carry a new password
 * sign-in time, which delete_my_account must check itself (proposal in supabase/README.md): a check made only here can be
 * skipped by anyone holding the session, so this is the client half. Returns an error message, or null when deleted.
 */
export async function deleteAccount(email: string, password: string): Promise<string | null> {
  if (!supabase) return "Accounts aren't available in this build.";
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) return authError.message;
  const { error } = await supabase.rpc("delete_my_account");
  return error ? error.message : null;
}

/**
 * Erases this phone's copy for someone who has forgotten the app-lock PIN. It signs this phone out of the account
 * FIRST, then wipes. Wiping alone proves nothing about who is holding the phone, and the account stays signed in
 * on it, so the very next sync would hand the whole history back with no PIN and no app lock (audit P0-1). Now the
 * history only comes back through signing in again, with the account's password.
 *
 * Only this phone signs out (scope "local"): the account's data and the person's other phones are untouched.
 * Returns false, having wiped nothing, if the session could not be cleared.
 */
export async function signOutAndErase(): Promise<boolean> {
  if (supabase) {
    const uid = (await supabase.auth.getSession().catch(() => ({ data: { session: null } }))).data.session?.user.id;
    stopSync();
    if (uid) await forgetSync(uid);
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    const still = (await supabase.auth.getSession().catch(() => ({ data: { session: null } }))).data.session;
    if (still) { void startSync(still.user.id); return false; }
  }
  await actions.resetAll();
  return true;
}

/** Puts every refused row back in the queue. */
function retryRejected() {
  const t = Date.now();
  for (const k of Object.keys(meta.rejected)) meta.pending[k] ??= t;
  meta.rejected = {};
}

/** `retry`: also give rows the server refused earlier another try (the "Sync now" button). */
export function syncNow(retry = false): Promise<void> {
  if (!supabase || !userId) return Promise.resolve();
  if (retry && Object.keys(meta.rejected).length) { retryRejected(); saveMeta(); }
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
  // A refused item deleted elsewhere is gone here too: stop reporting it.
  if (Object.keys(meta.rejected).length) { const have = indexRows(getData()); for (const k of Object.keys(meta.rejected)) if (!have.has(k)) delete meta.rejected[k]; }

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

  // AI-written summaries are kept 7 days: once per launch, blank older ones on the account (its row-level security limits this to
  // the person's own rows). Local copies go in store.pruneExpiredAi, and merge never takes an expired one back.
  if (!purgedSummaries) {
    const { error } = await supabase!.from("weekly_reports").update({ summary: null, client_updated_at: Date.now() }).lte("week_start", addDays(today(), -AI_RETENTION_DAYS)).not("summary", "is", null);
    if (stale()) return;
    if (error) throw new Error(`weekly_reports: ${error.message}`);
    purgedSummaries = true;
  }

  // 3. push changes, parents first
  const snapshot = { ...meta.pending };
  const data = getData();
  const byTable = new Map<Table, Item[]>();
  for (const [k, t] of Object.entries(snapshot)) {
    for (const u of toRemote(k, data, uid, t)) byTable.set(u.table, [...(byTable.get(u.table) ?? []), { key: k, row: u.row }]);
  }
  const held = new Set<string>();
  const refused = new Map<string, string>();
  for (const t of PUSH_ORDER) {
    // An entry and its deduction are one key: if the entry was refused, its deduction isn't sent.
    const items = (byTable.get(t) ?? []).filter((i) => !refused.has(i.key));
    if (!items.length) continue;
    // Rows for a table the server lacks stay pending until it exists.
    if (missing.has(t)) { for (const i of items) held.add(i.key); continue; }
    for (let i = 0; i < items.length; i += 500) {
      const bad = await pushRows(t, items.slice(i, i + 500), stale);
      if (stale()) return;
      for (const [k, why] of bad) refused.set(k, why);
    }
  }
  for (const [k, t] of Object.entries(snapshot)) {
    if (held.has(k)) continue;
    const unchanged = meta.pending[k] === t;
    if (unchanged) delete meta.pending[k];
    if (refused.has(k)) { if (unchanged) meta.rejected[k] = { at: Date.now(), message: refused.get(k)! }; continue; }
    echo.set(k, t);
  }
  saveMeta();
}

type Row = Record<string, unknown>;
interface Item { key: string; row: Row }
type PushError = { message: string; code?: string };

/**
 * Whether the server refused a row because of the data in it: a data exception or constraint violation (SQLSTATE
 * classes 22 and 23) or a row-level-security check on a row whose parent it doesn't have (42501). Anything else
 * (no network, an expired session, the server down) has no such code and is retried later as a whole.
 */
export const isRowError = (e: PushError): boolean => /^(22|23)/.test(e.code ?? "") || (e.code === "42501" && /row-level security/i.test(e.message));

async function upsertBatch(t: Table, rows: Row[]): Promise<{ error: PushError | null }> {
  let batch = rows;
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
  return { error };
}

/**
 * Sends rows to a table. A batch the server refuses for the data in it is split in halves until the row or rows
 * responsible are found, so one bad row can't block the valid rows sent with it. Those rows are returned with the
 * server's reason, never dropped: the caller keeps them on the phone and tells the person. Any other error throws.
 */
async function pushRows(t: Table, items: Item[], stale: () => boolean): Promise<Map<string, string>> {
  const bad = new Map<string, string>();
  const send = async (batch: Item[]): Promise<void> => {
    if (stale()) return;
    const { error } = await upsertBatch(t, batch.map((i) => i.row));
    if (stale() || !error) return;
    if (!isRowError(error)) throw new Error(`${t}: ${error.message}`);
    if (batch.length === 1) { bad.set(batch[0].key, error.message); return; }
    const mid = batch.length >> 1;
    await send(batch.slice(0, mid));
    await send(batch.slice(mid));
  };
  await send(items);
  return bad;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { if (userId) void syncNow(); });
  window.addEventListener("offline", () => { if (userId) setStatus({ state: "offline" }); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && userId) void syncNow(); });
  setInterval(() => { if (userId && document.visibilityState === "visible") void syncNow(); }, 5 * 60_000);
}
