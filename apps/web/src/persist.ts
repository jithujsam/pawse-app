import {
  CleanDaySchema, CompanionSchema, EntrySchema, HabitSchema, JournalSchema, LegacySettingsSchema, parseAppData, parseAppDataV1, SettingsSchema,
  TrackHabitSchema, UrgeSchema,
} from "@detox/schema";
import { inferStartedOn, PER_TRACK_KEYS, repairTracks, trackFromLegacy, type LegacyTrackSettings } from "./tracks";
import type { AppData, CleanDay, Companion, Entry, Habit, JournalEntry, Settings, Urge } from "./types";

export const uuid = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const defaultSettings = (): Settings => ({
  tone: "honest", userName: "", reminder: "20:00", currency: "Rs", deathScene: true, onboarded: false,
  haptics: true, remindersOn: false, coachSeen: false, autoLock: "1m",
  careNotes: true, riskNudge: true, neglectFrom: null, theme: "system", accent: "pet",
  petLife: "continuity", activeHabit: null,
});

export const blank = (): AppData => ({
  v: 2, settings: defaultSettings(), companions: [], habits: [], entries: [], cleanDays: [], urges: [], journal: [], summaries: {}, updatedAt: 0,
});

export { PER_TRACK_KEYS } from "./tracks";
type LegacySettings = Partial<Settings> & LegacyTrackSettings;

/** The v2 shape before the track repairs in normalize(): habits may lack a state, companions an owner. */
type Loose = Omit<AppData, "settings"> & { settings: Partial<Settings> };
type V1 = Omit<Loose, "v" | "summaries" | "settings"> & { v: 1; settings: LegacySettings; summaries: Record<string, string> };

type RowSchema<T> = { safeParse: (x: unknown) => { success: boolean; data?: T } };
const rows = <T>(xs: unknown, ...schemas: RowSchema<T>[]): T[] =>
  Array.isArray(xs) ? xs.flatMap((x) => { for (const s of schemas) { const p = s.safeParse(x); if (p.success) return [p.data as T]; } return []; }) : [];
const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;

/** A companion whose mission memory or mode is damaged is kept without them: progress is recomputed, and losing the pet would cost far more. */
const CompanionWithoutMissions: RowSchema<Companion> = {
  safeParse: (x) => {
    if (!x || typeof x !== "object") return { success: false };
    const { missions: _m, adoption, ...rest } = x as Record<string, unknown>;
    return CompanionSchema.safeParse(adoption === "raise" || adoption === "rescue" ? { ...rest, adoption } : rest) as unknown as { success: boolean; data?: Companion };
  },
};

/** Rabbits, owls and pandas are gone in 5.0: those pets become a golden Shiba, keeping their name and history. */
const RETIRED_SPECIES = new Set(["rabbit", "owl", "panda"]);
const retireSpecies = (c: Companion): Companion =>
  RETIRED_SPECIES.has(c.species as string) ? { ...c, species: "dog", breed: "shiba", coat: "golden" } : c;

/** Keeps every row that is valid on its own, so one damaged row never costs the whole history. */
function salvage(raw: unknown): V1 | Loose | null {
  const v = raw && typeof raw === "object" ? (raw as { v?: unknown }).v : undefined;
  if (v !== 1 && v !== 2) return null;
  const r = raw as Record<string, unknown>;
  const s = (v === 1 ? LegacySettingsSchema : SettingsSchema).safeParse(r.settings);
  const obj = (x: unknown) => (x && typeof x === "object" ? Object.entries(x as Record<string, unknown>) : []);
  const common = {
    companions: rows<Companion>(r.companions, CompanionSchema as unknown as RowSchema<Companion>, CompanionWithoutMissions),
    entries: rows<Entry>(r.entries, EntrySchema),
    cleanDays: rows<CleanDay>(r.cleanDays, CleanDaySchema),
    urges: rows<Urge>(r.urges, UrgeSchema),
    journal: rows<JournalEntry>(r.journal, JournalSchema),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
  };
  if (v === 1) {
    const summaries = Object.fromEntries(obj(r.summaries).filter(([, x]) => text(x, 800))) as Record<string, string>;
    return { v: 1, settings: s.success ? (s.data as LegacySettings) : {}, habits: rows<Habit>(r.habits, HabitSchema), summaries, ...common };
  }
  const summaries = Object.fromEntries(obj(r.summaries).map(([k, w]) => [k, Object.fromEntries(obj(w).filter(([, x]) => text(x, 800)))])) as AppData["summaries"];
  // A habit whose track state is damaged is kept without it; repairTracks gives it a fresh state.
  return { v: 2, settings: s.success ? (s.data as Partial<Settings>) : {}, habits: rows<Habit>(r.habits, TrackHabitSchema, HabitSchema), summaries, ...common };
}

/**
 * v1 -> v2: per-track settings move from the person's settings onto each habit (see trackFromLegacy), flat weekly
 * summaries move under the first habit (the only one they could have been written for), and the old keys leave
 * settings. Every row keeps its id. Start dates come from each track's own companions and events.
 */
