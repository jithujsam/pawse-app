import { migrateIds, normalizeWithReport } from "./persist";
import type { AppData } from "./types";

/**
 * Restoring from a backup file. It is a merge that only ADDS: every record already on this phone stays exactly as it
 * is, and nothing is removed, so no deletion can be synced to the account and the person's other phones. It used to
 * replace everything: a smaller or older file turned every record missing from it into a deletion on every device, and
 * damaged rows in the file were dropped without a word (audit P0-3). Pure: no storage and no clock, so it can be
 * previewed before anything changes.
 *
 * The file format is unchanged (it is what exportJson writes, or an older v1 file). Not imported: settings, because a
 * backup must not change how this phone is set up. Each track's own state (plan, pauses, milestones) comes with the track.
 */

export interface Counts { tracks: number; pets: number; slips: number; goalMetDays: number; urges: number; reflections: number; summaries: number }
const zero = (): Counts => ({ tracks: 0, pets: 0, slips: 0, goalMetDays: 0, urges: 0, reflections: 0, summaries: 0 });
export const total = (c: Counts): number => Object.values(c).reduce((a, b) => a + b, 0);

/** Exactly what an import added, so it can be taken back. */
export interface AddedRows {
  companions: AppData["companions"]; habits: AppData["habits"]; entries: AppData["entries"]; cleanDays: AppData["cleanDays"];
  urges: AppData["urges"]; journal: AppData["journal"]; summaries: { h: string; week: string; text: string }[];
}

export type RefusalReason = "not_json" | "not_backup" | "newer_version" | "unfinished" | "too_many_tracks";
export interface Refused { ok: false; reason: RefusalReason; message: string }

export interface ImportPlan {
  ok: true;
  /** 1: saved before tracks, read and upgraded. 2: current. */
  version: 1 | 2;
  /** Records in the file that are new to this phone. */
  add: Counts;
  /** Already here and identical. */
  same: Counts;
  /** Already here but different: the version on this phone is kept. */
  keep: Counts;
  /** Rows the file holds that can't be used (damaged, or their track or pet is missing). Left out, and counted. */
  unreadable: number;
  /** Rows the file repeats. The first of each is used. */
  duplicates: number;
  /** The phone's data after the import. */
  next: AppData;
  added: AddedRows;
}

const refuse = (reason: RefusalReason, message: string): Refused => ({ ok: false, reason, message });

