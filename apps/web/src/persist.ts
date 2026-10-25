import {
  CleanDaySchema, CompanionSchema, EntrySchema, HabitSchema, JournalSchema, LegacySettingsSchema, parseAppData, parseAppDataV1, SettingsSchema,
  TrackHabitSchema, UrgeSchema,
} from "@detox/schema";
import { defaultTrackState, inferStartedOn, repairTracks } from "./tracks";
import type { AppData, CleanDay, Companion, Entry, Habit, JournalEntry, Settings, TrackState, Urge } from "./types";

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
  careNotes: true, riskNudge: true, neglectFrom: null, pet3d: true, theme: "system", accent: "pet",
  petLife: "continuity", focusTrackId: null,
});

export const blank = (): AppData => ({
  v: 2, settings: defaultSettings(), companions: [], habits: [], entries: [], cleanDays: [], urges: [], journal: [], summaries: {}, updatedAt: 0,
});

/** Settings that sat in the person's settings while there was one habit (v1), and now belong to a track. */
export const PER_TRACK_KEYS = ["goal", "baseline", "plan", "restDays", "weekFocus", "celebrated", "wear", "treatsGiven", "fedOn", "savingsGoal"] as const;
type LegacySettings = Partial<Settings> & Partial<Pick<TrackState, Exclude<(typeof PER_TRACK_KEYS)[number], "goal">>> & { goal?: string };

/** The v2 shape before the track repairs in normalize(): habits may lack a state, companions an owner. */
type Loose = Omit<AppData, "settings"> & { settings: Partial<Settings> };
type V1 = Omit<Loose, "v" | "summaries" | "settings"> & { v: 1; settings: LegacySettings; summaries: Record<string, string> };

type RowSchema<T> = { safeParse: (x: unknown) => { success: boolean; data?: T } };
const rows = <T>(xs: unknown, ...schemas: RowSchema<T>[]): T[] =>
  Array.isArray(xs) ? xs.flatMap((x) => { for (const s of schemas) { const p = s.safeParse(x); if (p.success) return [p.data as T]; } return []; }) : [];
const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;

/** Keeps every row that is valid on its own, so one damaged row never costs the whole history. */
function salvage(raw: unknown): V1 | Loose | null {
  const v = raw && typeof raw === "object" ? (raw as { v?: unknown }).v : undefined;
  if (v !== 1 && v !== 2) return null;
  const r = raw as Record<string, unknown>;
  const s = (v === 1 ? LegacySettingsSchema : SettingsSchema).safeParse(r.settings);
  const obj = (x: unknown) => (x && typeof x === "object" ? Object.entries(x as Record<string, unknown>) : []);
  const common = {
    companions: rows<Companion>(r.companions, CompanionSchema),
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
 * v1 -> v2. The one habit the app showed (habits[0]) takes every per-track setting that used to be global;
 * any other habit starts with defaults, so nothing is counted twice. Flat weekly summaries move under it.
 * Every row keeps its id. Start dates come from each track's own companions and events.
 */
export function upgradeV1(v1: V1): Loose {
  const { goal, baseline, plan, restDays, weekFocus, celebrated, wear, treatsGiven, fedOn, savingsGoal, ...person } = v1.settings;
  const base: Loose = { ...v1, v: 2, settings: person, summaries: {} };
  const habits = v1.habits.map((h, i): Habit => {
    const fresh = defaultTrackState(inferStartedOn(base as AppData, h));
    if (i > 0) return { ...h, track: fresh };
    const description = goal?.trim() && goal.trim() !== h.name.trim() ? goal.trim() : "";
    return {
      ...h,
      track: {
        ...fresh, description, baseline: baseline ?? null, plan: plan ?? null, restDays: restDays ?? [], weekFocus: weekFocus ?? [],
        celebrated: celebrated ?? [], wear: wear ?? null, treatsGiven: treatsGiven ?? 0, fedOn: fedOn ?? null, savingsGoal: savingsGoal ?? null,
      },
    };
  });
  const primary = habits[0];
  return { ...base, habits, summaries: primary && Object.keys(v1.summaries).length ? { [primary.id]: v1.summaries } : {} };
}

/** Validates anything read from storage or a file, migrates v1 data, and fills in settings added since it was saved. */
export function normalize(raw: unknown): AppData | null {
  const v = raw && typeof raw === "object" ? (raw as { v?: unknown }).v : undefined;
  const parsed = v === 1 ? (parseAppDataV1(raw) as V1 | null) : v === 2 ? (parseAppData(raw) as Loose | null) : null;
  const loose = parsed ?? salvage(raw);
  if (!loose) return null;
  const up = loose.v === 1 ? upgradeV1(loose as V1) : (loose as Loose);
  const d = repairTracks({ ...up, settings: { ...defaultSettings(), ...up.settings } } as AppData);
  // Drop rows whose parents are gone.
  const companions = new Set(d.companions.map((c) => c.id));
  const habits = d.habits.filter((h) => companions.has(h.companionId));
  const habitIds = new Set(habits.map((h) => h.id));
  return {
    ...d,
    habits,
    entries: d.entries.filter((e) => habitIds.has(e.habitId) && companions.has(e.companionId)),
    cleanDays: d.cleanDays.filter((c) => habitIds.has(c.habitId)),
    urges: (d.urges ?? []).filter((u) => habitIds.has(u.habitId)),
    journal: d.journal ?? [],
    summaries: Object.fromEntries(Object.entries(d.summaries).filter(([id]) => habitIds.has(id))),
  };
}

/** Earlier versions used short random ids. Sync needs UUIDs, so remap once, keeping every reference intact. */
export function migrateIds(d: AppData): AppData {
  const map = new Map<string, string>();
  const fix = (id: string) => { if (UUID.test(id)) return id; if (!map.has(id)) map.set(id, uuid()); return map.get(id)!; };
  const companions = d.companions.map((c) => ({ ...c, id: fix(c.id), ...(c.trackId ? { trackId: fix(c.trackId) } : {}) }));
  if (!map.size && d.habits.every((h) => UUID.test(h.id)) && d.entries.every((e) => UUID.test(e.id))) return d;
  return {
    ...d,
    settings: d.settings.focusTrackId ? { ...d.settings, focusTrackId: fix(d.settings.focusTrackId) } : d.settings,
    companions,
    habits: d.habits.map((h) => ({ ...h, id: fix(h.id), companionId: fix(h.companionId) })),
    entries: d.entries.map((e) => ({ ...e, id: fix(e.id), habitId: fix(e.habitId), companionId: fix(e.companionId) })),
    cleanDays: d.cleanDays.map((c) => ({ ...c, habitId: fix(c.habitId) })),
    urges: d.urges.map((u) => ({ ...u, id: fix(u.id), habitId: fix(u.habitId) })),
    summaries: Object.fromEntries(Object.entries(d.summaries).map(([id, w]) => [fix(id), w])),
  };
}