export function upgradeV1(v1: V1): Loose {
  const person = Object.fromEntries(Object.entries(v1.settings).filter(([k]) => !(PER_TRACK_KEYS as readonly string[]).includes(k))) as Partial<Settings>;
  const base: Loose = { ...v1, v: 2, settings: person, summaries: {} };
  const habits = v1.habits.map((h, i): Habit => ({ ...h, track: trackFromLegacy(v1.settings, h, i, inferStartedOn(base as AppData, h)) }));
  const primary = habits[0];
  return { ...base, habits, summaries: primary && Object.keys(v1.summaries).length ? { [primary.id]: v1.summaries } : {} };
}

/** What normalize() had to leave out: rows that failed validation, and rows whose parent row is missing. */
export interface LoadReport { invalid: number; orphaned: number }

const count = (x: unknown) => (Array.isArray(x) ? x.length : 0);

/**
 * Validates anything read from storage, a backup file or a restore, migrates v1 data, and fills in settings added
 * since it was saved. The report says how many rows were left out, so callers can keep the original instead of
 * losing it silently (store.boot keeps it in IndexedDB; importJson refuses the file). Null when it isn't app data,
 * including data from a newer version this one doesn't understand.
 */
export function normalizeWithReport(raw: unknown): { data: AppData; report: LoadReport } | null {
  const v = raw && typeof raw === "object" ? (raw as { v?: unknown }).v : undefined;
  const parsed = v === 1 ? (parseAppDataV1(raw) as V1 | null) : v === 2 ? (parseAppData(raw) as Loose | null) : null;
  const loose = parsed ?? salvage(raw);
  if (!loose) return null;
  const r = raw as Record<string, unknown>;
  const invalid = parsed ? 0 : (["companions", "habits", "entries", "cleanDays", "urges", "journal"] as const)
    .reduce((n, k) => n + count(r[k]) - count((loose as unknown as Record<string, unknown>)[k]), 0)
    + (!parsed && r.settings !== undefined && !(v === 1 ? LegacySettingsSchema : SettingsSchema).safeParse(r.settings).success ? 1 : 0);
  const up = loose.v === 1 ? upgradeV1(loose as V1) : (loose as Loose);
  // v2 settings keep unknown keys from newer versions, but never the old per-track ones: tracks own those now.
  const person = Object.fromEntries(Object.entries(up.settings).filter(([k]) => !(PER_TRACK_KEYS as readonly string[]).includes(k)));
  // Pets are always 3D now (the drawing is only the fallback), so the old style switch is dropped.
  delete person.pet3d;
  const d = repairTracks({ ...up, companions: up.companions.map(retireSpecies), settings: { ...defaultSettings(), ...person } } as AppData);
  // Rows whose parents are gone can't be shown or synced; they're left out and counted.
  const companions = new Set(d.companions.map((c) => c.id));
  const habits = d.habits.filter((h) => companions.has(h.companionId));
  const habitIds = new Set(habits.map((h) => h.id));
  const out: AppData = {
    ...d,
    habits,
    entries: d.entries.filter((e) => habitIds.has(e.habitId) && companions.has(e.companionId)),
    cleanDays: d.cleanDays.filter((c) => habitIds.has(c.habitId)),
    urges: (d.urges ?? []).filter((u) => habitIds.has(u.habitId)),
    journal: d.journal ?? [],
    summaries: Object.fromEntries(Object.entries(d.summaries).filter(([id]) => habitIds.has(id))),
  };
  const orphaned = d.habits.length - out.habits.length + d.entries.length - out.entries.length + d.cleanDays.length - out.cleanDays.length
    + (d.urges ?? []).length - out.urges.length + Object.keys(d.summaries).length - Object.keys(out.summaries).length;
  return { data: out, report: { invalid, orphaned } };
}

export const normalize = (raw: unknown): AppData | null => normalizeWithReport(raw)?.data ?? null;

/** Earlier versions used short random ids. Sync needs UUIDs, so remap once, keeping every reference intact. */
export function migrateIds(d: AppData): AppData {
  const map = new Map<string, string>();
  const fix = (id: string) => { if (UUID.test(id)) return id; if (!map.has(id)) map.set(id, uuid()); return map.get(id)!; };
  const companions = d.companions.map((c) => ({ ...c, id: fix(c.id), ...(c.trackId ? { trackId: fix(c.trackId) } : {}) }));
  if (!map.size && d.habits.every((h) => UUID.test(h.id)) && d.entries.every((e) => UUID.test(e.id))) return d;
  return {
    ...d,
    settings: d.settings.activeHabit ? { ...d.settings, activeHabit: fix(d.settings.activeHabit) } : d.settings,
    companions,
    habits: d.habits.map((h) => ({ ...h, id: fix(h.id), companionId: fix(h.companionId) })),
    entries: d.entries.map((e) => ({ ...e, id: fix(e.id), habitId: fix(e.habitId), companionId: fix(e.companionId) })),
    cleanDays: d.cleanDays.map((c) => ({ ...c, habitId: fix(c.habitId) })),
    urges: d.urges.map((u) => ({ ...u, id: fix(u.id), habitId: fix(u.habitId) })),
    summaries: Object.fromEntries(Object.entries(d.summaries).map(([id, w]) => [fix(id), w])),
  };
}
