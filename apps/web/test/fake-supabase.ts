/**
 * An in-memory stand-in for the Supabase tables the sync loop talks to. It behaves like the real project where
 * sync depends on it:
 * - upserts by each table's conflict key, stamping a server `updated_at` (a minute apart, well past the 5 s overlap
 *   sync re-reads, so an incremental pull really is incremental);
 * - the `touch_row` trigger: a write older than the stored `client_updated_at` is ignored;
 * - `.gt("updated_at", since)` filtering, so pulls only return rows changed since the cursor;
 * - `.eq()` filters for user and soft-delete matches.
 * `hold()` pauses pulls, so a test can act in the middle of a sync. `lacksColumns()` makes upserts fail the way
 * PostgREST does on a server that hasn't had a migration yet.
 * `refuse()` makes the server reject any batch that contains a matching row, as one failed CHECK constraint rejects
 * the whole statement (nothing in the batch is written). `networkDown()` makes every upsert fail with no SQLSTATE code,
 * as a fetch failure does. `authState` is the signed-in session `supabase.auth` reports; `upsertCalls` counts requests.
 */
type Row = Record<string, unknown>;
const KEYS: Record<string, string[]> = {
  profiles: ["id"], companions: ["id"], habits: ["id"], entries: ["id"], deductions: ["entry_id"],
  clean_days: ["habit_id", "day"], weekly_reports: ["habit_id", "week_start"], urges: ["id"], journal: ["user_id", "day"],
};
export const server = new Map<string, Map<string, Row>>();
let clock = 0;
let gate: Promise<void> | null = null;

export const table = (t: string) => { if (!server.has(t)) server.set(t, new Map()); return server.get(t)!; };
export const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++clock * 60_000).toISOString();
const absent = new Map<string, string[]>();
export const lacksColumns = (t: string, cols: string[]) => { absent.set(t, cols); };
export const hold = () => { let open!: () => void; gate = new Promise((r) => { open = r; }); return () => { gate = null; open(); }; };
const keyOf = (t: string, r: Row) => KEYS[t].map((k) => String(r[k])).join("|");
const stale = (old: Row | undefined, r: Row) => old !== undefined && Number(r.client_updated_at ?? 0) < Number(old.client_updated_at ?? 0);

type Refusal = { t: string; test: (r: Row) => boolean; error: { message: string; code?: string } };
const refusals: Refusal[] = [];
let down = false;
export const upsertCalls: Record<string, number> = {};
export const resetCalls = () => { for (const k of Object.keys(upsertCalls)) delete upsertCalls[k]; };
export const refuse = (t: string, test: (r: Row) => boolean, error: Refusal["error"] = { message: `new row for relation "${t}" violates check constraint "${t}_check"`, code: "23514" }) => { refusals.push({ t, test, error }); };
export const clearRefusals = () => { refusals.length = 0; };
export const networkDown = (on: boolean) => { down = on; };
export const authState: { session: { user: { id: string } } | null; stuck: boolean; password: string } = { session: { user: { id: "u1" } }, stuck: false, password: "right-password" };
/** Names of the database functions the app called. */
export const rpcCalls: string[] = [];

/** Another phone writes a row straight to the server. */
export function remoteWrite(t: string, row: Row) {
  const k = keyOf(t, row);
  table(t).set(k, { ...table(t).get(k), ...row, updated_at: stamp() });
}

function query(t: string) {
  const eqs: [string, unknown][] = [];
  let since: string | null = null;
  let patch: Row | null = null;
  const lte: [string, string][] = [];
  const notNull: string[] = [];
  const q = {
    select: () => q, order: () => q, range: () => q,
    gt: (_c: string, v: string) => { since = v; return q; },
    eq: (c: string, v: unknown) => { eqs.push([c, v]); return q; },
    update: (p: Row) => { patch = p; return q; },
    lte: (c: string, v: string) => { lte.push([c, v]); return q; },
    not: (c: string) => { notNull.push(c); return q; },
    upsert: (rows: Row[]) => {
      upsertCalls[t] = (upsertCalls[t] ?? 0) + 1;
      if (down) return Promise.resolve({ error: { message: "TypeError: Failed to fetch", code: "" } });
      const refused = refusals.find((x) => x.t === t && rows.some(x.test));
      if (refused) return Promise.resolve({ error: refused.error });
      const col = (absent.get(t) ?? []).find((c) => rows.some((r) => c in r));
      if (col) return Promise.resolve({ error: { message: `Could not find the '${col}' column of '${t}' in the schema cache` } });
      for (const r of rows) { const k = keyOf(t, r); const old = table(t).get(k); if (!stale(old, r)) table(t).set(k, { ...old, ...r, updated_at: stamp() }); }
      return Promise.resolve({ error: null });
    },
    then: async (res: (v: { data: Row[] | null; error: null }) => unknown) => {
      if (!patch && gate) await gate;
      const match = [...table(t).values()].filter((r) => eqs.every(([c, v]) => r[c] === v) && lte.every(([c, v]) => String(r[c]) <= v) && notNull.every((c) => r[c] != null) && (patch || !since || String(r.updated_at) > since));
      if (patch) { for (const r of match) if (!stale(r, patch)) Object.assign(r, patch, { updated_at: stamp() }); return res({ data: null, error: null }); }
      return res({ data: match.map((r) => ({ ...r })), error: null });
    },
  };
  return q;
}

export const client = {
  from: (t: string) => query(t),
  auth: {
    getSession: async () => ({ data: { session: authState.session } }),
    signOut: async () => { if (!authState.stuck) authState.session = null; return { error: null }; },
    signInWithPassword: async ({ password }: { email: string; password: string }) => {
      if (password !== authState.password) return { error: { message: "Invalid login credentials" } };
      authState.session = { user: { id: "u1" } };
      return { error: null };
    },
  },
  rpc: async (name: string) => { rpcCalls.push(name); return { error: null }; },
};
