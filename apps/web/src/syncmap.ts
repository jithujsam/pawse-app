import { LegacySettingsSchema, TrackStateSchema } from "@detox/schema";
import { defaultTrackState, PER_TRACK_KEYS, trackFromLegacy, trackState, type LegacyTrackSettings } from "./tracks";
import type { AppData, CleanDay, Companion, Entry, Habit, JournalEntry, Settings, TrackState, Urge } from "./types";

/**
 * Pure mapping between what the phone keeps and the normalised tables.
 * Each local row has a key: "c:<id>", "h:<id>", "e:<id>", "k:<habitId>:<day>", "w:<habitId>:<week>", "u:<id>" (urge),
 * "j:<day>" (journal), or "s" for settings.
 */

export type Table = "profiles" | "companions" | "habits" | "entries" | "deductions" | "clean_days" | "weekly_reports" | "urges" | "journal";
/** Parents before children, so ownership checks pass on insert. */
export const PUSH_ORDER: Table[] = ["profiles", "companions", "habits", "entries", "deductions", "clean_days", "weekly_reports", "urges", "journal"];
/** Tables added in v2. A server without them keeps syncing everything else. */
export const OPTIONAL_TABLES: Table[] = ["urges", "journal"];

type Local = { kind: "c"; row: Companion } | { kind: "h"; row: Habit; position: number } | { kind: "e"; row: Entry } | { kind: "k"; row: CleanDay } | { kind: "w"; habitId: string; week: string; text: string } | { kind: "s"; row: Settings; legacy: TrackState | undefined } | { kind: "u"; row: Urge } | { kind: "j"; row: JournalEntry };

export function indexRows(d: AppData): Map<string, Local> {
  const m = new Map<string, Local>();
  // The profile also carries a copy of the first track's settings for app versions from before tracks.
  m.set("s", { kind: "s", row: d.settings, legacy: d.habits[0]?.track });
  for (const c of d.companions) m.set(`c:${c.id}`, { kind: "c", row: c });
  d.habits.forEach((h, i) => m.set(`h:${h.id}`, { kind: "h", row: h, position: i }));
  for (const e of d.entries) m.set(`e:${e.id}`, { kind: "e", row: e });
  for (const k of d.cleanDays) m.set(`k:${k.habitId}:${k.day}`, { kind: "k", row: k });
  for (const [habitId, weeks] of Object.entries(d.summaries)) for (const [week, text] of Object.entries(weeks)) m.set(`w:${habitId}:${week}`, { kind: "w", habitId, week, text });
  for (const u of d.urges ?? []) m.set(`u:${u.id}`, { kind: "u", row: u });
  for (const j of d.journal ?? []) m.set(`j:${j.day}`, { kind: "j", row: j });
  return m;
}

/** Rows are replaced, never mutated, so a changed row is simply a different object. */
export function diff(prev: AppData, next: AppData): { changed: string[]; removed: string[] } {
  const a = indexRows(prev), b = indexRows(next);
  const changed: string[] = [], removed: string[] = [];
  for (const [k, v] of b) {
    const old = a.get(k);
    if (!old) { changed.push(k); continue; }
    if (v.kind === "w" && old.kind === "w") { if (v.text !== old.text) changed.push(k); continue; }
    if (v.kind === "h" && old.kind === "h" && v.position !== old.position) { changed.push(k); continue; }
    if (v.kind === "s" && old.kind === "s" && v.legacy !== old.legacy) { changed.push(k); continue; }
    if ("row" in v && "row" in old && v.row !== old.row) changed.push(k);
  }
  for (const k of a.keys()) if (!b.has(k)) removed.push(k);
  return { changed, removed };
}

const isPhoto = (v: unknown) => typeof v === "string" && v.startsWith("data:");
/** Photos stay on the phone. */
export const stripPhotos = (values: Entry["values"]) => Object.fromEntries(Object.entries(values).filter(([, v]) => !isPhoto(v)));

