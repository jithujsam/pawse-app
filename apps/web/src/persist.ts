import { CleanDaySchema, CompanionSchema, EntrySchema, HabitSchema, JournalSchema, parseAppData, SettingsSchema, UrgeSchema } from "@detox/schema";
import type { AppData, Settings } from "./types";

export const uuid = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const defaultSettings = (): Settings => ({
  tone: "honest", reminder: "20:00", currency: "Rs", deathScene: true, onboarded: false, goal: "",
  baseline: null, haptics: true, remindersOn: false, coachSeen: false, celebrated: [], autoLock: "1m",
  wear: null, treatsGiven: 0, fedOn: null, careNotes: true, savingsGoal: null, riskNudge: true, neglectFrom: null, pet3d: true,
});

export const blank = (): AppData => ({
  v: 1, settings: defaultSettings(), companions: [], habits: [], entries: [], cleanDays: [], urges: [], journal: [], summaries: {}, updatedAt: 0,
});

/** Keeps every row that is valid on its own, so one damaged row never costs the whole history. */
function salvage(raw: unknown): AppData | null {
  if (!raw || typeof raw !== "object" || (raw as { v?: unknown }).v !== 1) return null;
  const r = raw as Record<string, unknown>;
  const rows = <T>(xs: unknown, schema: { safeParse: (x: unknown) => { success: boolean; data?: T } }): T[] =>
    Array.isArray(xs) ? xs.map((x) => schema.safeParse(x)).filter((p) => p.success).map((p) => p.data as T) : [];
  const s = SettingsSchema.safeParse(r.settings);
  const summaries = r.summaries && typeof r.summaries === "object"
    ? Object.fromEntries(Object.entries(r.summaries as Record<string, unknown>).filter(([, v]) => typeof v === "string" && v.length <= 800)) as Record<string, string>
    : {};
  return {
    v: 1,
    settings: { ...defaultSettings(), ...(s.success ? s.data : {}) },
    companions: rows(r.companions, CompanionSchema),
    habits: rows(r.habits, HabitSchema),
    entries: rows(r.entries, EntrySchema),
    cleanDays: rows(r.cleanDays, CleanDaySchema),
    urges: rows(r.urges, UrgeSchema),
    journal: rows(r.journal, JournalSchema),
    summaries,
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
  };
}

/** Validates anything read from storage or a file and fills in settings added since it was saved. */
export function normalize(raw: unknown): AppData | null {
  const parsed = parseAppData(raw);
  const d = parsed ? ({ ...parsed, settings: { ...defaultSettings(), ...parsed.settings } } as AppData) : salvage(raw);
  if (!d) return null;
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
  };
}

/** Earlier versions used short random ids. Sync needs UUIDs, so remap once, keeping every reference intact. */
export function migrateIds(d: AppData): AppData {
  const map = new Map<string, string>();
  const fix = (id: string) => { if (UUID.test(id)) return id; if (!map.has(id)) map.set(id, uuid()); return map.get(id)!; };
  const companions = d.companions.map((c) => ({ ...c, id: fix(c.id) }));
  if (!map.size && d.habits.every((h) => UUID.test(h.id)) && d.entries.every((e) => UUID.test(e.id))) return d;
  return {
    ...d,
    companions,
    habits: d.habits.map((h) => ({ ...h, id: fix(h.id), companionId: fix(h.companionId) })),
    entries: d.entries.map((e) => ({ ...e, id: fix(e.id), habitId: fix(e.habitId), companionId: fix(e.companionId) })),
    cleanDays: d.cleanDays.map((c) => ({ ...c, habitId: fix(c.habitId) })),
    urges: d.urges.map((u) => ({ ...u, id: fix(u.id), habitId: fix(u.habitId) })),
  };
}