/** JSON with sorted keys, so two copies of a record compare equal whatever order their fields were written in. */
function stable(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stable).join(",")}]`;
  if (x && typeof x === "object") return `{${Object.entries(x as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(x);
}

export function planImport(text: string, current: AppData): ImportPlan | Refused {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return refuse("not_json", "That file isn't a Pawse backup."); }
  const v = raw && typeof raw === "object" ? (raw as { v?: unknown }).v : undefined;
  if (typeof v === "number" && v > 2) return refuse("newer_version", "This backup was made by a newer version of Pawse. Update the app, then try again. Nothing was changed.");
  const read = normalizeWithReport(raw);
  if (!read) return refuse("not_backup", "That file isn't a Pawse backup.");
  if (!read.data.settings.onboarded) return refuse("unfinished", "That backup is from a Pawse that was never set up, so there is nothing in it to add.");
  const file = migrateIds(read.data);

  const add = zero(), same = zero(), keep = zero();
  let duplicates = 0;
  const added: AddedRows = { companions: [], habits: [], entries: [], cleanDays: [], urges: [], journal: [], summaries: [] };

  /** The records to add from one list: not already here, not repeated in the file. Counts what is new, identical and different. */
  function merge<T>(here: T[], incoming: T[], key: (x: T) => string, kind: keyof Counts, log: T[]): T[] {
    const mine = new Map(here.map((x) => [key(x), x]));
    const seen = new Set<string>();
    const out: T[] = [];
    for (const x of incoming) {
      const k = key(x);
      if (seen.has(k)) { duplicates++; continue; }
      seen.add(k);
      const old = mine.get(k);
      if (old === undefined) { out.push(x); add[kind]++; log.push(x); } else if (stable(old) === stable(x)) same[kind]++; else keep[kind]++;
    }
    return out;
  }

  const companions = [...current.companions, ...merge(current.companions, file.companions, (c) => c.id, "pets", added.companions)];
  const habits = [...current.habits, ...merge(current.habits, file.habits, (h) => h.id, "tracks", added.habits)];
  if (habits.length > 50) return refuse("too_many_tracks", `Adding this backup would make ${habits.length} tracks, and Pawse keeps at most 50. Nothing was changed.`);
  const entries = [...current.entries, ...merge(current.entries, file.entries, (e) => e.id, "slips", added.entries)].sort((a, b) => a.createdAt - b.createdAt);
  const cleanDays = [...current.cleanDays, ...merge(current.cleanDays, file.cleanDays, (c) => `${c.habitId}|${c.day}`, "goalMetDays", added.cleanDays)];
  const urges = [...current.urges, ...merge(current.urges, file.urges, (u) => u.id, "urges", added.urges)].sort((a, b) => a.createdAt - b.createdAt);
  const journal = [...current.journal, ...merge(current.journal, file.journal, (j) => j.day, "reflections", added.journal)].sort((a, b) => a.day.localeCompare(b.day));

  const weeks = (d: AppData) => Object.entries(d.summaries).flatMap(([h, w]) => Object.entries(w).map(([week, text]) => ({ h, week, text })));
  const newWeeks = merge(weeks(current), weeks(file), (s) => `${s.h}|${s.week}`, "summaries", added.summaries);
  const summaries = { ...current.summaries };
  for (const s of newWeeks) summaries[s.h] = { ...summaries[s.h], [s.week]: s.text };

  return {
    ok: true, version: v === 1 ? 1 : 2, add, same, keep, duplicates, added,
    unreadable: read.report.invalid + read.report.orphaned,
    next: { ...current, companions, habits, entries, cleanDays, urges, journal, summaries },
  };
}

/**
 * Takes an import back: removes the rows it added, but only those still exactly as imported. A row the person has edited since
 * is theirs and stays, and so does a track or pet that has other records on it.
 */
export function withoutAdded(d: AppData, a: AddedRows): AppData {
  const unchanged = <T>(added: T[], key: (x: T) => string) => {
    const was = new Map(added.map((x) => [key(x), stable(x)]));
    return (x: T) => was.get(key(x)) === stable(x);
  };
  const slip = unchanged(a.entries, (e) => e.id), day = unchanged(a.cleanDays, (c) => `${c.habitId}|${c.day}`);
  const urge = unchanged(a.urges, (u) => u.id), note = unchanged(a.journal, (j) => j.day);
  const entries = d.entries.filter((e) => !slip(e));
  const cleanDays = d.cleanDays.filter((c) => !day(c));
  const urges = d.urges.filter((u) => !urge(u));
  const journal = d.journal.filter((j) => !note(j));
  const track = unchanged(a.habits, (h) => h.id), pet = unchanged(a.companions, (c) => c.id);
  const busy = new Set([...entries.map((e) => e.habitId), ...cleanDays.map((c) => c.habitId), ...urges.map((u) => u.habitId)]);
  const habits = d.habits.filter((h) => !(track(h) && !busy.has(h.id)));
  const used = new Set([...entries.map((e) => e.companionId), ...habits.map((h) => h.companionId)]);
  const companions = d.companions.filter((c) => !(pet(c) && !used.has(c.id)));
  const text = unchanged(a.summaries, (s) => `${s.h}|${s.week}`);
  const summaries: AppData["summaries"] = {};
  for (const [h, w] of Object.entries(d.summaries)) {
    if (!habits.some((x) => x.id === h)) continue;
    const kept = Object.fromEntries(Object.entries(w).filter(([week, t]) => !text({ h, week, text: t })));
    if (Object.keys(kept).length) summaries[h] = kept;
  }
  return { ...d, companions, habits, entries, cleanDays, urges, journal, summaries };
}

/** "2 tracks", "14 slips"...: the non-zero parts of a count, in words for the person. */
export function describeCounts(c: Counts): string[] {
  const one = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;
  const parts: [number, string, string][] = [
    [c.tracks, "track", "tracks"], [c.pets, "pet", "pets"], [c.slips, "slip", "slips"], [c.goalMetDays, "goal-met day", "goal-met days"],
    [c.urges, "urge", "urges"], [c.reflections, "reflection", "reflections"], [c.summaries, "weekly summary", "weekly summaries"],
  ];
  return parts.filter(([n]) => n > 0).map(([n, a, b]) => one(n, a, b));
}