/** Settings that belong to this phone rather than the person. */
const DEVICE_ONLY: (keyof Settings)[] = ["haptics", "remindersOn", "autoLock", "coachSeen", "theme", "activeHabit"];
export const portableSettings = (s: Settings) => Object.fromEntries(Object.entries(s).filter(([k]) => !DEVICE_ONLY.includes(k as keyof Settings)));

/**
 * What app versions from before tracks read from the profile: the first track's settings under the old
 * single-track keys (they only ever show habits[0]). Written only; read back solely to seed a track that arrives
 * with no state of its own (see merge). The interim per-habit maps are deliberately not written: no released
 * version reads them, and writing them would feed one track's rest days into another's seed.
 */
export function legacyProfileCopy(d: AppData): Record<string, unknown> {
  const h = d.habits[0];
  if (!h) return {};
  const t = trackState(d, h.id);
  return {
    goal: (t.description || h.name).slice(0, 60), baseline: t.baseline, plan: t.plan, restDays: t.restDays, weekFocus: t.weekFocus,
    celebrated: t.celebrated, wear: t.wear, treatsGiven: t.treatsGiven, fedOn: t.fedOn, savingsGoal: t.savingsGoal,
  };
}

/**
 * The habits row's `track` column: everything in the track's state except what has its own column. Keys this
 * version doesn't know (from a newer app) go back up unchanged.
 */
const trackColumn = (t: TrackState) => { const { description: _d, startedOn: _s, status: _st, ...rest } = t; return rest; };
/** Columns added by migration 0006. A server without them keeps syncing the rest. */
export const TRACK_COLUMNS = { habits: ["description", "started_on", "status", "archived_at", "track"], companions: ["habit_id"] } as const;

export interface Upsert { table: Table; row: Record<string, unknown> }

/** The server rows for one local key. An entry is two rows: the entry and its deduction. */
export function toRemote(key: string, d: AppData, userId: string, t: number): Upsert[] {
  const l = indexRows(d).get(key);
  if (!l) return [];
  const base = { user_id: userId, client_updated_at: t };
  switch (l.kind) {
    case "s": return [{ table: "profiles", row: { id: userId, settings: { ...legacyProfileCopy(d), ...portableSettings(l.row) }, client_updated_at: t, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone?.slice(0, 64) ?? null } }];
    case "c": return [{ table: "companions", row: { ...base, id: l.row.id, species: l.row.species, name: l.row.name, born_on: l.row.bornOn, died_on: l.row.diedOn, final_age: l.row.finalAge, coat: l.row.coat ?? null, breed: l.row.breed ?? null, personality: l.row.personality ?? null, habit_id: l.row.trackId ?? null, deleted_at: null } }];
    case "h": {
      const tr = trackState(d, l.row.id);
      return [{ table: "habits", row: {
        ...base, id: l.row.id, companion_id: l.row.companionId, name: l.row.name, class: l.row.cls, class_weight: l.row.classWeight, unit: l.row.unit, fields: l.row.fields, position: l.position, deleted_at: null,
        description: tr.description, started_on: tr.startedOn, status: tr.status, archived_at: tr.archivedOn, track: trackColumn(tr),
      } }];
    }
    case "e": return [
      { table: "entries", row: { ...base, id: l.row.id, habit_id: l.row.habitId, companion_id: l.row.companionId, occurred_on: l.row.day, occurred_at: l.row.time, values: stripPhotos(l.row.values), amount: l.row.amount, client_created_at: l.row.createdAt, deleted_at: null } },
      { table: "deductions", row: { ...base, entry_id: l.row.id, months_lost: l.row.months, severity: Math.max(0.5, l.row.severity), baseline_months: null, ai_adjust_pct: l.row.aiAdjustPct, body_effects: l.row.effects, explanation: l.row.explanation.slice(0, 200), source: l.row.source } },
    ];
    case "k": return [{ table: "clean_days", row: { ...base, habit_id: l.row.habitId, day: l.row.day, deleted_at: null } }];
    case "u": return [{ table: "urges", row: { ...base, id: l.row.id, habit_id: l.row.habitId, occurred_on: l.row.day, occurred_at: l.row.time, strength: l.row.strength, outcome: l.row.outcome, strategy: l.row.strategy ?? null, trigger: l.row.trigger ?? null, client_created_at: l.row.createdAt, deleted_at: null } }];
    case "j": return [{ table: "journal", row: { ...base, day: l.row.day, mood: l.row.mood, body: l.row.body, deleted_at: null } }];
    case "w": return d.habits.some((h) => h.id === l.habitId) ? [{ table: "weekly_reports", row: { ...base, habit_id: l.habitId, week_start: l.week, summary: l.text } }] : [];
  }
}

/** How a removed local key is marked deleted on the server. */
export function tombstone(key: string): { table: Table; match: Record<string, string> } | null {
  const [kind, a, b] = key.split(":");
  if (kind === "c") return { table: "companions", match: { id: a } };
  if (kind === "h") return { table: "habits", match: { id: a } };
  if (kind === "e") return { table: "entries", match: { id: a } };
  if (kind === "k") return { table: "clean_days", match: { habit_id: a, day: b } };
  if (kind === "u") return { table: "urges", match: { id: a } };
  if (kind === "j") return { table: "journal", match: { day: a } };
  return null;
}

// ---------- remote -> local ----------

type R = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const time = (v: unknown) => (typeof v === "string" ? v.slice(0, 5) : null);

export interface Pulled {
  profiles: R[]; companions: R[]; habits: R[]; entries: R[]; deductions: R[]; clean_days: R[]; weekly_reports: R[]; urges?: R[]; journal?: R[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: unknown) => (typeof v === "string" && DAY.test(v.slice(0, 10)) ? v.slice(0, 10) : null);

/**
 * A track's state from a habits row:
 * - The `track` column and the 0006 columns (description, started_on, status, archived_at) win when present.
 * - Anything the row doesn't carry keeps this phone's value. An older app's write never sends these columns, so
 *   it can't clear them (an upsert only sets the columns it sends).
 * - A track this phone has never seen, arriving without state (a server or app from before tracks), is built from
 *   the profile's old per-track keys the same way the on-device migration does (trackFromLegacy), else defaults.
 * - Nothing is coerced: a malformed value fails the schema and this phone's state stands. Keys this version
 *   doesn't know are kept, so a newer app's fields survive.
 * Undefined when there's nothing to go on; normalize fills it in on the next load.
 */
function remoteTrack(r: R, h: Habit, local: TrackState | undefined, legacy: LegacyTrackSettings | undefined, bornOn: string | undefined): TrackState | undefined {
  const t = r.track && typeof r.track === "object" && !Array.isArray(r.track) ? (r.track as Record<string, unknown>) : undefined;
  const startedOn = day(r.started_on) ?? local?.startedOn ?? bornOn ?? day(r.created_at);
  if (!t && !local && !legacy && r.status == null) return undefined;
  if (!startedOn) return local;
  const base: TrackState = local ?? (legacy ? trackFromLegacy(legacy, h, Number(r.position ?? 0) === 0 ? 0 : 1, startedOn) : defaultTrackState(startedOn));
  const status = r.status == null ? base.status : r.status;
  const next: Record<string, unknown> = {
    ...base, ...(t ?? {}),
    ...(typeof r.description === "string" ? { description: r.description } : {}),
    startedOn: day(r.started_on) ?? base.startedOn,
    status,
  };
  if (status !== "archived") next.archivedOn = null;
  else if (next.archivedOn == null) next.archivedOn = day(r.archived_at);
  const ok = TrackStateSchema.safeParse(next);
  return ok.success ? (ok.data as TrackState) : local;
}

/**
 * Merges pulled rows into local data. A row only wins when it is newer than an unsent local change
 * to the same key (last write wins, by the time each phone made the change).
 */
export function merge(d: AppData, p: Pulled, pending: Record<string, number>): { data: AppData; applied: string[] } {
  const applied: string[] = [];
  const wins = (key: string, r: R) => { const t = pending[key]; const ok = t === undefined || Number(r.client_updated_at) >= t; if (ok) applied.push(key); return ok; };
  let { companions, habits, entries, cleanDays, settings, summaries } = d;
  let urges = d.urges ?? [], journal = d.journal ?? [];

  // The profile's copy of per-track settings (for old app versions) is never read back, except to seed a track
  // that arrives from the server with no state of its own (a server or app from before tracks).
  const profileSettings = p.profiles.find((r) => r.settings && typeof r.settings === "object")?.settings;
  const parsedLegacy = profileSettings ? LegacySettingsSchema.safeParse(profileSettings) : null;
  const legacy = parsedLegacy?.success ? (parsedLegacy.data as LegacyTrackSettings) : undefined;
  const person = (x: Record<string, unknown>) => Object.fromEntries(Object.entries(x).filter(([k]) => !(PER_TRACK_KEYS as readonly string[]).includes(k)));
  for (const r of p.profiles) if (wins("s", r) && r.settings && typeof r.settings === "object") settings = { ...settings, ...(person(r.settings as Record<string, unknown>) as Partial<Settings>), ...Object.fromEntries(DEVICE_ONLY.map((k) => [k, settings[k]])) };

  const upsert = <T extends { id: string }>(list: T[], row: T) => { const i = list.findIndex((x) => x.id === row.id); return i < 0 ? [...list, row] : list.map((x, j) => (j === i ? row : x)); };

  for (const r of p.companions) {
    const key = `c:${r.id}`;
    if (!wins(key, r)) continue;
    if (r.deleted_at) { companions = companions.filter((c) => c.id !== r.id); continue; }
    const owner = r.habit_id ? String(r.habit_id) : companions.find((c) => c.id === r.id)?.trackId;
    companions = upsert(companions, { id: String(r.id), species: r.species as Companion["species"], name: String(r.name), bornOn: String(r.born_on), diedOn: (r.died_on as string) ?? null, finalAge: num(r.final_age),
      ...(r.coat ? { coat: String(r.coat) } : {}), ...(r.breed ? { breed: String(r.breed) } : {}), ...(r.personality ? { personality: r.personality as Companion["personality"] } : {}), ...(owner ? { trackId: owner } : {}) });
  }
  const sortedHabits = [...p.habits].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
  for (const r of sortedHabits) {
    const key = `h:${r.id}`;
    if (!wins(key, r)) continue;
    if (r.deleted_at) { habits = habits.filter((h) => h.id !== r.id); continue; }
    const local = habits.find((h) => h.id === r.id)?.track;
    const bornOn = companions.find((c) => c.id === String(r.companion_id))?.bornOn;
    const row: Habit = { id: String(r.id), companionId: String(r.companion_id), name: String(r.name), cls: r.class as Habit["cls"], classWeight: Number(r.class_weight), unit: r.unit as Habit["unit"], fields: r.fields as Habit["fields"] };
    const track = remoteTrack(r, row, local, legacy, bornOn);
    habits = upsert(habits, { ...row, ...(track ? { track } : {}) });
  }
  const ded = new Map(p.deductions.map((x) => [String(x.entry_id), x]));
  for (const r of p.entries) {
    const key = `e:${r.id}`;
    if (!wins(key, r)) continue;
    if (r.deleted_at) { entries = entries.filter((e) => e.id !== r.id); continue; }
    const local = entries.find((e) => e.id === r.id);
    const x = ded.get(String(r.id));
    const photos = local ? Object.fromEntries(Object.entries(local.values).filter(([, v]) => isPhoto(v))) : {};
    entries = upsert(entries, {
      id: String(r.id), habitId: String(r.habit_id), companionId: String(r.companion_id), day: String(r.occurred_on), time: time(r.occurred_at),
      values: { ...(r.values as Entry["values"]), ...photos }, amount: num(r.amount), createdAt: Number(r.client_created_at),
      months: x ? Number(x.months_lost) : local?.months ?? 0, severity: x ? Number(x.severity) : local?.severity ?? 1,
      effects: x ? (x.body_effects as string[]) : local?.effects ?? [], explanation: x ? String(x.explanation) : local?.explanation ?? "",
      source: x ? (x.source as Entry["source"]) : local?.source ?? "baseline", aiAdjustPct: x ? num(x.ai_adjust_pct) : local?.aiAdjustPct ?? null,
    });
  }
  // A deduction can change on its own (AI polish arriving later).
  for (const x of p.deductions) {
    const id = String(x.entry_id);
    if (p.entries.some((r) => String(r.id) === id) || !wins(`e:${id}`, x)) continue;
    entries = entries.map((e) => (e.id === id ? { ...e, months: Number(x.months_lost), severity: Number(x.severity), effects: x.body_effects as string[], explanation: String(x.explanation), source: x.source as Entry["source"], aiAdjustPct: num(x.ai_adjust_pct) } : e));
  }
  for (const r of p.clean_days) {
    const key = `k:${r.habit_id}:${r.day}`;
    if (!wins(key, r)) continue;
    cleanDays = cleanDays.filter((c) => !(c.habitId === r.habit_id && c.day === r.day));
    if (!r.deleted_at) cleanDays = [...cleanDays, { habitId: String(r.habit_id), day: String(r.day) }];
  }
  for (const r of p.weekly_reports) {
    const h = String(r.habit_id), w = String(r.week_start);
    if (r.summary && habits.some((x) => x.id === h) && wins(`w:${h}:${w}`, r)) summaries = { ...summaries, [h]: { ...summaries[h], [w]: String(r.summary) } };
  }

  for (const r of p.urges ?? []) {
    const key = `u:${r.id}`;
    if (!wins(key, r)) continue;
    urges = urges.filter((u) => u.id !== r.id);
    if (!r.deleted_at) urges = [...urges, { id: String(r.id), habitId: String(r.habit_id), day: String(r.occurred_on), time: time(r.occurred_at), strength: Number(r.strength), outcome: r.outcome as Urge["outcome"], createdAt: Number(r.client_created_at),
      strategy: (r.strategy as Urge["strategy"]) ?? null, trigger: typeof r.trigger === "string" ? r.trigger : null }];
  }
  for (const r of p.journal ?? []) {
    const key = `j:${r.day}`;
    if (!wins(key, r)) continue;
    journal = journal.filter((j) => j.day !== r.day);
    if (!r.deleted_at) journal = [...journal, { day: String(r.day), mood: Number(r.mood), body: String(r.body ?? "") }];
  }

  entries = [...entries].sort((a, b) => a.createdAt - b.createdAt);
  urges = [...urges].sort((a, b) => a.createdAt - b.createdAt);
  journal = [...journal].sort((a, b) => a.day.localeCompare(b.day));
  return { data: { ...d, companions, habits, entries, cleanDays, settings, summaries, urges, journal }, applied };
}

/**
 * First sync on a phone whose account already has a companion (audit B17). Deterministic rule:
 * - The account's first habit (lowest position, then id) and its companion stay the active ones.
 * - Everything logged on this phone before its first sync (slips, clean days, urges, reflections) is kept and
 *   moved onto that habit and companion. Nothing logged is ever dropped.
 * - The phone's own habit and living companion, made during onboarding and never synced, are dropped: they hold
 *   no data of their own once their rows have moved. A companion that already died on this phone stays in the Hall.
 * - The account's settings win (the phone's settings key is not pushed); clean days that land on the same day
 *   twice collapse into one. Only rows the account doesn't already have are pushed; for rows it has, its copy wins.
 * Returns null when the account has no companion yet (this phone's data simply goes up).
 */
export function adoptAccount(d: AppData, p: Pulled): { data: AppData; push: string[] } | null {
  const live = p.habits.filter((h) => !h.deleted_at)
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0) || String(a.id).localeCompare(String(b.id)));
  const target = live[0];
  if (!target) return null;
  const habitId = String(target.id), companionId = String(target.companion_id);
  const remoteHabits = new Set(p.habits.map((h) => String(h.id)));
  const remoteCompanions = new Set(p.companions.map((c) => String(c.id)));
  const movedHabits = new Set(d.habits.filter((h) => !remoteHabits.has(h.id)).map((h) => h.id));
  const droppedCompanions = new Set(d.companions.filter((c) => !remoteCompanions.has(c.id) && c.diedOn === null).map((c) => c.id));
  const habit = (id: string) => (movedHabits.has(id) ? habitId : id);
  const companion = (id: string) => (droppedCompanions.has(id) ? companionId : id);

  const entries = d.entries.map((e) => (movedHabits.has(e.habitId) || droppedCompanions.has(e.companionId) ? { ...e, habitId: habit(e.habitId), companionId: companion(e.companionId) } : e));
  const seen = new Set<string>();
  const cleanDays = d.cleanDays.map((c) => ({ ...c, habitId: habit(c.habitId) })).filter((c) => { const k = `${c.habitId}:${c.day}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const urges = d.urges.map((u) => (movedHabits.has(u.habitId) ? { ...u, habitId: habit(u.habitId) } : u));
  const data: AppData = {
    ...d,
    companions: d.companions.filter((c) => !droppedCompanions.has(c.id)),
    habits: d.habits.filter((h) => !movedHabits.has(h.id)),
    entries, cleanDays, urges,
    summaries: {}, // weekly summaries belong to the account's habit; the account's own come down with the merge
  };
  // Only rows the account doesn't have yet go up. A row it already has (a phone that lost its sync position) is
  // left to the merge, so an older copy here can't overwrite a newer edit made on another phone.
  const has = (rows: R[] | undefined, key: (r: R) => string) => new Set((rows ?? []).map(key));
  const remoteEntries = has(p.entries, (r) => String(r.id));
  const remoteClean = has(p.clean_days, (r) => `${r.habit_id}:${r.day}`);
  const remoteUrges = has(p.urges, (r) => String(r.id));
  const remoteJournal = has(p.journal, (r) => String(r.day));
  const push = [
    ...data.companions.filter((c) => !remoteCompanions.has(c.id)).map((c) => `c:${c.id}`),
    ...entries.filter((e) => !remoteEntries.has(e.id)).map((e) => `e:${e.id}`),
    ...cleanDays.filter((c) => !remoteClean.has(`${c.habitId}:${c.day}`)).map((c) => `k:${c.habitId}:${c.day}`),
    ...urges.filter((u) => !remoteUrges.has(u.id)).map((u) => `u:${u.id}`),
    ...d.journal.filter((j) => !remoteJournal.has(j.day)).map((j) => `j:${j.day}`),
  ];
  return { data, push };
}

/**
 * A day can't be both a slip day and a clean day. When two phones disagree (one logged a slip, the other marked the
 * day clean), the explicit slip wins and the clean mark is removed, here and, through the returned keys, on the server.
 */
export function slipBeatsClean(d: AppData): { data: AppData; removed: string[] } {
  const slipDays = new Set(d.entries.map((e) => `${e.habitId}:${e.day}`));
  const removed = d.cleanDays.filter((c) => slipDays.has(`${c.habitId}:${c.day}`)).map((c) => `k:${c.habitId}:${c.day}`);
  return removed.length ? { data: { ...d, cleanDays: d.cleanDays.filter((c) => !slipDays.has(`${c.habitId}:${c.day}`)) }, removed } : { data: d, removed };
}
